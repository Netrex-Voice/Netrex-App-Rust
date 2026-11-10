/**
 * 🏓 Masa Tenisi — 3B gerçekçi fizik (deterministik; host ve istemci tahmini AYNI kodu çalıştırır).
 *
 * Birimler: metre, saniye, kg, rad/s. Eksenler: X yan, Y yukarı, Z masa boyu. Koltuk 0: Z<0 ucu, koltuk 1: Z>0 ucu.
 * Ölçüler (ITTF): masa 2,74 × 1,525 m, yükseklik 0,76 m; file 15,25 cm (masa dışına 15,25 cm taşar); top Ø40 mm, 2,7 g.
 * Uçuş: yerçekimi + karesel hava direnci (Cd 0,4) + Magnus (ω × v): topspin dalar, backspin süzülür, yan falso kavis yapar.
 * Masa sekmesi: e = 0,88; temas noktasında Coulomb sürtünmesi (μ 0,25) → falso ile hız etkileşir (topspin ileri fırlar).
 * Vuruş ("destekli temas"): oyuncu raketi yan/yukarı sürer, ileri-geri otomatik (ayak hareketi). Çıkış hızı ve falso,
 *   raketin hız vektörü ve temas noktasından DETERMİNİSTİK hesaplanır, sonra top gerçek fizikle uçar.
 *   Misafir yalnızca raket durumunu bildirir; host sonucu aynı fonksiyonla kendisi hesaplar (hız/falso uydurulamaz).
 * Kurallar: servis önce kendi yarısına sonra rakip yarısına sekmeli (filee değip geçerse "let", tekrar); vuruştan sonra
 *   top rakip yarısına düşmeli; bir yarıda iki sekme o tarafın sayı kaybı; 11 sayı, 2 fark; her 2 sayıda servis değişir.
 */
import { clamp, fin } from "./util.js";

export const TABLE_Y = 0.76;
export const HALF_W = 0.7625;
export const HALF_L = 1.37;
export const NET_H = 0.1525;
export const NET_HALF = 0.9144;
export const R_BALL = 0.02;
const M = 0.0027;
const I = (2 / 3) * M * R_BALL * R_BALL; // ince kabuk küre
const G = 9.81;
const K_DRAG = 0.1117; // ½ρCdA/m
const K_MAG = 0.0035; // Magnus katsayısı (ω × v)
const E_TABLE = 0.9; // 30 cm düşüşte ~23 cm sekme (ITTF)
const MU_TABLE = 0.25;
const STEP = 1 / 480;
export const R_BLADE = 0.085; // raket yüzü (temas hoşgörüsüyle)
export const PAD_VMAX = 6;
const PAD_AMAX = 80;
const FOOT_V = 2.6; // ileri-geri otomatik adım hızı (m/s)
const BOT_LEVEL = { easy: 0.55, normal: 0.8, hard: 1 };
export const SPEEDS = { slow: 0.85, normal: 1, fast: 1.18 };

export const NET_EPS = 0.001;
export const NET_BIG = 0.6;
export const meta = { seats: 2 };

const sideSign = (seat) => (seat === 0 ? -1 : 1);
const sideOf = (z) => (z < 0 ? 0 : 1);
const homeZ = (seat) => sideSign(seat) * (HALF_L + 0.45);

export function bounds(s, seat) {
  return { x0: -1.05, x1: 1.05, y0: TABLE_Y - 0.06, y1: TABLE_Y + 0.75 };
}

export function create({ players, config = {}, rng = Math.random }) {
  const s = {
    t: "pingpong",
    rng,
    seats: players.slice(0, 2).map((p) => p.id),
    bots: players.slice(0, 2).map((p) => !!p.bot),
    claim: players.slice(0, 2).map((p) => !!p.remote && !p.bot),
    level: BOT_LEVEL[config.botLevel] || BOT_LEVEL.normal,
    speed: SPEEDS[config.speed] || 1,
    winBy2: config.winBy2 !== false,
    serveEvery: [1, 2, 5].includes(config.serveEvery) ? config.serveEvery : 2,
    target: clamp(Math.round(fin(config.target, 11)), 3, 21),
    score: [0, 0],
    phase: "serve", // serve | toss | rally | point | over
    timer: 0,
    server: 0,
    winner: null,
    reason: "",
    msg: "",
    time: 0,
    ball: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0 },
    pads: [0, 1].map((i) => ({ x: 0, y: TABLE_Y + 0.2, z: homeZ(i), vx: 0, vy: 0, tx: 0, ty: TABLE_Y + 0.2 })),
    lastHit: -1,
    stage: "", // serve1 | serve2 | rally
    netTouch: false,
    bounceSide: -1, // son sekme tarafı
    bounceCount: 0, // aynı tarafta art arda sekme
    canHit: [false, false],
    contact: [null, null],
    hits: 0,
    bounces: 0,
    nets: 0,
    noHit: [0, 0],
    lastClaim: [-1, -1],
    botT: 0.9,
    botSwing: [{ vx: 0, vy: 1.2 }, { vx: 0, vy: 1.2 }],
    botErr: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
    rally: 0,
    longest: 0,
  };
  holdBall(s);
  return s;
}

/** Servis bekleyişi: top servis atanın raketinin önünde */
function holdBall(s) {
  const p = s.pads[s.server];
  s.ball = { x: p.x, y: Math.max(TABLE_Y + 0.12, p.y), z: sideSign(s.server) * (HALF_L + 0.12), vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0 };
}

// ───────────────────────── Uçuş fiziği ─────────────────────────

/** Bir adım uçuş (yarı-örtük Euler): yerçekimi + direnç + Magnus + falso sönümü */
function fly(b, h) {
  const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz);
  const ax = -K_DRAG * sp * b.vx + K_MAG * (b.wy * b.vz - b.wz * b.vy);
  const ay = -G - K_DRAG * sp * b.vy + K_MAG * (b.wz * b.vx - b.wx * b.vz);
  const az = -K_DRAG * sp * b.vz + K_MAG * (b.wx * b.vy - b.wy * b.vx);
  b.vx += ax * h;
  b.vy += ay * h;
  b.vz += az * h;
  const px = b.x;
  const py = b.y;
  const pz = b.z;
  b.x += b.vx * h;
  b.y += b.vy * h;
  b.z += b.vz * h;
  const d = 1 - 0.05 * h;
  b.wx *= d;
  b.wy *= d;
  b.wz *= d;
  return { px, py, pz };
}

/** Masa üstü sekmesi (sürtünmeli). Temas noktası hızı u = v + ω × (0,−r,0) */
function tableBounce(b) {
  b.y = TABLE_Y + R_BALL;
  const vn = b.vy;
  const jn = -(1 + E_TABLE) * M * vn;
  const ux = b.vx + R_BALL * b.wz;
  const uz = b.vz - R_BALL * b.wx;
  let jx = (-ux * 2 * M) / 5;
  let jz = (-uz * 2 * M) / 5;
  const jt = Math.sqrt(jx * jx + jz * jz);
  const lim = MU_TABLE * jn;
  if (jt > lim) {
    jx *= lim / jt;
    jz *= lim / jt;
  }
  b.vx += jx / M;
  b.vy += jn / M;
  b.vz += jz / M;
  b.wx += (-R_BALL * jz) / I;
  b.wz += (R_BALL * jx) / I;
}

const onTable = (x, z) => Math.abs(x) <= HALF_W && Math.abs(z) <= HALF_L;

/**
 * Topu bir adım ilerletir; olaylar: "table" (taraf), "net", "floor". Kural uygulamaz (step/rules ayrı).
 */
function ballStep(s, h, events) {
  const b = s.ball;
  const prev = fly(b, h);
  // masa
  if (b.vy < 0 && b.y - R_BALL <= TABLE_Y && prev.py - R_BALL >= TABLE_Y - 0.02 && onTable(b.x, b.z)) {
    tableBounce(b);
    s.bounces++;
    events.push({ e: "table", side: sideOf(b.z) });
  }
  // file (z = 0 düzlemini geçiş)
  if ((prev.pz < 0) !== (b.z < 0) && Math.abs(b.x) <= NET_HALF) {
    const top = TABLE_Y + NET_H;
    if (b.y - R_BALL < top && b.y > TABLE_Y) {
      s.nets++;
      if (b.y < top - R_BALL * 0.4) {
        // file gövdesi: emer, geri düşer
        b.z = prev.pz < 0 ? -R_BALL : R_BALL;
        b.vz *= -0.12;
        b.vx *= 0.4;
        b.vy *= 0.3;
        events.push({ e: "net", hard: true });
      } else {
        // file teli: sıçrar ama geçer
        b.vz *= 0.55;
        b.vy = Math.abs(b.vy) * 0.4 + 0.5;
        events.push({ e: "net", hard: false });
      }
    }
  }
  // zemin
  if (b.y - R_BALL <= 0 && b.vy < 0) {
    b.y = R_BALL;
    b.vy = -b.vy * 0.75;
    b.vx *= 0.8;
    b.vz *= 0.8;
    events.push({ e: "floor" });
  }
}

/** Topu masaya ilk değene (ya da düşene) kadar uçur — vuruş çözücüsü ve temas tahmini için */
function flyTo(b0, maxT, until) {
  const b = { ...b0 };
  const ev = [];
  const fake = { ball: b, bounces: 0, nets: 0 };
  let t = 0;
  while (t < maxT) {
    const before = { ...b };
    ev.length = 0; // yalnızca bu adımın olayları
    ballStep(fake, STEP, ev);
    t += STEP;
    const r = until(b, ev, before, t);
    if (r) return r;
    if (b.y < 0.03) return { b, t, floor: true, ev };
  }
  return { b, t, timeout: true, ev };
}

// ───────────────────────── Vuruş modeli ─────────────────────────

/**
 * Raket temasından çıkış durumunu hesaplar (deterministik).
 * @param seat  vuran taraf
 * @param ball  temas anındaki top
 * @param pad   { x, y, z, vx, vy }
 * @param speed hız çarpanı (ayar)
 */
export function shot(seat, ball, pad, speed = 1, serve = false) {
  const dirZ = -sideSign(seat); // rakibe doğru
  const sw = Math.min(8, Math.hypot(pad.vx, pad.vy));
  const off = Math.min(1, Math.hypot(ball.x - pad.x, ball.y - pad.y) / R_BLADE);
  const q = 1 - off * off; // temas kalitesi (merkez 1)
  const p = clamp(0.22 + 0.78 * (sw / 5.5), 0.22, 1); // güç
  const inSp = Math.hypot(ball.vx, ball.vy, ball.vz);
  const offSign = Math.sign(ball.x - pad.x) || 1;

  if (serve) return serveShot(seat, ball, pad, speed, p);
  let tx;
  let tz;
  let vh;
  {
    tx = clamp(pad.x * 0.3 + pad.vx * 0.11 + (ball.x - pad.x) * 2.2, -0.68, 0.68);
    tz = dirZ * clamp(0.42 + 0.72 * p, 0.3, 1.2);
    vh = (3.1 + 9.2 * p + inSp * 0.12) * speed * (0.86 + 0.14 * q);
    // kötü temas: hedef sapar (deterministik), bazen dışarı
    tx += (1 - q) * offSign * 0.32;
    tz += dirZ * (1 - q) * 0.34;
  }
  const dx = tx - ball.x;
  const dz = tz - ball.z;
  const dl = Math.hypot(dx, dz) || 1;
  const ux = dx / dl;
  const uz = dz / dl;
  // falso: yukarı vuruş = topspin, aşağı = backspin (kesme); yana = yan falso
  const top = clamp(pad.vy * 26, -140, 160) * (serve ? 0.7 : 1);
  const side = clamp(-pad.vx * 10, -60, 60);
  // topspin ekseni = yukarı × yön
  const wx = top * uz + ball.wx * 0.12;
  const wz = -top * ux + ball.wz * 0.12;
  const wy = side;

  // Çıkış dikey hızını çöz: ilk masa teması (tx, tz) civarında olsun ve fileyi geçsin
  const land = (vy) => {
    const r = flyTo({ ...ball, vx: ux * vh, vy, vz: uz * vh, wx, wy, wz }, 2.5, (b, ev) => {
      if (ev.some((e) => e.e === "net" && e.hard)) return { net: true, b };
      if (ev.some((e) => e.e === "table")) return { b, table: true };
      return null;
    });
    if (r.net) return { d: -1, net: true };
    if (!r.table) return { d: 99 };
    return { d: (r.b.x - ball.x) * ux + (r.b.z - ball.z) * uz };
  };
  const want = dl;
  let lo = -5;
  let hi = 6;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    const r = land(mid);
    if (r.net || r.d < want) lo = mid;
    else hi = mid;
  }
  const vy = (lo + hi) / 2;
  return { x: ball.x, y: ball.y, z: ball.z + sideSign(seat) * 0.0001, vx: ux * vh, vy, vz: uz * vh, wx, wy, wz };
}

/**
 * Servis: ilk sekme kendi yarında, sonra fileyi temiz geçip rakip yarısında hedef derinliğe düşmeli.
 * Aday (ilk sekme derinliği × yatay hız) ızgarasında tam yörünge simüle edilir; en iyi geçerli aday seçilir.
 */
function serveShot(seat, ball, pad, speed, p) {
  const tx = clamp(pad.x * 0.3 + pad.vx * 0.06, -0.55, 0.55);
  const want = 0.45 + 0.65 * p; // rakip yarısında fileden uzaklık
  // istenen falso ile geçerli servis bulunamazsa falso kademeli azaltılır (oyuncu yine kurala uygun servis atar)
  for (const k of [1, 0.6, 0.3, 0]) {
    const r = serveSearch(seat, ball, tx, clamp(pad.vy * 18, -110, 110) * k, clamp(-pad.vx * 8, -45, 45) * k, speed, want);
    if (r) return r;
  }
  return { ...ball, vx: 0, vy: 2.2, vz: -sideSign(seat) * 4.2, wx: 0, wy: 0, wz: 0 };
}

function serveSearch(seat, ball, tx, top, side, speed, want) {
  const dirZ = -sideSign(seat);
  let best = null;
  for (const z1 of [1.0, 0.85, 0.7, 0.55, 0.42]) {
    for (let vh = 2.6; vh <= 7.2; vh += 0.4) {
      const v = vh * speed;
      const tz1 = -dirZ * z1;
      const dx = tx * 0.5 - ball.x;
      const dz = tz1 - ball.z;
      const dl = Math.hypot(dx, dz) || 1;
      const ux = dx / dl;
      const uz = dz / dl;
      const wx = top * uz;
      const wz = -top * ux;
      let lo = -6;
      let hi = 3;
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        const r = flyTo({ ...ball, vx: ux * v, vy: mid, vz: uz * v, wx, wy: side, wz }, 1.5, (b, ev) => (ev.some((e) => e.e === "table") ? { b } : null));
        const d = r.b && !r.floor && !r.timeout ? (r.b.x - ball.x) * ux + (r.b.z - ball.z) * uz : 99;
        if (d < dl) lo = mid;
        else hi = mid;
      }
      const init = { ...ball, vx: ux * v, vy: (lo + hi) / 2, vz: uz * v, wx, wy: side, wz };
      let n = 0;
      let first = false;
      let clear = 1;
      const r = flyTo(init, 2.2, (b, ev, before) => {
        if ((before.z < 0) !== (b.z < 0)) clear = Math.min(clear, b.y - (TABLE_Y + NET_H + R_BALL));
        if (ev.some((e) => e.e === "net")) return { bad: true };
        for (const e of ev)
          if (e.e === "table") {
            n++;
            if (n === 1) {
              if (e.side !== seat) return { bad: true };
              first = true;
            } else return { b, second: e.side };
          }
        return null;
      });
      if (!first || !r.b || r.bad || r.second !== 1 - seat || clear < 0.015) continue;
      const depth = Math.abs(r.b.z);
      if (depth > HALF_L - 0.03 || Math.abs(r.b.x) > HALF_W - 0.02) continue;
      const err = Math.abs(depth - want) + Math.abs(r.b.x - tx) * 0.5;
      if (!best || err < best.err) best = { err, init };
    }
  }
  return best ? best.init : null;
}

/** Topun bu tarafa geldiğinde vurulabileceği noktayı tahmin et (ayak hareketi ve botlar için) */
function predictContact(s, seat) {
  const sg = sideSign(seat);
  let bounced = !!s.canHit[seat]; // top bu yarıda zaten sekmiş olabilir
  const r = flyTo(s.ball, 2.6, (b, ev) => {
    if (ev.some((e) => e.e === "table" && e.side === seat)) bounced = true;
    // karşı yarıdaki sekme yalnızca benim yarımda sekmeden önce olabilir (servisin ilk sekmesi)
    if (bounced && ev.some((e) => e.e === "table" && e.side !== seat)) return { bad: true };
    if (bounced && ((b.vy < 0 && b.y <= TABLE_Y + 0.34) || b.z * sg > HALF_L + 0.95)) return { b };
    return null;
  });
  if (!r || r.bad || !r.b || !bounced || r.floor || r.timeout) return null;
  return { x: clamp(r.b.x, -1.05, 1.05), y: clamp(r.b.y, TABLE_Y + 0.02, TABLE_Y + 0.7), z: sg * clamp(Math.abs(r.b.z), HALF_L + 0.06, HALF_L + 0.95) };
}

function refreshContacts(s) {
  for (const seat of [0, 1]) s.contact[seat] = s.phase === "rally" && s.lastHit !== seat ? predictContact(s, seat) : null;
}

// ───────────────────────── Raket hareketi ─────────────────────────

export function movePad(s, seat, h, vmax = PAD_VMAX) {
  const p = s.pads[seat];
  const b = bounds(s, seat);
  const tau = 0.03;
  let dvx = (clamp(p.tx, b.x0, b.x1) - p.x) / tau;
  let dvy = (clamp(p.ty, b.y0, b.y1) - p.y) / tau;
  const ds = Math.hypot(dvx, dvy);
  if (ds > vmax) (dvx *= vmax / ds), (dvy *= vmax / ds);
  let ax = (dvx - p.vx) / h;
  let ay = (dvy - p.vy) / h;
  const as = Math.hypot(ax, ay);
  if (as > PAD_AMAX) (ax *= PAD_AMAX / as), (ay *= PAD_AMAX / as);
  p.vx += ax * h;
  p.vy += ay * h;
  p.x = clamp(p.x + p.vx * h, b.x0, b.x1);
  p.y = clamp(p.y + p.vy * h, b.y0, b.y1);
}

/** İleri-geri otomatik adım: tahmini temas derinliğine */
function footwork(s, seat, h) {
  const p = s.pads[seat];
  const c = s.contact[seat];
  const tz = c ? c.z : homeZ(seat);
  const dz = tz - p.z;
  const st = FOOT_V * h;
  p.z += Math.abs(dz) < st ? dz : Math.sign(dz) * st;
}

// ───────────────────────── Kurallar ─────────────────────────

function award(s, to, msg) {
  s.score[to]++;
  s.msg = msg;
  s.longest = Math.max(s.longest, s.rally);
  s.rally = 0;
  const [a, b] = s.score;
  const need = s.target;
  if ((a >= need || b >= need) && (!s.winBy2 || Math.abs(a - b) >= 2)) {
    s.phase = "over";
    s.winner = a > b ? 0 : 1;
    s.reason = "score";
    return;
  }
  const total = a + b;
  const deuce = s.winBy2 && a >= need - 1 && b >= need - 1;
  s.server = deuce ? total % 2 : Math.floor(total / s.serveEvery) % 2;
  s.phase = "point";
  s.timer = 1.6;
}

function rules(s, ev) {
  for (const e of ev) {
    if (s.phase !== "rally") return;
    const L = s.lastHit;
    const opp = 1 - L;
    if (e.e === "net" && s.stage !== "rally") s.netTouch = true;
    if (e.e === "table") {
      if (e.side === s.bounceSide) s.bounceCount++;
      else (s.bounceSide = e.side), (s.bounceCount = 1);
      if (s.stage === "serve1") {
        if (e.side === L) s.stage = "serve2";
        else return award(s, opp, "Servis hatası");
        continue;
      }
      if (e.side === L) return award(s, opp, "Top kendi yarına düştü");
      // rakip yarısında
      if (s.stage === "serve2" && s.netTouch) {
        // let: servis tekrar
        s.phase = "point";
        s.timer = 1.0;
        s.msg = "Let — servis tekrar";
        return;
      }
      s.stage = "rally";
      s.canHit[opp] = true;
      if (s.bounceCount >= 2) return award(s, L, "Çift sekme — sayı!");
    }
    if (e.e === "floor") {
      // rakip yarısına geçerli sekmeden sonra karşılanmadıysa vuran kazanır; değilse kaybeder
      if (s.bounceSide === opp && s.stage === "rally") return award(s, L, "Sayı!");
      return award(s, opp, s.stage === "serve1" || s.stage === "serve2" ? "Servis hatası" : "Top dışarı");
    }
  }
}

/** Raket-top teması kontrolü (düzlem geçişi) */
function paddleContacts(s, prevZ, h, onHit) {
  const b = s.ball;
  for (const seat of [0, 1]) {
    if (!s.canHit[seat] || s.claim?.[seat] || s.time < s.noHit[seat]) continue;
    const p = s.pads[seat];
    const sg = sideSign(seat);
    if (b.vz * sg <= 0) continue; // bana doğru gelmiyor
    const crossed = (prevZ - p.z) * sg <= 0 && (b.z - p.z) * sg >= 0;
    if (!crossed) continue;
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d > R_BLADE + R_BALL) continue;
    applyHit(s, seat, { ...b, z: p.z - sg * 0.001 }, p);
    if (onHit) onHit(seat);
  }
}

function applyHit(s, seat, ballAtContact, pad) {
  const serve = s.stage === "serveHit";
  s.lastContact = { seat, serve, ball: { ...ballAtContact }, pad: { x: pad.x, y: pad.y, z: pad.z, vx: pad.vx, vy: pad.vy } };
  s.ball = shot(seat, ballAtContact, pad, s.speed, serve);
  s.lastHit = seat;
  s.canHit = [false, false];
  s.bounceSide = -1;
  s.bounceCount = 0;
  s.hits++;
  s.rally++;
  if (serve) {
    s.stage = "serve1";
    s.netTouch = false;
  } else if (s.stage !== "serve1" && s.stage !== "serve2") s.stage = "rally";
  refreshContacts(s);
}

const reject = (s, why) => {
  s.claimReject = why;
  return false;
};

/**
 * Uzak oyuncunun vuruş iddiası: { px,py,pz,vx,vy,vz,wx,wy,wz (temas anı top), ax,ay,az,avx,avy (raket) }.
 * Host topun ve raketin makul olduğunu doğrular, çıkışı KENDİSİ hesaplar (aynı `shot` fonksiyonu).
 */
export function claimHit(s, seat, c) {
  if (s.phase !== "rally" || !s.canHit[seat]) return reject(s, "phase_or_lockout");
  if (s.lastClaim[seat] >= 0 && s.time - s.lastClaim[seat] < 0.15) return reject(s, "rate");
  const k = ["px", "py", "pz", "vx", "vy", "vz", "ax", "ay", "az"].map((x) => Number(c[x]));
  if (!k.every(Number.isFinite)) return reject(s, "nan");
  const [px, py, pz, vx, vy, vz, ax, ay, az] = k;
  const b = s.ball;
  if (Math.hypot(px - b.x, py - b.y, pz - b.z) > 0.18 + Math.hypot(b.vx, b.vy, b.vz) * 0.25) return reject(s, "ball_far");
  if (Math.hypot(vx - b.vx, vy - b.vy, vz - b.vz) > 4) return reject(s, "ball_vel");
  const pad = s.pads[seat];
  if (Math.hypot(ax - pad.x, ay - pad.y) > 0.15 + Math.hypot(pad.vx, pad.vy) * 0.12) return reject(s, "pad_far");
  if (Math.abs(az - pad.z) > 0.6) return reject(s, "pad_depth");
  if (Math.hypot(px - ax, py - ay) > R_BLADE + R_BALL + 0.02) return reject(s, "no_contact");
  const bd = bounds(s, seat);
  const padState = { x: clamp(ax, bd.x0, bd.x1), y: clamp(ay, bd.y0, bd.y1), z: az, vx: clamp(fin(c.avx), -PAD_VMAX, PAD_VMAX), vy: clamp(fin(c.avy), -PAD_VMAX, PAD_VMAX) };
  const ball = { x: px, y: py, z: pz, vx, vy, vz, wx: clamp(fin(c.wx), -400, 400), wy: clamp(fin(c.wy), -400, 400), wz: clamp(fin(c.wz), -400, 400) };
  Object.assign(pad, { x: padState.x, y: padState.y, z: padState.z });
  s.lastClaim[seat] = s.time;
  applyHit(s, seat, ball, padState);
  return true;
}

/** İstemci tahmini: istemcinin iddia yükü (motor bilgisinden) */
export function claimPayload(s, seat) {
  const c = s.lastContact;
  if (!c || c.seat !== seat || c.serve) return null; // servisi host kendi hesaplar
  const r = (v) => Math.round(v * 10000) / 10000;
  return { t: "hit", px: r(c.ball.x), py: r(c.ball.y), pz: r(c.ball.z), vx: r(c.ball.vx), vy: r(c.ball.vy), vz: r(c.ball.vz), wx: r(c.ball.wx), wy: r(c.ball.wy), wz: r(c.ball.wz), ax: r(c.pad.x), ay: r(c.pad.y), az: r(c.pad.z), avx: r(c.pad.vx), avy: r(c.pad.vy) };
}

// ───────────────────────── Döngü ─────────────────────────

export function input(s, pid, m) {
  if (!m || typeof m !== "object") return false;
  const seat = s.seats.indexOf(pid);
  if (seat < 0 || s.bots[seat]) return false;
  if (m.t === "move") {
    const b = bounds(s, seat);
    const p = s.pads[seat];
    p.tx = clamp(fin(m.x, p.tx), b.x0, b.x1);
    p.ty = clamp(fin(m.y, p.ty), b.y0, b.y1);
    if (s.claim?.[seat]) {
      p.x = p.tx;
      p.y = p.ty;
      p.vx = clamp(fin(m.vx), -PAD_VMAX, PAD_VMAX);
      p.vy = clamp(fin(m.vy), -PAD_VMAX, PAD_VMAX);
    }
    return true;
  }
  if (m.t === "serve" && s.phase === "serve" && seat === s.server) return toss(s);
  if (m.t === "hit") return claimHit(s, seat, m);
  return false;
}

function toss(s) {
  s.phase = "toss";
  const b = s.ball;
  b.vy = 2.4; // ~30 cm atış
  s.tossY = b.y;
  return true;
}

function botThink(s, seat, dt) {
  const p = s.pads[seat];
  const c = s.contact[seat];
  if (s.phase === "serve" || s.phase === "toss") {
    p.tx = s.server === seat ? s.ball.x : 0;
    p.ty = TABLE_Y + 0.18;
    if (s.phase === "serve" && seat === s.server) {
      s.botT -= dt;
      if (s.botT <= 0) {
        s.botT = 0.9;
        toss(s);
      }
    }
    return;
  }
  if (c && s.canHit[seat] === false && s.lastHit !== seat) {
    // gelen top: hata ve vuruş tarzı her vuruşta bir kez seçilir
    if (s.botErrHits !== s.hits) {
      s.botErrHits = s.hits;
      const e = (1 - s.level) * 0.16 + 0.015;
      s.botErr[seat] = { x: (s.rng() - 0.5) * e, y: (s.rng() - 0.5) * e };
      s.botSwing[seat] = { vx: (s.rng() - 0.5) * 2, vy: 0.6 + s.rng() * (1.2 + 1.5 * s.level) };
    }
  }
  if (c) {
    // temas noktasının biraz altında bekle, yaklaşırken yukarı/yan vuruş hareketi
    const sw = s.botSwing[seat];
    const tt = Math.abs(s.ball.z - p.z) / Math.max(0.5, Math.abs(s.ball.vz));
    const lead = clamp(tt, 0, 0.25);
    p.tx = c.x + s.botErr[seat].x - sw.vx * lead;
    p.ty = c.y + s.botErr[seat].y - sw.vy * lead;
  } else {
    p.tx = p.x * 0.9;
    p.ty = TABLE_Y + 0.22;
  }
}

/** Fizik + kurallar (host) ya da yalnızca fizik (istemci tahmini) */
function step(s, h, opts) {
  const rulesOn = opts.rules !== false;
  if (opts.movePads !== false) s.pads.forEach((_, i) => !s.claim?.[i] && movePad(s, i, h, s.bots[i] ? 3.4 * s.level + 0.8 : PAD_VMAX));
  s.pads.forEach((_, i) => footwork(s, i, h));
  s.time += h;
  if (s.phase === "toss") {
    const b = s.ball;
    const prev = fly(b, h);
    const p = s.pads[s.server];
    b.x = p.x;
    b.z = sideSign(s.server) * (HALF_L + 0.12);
    // top atış yüksekliğinden raket hizasına inince servis vuruşu
    if (b.vy < 0 && b.y <= Math.max(s.tossY, p.y + 0.02) && prev.py > b.y) {
      s.phase = "rally";
      s.stage = "serveHit";
      s.canHit = [false, false];
      const pad = { x: p.x, y: b.y, z: b.z, vx: p.vx, vy: p.vy };
      applyHit(s, s.server, { ...b }, pad);
      if (opts.onHit) opts.onHit(s.server);
    }
    return;
  }
  if (s.phase !== "rally") return;
  const prevZ = s.ball.z;
  const ev = [];
  ballStep(s, h, ev);
  if (ev.length) {
    if (rulesOn) rules(s, ev);
    else
      for (const e of ev) {
        // tahmin: kural yok ama "vurulabilir" bilgisini yerelde de güncelle
        if (e.e === "table" && s.lastHit >= 0 && e.side === 1 - s.lastHit) s.canHit[e.side] = true;
      }
    if (s.phase === "rally") refreshContacts(s);
    if (opts.onEvent) ev.forEach(opts.onEvent);
  }
  if (s.phase === "rally") paddleContacts(s, prevZ, h, opts.onHit);
}

export function simulate(s, dt, opts = {}) {
  let left = Math.min(dt, 0.1);
  while (left > 1e-9) {
    const h = Math.min(STEP, left);
    step(s, h, { ...opts, rules: false });
    left -= h;
  }
}

export function tick(s, dt) {
  if (s.phase === "over") return;
  dt = Math.min(dt, 0.1);
  s.bots.forEach((b, i) => b && botThink(s, i, dt));
  if (s.phase === "serve") {
    let left = dt;
    while (left > 1e-9) {
      const h = Math.min(STEP, left);
      s.pads.forEach((_, i) => !s.claim?.[i] && movePad(s, i, h, s.bots[i] ? 3.4 * s.level + 0.8 : PAD_VMAX));
      s.pads.forEach((_, i) => footwork(s, i, h));
      left -= h;
    }
    s.time += dt;
    holdBall(s);
    return;
  }
  if (s.phase === "point") {
    s.timer -= dt;
    let left = dt;
    while (left > 1e-9) {
      const h = Math.min(STEP, left);
      ballStep(s, h, []);
      left -= h;
    }
    s.time += dt;
    if (s.timer <= 0) {
      s.phase = "serve";
      s.msg = "";
      s.lastHit = -1;
      s.stage = "";
      s.canHit = [false, false];
      s.contact = [null, null];
      s.botT = 0.9;
      holdBall(s);
    }
    return;
  }
  let left = dt;
  while (left > 1e-9 && (s.phase === "rally" || s.phase === "toss")) {
    const h = Math.min(STEP, left);
    step(s, h, {});
    left -= h;
  }
}

export function playerLeft(s, pid) {
  const seat = s.seats.indexOf(pid);
  if (seat < 0 || s.phase === "over") return;
  s.phase = "over";
  s.winner = 1 - seat;
  s.reason = "forfeit";
}

export const isOver = (s) => s.phase === "over";

const mm = (v) => Math.round(v * 1000) / 1000;
const r1 = (v) => Math.round(v * 10) / 10;
export function view(s) {
  const b = s.ball;
  return {
    t: "pingpong",
    seats: s.seats,
    bots: s.bots,
    score: s.score,
    target: s.target,
    phase: s.phase,
    server: s.server,
    winner: s.winner,
    reason: s.reason,
    winBy2: s.winBy2,
    msg: s.msg,
    speed: s.speed,
    time: mm(s.time),
    hits: s.hits,
    bounces: s.bounces,
    nets: s.nets,
    lastHit: s.lastHit,
    stage: s.stage,
    canHit: s.canHit,
    longest: Math.max(s.longest, s.rally),
    ball: [mm(b.x), mm(b.y), mm(b.z), mm(b.vx), mm(b.vy), mm(b.vz), r1(b.wx), r1(b.wy), r1(b.wz)],
    pads: s.pads.map((p) => [mm(p.x), mm(p.y), mm(p.vx), mm(p.vy), mm(p.z)]),
  };
}

/** Tahmin: anlık görüntüden kural durumunu eşitle (top hariç) */
export function syncMeta(sim, v) {
  sim.lastHit = v.lastHit;
  sim.canHit = (v.canHit || [false, false]).slice();
  sim.stage = v.stage || "";
  sim.server = v.server;
  if (sim.phase === "rally") refreshContacts(sim);
}

export function fromView(v) {
  const [x, y, z, vx, vy, vz, wx, wy, wz] = v.ball;
  const s = {
    t: "pingpong",
    seats: v.seats,
    bots: [true, true],
    claim: [false, false],
    level: 1,
    speed: v.speed || 1,
    phase: v.phase,
    server: v.server,
    time: v.time || 0,
    ball: { x, y, z, vx, vy, vz, wx, wy, wz },
    pads: v.pads.map((p) => ({ x: p[0], y: p[1], vx: p[2] || 0, vy: p[3] || 0, z: p[4], tx: p[0], ty: p[1] })),
    lastHit: v.lastHit,
    stage: v.stage || "",
    canHit: (v.canHit || [false, false]).slice(),
    contact: [null, null],
    hits: v.hits || 0,
    bounces: v.bounces || 0,
    nets: v.nets || 0,
    noHit: [0, 0],
    bounceSide: -1,
    bounceCount: 0,
    rally: 0,
    longest: 0,
  };
  if (s.phase === "rally") refreshContacts(s);
  return s;
}
