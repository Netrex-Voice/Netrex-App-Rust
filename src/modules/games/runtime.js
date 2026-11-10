/**
 * 🎮 Netrex Games — HOST çalışma zamanı (React/LiveKit'ten bağımsız, Node'da test edilir)
 *
 * Güven sınırı: oda içindeki mesajın GÖNDERENİ LiveKit tarafından imzalı kimliktir (Netrex hesabı); bu sınıf
 * kimliğe göre yetkilendirir. Oyun durumu (gizli eller/kartlar dahil) yalnızca burada yaşar; istemcilere
 * `engine.view(state, pid)` çıktısı gider. Mesajlar boyut ve hız sınırından geçer.
 *
 * transport: { send(topic, obj, destIds|null, reliable) }  — destIds null ise tüm oda
 */
import { cleanConfig } from "./registry.js";

export const REACTIONS = ["👍", "😂", "😮", "👏", "🔥", "😢", "GG"];
export const LIMITS = { MSG_BYTES: 2048, MSGS_PER_SEC: 90, NAME: 32, WATCHERS: 30, LOBBY_IDLE_MS: 30 * 60 * 1000 };
const REALTIME_SEND_MS = 16; // 60 Hz (~12 KB/sn/oyuncu); host kendisine her tikte
const TURN_SEND_MS = 250;
const clip = (v, n) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, " ").slice(0, n) : "");

export class HostSession {
  constructor({ sid, manifest, engine, hostId, hostName, transport, now = () => Date.now(), rng = Math.random }) {
    this.sid = sid;
    this.m = manifest;
    this.engine = engine;
    this.hostId = hostId;
    this.tp = transport;
    this.now = now;
    this.rng = rng;
    this.status = "lobby"; // lobby | playing | over
    this.access = "open"; // open | invite
    this.invited = new Set();
    this.round = 0;
    this.lastReact = new Map();
    this.players = new Map(); // id → {id,name,team,bot}
    this.watchers = new Set();
    this.config = cleanConfig(manifest, {});
    this.state = null;
    this.sentAt = new Map(); // pid → {t, json}
    this.rate = new Map();
    this.botN = 0;
    this.stats = { rejected: 0, rateLimited: 0, oversize: 0 };
    this.lastActive = now();
    this.players.set(hostId, { id: hostId, name: clip(hostName, LIMITS.NAME) || "Host", team: 0, bot: false, ready: true, ...this.tokenField() });
  }

  // ───────── Lobi ─────────
  /** Piyon seçimi olan oyunlarda yeni oyuncuya ilk boş piyon (diğer oyunlarda alan eklenmez) */
  tokenField() {
    if (!this.m.tokens) return {};
    const used = new Set([...this.players.values()].map((p) => p.token));
    for (let t = 0; t < this.m.tokens; t++) if (!used.has(t)) return { token: t };
    return {};
  }

  /** Piyon seç: yalnızca lobide; kendi piyonun (host botlarınkini de) ve başkasında olmayan geçerli bir piyon */
  setToken(by, id, tok) {
    const p = this.players.get(id);
    if (!this.m.tokens || !p || this.status !== "lobby") return false;
    if (by !== id && !(by === this.hostId && p.bot)) return false;
    if (!Number.isInteger(tok) || tok < 0 || tok >= this.m.tokens) return false;
    if ([...this.players.values()].some((q) => q.id !== id && q.token === tok)) return false;
    p.token = tok;
    this.publishLobby();
    return true;
  }

  lobby() {
    return {
      sid: this.sid,
      gameId: this.m.id,
      hostId: this.hostId,
      status: this.status,
      round: this.round,
      access: this.access,
      invited: [...this.invited],
      config: this.config,
      players: [...this.players.values()],
      watchers: this.watchers.size,
      max: this.m.players.max,
    };
  }

  publishLobby(dest = null) {
    this.tp.send("gm_lobby", this.lobby(), dest, true);
  }

  join(id, name) {
    if (this.players.has(id)) return true; // yinelenen katılım: sessizce aynı kimlik
    const full = this.players.size >= this.m.players.max;
    const allowed = this.access === "open" || this.invited.has(id);
    if (this.status === "lobby" && !full && allowed) {
      const t0 = [...this.players.values()].filter((p) => p.team === 0).length;
      const t1 = this.players.size - t0;
      this.players.set(id, { id, name: clip(name, LIMITS.NAME) || "Oyuncu", team: t0 <= t1 ? 0 : 1, bot: false, ready: false, ...this.tokenField() });
      this.publishLobby();
      return true;
    }
    // Oyun başladı ya da dolu → izleyici
    if (this.watchers.size >= LIMITS.WATCHERS) return false;
    this.watchers.add(id);
    this.publishLobby();
    this.sendTo(id, true);
    return true;
  }

  leave(id) {
    this.watchers.delete(id);
    this.sentAt.delete(id);
    const p = this.players.get(id);
    if (!p) return this.publishLobby();
    if (id === this.hostId) return; // host ayrılırsa oturum dışarıdan kapatılır
    if (this.status === "playing") this.engine.playerLeft?.(this.state, id);
    this.players.delete(id);
    this.afterChange();
    this.publishLobby();
  }

  setTeam(id, team) {
    const p = this.players.get(id);
    if (!p || this.status !== "lobby" || !this.m.teams) return false;
    p.team = team === 1 ? 1 : 0;
    this.publishLobby();
    return true;
  }

  addBot(by) {
    if (by !== this.hostId || this.status !== "lobby" || !this.m.bots || this.players.size >= this.m.players.max) return false;
    const id = "@bot" + ++this.botN;
    this.players.set(id, { id, name: "Bot " + this.botN, team: this.botN % 2, bot: true, ready: true, ...this.tokenField() });
    this.publishLobby();
    return true;
  }

  removeBot(by, id) {
    if (by !== this.hostId || this.status !== "lobby" || !this.players.get(id)?.bot) return false;
    this.players.delete(id);
    this.publishLobby();
    return true;
  }

  kick(by, id) {
    if (by !== this.hostId || id === this.hostId || !this.players.has(id)) return false;
    this.leave(id);
    this.tp.send("gm_kicked", { sid: this.sid }, [id], true);
    return true;
  }

  setReady(id, v) {
    const p = this.players.get(id);
    if (!p || p.bot || this.status !== "lobby") return false;
    p.ready = id === this.hostId ? true : !!v;
    this.publishLobby();
    return true;
  }

  setAccess(by, access) {
    if (by !== this.hostId || this.status !== "lobby") return false;
    this.access = access === "invite" ? "invite" : "open";
    this.publishLobby();
    return true;
  }

  /** Davet: yalnızca host; davet edilene bildirim gider ve (davetli modunda) katılma hakkı verir */
  invite(by, ids) {
    if (by !== this.hostId || this.status !== "lobby" || !Array.isArray(ids)) return false;
    for (const id of ids.slice(0, 20)) {
      if (typeof id !== "string" || id === this.hostId || this.players.has(id)) continue;
      this.invited.add(id);
      this.tp.send("gm_invite", { sid: this.sid, gameId: this.m.id, from: this.players.get(this.hostId).name }, [id], true);
    }
    this.publishLobby();
    return true;
  }

  /** Emoji tepkisi: yalnızca oyuncu/izleyici, kişi başı saniyede 1, izinli liste */
  react(from, e) {
    if (!REACTIONS.includes(e) || (!this.players.has(from) && !this.watchers.has(from))) return false;
    const t = this.now();
    if (t - (this.lastReact.get(from) || 0) < 1000) return false;
    this.lastReact.set(from, t);
    const name = this.players.get(from)?.name || "İzleyici";
    this.tp.send("gm_react", { sid: this.sid, e, name }, this.recipients(), false);
    return true;
  }

  setConfig(by, cfg) {
    if (by !== this.hostId || this.status !== "lobby") return false;
    this.config = cleanConfig(this.m, cfg);
    this.publishLobby();
    return true;
  }

  canStart() {
    const n = this.players.size;
    if (this.m.fillBots) return n >= 1;
    return n >= this.m.players.min && n <= this.m.players.max;
  }

  start(by) {
    if (by !== this.hostId || this.status !== "lobby") return false;
    if (!this.canStart()) return false;
    if ([...this.players.values()].some((p) => !p.ready)) return false;
    if (this.m.teams) {
      const ts = [...this.players.values()].map((p) => p.team);
      if (!ts.includes(0) || !ts.includes(1)) return false;
    }
    // remote: bu istemcide değil → gerçek zamanlı oyunlarda vuruşu kendi iddiasıyla gelir
    this.state = this.engine.create({ players: [...this.players.values()].map((p) => ({ ...p, remote: p.id !== this.hostId })), config: this.config, rng: this.rng });
    this.status = "playing";
    this.round++;
    this.sentAt.clear();
    this.publishLobby();
    this.flush(true);
    return true;
  }

  /** Maç bitince aynı kadroyla lobiye dön (rövanş = start tekrar) */
  backToLobby(by) {
    if (by !== this.hostId || this.status === "lobby") return false;
    this.status = "lobby";
    this.state = null;
    this.sentAt.clear();
    this.publishLobby();
    return true;
  }

  // ───────── Oyun ─────────
  /** Rate limit: gönderici başına saniyede en fazla MSGS_PER_SEC mesaj */
  allow(from) {
    const t = Math.floor(this.now() / 1000);
    const r = this.rate.get(from);
    if (!r || r.t !== t) {
      this.rate.set(from, { t, n: 1 });
      return true;
    }
    if (++r.n > LIMITS.MSGS_PER_SEC) {
      this.stats.rateLimited++;
      return false;
    }
    return true;
  }

  input(from, m) {
    if (this.status !== "playing" || !this.players.has(from) || !this.allow(from)) return false;
    this.lastActive = this.now();
    const ok = this.engine.input(this.state, from, m);
    if (!ok) {
      this.stats.rejected++;
      if (m?.t !== "move") this.tp.send("gm_rej", { sid: this.sid, t: clip(String(m?.t), 12) }, [from], true);
      return false;
    }
    if (m.t !== "move") this.flush(true);
    return true;
  }

  tick(dt) {
    if (this.status !== "playing") return;
    this.engine.tick(this.state, dt);
    this.afterChange();
    this.flush(false);
  }

  afterChange() {
    if (this.status === "playing" && this.state && this.engine.isOver(this.state)) {
      this.status = "over";
      this.flush(true);
      this.publishLobby();
    }
  }

  recipients() {
    return [...[...this.players.values()].filter((p) => !p.bot).map((p) => p.id), ...this.watchers];
  }

  sendTo(id, force) {
    if (!this.state) return;
    const v = this.engine.view(this.state, id);
    const json = JSON.stringify(v);
    const prev = this.sentAt.get(id);
    const t = this.now();
    const gap = id === this.hostId && this.m.realtime ? 0 : this.m.realtime ? REALTIME_SEND_MS : TURN_SEND_MS;
    if (!force && prev && (t - prev.t < gap - 4 || (!this.m.realtime && prev.json === json))) return; // -8 ms: 16 ms tik ile tam 30 Hz
    this.sentAt.set(id, { t, json });
    // Gerçek zamanlı kareler kayıplı (en yeni geçerli), olaylı durumlar güvenilir kanaldan
    this.tp.send("gm_state", { sid: this.sid, v }, [id], !this.m.realtime || force || v.phase === "over");
  }

  flush(force) {
    for (const id of this.recipients()) this.sendTo(id, force);
  }

  /** Yeniden bağlanan / geç gelen için tam durum */
  resync(id) {
    this.publishLobby([id]);
    this.sentAt.delete(id);
    this.sendTo(id, true);
  }

  idle() {
    return this.now() - this.lastActive > LIMITS.LOBBY_IDLE_MS;
  }
}
