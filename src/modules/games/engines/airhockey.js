/**
 * 🏒 Air Hockey — gerçek ölçülü, deterministik fizik (host'ta ve istemci tahmininde AYNI kod).
 *
 * Birimler: metre, saniye, kg, rad. Masa düzlemi: x = uzunluk (koltuk 0: x<0 ucu), y = genişlik.
 * Model:
 *  • Disk: Ø 82,5 mm, 25 g, ince disk (I = ½·m·r²). Hava yastığı: çok küçük doğrusal + sabit yavaşlama.
 *  • Raylar: yuvarlatılmış köşeli dikdörtgen (köşe yarıçapı 10 cm). Çarpışma: normal yönde geri sekme katsayısı e,
 *    teğet yönde Coulomb sürtünmesi (μ) ile itme → disk döner (spin); dönen disk raydan farklı açıyla seker.
 *  • Raket: Ø 96 mm, el ile sürülen (sonsuz kütle kabulü), hız ≤ 7 m/s, ivme ≤ 120 m/s².
 *  • Kale ağzı: kısa kenarda ray boşluğu; ağız uçlarında ray köşeleri (direk) var.
 * Gol ve skor YALNIZCA host'ta (`tick`). Uzak oyuncu vuruşu `hit` iddiası ile gelir ve `claimHit` doğrular.
 */
import { clamp, fin } from "./util.js";

// ───────── Gerçek ölçüler ─────────
export const L = 2.0; // oyun alanı uzunluğu (m)
export const WD = 1.0; // genişlik (m)
export const CORNER = 0.1; // ray köşe yarıçapı
export const R_PUCK = 0.04125;
export const M_PUCK = 0.025;
export const R_PAD = 0.048;
export const GOAL = 0.25;
export const POST_R = 0.006;
export const MAX_PUCK = 15; // m/s (sınır, gerçek sert atışlar ~12–15)
export const PAD_VMAX = 7;
export const PAD_AMAX = 120;
const BOT_VMAX = 4.2; // botlar insandan yavaş: zor bot bile yenilebilir
const E_RAIL = 0.8;
const MU_RAIL = 0.22;
const E_PAD = 0.72;
const MU_PAD = 0.18;
const STEP = 1 / 480; // 15 m/s disk adımda 3,1 cm < disk+raket yarıçapı → tünelleme yok
const I_PUCK = 0.5 * M_PUCK * R_PUCK * R_PUCK;

export const GOAL_SIZES = { small: 0.2, normal: 0.25, large: 0.32 };
export const PAD_SIZES = { small: 0.042, normal: 0.048, large: 0.056 };
export const PUCK_SPEEDS = { slow: 11, normal: 15, fast: 19 };
const BOT_LEVEL = { easy: 0.55, normal: 0.8, hard: 1 };

// Ağ tahmini eşikleri (metre): bu altındaki fark yok sayılır / bu üstü ışınlanma kabul edilir
export const NET_EPS = 0.001;
export const NET_BIG = 0.45;

export const meta = { seats: 2 };

export function create({ players, config = {}, rng = Math.random }) {
  return {
    t: "airhockey",
    rng,
    seats: players.slice(0, 2).map((p) => p.id),
    bots: players.slice(0, 2).map((p) => !!p.bot),
    // Uzak insan oyuncunun vuruşları yalnızca kendi `hit` iddiasından gelir
    claim: players.slice(0, 2).map((p) => !!p.remote && !p.bot),
    level: BOT_LEVEL[config.botLevel] || BOT_LEVEL.normal,
    goal: GOAL_SIZES[config.goal] || GOAL,
    padR: PAD_SIZES[config.padSize] || R_PAD,
    maxPuck: PUCK_SPEEDS[config.puckSpeed] || MAX_PUCK,
    score: [0, 0],
    target: clamp(Math.round(fin(config.target, 7)), 1, 15),
    phase: "countdown", // countdown | play | goal | over
    timer: 3,
    winner: null,
    reason: "",
    time: 0,
    puck: { x: 0, y: 0, vx: 0, vy: 0, w: 0 },
    pads: [
      { x: -L / 2 + 0.18, y: 0, vx: 0, vy: 0, tx: -L / 2 + 0.18, ty: 0 },
      { x: L / 2 - 0.18, y: 0, vx: 0, vy: 0, tx: L / 2 - 0.18, ty: 0 },
    ],
    hits: 0,
    lastHitSeat: -1,
    noHit: [0, 0],
    lastClaim: [-1, -1],
    side: 0,
    sideTime: 0,
    aim: 0,
    aimHits: -1,
    lastScorer: -1,
    shots: [0, 0],
    topSpeed: 0,
    rail: 0, // ray çarpma sayacı (ses/efekt için)
  };
}

/** Raketin gidebileceği alan */
export function bounds(s, seat) {
  const r = s.padR;
  return seat === 0 ? { x0: -L / 2 + r, x1: -r, y0: -WD / 2 + r, y1: WD / 2 - r } : { x0: r, x1: L / 2 - r, y0: -WD / 2 + r, y1: WD / 2 - r };
}

function resetPuck(s, toSeat) {
  s.puck = { x: toSeat === 0 ? -0.35 : 0.35, y: 0, vx: 0, vy: 0, w: 0 };
}

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
      // Uzak oyuncunun raketi kendi ekranındaki konumdur: fizikle sürülmez, doğrudan konur (hız mesajdan)
      p.vx = clamp(fin(m.vx), -PAD_VMAX, PAD_VMAX);
      p.vy = clamp(fin(m.vy), -PAD_VMAX, PAD_VMAX);
      p.x = p.tx;
      p.y = p.ty;
    }
    return true;
  }
  if (m.t === "hit") return claimHit(s, seat, m);
  return false;
}

const reject = (s, why) => {
  s.claimReject = why;
  return false;
};

/**
 * Vuruş iddiası doğrulaması (host). Kabul koşulları (metre):
 *  oyun sürüyor · iddialar arası ≥ 80 ms · raket kendi alanında ve host kopyasına ≤ 25 cm
 *  · disk host'taki diske ≤ 15 cm + hız × 0,25 sn · disk raketle temas halinde
 *  · yeni hız sınır içinde ve raketten dışarı · spin ≤ 250 rad/s
 */
export function claimHit(s, seat, c) {
  if (s.phase !== "play") return reject(s, "phase");
  if (s.lastClaim[seat] >= 0 && s.time - s.lastClaim[seat] < 0.08) return reject(s, "rate");
  const v = ["px", "py", "vx", "vy", "ax", "ay"].map((k) => Number(c[k]));
  if (!v.every(Number.isFinite)) return reject(s, "nan");
  const [px, py, vx, vy, ax, ay] = v;
  const w = clamp(fin(c.w), -250, 250);
  const avx = clamp(fin(c.avx), -PAD_VMAX, PAD_VMAX);
  const avy = clamp(fin(c.avy), -PAD_VMAX, PAD_VMAX);
  const b = bounds(s, seat);
  if (ax < b.x0 - 0.005 || ax > b.x1 + 0.005 || ay < b.y0 - 0.005 || ay > b.y1 + 0.005) return reject(s, "pad_bounds");
  const pad = s.pads[seat];
  // son hareket mesajı ≤ ~50 ms eski olabilir: raket hızı kadar pay
  if (Math.hypot(ax - pad.x, ay - pad.y) > 0.12 + Math.hypot(pad.vx, pad.vy) * 0.12) return reject(s, "pad_far");
  const k = s.puck;
  if (Math.hypot(px - k.x, py - k.y) > 0.15 + Math.hypot(k.vx, k.vy) * 0.25) return reject(s, "puck_far");
  const dx = px - ax;
  const dy = py - ay;
  const d = Math.hypot(dx, dy);
  if (d > R_PUCK + s.padR + 0.03 || d < 0.005) return reject(s, "no_contact");
  if (Math.hypot(vx, vy) > s.maxPuck * 1.02 + 0.01) return reject(s, "too_fast");
  if (vx * dx + vy * dy <= 0 && (vx - avx) * dx + (vy - avy) * dy < -d * 0.05) return reject(s, "wrong_dir");
  s.puck = { x: px, y: py, vx, vy, w };
  pad.x = ax;
  pad.y = ay;
  s.lastClaim[seat] = s.time;
  s.noHit[seat] = s.time + 0.15;
  registerHit(s, seat);
  return true;
}

function registerHit(s, seat) {
  s.hits++;
  s.lastHitSeat = seat;
  s.shots[seat]++;
}

/** El hareketi: hedefe hız (≤ vmax) ve ivme (≤ PAD_AMAX) sınırıyla; alan dışına çıkamaz */
export function movePad(s, seat, h, vmax = PAD_VMAX) {
  const p = s.pads[seat];
  const b = bounds(s, seat);
  const tau = 0.025; // hedefe yaklaşma zaman sabiti
  let dvx = (clamp(p.tx, b.x0, b.x1) - p.x) / tau;
  let dvy = (clamp(p.ty, b.y0, b.y1) - p.y) / tau;
  const ds = Math.hypot(dvx, dvy);
  if (ds > vmax) {
    dvx *= vmax / ds;
    dvy *= vmax / ds;
  }
  let ax = (dvx - p.vx) / h;
  let ay = (dvy - p.vy) / h;
  const as = Math.hypot(ax, ay);
  if (as > PAD_AMAX) {
    ax *= PAD_AMAX / as;
    ay *= PAD_AMAX / as;
  }
  p.vx += ax * h;
  p.vy += ay * h;
  p.x += p.vx * h;
  p.y += p.vy * h;
  if (p.x < b.x0 || p.x > b.x1) (p.x = clamp(p.x, b.x0, b.x1)), (p.vx = 0);
  if (p.y < b.y0 || p.y > b.y1) (p.y = clamp(p.y, b.y0, b.y1)), (p.vy = 0);
}

/**
 * Darbe çözümü (disk ↔ sabit/kinematik yüzey). n: yüzeyden diske birim normal, pen: girme,
 * (sx, sy): yüzey hızı. Normal: geri sekme; teğet: Coulomb sürtünmesi (spin üretir/tüketir).
 * Döndürür: normal darbe büyüklüğü (0 = ayrılıyor)
 */
function impulse(k, nx, ny, pen, e, mu, sx = 0, sy = 0) {
  k.x += nx * pen;
  k.y += ny * pen;
  const ux = k.vx - sx;
  const uy = k.vy - sy;
  const vn = ux * nx + uy * ny;
  if (vn >= 0) return 0;
  const jn = -(1 + e) * vn * M_PUCK;
  const tx = -ny;
  const ty = nx;
  const ut = ux * tx + uy * ty - k.w * R_PUCK; // temas noktasının teğet hızı
  let jt = (-ut * M_PUCK) / 3; // kaymayı sıfırlayacak darbe (1/m + r²/I = 3/m)
  const lim = mu * jn;
  if (jt > lim) jt = lim;
  else if (jt < -lim) jt = -lim;
  k.vx += (jn * nx + jt * tx) / M_PUCK;
  k.vy += (jn * ny + jt * ty) / M_PUCK;
  k.w += (-R_PUCK * jt) / I_PUCK;
  return jn;
}

/** Raylar: yuvarlatılmış dikdörtgen + kale ağzı boşlukları + ağız köşeleri */
function rails(s, k) {
  const A = L / 2 - R_PUCK;
  const B = WD / 2 - R_PUCK;
  const rc = CORNER - R_PUCK;
  const ax = Math.abs(k.x);
  const ay = Math.abs(k.y);
  let hit = 0;
  if (ax > A - rc && ay > B - rc) {
    const cx = Math.sign(k.x) * (A - rc);
    const cy = Math.sign(k.y) * (B - rc);
    const dx = k.x - cx;
    const dy = k.y - cy;
    const d = Math.hypot(dx, dy);
    if (d > rc) hit += impulse(k, -dx / d, -dy / d, d - rc, E_RAIL, MU_RAIL);
  } else {
    if (ay > B) hit += impulse(k, 0, -Math.sign(k.y), ay - B, E_RAIL, MU_RAIL);
    const inMouth = Math.abs(k.y) < s.goal / 2;
    if (ax > A && !inMouth && ax < L / 2 + R_PUCK) hit += impulse(k, -Math.sign(k.x), 0, ax - A, E_RAIL, MU_RAIL);
  }
  for (const px of [-L / 2, L / 2])
    for (const py of [-s.goal / 2, s.goal / 2]) {
      const dx = k.x - px;
      const dy = k.y - py;
      const d = Math.hypot(dx, dy);
      const min = R_PUCK + POST_R;
      if (d < min && d > 1e-9) hit += impulse(k, dx / d, dy / d, min - d, E_RAIL, MU_RAIL);
    }
  if (hit > 0.004) s.rail++;
}

/** Tek fizik adımı. opts.onHit(seat) raket teması olunca; opts.movePads=false ise raketler dışarıdan sürülür */
function step(s, h, opts = {}) {
  const k = s.puck;
  if (opts.movePads !== false) s.pads.forEach((_, i) => !s.claim?.[i] && movePad(s, i, h, s.bots[i] ? BOT_VMAX * s.level : PAD_VMAX));
  k.x += k.vx * h;
  k.y += k.vy * h;
  const sp = Math.hypot(k.vx, k.vy);
  if (sp > 0) {
    const ns = Math.max(0, sp * (1 - 0.02 * h) - 0.05 * h);
    k.vx *= ns / sp;
    k.vy *= ns / sp;
  }
  k.w *= 1 - 0.5 * h;

  for (let i = 0; i < 2; i++) {
    if (s.time < s.noHit[i] || s.claim?.[i]) continue;
    const p = s.pads[i];
    const dx = k.x - p.x;
    const dy = k.y - p.y;
    const d = Math.hypot(dx, dy);
    const min = R_PUCK + s.padR;
    if (d >= min) continue;
    const nx = d > 1e-9 ? dx / d : i === 0 ? 1 : -1;
    const ny = d > 1e-9 ? dy / d : 0;
    if (impulse(k, nx, ny, min - d, E_PAD, MU_PAD, p.vx, p.vy) > 0) {
      const v2 = Math.hypot(k.vx, k.vy);
      if (v2 > s.maxPuck) {
        k.vx *= s.maxPuck / v2;
        k.vy *= s.maxPuck / v2;
      }
      if (opts.onHit) opts.onHit(i);
      else registerHit(s, i);
    }
  }
  rails(s, k);
  for (let i = 0; i < 2; i++) {
    if (s.claim?.[i]) continue;
    const p = s.pads[i];
    const dx = p.x - k.x;
    const dy = p.y - k.y;
    const d = Math.hypot(dx, dy);
    const min = R_PUCK + s.padR;
    if (d >= min) continue;
    const b = bounds(s, i);
    const nx = d > 1e-9 ? dx / d : i === 0 ? -1 : 1;
    const ny = d > 1e-9 ? dy / d : 0;
    p.x = clamp(k.x + nx * min, b.x0, b.x1);
    p.y = clamp(k.y + ny * min, b.y0, b.y1);
  }
  const v = Math.hypot(k.vx, k.vy);
  if (v > s.maxPuck) {
    k.vx *= s.maxPuck / v;
    k.vy *= s.maxPuck / v;
  }
  if (v > s.topSpeed) s.topSpeed = v;
  s.time += h;
}

const outOfPlay = (k) => k.x < -L / 2 - R_PUCK || k.x > L / 2 + R_PUCK;

/** İstemci tahmini: kural yok (gol/skor yok); disk kale çizgisini geçince durur, sonucu sunucu belirler */
export function simulate(s, dt, opts = {}) {
  let left = Math.min(dt, 0.1);
  while (left > 1e-9) {
    const h = Math.min(STEP, left);
    step(s, h, opts);
    if (outOfPlay(s.puck)) {
      s.puck.vx = s.puck.vy = 0;
      break;
    }
    left -= h;
  }
}

function checkGoal(s) {
  const k = s.puck;
  if (!outOfPlay(k)) return;
  const scorer = k.x < 0 ? 1 : 0;
  s.score[scorer]++;
  s.lastScorer = scorer;
  k.vx = k.vy = k.w = 0;
  if (s.score[scorer] >= s.target) {
    s.phase = "over";
    s.winner = scorer;
    s.reason = "score";
  } else {
    s.phase = "goal";
    s.timer = 1.8;
  }
}

function botThink(s, seat) {
  const p = s.pads[seat];
  const k = s.puck;
  const b = bounds(s, seat);
  const dir = seat === 0 ? 1 : -1;
  const homeX = seat === 0 ? -L / 2 + 0.14 : L / 2 - 0.14;
  const onMySide = seat === 0 ? k.x < -0.06 : k.x > 0.06;
  if (s.aimHits !== s.hits) {
    s.aimHits = s.hits;
    s.aim = (s.rng() - 0.5) * 0.09;
  }
  let tx = homeX;
  let ty = k.y * 0.5;
  if (onMySide) {
    const slow = Math.hypot(k.vx, k.vy) < 1.2;
    if (slow || (seat === 0 ? k.vx < 0 : k.vx > 0)) {
      const behind = k.x - dir * (s.padR + R_PUCK - 0.008);
      tx = Math.abs(p.x - behind) > 0.035 && Math.abs(p.y - k.y) > 0.035 ? behind : k.x + dir * 0.05;
      ty = k.y + s.aim;
    } else {
      tx = homeX + dir * 0.05;
      ty = clamp(k.y + k.vy * 0.12, b.y0, b.y1);
    }
  }
  p.tx = clamp(tx, b.x0, b.x1);
  p.ty = clamp(ty, b.y0, b.y1);
}

export function tick(s, dt) {
  if (s.phase === "over") return;
  dt = Math.min(dt, 0.1);
  s.bots.forEach((isBot, i) => isBot && botThink(s, i));
  if (s.phase === "countdown" || s.phase === "goal") {
    s.timer -= dt;
    let left = dt;
    while (left > 1e-9) {
      const h = Math.min(STEP, left);
      s.pads.forEach((_, i) => !s.claim?.[i] && movePad(s, i, h, s.bots[i] ? BOT_VMAX * s.level : PAD_VMAX));
      left -= h;
    }
    s.time += dt;
    if (s.timer <= 0) {
      if (s.phase === "goal") resetPuck(s, 1 - s.lastScorer);
      s.phase = "play";
      s.timer = 0;
    }
    return;
  }
  let left = dt;
  while (left > 1e-9 && s.phase === "play") {
    const h = Math.min(STEP, left);
    step(s, h);
    checkGoal(s);
    left -= h;
  }
  if (s.phase === "play") {
    // Gerçek kural: disk bir yarıda 7 sn'den uzun kalırsa rakibe geçer (oyun asla kilitlenmez)
    const side = s.puck.x < 0 ? 0 : 1;
    s.sideTime = s.side === side ? s.sideTime + dt : 0;
    s.side = side;
    if (s.sideTime > 7) {
      resetPuck(s, 1 - side);
      s.sideTime = 0;
      s.side = 1 - side;
    }
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
export function view(s) {
  return {
    t: "airhockey",
    seats: s.seats,
    bots: s.bots,
    score: s.score,
    target: s.target,
    goal: s.goal,
    padR: s.padR,
    maxPuck: s.maxPuck,
    phase: s.phase,
    timer: Math.round(s.timer * 10) / 10,
    winner: s.winner,
    reason: s.reason,
    lastScorer: s.lastScorer,
    time: mm(s.time),
    hits: s.hits,
    rail: s.rail,
    lastHit: s.lastHitSeat,
    shots: s.shots,
    top: Math.round(s.topSpeed * 10) / 10,
    puck: [mm(s.puck.x), mm(s.puck.y), mm(s.puck.vx), mm(s.puck.vy), Math.round(s.puck.w * 10) / 10],
    pads: s.pads.map((p) => [mm(p.x), mm(p.y), mm(p.vx), mm(p.vy)]),
  };
}

/** İstemci tahmini için görünümden simülasyon durumu */
export function fromView(v) {
  return {
    t: "airhockey",
    seats: v.seats,
    bots: [true, true],
    level: 1,
    goal: v.goal,
    padR: v.padR,
    maxPuck: v.maxPuck || MAX_PUCK,
    phase: v.phase,
    time: v.time,
    puck: { x: v.puck[0], y: v.puck[1], vx: v.puck[2], vy: v.puck[3], w: v.puck[4] || 0 },
    pads: v.pads.map((p) => ({ x: p[0], y: p[1], vx: p[2] || 0, vy: p[3] || 0, tx: p[0], ty: p[1] })),
    hits: v.hits,
    rail: v.rail || 0,
    noHit: [0, 0],
    topSpeed: 0,
  };
}
