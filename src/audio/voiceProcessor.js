// Netrex mikrofon işlemcisi: LiveKit'in resmi TrackProcessor arayüzü (track.setProcessor).
//
// Zincir:  mikrofon → input → [RNNoise] → [standart filtreler] → preGate ─┬→ gate → MediaStreamDestination → LiveKit
//                                                                         └→ analyser → VAD worklet (gate'ten bağımsız)
//
// Neden setProcessor: LiveKit cihaz değişimi / yeniden başlatma sırasında processor.restart() çağırır,
// processedTrack'i sender'a kendisi bağlar ve unpublish'te temizler. Eskiden replaceTrack'i LiveKit'in
// arkasından yapıyorduk; mikrofon yeniden başlayınca zincir eski track'te kalıp sessizleşiyordu.

import { RNNOISE_WORKLET, VAD_WORKLET, ensureWorkletModule } from "./sharedAudioContext";

const CONFIG = {
  FFT_SIZE: 2048,
  VOICE_LOW_FREQ: 80,
  VOICE_HIGH_FREQ: 5000,
  SPECTRAL_SMOOTHING: 0.05,
  GATE_ATTACK: 0.005, // 5ms - hızlı açılsın
  GATE_RELEASE: 0.08, // 80ms - yumuşak kapansın (pop/click önleme)
};

// RNNoise (WASM) bir kez çöktüyse bu oturumda tekrar deneme
let rnnoiseBroken = false;

export class NetrexVoiceProcessor {
  /**
   * @param {object} opts
   * @param {() => {mode: string, advancedNoiseReduction: boolean, spectralFiltering: boolean}} opts.getSettings
   * @param {(file: string) => string} opts.resolveWorkletUrl
   * @param {(metrics: object) => boolean} opts.onMetrics  VAD metriklerini alır, konuşuyor mu döndürür (gate'i sürer)
   */
  constructor({ getSettings, resolveWorkletUrl, onMetrics }) {
    this.name = "netrex-voice-processor";
    this.processedTrack = undefined;

    this._getSettings = getSettings;
    this._resolveWorkletUrl = resolveWorkletUrl;
    this._onMetrics = onMetrics;

    this._ctx = null;
    this._track = null;
    this._source = null;
    this._destroyed = false;
    this._wireSeq = 0;

    // Sabit düğümler
    this._input = null;
    this._preGate = null;
    this._gate = null;
    this._destination = null;
    this._analyser = null;
    this._vadNode = null;
    this._silentGain = null;
    // Ayarlara göre yeniden kurulan orta zincir (RNNoise + filtreler)
    this._chain = [];
  }

  // ── LiveKit arayüzü ──────────────────────────────────────

  async init({ track, audioContext }) {
    if (!audioContext) throw new Error("NetrexVoiceProcessor: audioContext gerekli");
    this._destroyed = false;
    this._ctx = audioContext;
    this._track = track;

    const ctx = this._ctx;
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});

    this._input = ctx.createGain();
    this._preGate = ctx.createGain();
    this._gate = ctx.createGain();
    this._gate.gain.value = 1.0; // ilk kelime kırpılmasın; VAD sessizliği görünce kapatır
    this._destination = ctx.createMediaStreamDestination();

    // Gate yolu → LiveKit
    this._preGate.connect(this._gate);
    this._gate.connect(this._destination);
    this.processedTrack = this._destination.stream.getAudioTracks()[0];

    await this._buildVad();
    this._attachSource(track);
    await this._wire();
  }

  async restart({ track }) {
    if (this._destroyed || !this._ctx) return;
    this._track = track;
    this._attachSource(track);
    if (rnnoiseBroken) this._enableNativeNoiseSuppression();
  }

  async destroy() {
    this._destroyed = true;
    this._wireSeq++;
    this._disconnectAll();
    try { this.processedTrack?.stop(); } catch (e) {}
    this.processedTrack = undefined;
    this._ctx = null;
    this._track = null;
  }

  // ── Ayar değişimi (processor yeniden oluşturulmadan) ─────

  async applySettings() {
    if (this._destroyed || !this._ctx) return;
    await this._wire();
  }

  // ── İç yardımcılar ───────────────────────────────────────

  _attachSource(track) {
    if (this._source) {
      try { this._source.disconnect(); } catch (e) {}
      this._source = null;
    }
    if (!track || track.readyState === "ended") return;
    this._source = this._ctx.createMediaStreamSource(new MediaStream([track]));
    this._source.connect(this._input);
  }

  async _buildVad() {
    const ctx = this._ctx;
    this._analyser = ctx.createAnalyser();
    this._analyser.fftSize = CONFIG.FFT_SIZE;
    this._analyser.smoothingTimeConstant = CONFIG.SPECTRAL_SMOOTHING;
    this._preGate.connect(this._analyser); // gate'ten ÖNCE: gate kapalıyken de analiz sürer

    try {
      await ensureWorkletModule(ctx, this._resolveWorkletUrl(VAD_WORKLET));
    } catch (e) {
      // Worklet zaten kayıtlıysa addModule hata verebilir; düğüm oluşturmayı yine de dene
    }
    if (this._destroyed) return;
    this._vadNode = new AudioWorkletNode(ctx, "voice-processor");
    this._analyser.connect(this._vadNode);
    // Worklet'in çekilmesi için bir çıkışa bağlı olmalı; sessiz
    this._silentGain = ctx.createGain();
    this._silentGain.gain.value = 0;
    this._vadNode.connect(this._silentGain);
    this._silentGain.connect(ctx.destination);

    this._vadNode.port.onmessage = (event) => {
      if (this._destroyed || event.data?.type !== "metrics") return;
      let speaking = false;
      try {
        speaking = !!this._onMetrics(event.data);
      } catch (e) {}
      const g = this._gate?.gain;
      if (!g) return;
      const t = this._ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setTargetAtTime(speaking ? 1.0 : 0.0, t, speaking ? CONFIG.GATE_ATTACK : CONFIG.GATE_RELEASE);
    };
  }

  /** Orta zinciri (RNNoise + filtreler) mevcut ayarlara göre yeniden kurar. */
  async _wire() {
    const ctx = this._ctx;
    if (!ctx) return;
    const seq = ++this._wireSeq;
    const settings = this._getSettings();

    // RNNoise düğümünü (async) önce hazırla; kurulum sürerken başka bir _wire başladıysa bırak
    let rnnoise = null;
    if (settings.mode === "krisp" && !rnnoiseBroken) {
      rnnoise = await this._createRnnoise();
      if (seq !== this._wireSeq || this._destroyed) {
        try { rnnoise?.disconnect(); } catch (e) {}
        return;
      }
    }
    if (rnnoiseBroken) this._enableNativeNoiseSuppression();

    this._teardownChain();

    let cur = this._input;
    const add = (node) => {
      cur.connect(node);
      cur = node;
      this._chain.push(node);
    };

    if (rnnoise) add(rnnoise);
    // Teşhis: arka plan gürültüsü artarsa ilk bakılacak yer; RNNoise gerçekten zincirde mi?
    console.log(
      `🎚️ Ses zinciri: mod=${settings.mode}, RNNoise=${rnnoise ? "AKTİF" : rnnoiseBroken ? "ÇÖKTÜ (devre dışı)" : "kapalı"}`
    );

    // Standart filtreler: yalnızca RNNoise yoksa (standart mod ya da RNNoise düştüyse)
    if (!rnnoise && (settings.advancedNoiseReduction || settings.spectralFiltering)) {
      const highPass = ctx.createBiquadFilter();
      highPass.type = "highpass";
      highPass.frequency.value = CONFIG.VOICE_LOW_FREQ;
      highPass.Q.value = 0.8;
      add(highPass);

      const lowPass = ctx.createBiquadFilter();
      lowPass.type = "lowpass";
      lowPass.frequency.value = CONFIG.VOICE_HIGH_FREQ;
      lowPass.Q.value = 0.8;
      add(lowPass);

      if (settings.advancedNoiseReduction) {
        const notch = ctx.createBiquadFilter();
        notch.type = "notch";
        notch.frequency.value = 50;
        add(notch);

        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;
        add(compressor);

        add(ctx.createGain());
      }
    }

    cur.connect(this._preGate);
  }

  async _createRnnoise() {
    const ctx = this._ctx;
    try {
      await ensureWorkletModule(ctx, this._resolveWorkletUrl(RNNOISE_WORKLET));
    } catch (e) {
      // Aynı worklet daha önce kaydedilmişse sorun değil; gerçek yükleme hatası aşağıda düğüm kurulurken yakalanır
    }
    try {
      const node = new AudioWorkletNode(ctx, "NoiseSuppressorWorklet");
      // WASM derlenemezse (CSP vb.) işlemci çöker ve düğüm sessiz çıktı verir: RNNoise'suz yeniden kur
      node.onprocessorerror = (ev) => {
        console.error("❌ RNNoise işlemcisi çöktü, RNNoise olmadan devam ediliyor:", ev);
        rnnoiseBroken = true;
        if (!this._destroyed) this._wire().catch(() => {});
      };
      return node;
    } catch (e) {
      console.error("❌ RNNoise başlatılamadı:", e);
      rnnoiseBroken = true;
      return null;
    }
  }

  /** RNNoise çalışmıyorsa tarayıcının yerleşik gürültü bastırmasına düş (hiç bastırma olmamasından iyi). */
  _enableNativeNoiseSuppression() {
    try {
      this._track?.applyConstraints?.({ noiseSuppression: true }).catch(() => {});
    } catch (e) {}
  }

  _teardownChain() {
    try { this._input?.disconnect(); } catch (e) {}
    this._chain.forEach((n) => {
      try {
        n.disconnect();
        if (n.port) { n.onprocessorerror = null; n.port.close?.(); }
      } catch (e) {}
    });
    this._chain = [];
    // source → input bağlantısı korunur: disconnect yalnızca input'un çıkışlarını keser
  }

  _disconnectAll() {
    const nodes = [
      this._source, this._input, ...this._chain, this._preGate, this._gate,
      this._analyser, this._vadNode, this._silentGain, this._destination,
    ];
    nodes.forEach((n) => {
      if (!n) return;
      try {
        n.disconnect();
        if (n.port) {
          n.port.onmessage = null;
          n.port.close?.();
        }
      } catch (e) {}
    });
    this._chain = [];
    this._source = this._input = this._preGate = this._gate = null;
    this._analyser = this._vadNode = this._silentGain = this._destination = null;
  }
}
