import { TrackEvent } from "livekit-client";
import { canvasTo3D, distanceToAudio, CANVAS_CENTER } from "@/src/utils/spatialMath";

/**
 * 🎧 Uzamsal ses motoru (React'ten bağımsız)
 *
 * Her uzak katılımcı için bir "boru hattı":
 *
 *   MediaStreamSource → LowPass (mesafe matlığı) → DistanceGain (mesafe sesi) → UserGain (kişi başına ses ayarı)
 *        → Panner (HRTF, 3B konum) ──┐
 *                                     ├─► Master (sağırlaştırma) → Limiter → hoparlör (AudioContext çıkışı)
 *   (diğer katılımcılar)  ───────────┘
 *
 * Tasarım kararları:
 *  - TEK ana ses düğümü (Master): sağırlaştırma tek yerden, her kaynak için kesin çalışır.
 *  - Çıkış cihazı: AudioContext.setSinkId ile seçili hoparlöre gider (eskiden seçim yok sayılıyordu).
 *  - LiveKit'in kendi <audio> öğeleri susturulur ve `data-netrex-spatial` ile işaretlenir; başka kod
 *    (DeafenManager) bu işaretli öğeleri geri AÇMAZ → aynı ses iki kez çalmaz.
 *  - Parametre değişimleri `setTargetAtTime` ile yumuşatılır (tıkırtı/zıplama olmaz).
 *
 * Koordinat sistemi için src/utils/spatialMath.js.
 */

const SMOOTH = 0.04; // parametre yumuşatma zaman sabiti (sn)
const FADE_IN = 0.03; // yeni boru hattında sesin açılma süresi

export class SpatialEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.pipelines = new Map(); // identity -> pipeline
    this.layout = {}; // identity -> { x, y } (canvas koordinatı)
    this.volumes = {}; // identity -> 0..N
    this.deafened = false;
    this.sinkId = "default";
    this._resumeHandler = null;
    this._disposed = false;
  }

  // ──────────────────────────────────────────────────
  // AudioContext
  // ──────────────────────────────────────────────────
  ensureContext() {
    if (this._disposed) return null;
    if (this.ctx && this.ctx.state !== "closed") return this.ctx;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx({ latencyHint: "interactive" });

    // Dinleyici (sen): merkezde, -Z yönüne (ekranda YUKARI) bakar
    const listener = ctx.listener;
    if (listener.positionX) {
      listener.positionX.value = 0;
      listener.positionY.value = 0;
      listener.positionZ.value = 0;
      listener.forwardX.value = 0;
      listener.forwardY.value = 0;
      listener.forwardZ.value = -1;
      listener.upX.value = 0;
      listener.upY.value = 1;
      listener.upZ.value = 0;
    } else {
      listener.setPosition(0, 0, 0);
      listener.setOrientation(0, 0, -1, 0, 1, 0);
    }

    // Ana ses düğümü (sağırlaştırma) → hafif sınırlayıcı (yalnızca patlama/clipping önler)
    const master = ctx.createGain();
    master.gain.value = this.deafened ? 0 : 1;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -3;
    compressor.knee.value = 30;
    compressor.ratio.value = 1.5;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    master.connect(compressor);
    compressor.connect(ctx.destination);

    this.ctx = ctx;
    this.master = master;
    this.compressor = compressor;

    this._applySink();
    this._installResumeHooks();
    return ctx;
  }

  // Tarayıcılar kullanıcı etkileşimi olmadan AudioContext'i askıya alır; ilk etkileşimde/sekme dönünce devam ettir
  _installResumeHooks() {
    if (this._resumeHandler) return;
    this._resumeHandler = () => {
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    };
    ["pointerdown", "keydown", "touchend"].forEach((evt) =>
      window.addEventListener(evt, this._resumeHandler, { passive: true }),
    );
    document.addEventListener("visibilitychange", this._resumeHandler);
    this._resumeHandler(); // zaten izin varsa hemen başlat
  }

  _removeResumeHooks() {
    if (!this._resumeHandler) return;
    ["pointerdown", "keydown", "touchend"].forEach((evt) =>
      window.removeEventListener(evt, this._resumeHandler),
    );
    document.removeEventListener("visibilitychange", this._resumeHandler);
    this._resumeHandler = null;
  }

  // ──────────────────────────────────────────────────
  // Çıkış cihazı
  // ──────────────────────────────────────────────────
  setSink(sinkId) {
    this.sinkId = sinkId || "default";
    this._applySink();
  }

  _applySink() {
    const ctx = this.ctx;
    if (!ctx || typeof ctx.setSinkId !== "function") return; // desteklemeyen tarayıcıda varsayılan cihaz
    const id = this.sinkId === "default" ? "" : this.sinkId;
    ctx.setSinkId(id).catch((e) => {
      console.warn("Uzamsal ses çıkış cihazı ayarlanamadı:", e?.message || e);
    });
  }

  // ──────────────────────────────────────────────────
  // Durum (yerleşim, ses seviyeleri, sağırlaştırma)
  // ──────────────────────────────────────────────────
  setState({ layout, volumes, deafened }) {
    if (this._disposed) return;
    if (layout) this.layout = layout;
    if (volumes) this.volumes = volumes;
    if (typeof deafened === "boolean") this.deafened = deafened;

    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(this.deafened ? 0 : 1, this.ctx.currentTime, 0.02);
    }
    this.pipelines.forEach((p) => this._applyOne(p, false));
  }

  // ──────────────────────────────────────────────────
  // Ses akışlarıyla uzlaştırma
  // ──────────────────────────────────────────────────
  /**
   * @param {Map<string, import('livekit-client').RemoteAudioTrack>} tracks  identity → mikrofon track'i
   */
  sync(tracks) {
    if (this._disposed) return;
    if (!this.ensureContext()) return;

    for (const [identity, track] of tracks) {
      const existing = this.pipelines.get(identity);
      const trackId = track.mediaStreamTrack?.id || null;
      // Aynı track + aynı ses akışı ise dokunma. Değiştiyse (yeniden abone olma, mikrofon yeniden yayını) baştan kur.
      if (existing && existing.track === track && existing.trackId === trackId) continue;
      if (existing) this._destroy(identity);
      this._create(identity, track);
    }

    for (const identity of [...this.pipelines.keys()]) {
      if (!tracks.has(identity)) this._destroy(identity);
    }
  }

  _create(identity, track) {
    const ctx = this.ctx;
    try {
      const stream =
        track.mediaStream || (track.mediaStreamTrack ? new MediaStream([track.mediaStreamTrack]) : null);
      if (!stream) return;

      const source = ctx.createMediaStreamSource(stream);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 20000;
      filter.Q.value = 0.5;

      const distGain = ctx.createGain();
      const userGain = ctx.createGain();
      userGain.gain.value = 0; // yumuşak açılış için sıfırdan başlar

      const panner = ctx.createPanner();
      panner.panningModel = "HRTF"; // gerçek 3B konumlama (kulaklıkta ön/arka, sol/sağ ayrımı)
      panner.distanceModel = "inverse";
      panner.refDistance = 1;
      panner.maxDistance = 20;
      panner.rolloffFactor = 0; // mesafe kısmayı kendi eğrimiz (distGain) yönetiyor
      panner.coneInnerAngle = 360;
      panner.coneOuterAngle = 360;
      panner.coneOuterGain = 0;

      source.connect(filter);
      filter.connect(distGain);
      distGain.connect(userGain);
      userGain.connect(panner);
      panner.connect(this.master);

      const p = {
        identity,
        track,
        trackId: track.mediaStreamTrack?.id || null,
        source,
        filter,
        distGain,
        userGain,
        panner,
        elements: new Set(),
        onAttach: null,
      };

      // LiveKit <audio> öğeleri: aynı ses ikinci kez çalmasın diye sustur (geç eklenenler dahil)
      p.onAttach = (el) => this._claimElement(p, el);
      track.on(TrackEvent.ElementAttached, p.onAttach);
      (track.attachedElements || []).forEach((el) => this._claimElement(p, el));

      this.pipelines.set(identity, p);
      this._applyOne(p, true);
    } catch (error) {
      console.warn(`⚠️ Uzamsal ses boru hattı kurulamadı (${identity}):`, error);
    }
  }

  _destroy(identity) {
    const p = this.pipelines.get(identity);
    if (!p) return;

    try { p.track.off(TrackEvent.ElementAttached, p.onAttach); } catch (e) {}
    [p.source, p.filter, p.distGain, p.userGain, p.panner].forEach((n) => {
      try { n.disconnect(); } catch (e) {}
    });
    p.elements.forEach((el) => this._releaseElement(el));
    p.elements.clear();
    this.pipelines.delete(identity);
  }

  _claimElement(p, el) {
    if (!el || el.tagName !== "AUDIO") return;
    p.elements.add(el);
    el.dataset.netrexSpatial = "1"; // başkaları bu öğeyi açmasın
    el.muted = true;
  }

  _releaseElement(el) {
    try {
      delete el.dataset.netrexSpatial;
      // Sağırlaştırma sürüyorsa kapalı kalsın; değilse normal çalmaya dön
      el.muted = this.deafened;
    } catch (e) {}
  }

  // ──────────────────────────────────────────────────
  // Parametreleri uygula
  // ──────────────────────────────────────────────────
  _applyOne(p, fadeIn) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;

    // Konum: kayıtlı/varsayılan yerleşim; bilinmiyorsa merkezin biraz önü (merkez = dinleyicinin içi, yön duyulmaz)
    const pos = this.layout[p.identity] || { x: CANVAS_CENTER.x, y: CANVAS_CENTER.y - 120 };
    const { audioX, audioY, audioZ, normalized } = canvasTo3D(pos.x, pos.y);
    const { spatialGain, filterFrequency } = distanceToAudio(normalized);

    // İlk kurulumda parametreler doğrudan konumuna konur (merkezden kayarak gelmesin); sonrası yumuşak geçiş
    const to = (param, value) => {
      if (fadeIn) param.setValueAtTime(value, t);
      else param.setTargetAtTime(value, t, SMOOTH);
    };

    if (p.panner.positionX) {
      to(p.panner.positionX, audioX);
      to(p.panner.positionY, audioY);
      to(p.panner.positionZ, audioZ);
    } else {
      p.panner.setPosition(audioX, audioY, audioZ); // eski tarayıcı API'si
    }
    to(p.distGain.gain, spatialGain);
    to(p.filter.frequency, Math.max(2000, filterFrequency));

    const volume = Math.max(0, this.volumes[p.identity] ?? 1);
    if (fadeIn) {
      p.userGain.gain.setValueAtTime(0, t);
      p.userGain.gain.setTargetAtTime(volume, t, FADE_IN);
    } else {
      p.userGain.gain.setTargetAtTime(volume, t, SMOOTH);
    }
  }

  // ──────────────────────────────────────────────────
  // Kapat
  // ──────────────────────────────────────────────────
  dispose() {
    if (this._disposed) return;
    for (const identity of [...this.pipelines.keys()]) this._destroy(identity);
    this._removeResumeHooks();
    this._disposed = true;

    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    if (ctx && ctx.state !== "closed") ctx.close().catch(() => {});
  }
}
