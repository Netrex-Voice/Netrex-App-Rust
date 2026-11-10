/**
 * 🔌 Netrex Games — doğrudan (P2P) WebRTC taşıyıcısı
 *
 * Neden: oyun mesajları LiveKit SFU üzerinden gidince her mesaj bulut sunucusuna uğrayıp geri dönüyor (host ↔ misafir
 * arası RTT'ye bir sunucu turu daha biniyor). Burada host ile misafir arasında doğrudan RTCDataChannel açılır:
 *   • rt  — sırasız, yeniden gönderimsiz (maxRetransmits: 0): 60 Hz anlık görüntü, hareket, ping. Kayıp paket beklenmez.
 *   • rel — sıralı, güvenilir: vuruş iddiası, komutlar, olaylı durumlar.
 * Sinyalleşme (offer/answer/ICE) mevcut LiveKit veri kanalından (`gm_sig`) gider; gönderen kimliği LiveKit'in imzaladığı
 * Netrex kimliğidir, dolayısıyla bir P2P bağlantısı yalnızca sinyalleşmeyi yapan kimliğe bağlanır.
 * Kurulamazsa (NAT/güvenlik duvarı) ya da bağlantı düşerse mesajlar otomatik LiveKit'ten gider: oyun kesilmez.
 *
 * Gizlilik: P2P'de karşı taraf IP adresinizi görür (LiveKit üzerinden görmez). Ayarlardan kapatılabilir.
 * Saf JS: PeerLink tarayıcı API'sine, LinkRouter yalnızca enjekte edilen fonksiyonlara bağlıdır (Node'da test edilir).
 */

export const SIG_TOPIC = "gm_sig";
const MAX_FRAME = 16000; // karakter
const OPEN_TIMEOUT_MS = 8000;
const RETRY_MS = 20000;
const MAX_LINKS = 16;
const MAX_BUFFER = 64 * 1024; // rt kanalında bu kadar birikmişse eski kareyi at

export function defaultIceServers() {
  const servers = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  // İsteğe bağlı TURN (simetrik NAT'ler için); yoksa bu eşler LiveKit'e döner
  const url = process.env.NEXT_PUBLIC_GAMES_TURN_URL;
  if (url) {
    servers.push({ urls: url.split(",").map((u) => u.trim()), username: process.env.NEXT_PUBLIC_GAMES_TURN_USER || "", credential: process.env.NEXT_PUBLIC_GAMES_TURN_CRED || "" });
  }
  return servers;
}

export class PeerLink {
  /**
   * @param signal   (kind, data) → LiveKit üzerinden karşı tarafa sinyal gönderir
   * @param onMessage(topic, obj, peerId, size)
   * @param onState  ("open" | "failed" | "closed")
   */
  constructor({ peerId, initiator, signal, onMessage, onState, iceServers = defaultIceServers(), RTC = globalThis.RTCPeerConnection }) {
    this.peerId = peerId;
    this.state = "connecting";
    this.signal = signal;
    this.onMessage = onMessage;
    this.onState = onState;
    this.queued = [];
    const pc = (this.pc = new RTC({ iceServers }));
    // negotiated: iki taraf da aynı id ile kendi kanalını açar (ondatachannel beklemeye gerek yok)
    this.rel = pc.createDataChannel("rel", { negotiated: true, id: 0, ordered: true });
    this.rt = pc.createDataChannel("rt", { negotiated: true, id: 1, ordered: false, maxRetransmits: 0 });
    for (const ch of [this.rel, this.rt]) {
      ch.onmessage = (e) => this._recv(e.data);
      ch.onopen = () => this._check();
      ch.onclose = () => this._check();
    }
    pc.onicecandidate = (e) => e.candidate && this.signal("ice", e.candidate.toJSON ? e.candidate.toJSON() : e.candidate);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") this._fail();
    };
    this.timer = setTimeout(() => this.state === "connecting" && this._fail(), OPEN_TIMEOUT_MS);
    if (initiator) this._offer().catch(() => this._fail());
  }

  get open() {
    return this.state === "open";
  }

  async _offer() {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.signal("offer", this.pc.localDescription.toJSON ? this.pc.localDescription.toJSON() : this.pc.localDescription);
  }

  async signalIn(kind, d) {
    if (this.state === "failed" || this.state === "closed") return;
    try {
      if (kind === "offer") {
        await this.pc.setRemoteDescription(d);
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.signal("answer", this.pc.localDescription.toJSON ? this.pc.localDescription.toJSON() : this.pc.localDescription);
        await this._flushIce();
      } else if (kind === "answer") {
        await this.pc.setRemoteDescription(d);
        await this._flushIce();
      } else if (kind === "ice") {
        if (this.pc.remoteDescription) await this.pc.addIceCandidate(d);
        else this.queued.push(d);
      }
    } catch (e) {
      this._fail();
    }
  }

  async _flushIce() {
    const q = this.queued;
    this.queued = [];
    for (const c of q) await this.pc.addIceCandidate(c).catch(() => {});
  }

  _check() {
    if (this.state === "connecting" && this.rel.readyState === "open" && this.rt.readyState === "open") {
      clearTimeout(this.timer);
      this.state = "open";
      this.onState?.("open");
    } else if (this.state === "open" && (this.rel.readyState !== "open" || this.rt.readyState !== "open")) this._fail();
  }

  _fail() {
    if (this.state === "failed" || this.state === "closed") return;
    this.state = "failed";
    this.onState?.("failed");
    this._teardown();
  }

  _teardown() {
    clearTimeout(this.timer);
    try {
      this.rel.onmessage = this.rt.onmessage = null;
      this.pc.close();
    } catch (e) {}
  }

  _recv(data) {
    if (typeof data !== "string" || data.length > MAX_FRAME) return;
    let m;
    try {
      m = JSON.parse(data);
    } catch (e) {
      return;
    }
    if (!Array.isArray(m) || typeof m[0] !== "string" || !m[1] || typeof m[1] !== "object") return;
    this.onMessage(m[0], m[1], this.peerId, data.length);
  }

  /** @returns {boolean} gönderildi mi (false → çağıran LiveKit'e döner) */
  send(topic, obj, reliable) {
    if (this.state !== "open") return false;
    const ch = reliable ? this.rel : this.rt;
    if (ch.readyState !== "open") return false;
    const s = JSON.stringify([topic, obj]);
    if (s.length > MAX_FRAME) return false;
    if (!reliable && ch.bufferedAmount > MAX_BUFFER) return true; // tıkalı: bayat kareyi düşür
    try {
      ch.send(s);
      return true;
    } catch (e) {
      return false;
    }
  }

  close() {
    if (this.state === "closed") return;
    const was = this.state;
    this.state = "closed";
    this._teardown();
    if (was === "open") this.onState?.("closed");
  }
}

/**
 * Hedefli mesajları P2P'den, olmayanları (ve yayınları) LiveKit'ten yollar; bağlantıları yönetir.
 * relay(topic, obj, destIds|null, reliable) — LiveKit gönderimi. makeLink(opts) → PeerLink benzeri.
 */
export class LinkRouter {
  constructor({ relay, makeLink, now = () => Date.now() }) {
    this.relay = relay;
    this.makeLink = makeLink;
    this.now = now;
    this.enabled = true;
    this.links = new Map();
    this.retryAt = new Map();
    this.stats = { p2p: 0, relay: 0 };
  }

  setEnabled(v) {
    this.enabled = !!v;
    if (!v) this.closeAll();
  }

  /** Bu kimlikle şu an doğrudan hat var mı? */
  isDirect(id) {
    return !!this.links.get(id)?.open;
  }

  /** Bağlantıyı (yoksa) başlat; başlatan taraf offer üretir */
  connect(peerId, initiator) {
    if (!this.enabled) return null;
    const cur = this.links.get(peerId);
    if (cur && cur.state !== "failed" && cur.state !== "closed") return cur;
    if ((this.retryAt.get(peerId) || 0) > this.now() || this.links.size >= MAX_LINKS) return null;
    let link = null;
    link = this.makeLink({
      peerId,
      initiator,
      onState: (st) => {
        if (st === "failed") {
          this.retryAt.set(peerId, this.now() + RETRY_MS);
          if (this.links.get(peerId) === link) this.links.delete(peerId);
        }
        this.onChange?.(peerId, st);
      },
    });
    this.links.set(peerId, link);
    return link;
  }

  /** LiveKit'ten gelen sinyal (kimlik = imzalı gönderen) */
  signal(from, kind, d) {
    if (!this.enabled) return;
    if (kind === "bye") return this.drop(from);
    if (kind === "offer") {
      this.drop(from); // karşı taraf yeniden deniyor: eskisini bırak
      this.retryAt.delete(from);
      this.connect(from, false)?.signalIn("offer", d);
    } else if (kind === "answer" || kind === "ice") this.links.get(from)?.signalIn(kind, d);
  }

  drop(id) {
    const l = this.links.get(id);
    this.links.delete(id);
    l?.close();
  }

  closeAll() {
    for (const id of [...this.links.keys()]) this.drop(id);
  }

  /** dest yoksa yayın (LiveKit); varsa her hedef için P2P → olmazsa LiveKit */
  send(topic, obj, dest, reliable = true) {
    if (!dest) {
      this.stats.relay++;
      return this.relay(topic, obj, null, reliable);
    }
    const rest = [];
    for (const id of dest) {
      const l = this.enabled ? this.links.get(id) : null;
      if (l?.open && l.send(topic, obj, reliable)) this.stats.p2p++;
      else rest.push(id);
    }
    if (rest.length) {
      this.stats.relay++;
      this.relay(topic, obj, rest, reliable);
    }
  }
}
