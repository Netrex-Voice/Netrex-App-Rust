/**
 * 🎱 Bilardo (8 top) — deterministik fizik + WPA tarzı kurallar.
 *
 * Birimler: metre, saniye, kg, rad/s. Masa düzlemi: x = uzunluk, z = genişlik (y yukarı). 8 ft masa: 2,24 × 1,12 m oyun alanı.
 * Top: Ø57,15 mm, 170 g, I = 2/5·m·R². Durumlar: kayma (μs 0,2) → yuvarlanma (μr 0,01); dikey eksen dönüşü (İngiliz falsosu) sönümlenir.
 * Istaka darbesi: istakanın vurduğu nokta (a: yan, b: dikey; |a|,|b| ≤ 0,5R) açısal itme üretir → takip/geri çekme/yan falso.
 * Bant: normal geri sekme e = 0,8 (hıza bağlı), yan falso ile teğet sürtünme (μ 0,14) → yansıma açısı değişir.
 * Top-top: eşit kütle, e = 0,95 (normal bileşen değiş tokuşu) + çok küçük "throw".
 * Cepler: köşe ve yan ağızlar, çene uçları; top merkezi cep dairesine girerse düşer.
 *
 * Ağ modeli: vuruş parametreleri (yön birim vektörü, güç, a, b) → her istemci aynı başlangıçtan aynı sonucu hesaplar
 * (yalnızca + − × ÷ ve Math.sqrt: IEEE kesin → makineler arası aynı). Host vuruş bitince kesin konumları da yollar.
 */
import { clamp, fin, shuffle } from "./util.js";

export const A = 1.12; // yarım uzunluk
export const B = 0.56; // yarım genişlik
export const R = 0.028575;
const M = 0.17;
const G = 9.81;
const MU_S = 0.2;
const MU_R = 0.01;
const SPIN_DECAY = 10; // rad/s² (dikey eksen)
const E_BALL = 0.95;
const MU_CUSH = 0.14;
const STEP = 1 / 960;
const MAX_V = 9; // açılış vuruşu ~8–9 m/s
const CORNER_MOUTH = 0.118; // köşe cep ağzı (~4,6")
const SIDE_MOUTH = 0.132; // yan cep ağzı (~5,2")
const POCKET_R = { corner: 0.064, side: 0.062 };
export const HEAD_X = -A / 2; // açılış (baş) çizgisi
export const FOOT = { x: A / 2, z: 0 }; // ayak noktası

export const meta = { seats: 2 };

// ───────── Masa geometrisi: bant segmentleri + çene uçları + cepler ─────────
function buildTable() {
  const c = CORNER_MOUTH / Math.SQRT2; // köşe ağzının bant boyunca kesik uzunluğu
  const sh = SIDE_MOUTH / 2;
  const jaw = 0.05;
  const segs = [];
  const add = (x1, z1, x2, z2) => segs.push({ x1, z1, x2, z2 });
  for (const sz of [-1, 1]) {
    // uzun bantlar (iki parça: köşe ↔ yan cep)
    add(-A + c, sz * B, -sh, sz * B);
    add(sh, sz * B, A - c, sz * B);
    // çeneler: köşe 45°, yan cep hafif içe
    add(-A + c, sz * B, -A + c - jaw * 0.7, sz * (B + jaw * 0.7));
    add(A - c, sz * B, A - c + jaw * 0.7, sz * (B + jaw * 0.7));
    add(-sh, sz * B, -sh + jaw * 0.25, sz * (B + jaw));
    add(sh, sz * B, sh - jaw * 0.25, sz * (B + jaw));
  }
  for (const sx of [-1, 1]) {
    add(sx * A, -B + c, sx * A, B - c);
    add(sx * A, -B + c, sx * (A + jaw * 0.7), -B + c - jaw * 0.7);
    add(sx * A, B - c, sx * (A + jaw * 0.7), B - c + jaw * 0.7);
  }
  const pockets = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pockets.push({ x: sx * (A + 0.02), z: sz * (B + 0.02), r: POCKET_R.corner, kind: "corner" });
  for (const sz of [-1, 1]) pockets.push({ x: 0, z: sz * (B + 0.035), r: POCKET_R.side, kind: "side" });
  for (const s of segs) {
    const dx = s.x2 - s.x1;
    const dz = s.z2 - s.z1;
    const l = Math.sqrt(dx * dx + dz * dz);
    s.l = l;
    s.tx = dx / l;
    s.tz = dz / l;
  }
  return { segs, pockets };
}
export const TABLE = buildTable();

// ───────── Toplar ─────────
export const SOLIDS = [1, 2, 3, 4, 5, 6, 7];
export const STRIPES = [9, 10, 11, 12, 13, 14, 15];
const groupOf = (n) => (n >= 1 && n <= 7 ? "solid" : n >= 9 && n <= 15 ? "stripe" : n === 8 ? "eight" : "cue");

function ball(n, x, z) {
  return { n, x, z, vx: 0, vz: 0, wx: 0, wy: 0, wz: 0, on: true };
}

/** Üçgen dizilim: 8 ortada, arka köşelerde bir düz bir çizgili, kalanlar karışık (host RNG) */
export function rack(rng = Math.random) {
  const d = 2 * R + 0.0002; // toplar arası ufak boşluk (gerçek dizilimde de olur)
  const rows = [];
  for (let r = 0; r < 5; r++) for (let k = 0; k <= r; k++) rows.push({ r, k });
  const pos = rows.map(({ r, k }) => ({ x: FOOT.x + r * d * Math.sqrt(3) / 2, z: (k - r / 2) * d }));
  const others = shuffle([1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15], rng);
  const order = new Array(15).fill(0);
  order[4] = 8; // orta (3. sıra ortası)
  // arka köşeler (indeks 10 ve 14): biri düz biri çizgili
  const s = others.find((n) => n < 8);
  const t = others.find((n) => n > 8);
  order[10] = s;
  order[14] = t;
  const rest = others.filter((n) => n !== s && n !== t);
  let j = 0;
  for (let i = 0; i < 15; i++) if (!order[i]) order[i] = rest[j++];
  const balls = [ball(0, HEAD_X - 0.12, 0)];
  order.forEach((n, i) => balls.push(ball(n, pos[i].x, pos[i].z)));
  return balls;
}

// ───────── Fizik ─────────
/** Istaka darbesi → beyaz topun hızı ve falsosu. dir: birim vektör (dx, dz); a: yan (+sağ), b: dikey (+üst); ofsetler R cinsinden [-0.5, 0.5] */
export function strike(cue, dx, dz, power, a, b) {
  const l = Math.sqrt(dx * dx + dz * dz) || 1;
  dx /= l;
  dz /= l;
  const v = clamp(power, 0, 1) * MAX_V;
  a = clamp(a, -0.5, 0.5) * R;
  b = clamp(b, -0.5, 0.5) * R;
  // yan falso istakayı çok hafif saptırır ("squirt")
  const sq = -(a / R) * 0.025;
  const ex = dx - dz * sq;
  const ez = dz + dx * sq;
  const el = Math.sqrt(ex * ex + ez * ez);
  cue.vx = (v * ex) / el;
  cue.vz = (v * ez) / el;
  // ω = (5v / 2R²) · (a·(ŝ × d̂) + b·(ŷ × d̂)); ŝ = d̂ × ŷ (sağ), ŷ × d̂ = (dz, 0, −dx)
  const k = (5 * v) / (2 * R * R);
  cue.wx = k * b * dz;
  cue.wz = -k * b * dx;
  cue.wy = -k * a; // ŝ × d̂ = −ŷ  (sağ falso → saat yönü bakışında negatif)
}

/** Bir topu sürtünmeyle ilerlet */
function moveBall(o, h) {
  const sp2 = o.vx * o.vx + o.vz * o.vz;
  // temas noktası kayma hızı u = v + ω × (0,−R,0) = (vx + R·wz, vz − R·wx)
  const ux = o.vx + R * o.wz;
  const uz = o.vz - R * o.wx;
  const us = Math.sqrt(ux * ux + uz * uz);
  if (us > 1e-4) {
    // kayma: sürtünme kaymaya ters; açısal ivme torktan
    const f = MU_S * G;
    const ax = (-f * ux) / us;
    const az = (-f * uz) / us;
    // kaymayı tam sıfırlayan adımı aşma
    const k = Math.min(1, us / (3.5 * f * h));
    o.vx += ax * h * k;
    o.vz += az * h * k;
    // τ = r × F, F = m·a, r = (0,−R,0): τ = (−R·Fz, 0, R·Fx); ω̇ = τ / (2/5 m R²) = (5/2R)·(−az, 0, ax)
    o.wx += ((5 / (2 * R)) * -az) * h * k;
    o.wz += ((5 / (2 * R)) * ax) * h * k;
  } else if (sp2 > 1e-10) {
    // yuvarlanma: yuvarlanma direnci, ω hıza kilitli
    const sp = Math.sqrt(sp2);
    const ns = Math.max(0, sp - MU_R * G * h);
    o.vx *= ns / sp;
    o.vz *= ns / sp;
    o.wx = o.vz / R;
    o.wz = -o.vx / R;
  } else {
    o.vx = o.vz = 0;
    o.wx = o.wz = 0;
  }
  if (o.wy !== 0) {
    const d = SPIN_DECAY * h;
    o.wy = Math.abs(o.wy) <= d ? 0 : o.wy - Math.sign(o.wy) * d;
  }
  o.x += o.vx * h;
  o.z += o.vz * h;
}

/** Bant / çene çarpışması (segment ya da uç noktası) */
function cushion(o, nx, nz, pen, ev) {
  o.x += nx * pen;
  o.z += nz * pen;
  const vn = o.vx * nx + o.vz * nz;
  if (vn >= 0) return false;
  const e = clamp(0.88 - 0.02 * -vn, 0.7, 0.88); // hızlı çarpmada daha az sekme
  const jn = -(1 + e) * vn; // birim kütle başına
  // teğet: temas noktası hızı (ω × r, r = −R·n): dikey falso etkisi
  const tx = -nz;
  const tz = nx;
  const ut = o.vx * tx + o.vz * tz + o.wy * R; // yan falso bantta "tutar"
  let jt = (-ut * 2) / 7; // kaymayı durduracak itme (1 + R²·m/I = 7/2)
  const lim = MU_CUSH * jn;
  jt = clamp(jt, -lim, lim);
  o.vx += jn * nx + jt * tx;
  o.vz += jn * nz + jt * tz;
  o.wy += (jt * 5) / (2 * R);
  // banta çarpınca yuvarlanma dönüşü kısmen silinir (yeniden kayma başlar)
  o.wx *= 0.4;
  o.wz *= 0.4;
  ev.push({ e: "cushion", n: o.n, v: -vn });
  return true;
}

function collideTable(o, ev) {
  // hızlı ön eleme: masanın içinde ve bantlara uzaksa geç
  if (Math.abs(o.x) < A - R - 0.002 && Math.abs(o.z) < B - R - 0.002) return;
  for (const s of TABLE.segs) {
    const px = o.x - s.x1;
    const pz = o.z - s.z1;
    let t = px * s.tx + pz * s.tz;
    if (t < 0 || t > s.l) {
      // uç noktası (çene ucu)
      const ex = t < 0 ? s.x1 : s.x2;
      const ez = t < 0 ? s.z1 : s.z2;
      const dx = o.x - ex;
      const dz = o.z - ez;
      const d2 = dx * dx + dz * dz;
      if (d2 < R * R && d2 > 1e-14) {
        const d = Math.sqrt(d2);
        cushion(o, dx / d, dz / d, R - d, ev);
      }
      continue;
    }
    const cx = s.x1 + s.tx * t;
    const cz = s.z1 + s.tz * t;
    const dx = o.x - cx;
    const dz = o.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < R * R && d2 > 1e-14) {
      const d = Math.sqrt(d2);
      cushion(o, dx / d, dz / d, R - d, ev);
    }
  }
}

function collideBalls(a, b, ev) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d2 = dx * dx + dz * dz;
  if (d2 >= 4 * R * R || d2 < 1e-14) return;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const nz = dz / d;
  const pen = 2 * R - d;
  a.x -= (nx * pen) / 2;
  a.z -= (nz * pen) / 2;
  b.x += (nx * pen) / 2;
  b.z += (nz * pen) / 2;
  const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
  if (rv >= 0) return;
  const j = (-(1 + E_BALL) * rv) / 2;
  a.vx -= j * nx;
  a.vz -= j * nz;
  b.vx += j * nx;
  b.vz += j * nz;
  // küçük "throw": temas noktasında kayma, hedef topa yan hız
  const tx = -nz;
  const tz = nx;
  const ut = (a.vx - b.vx) * tx + (a.vz - b.vz) * tz + R * (a.wy + b.wy);
  const jt = clamp(-ut / 7, -0.06 * j, 0.06 * j);
  a.vx += jt * tx;
  a.vz += jt * tz;
  b.vx -= jt * tx;
  b.vz -= jt * tz;
  ev.push({ e: "ball", a: a.n, b: b.n, v: -rv });
}

function pocketCheck(o, ev) {
  if (Math.abs(o.x) < A - 0.06 && Math.abs(o.z) < B - 0.06) return false;
  for (let i = 0; i < TABLE.pockets.length; i++) {
    const p = TABLE.pockets[i];
    const dx = o.x - p.x;
    const dz = o.z - p.z;
    if (dx * dx + dz * dz < p.r * p.r) {
      o.on = false;
      o.vx = o.vz = o.wx = o.wy = o.wz = 0;
      o.pocket = i;
      ev.push({ e: "pocket", n: o.n, p: i });
      return true;
    }
  }
  // güvenlik: masa dışına çıkan top (olmamalı) cebe sayılır
  if (Math.abs(o.x) > A + 0.12 || Math.abs(o.z) > B + 0.12) {
    o.on = false;
    o.pocket = -1;
    ev.push({ e: "pocket", n: o.n, p: -1 });
    return true;
  }
  return false;
}

/** Tüm topları bir adım ilerlet; olayları ev'e yazar. Döndürür: hareket var mı */
export function stepBalls(balls, h, ev) {
  let moving = false;
  for (const o of balls) {
    if (!o.on) continue;
    if (o.vx !== 0 || o.vz !== 0 || o.wx !== 0 || o.wz !== 0 || o.wy !== 0) {
      moveBall(o, h);
      moving = true;
    }
  }
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i];
    if (!a.on) continue;
    for (let j = i + 1; j < balls.length; j++) if (balls[j].on) collideBalls(a, balls[j], ev);
  }
  for (const o of balls) if (o.on && (o.vx !== 0 || o.vz !== 0)) (collideTable(o, ev), pocketCheck(o, ev));
  return moving;
}

/** Vuruşu baştan sona simüle et (kurallar için olay listesi; kareler isteğe bağlı) */
export function simulateShot(balls0, shot, { frames = false, maxT = 30 } = {}) {
  const balls = balls0.map((b) => ({ ...b }));
  const cue = balls.find((b) => b.n === 0);
  strike(cue, shot.dx, shot.dz, shot.power, shot.a, shot.b);
  const events = [];
  const fr = [];
  let t = 0;
  let still = 0;
  while (t < maxT) {
    const ev = [];
    const moving = stepBalls(balls, STEP, ev);
    t += STEP;
    for (const e of ev) events.push({ ...e, t });
    if (frames && Math.round(t * 960) % 16 === 0) fr.push(balls.map((b) => [b.x, b.z, b.on ? 1 : 0]));
    if (!moving) {
      if (++still > 2) break;
    } else still = 0;
  }
  return { balls, events, t, frames: fr };
}

// ───────── Kurallar ─────────
export function create({ players, config = {}, rng = Math.random }) {
  return {
    t: "pool",
    rng,
    seats: players.slice(0, 2).map((p) => p.id),
    bots: players.slice(0, 2).map((p) => !!p.bot),
    level: { easy: 0.45, normal: 0.75, hard: 0.95 }[config.botLevel] || 0.75,
    turnTime: [0, 30, 45, 60].includes(config.turnTime) ? config.turnTime : 0,
    balls: rack(rng),
    turn: 0,
    phase: "aim", // aim | place | moving | over
    breakShot: true,
    groups: [null, null], // "solid" | "stripe"
    ballInHand: false,
    kitchenOnly: true, // açılışta beyaz yalnızca baş çizgisinin gerisine
    shot: null, // { id, dx, dz, power, a, b, start, t }
    shotId: 0,
    shotT: 0,
    msg: "Açılış vuruşu",
    winner: null,
    reason: "",
    aim: null, // izleyiciler için canlı nişan { dx, dz, power }
    turnLeft: 0,
    botT: 1.4,
    potted: [[], []],
    fouls: [0, 0],
  };
}

const groupBalls = (s, g) => s.balls.filter((b) => b.on && groupOf(b.n) === g);

function legalTargets(s, seat) {
  const g = s.groups[seat];
  if (!g) return ["solid", "stripe"]; // açık masa (8 hariç)
  return groupBalls(s, g).length ? [g] : ["eight"];
}

/** Elde top yerleştirme doğrulaması */
export function canPlace(s, x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  if (Math.abs(x) > A - R - 0.005 || Math.abs(z) > B - R - 0.005) return false;
  if (s.kitchenOnly && x > HEAD_X) return false;
  for (const b of s.balls) if (b.on && b.n !== 0 && (b.x - x) * (b.x - x) + (b.z - z) * (b.z - z) < 4 * R * R * 1.02) return false;
  return true;
}

export function input(s, pid, m) {
  if (!m || typeof m !== "object" || s.phase === "over") return false;
  const seat = s.seats.indexOf(pid);
  if (seat < 0 || seat !== s.turn || s.bots[seat]) return false;
  return act(s, seat, m);
}

function act(s, seat, m) {
  if (m.t === "aim" && (s.phase === "aim" || s.phase === "place")) {
    const dx = fin(m.dx);
    const dz = fin(m.dz);
    const l = Math.sqrt(dx * dx + dz * dz);
    if (l < 1e-6) return false;
    s.aim = { dx: dx / l, dz: dz / l, power: clamp(fin(m.power), 0, 1) };
    return true;
  }
  if (m.t === "place" && s.ballInHand && (s.phase === "aim" || s.phase === "place")) {
    const x = fin(m.x, NaN);
    const z = fin(m.z, NaN);
    if (!canPlace(s, x, z)) return false;
    const cue = s.balls.find((b) => b.n === 0);
    Object.assign(cue, { x, z, on: true, vx: 0, vz: 0, wx: 0, wy: 0, wz: 0 });
    s.phase = "aim";
    return true;
  }
  if (m.t === "shoot" && s.phase === "aim") {
    const cue = s.balls.find((b) => b.n === 0);
    if (!cue.on) return false;
    const dx = fin(m.dx);
    const dz = fin(m.dz);
    const l = Math.sqrt(dx * dx + dz * dz);
    if (l < 1e-6) return false;
    const shot = { dx: dx / l, dz: dz / l, power: clamp(fin(m.power), 0.02, 1), a: clamp(fin(m.a), -0.5, 0.5), b: clamp(fin(m.b), -0.5, 0.5) };
    s.shotId++;
    s.shot = { id: s.shotId, ...shot, start: s.balls.map((b) => ({ ...b })) };
    s.result = simulateShot(s.balls, shot);
    s.shotT = 0;
    s.phase = "moving";
    s.aim = null;
    s.ballInHand = false;
    return true;
  }
  return false;
}

/** Vuruş bitti: kuralları uygula */
function resolve(s) {
  const seat = s.turn;
  const r = s.result;
  s.balls = r.balls.map((b) => ({ ...b, vx: 0, vz: 0, wx: 0, wy: 0, wz: 0 }));
  const ev = r.events;
  const first = ev.find((e) => e.e === "ball" && (e.a === 0 || e.b === 0));
  const firstN = first ? (first.a === 0 ? first.b : first.a) : null;
  const firstIdx = first ? ev.indexOf(first) : -1;
  const pottedNow = ev.filter((e) => e.e === "pocket").map((e) => e.n);
  const scratch = pottedNow.includes(0);
  const eightIn = pottedNow.includes(8);
  const railAfter = firstIdx >= 0 && ev.slice(firstIdx + 1).some((e) => e.e === "cushion");
  const wasBreak = s.breakShot;
  s.breakShot = false;
  s.kitchenOnly = false;
  const targets = legalTargets(s, seat);

  let foul = "";
  if (!first) foul = "Hiçbir topa değmedi";
  else if (!wasBreak && !targets.includes(groupOf(firstN))) foul = groupOf(firstN) === "eight" ? "Önce 8'e değdin" : "Önce rakibin topuna değdin";
  else if (!wasBreak && !pottedNow.length && !railAfter) foul = "Temastan sonra banta değen yok";
  if (scratch) foul = "Beyaz top cebe girdi";

  // 8 top
  if (eightIn) {
    if (wasBreak) {
      // açılışta 8 (beyaz girse de girmese de): kayıp sayılmaz, ayak noktasına geri konur
      const e8 = s.balls.find((b) => b.n === 8);
      Object.assign(e8, { on: true, x: FOOT.x, z: 0 });
      nudgeFree(s, e8);
    } else {
      const cleared = s.groups[seat] && !groupBalls(s, s.groups[seat]).length;
      const won = cleared && !foul && targets.includes("eight");
      s.phase = "over";
      s.winner = won ? seat : 1 - seat;
      s.reason = won ? "eight" : "eight_foul";
      s.msg = won ? "8 top cebe — oyun bitti!" : "8 top erken / faulle girdi";
      return;
    }
  }
  pottedNow.filter((n) => n !== 0 && n !== 8).forEach((n) => s.potted[groupOf(n) === s.groups[1] ? 1 : groupOf(n) === s.groups[0] ? 0 : seat].push(n));

  // grup atama (açık masada, açılış değil, faulsüz ve bir grup topu girdiyse)
  let keep = false;
  if (!foul) {
    const own = pottedNow.filter((n) => n !== 0 && n !== 8);
    if (!s.groups[seat] && own.length && !wasBreak) {
      const g = groupOf(own[0]);
      s.groups[seat] = g;
      s.groups[1 - seat] = g === "solid" ? "stripe" : "solid";
      s.msg = `${g === "solid" ? "Düz" : "Çizgili"} toplar senin`;
      keep = true;
    } else if (wasBreak) keep = own.length > 0;
    else keep = own.some((n) => !s.groups[seat] || groupOf(n) === s.groups[seat]);
  }
  if (foul) {
    s.fouls[seat]++;
    s.msg = `Faul: ${foul} — rakip elde topla oynar`;
    s.turn = 1 - seat;
    s.ballInHand = true;
    if (wasBreak && scratch) s.kitchenOnly = true; // açılışta beyaz girerse rakip baş çizgisinin gerisinden başlar
    const cue = s.balls.find((b) => b.n === 0);
    if (!cue.on) Object.assign(cue, { on: true, x: HEAD_X - 0.12, z: 0 });
    nudgeFree(s, cue);
    s.phase = "place";
  } else {
    if (!keep) {
      s.turn = 1 - seat;
      s.msg = wasBreak ? "Açılışta top girmedi" : "Sıra rakipte";
    } else if (!s.msg || s.msg.startsWith("Sıra") || s.msg.startsWith("Faul") || s.msg.startsWith("Açılış")) s.msg = "Devam";
    s.phase = "aim";
  }
  s.turnLeft = s.turnTime;
  s.botT = 1.2;
}

/** Konulan top başka topla çakışıyorsa en yakın boş yere kaydır */
function nudgeFree(s, o) {
  for (let k = 0; k < 60; k++) {
    if (!s.balls.some((b) => b !== o && b.on && (b.x - o.x) * (b.x - o.x) + (b.z - o.z) * (b.z - o.z) < 4 * R * R * 1.02)) return;
    o.x -= 2 * R * 0.6;
    if (o.x < -A + R) o.x = A - R - 0.01;
  }
}

// ───────── Bot ─────────
function ghostShots(s, seat) {
  const cue = s.balls.find((b) => b.n === 0);
  const targets = legalTargets(s, seat);
  const cands = [];
  for (const o of s.balls) {
    if (!o.on || o.n === 0 || !targets.includes(groupOf(o.n)) || (groupOf(o.n) === "eight" && !targets.includes("eight"))) continue;
    for (const p of TABLE.pockets) {
      const px = p.x - o.x;
      const pz = p.z - o.z;
      const pl = Math.sqrt(px * px + pz * pz);
      const gx = o.x - (px / pl) * 2 * R; // hayalet top
      const gz = o.z - (pz / pl) * 2 * R;
      const ax = gx - cue.x;
      const az = gz - cue.z;
      const al = Math.sqrt(ax * ax + az * az);
      const cut = (ax * px + az * pz) / (al * pl); // kesme açısı kosinüsü
      if (cut < 0.25) continue;
      cands.push({ dx: ax / al, dz: az / al, score: cut * 2 - (al + pl) * 0.4, dist: al + pl, n: o.n });
    }
  }
  cands.sort((a, b) => b.score - a.score);
  return cands.slice(0, 7);
}

function botShoot(s, seat) {
  if (s.phase === "place") {
    // elde top: masanın baş tarafında boş bir yer
    for (const [x, z] of [[HEAD_X - 0.1, 0], [HEAD_X - 0.1, 0.2], [HEAD_X - 0.1, -0.2], [-0.2, 0.1], [0.2, -0.2], [0.1, 0.25]]) if (canPlace(s, x, z)) return act(s, seat, { t: "place", x, z });
    return act(s, seat, { t: "place", x: -A + 0.2, z: 0.3 });
  }
  if (s.breakShot) return act(s, seat, { t: "shoot", dx: 1, dz: (s.rng() - 0.5) * 0.02, power: 0.95, a: 0, b: 0.1 });
  let best = null;
  for (const c of ghostShots(s, seat)) {
    for (const power of [Math.min(0.85, 0.18 + c.dist * 0.16), Math.min(0.95, 0.3 + c.dist * 0.2)]) {
      const shot = { dx: c.dx, dz: c.dz, power, a: 0, b: 0 };
      const r = simulateShot(s.balls, shot, { maxT: 12 });
      const pot = r.events.filter((e) => e.e === "pocket").map((e) => e.n);
      const ok = pot.includes(c.n) && !pot.includes(0) && (c.n === 8 || !pot.includes(8));
      const sc = (ok ? 10 : 0) + c.score;
      if (!best || sc > best.sc) best = { sc, shot };
      if (ok) break;
    }
    if (best?.sc >= 10) break;
  }
  if (!best) {
    // güvenli vuruş: en yakın hedef topa orta güç
    const cue = s.balls.find((b) => b.n === 0);
    const t = s.balls.find((b) => b.on && b.n !== 0 && legalTargets(s, seat).includes(groupOf(b.n)));
    const dx = t ? t.x - cue.x : 1;
    const dz = t ? t.z - cue.z : 0;
    best = { shot: { dx, dz, power: 0.4, a: 0, b: 0 } };
  }
  // seviyeye göre nişan hatası (açı) ve güç hatası
  const err = (1 - s.level) * 0.035 * (s.rng() - 0.5) * 2;
  const { dx, dz } = best.shot;
  return act(s, seat, { t: "shoot", dx: dx - dz * err, dz: dz + dx * err, power: best.shot.power * (1 + (s.rng() - 0.5) * (1 - s.level) * 0.3), a: 0, b: best.shot.b });
}

export function tick(s, dt) {
  if (s.phase === "over") return;
  if (s.phase === "moving") {
    s.shotT += dt;
    if (s.shotT >= s.result.t) resolve(s);
    return;
  }
  if (s.bots[s.turn]) {
    s.botT -= dt;
    if (s.botT <= 0) {
      s.botT = 1.2;
      botShoot(s, s.turn);
    }
    return;
  }
  if (s.turnTime) {
    s.turnLeft -= dt;
    if (s.turnLeft <= 0) {
      // süre doldu: sıra geçer (faul sayılmaz)
      s.turn = 1 - s.turn;
      s.turnLeft = s.turnTime;
      s.msg = "Süre doldu — sıra rakipte";
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

export function view(s, pid) {
  return {
    t: "pool",
    seats: s.seats,
    bots: s.bots,
    me: s.seats.indexOf(pid),
    turn: s.turn,
    phase: s.phase,
    groups: s.groups,
    ballInHand: s.ballInHand,
    kitchenOnly: s.kitchenOnly,
    breakShot: s.breakShot,
    msg: s.msg,
    winner: s.winner,
    reason: s.reason,
    turnTime: s.turnTime,
    turnLeft: Math.ceil(Math.max(0, s.turnLeft)),
    potted: s.potted,
    fouls: s.fouls,
    aim: s.aim,
    // dinlenme konumları (vuruş sırasında: vuruş başı) — istemci vuruşu aynı fizikle kendisi oynatır
    // ham çift duyarlıklı değerler: JSON birebir taşır → istemci simülasyonu host'la bit bit aynı
    balls: (s.phase === "moving" ? s.shot.start : s.balls).map((b) => [b.n, b.x, b.z, b.on ? 1 : 0]),
    shot: s.phase === "moving" ? { id: s.shot.id, dx: s.shot.dx, dz: s.shot.dz, power: s.shot.power, a: s.shot.a, b: s.shot.b, t: Math.round(s.shotT * 1000) / 1000 } : null,
  };
}

/** İstemci: görünümdeki toplardan simülasyon dizisi */
export function ballsFromView(v) {
  return v.balls.map(([n, x, z, on]) => ({ n, x, z, vx: 0, vz: 0, wx: 0, wy: 0, wz: 0, on: !!on }));
}
