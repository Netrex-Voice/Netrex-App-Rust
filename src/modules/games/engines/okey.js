/**
 * 🀄 Türk Okey (standart 4 kişilik) — host-otoriteli kural motoru (saf mantık).
 *
 * KURALLAR (bu dosyanın uyguladığı, belgelenmiş set):
 *  • 106 taş: 4 renk × 1–13 × 2 takım = 104 + 2 sahte okey (id 104, 105). Taş id: set=id≥52, k=id%52, renk=⌊k/13⌋, sayı=k%13+1.
 *  • Karıştırılır, bir taş gösterge olarak açılır. Okey = göstergenin aynı renkte bir fazlası (13 → 1). Gerçek okey taşları joker,
 *    sahte okey ise okeyin yüzünü taşır (sıradan taş).
 *  • Dağıtım: başlangıç oyuncusuna 15, diğerlerine 14 taş; kalan 48 taş yığındadır (106 − 1 gösterge − 57).
 *  • Sıra: başlangıç oyuncusu çekmeden bir taş atar. Sonraki oyuncular ya yığından ya da solundaki oyuncunun son attığı taştan
 *    çeker, sonra bir taş atar. Sıra koltuk sırasındadır (0→1→2→3).
 *  • Bitirme: 15 taşla, bir taşı atarak kalan 14 taşın TAMAMI geçerli perlerde olmalı.
 *    Per = aynı renk ardışık ≥3 (12-13-1 geçerli, 13-1-2 geçersiz) ya da aynı sayı farklı renk 3–4 taş. Joker istenen taşın yerine geçer.
 *  • Çifte gitme ve el puanlaması uygulanmaz. Yığın biterse oyun berabere biter.
 * Gizlilik: eller ve yığın yalnızca bu nesnede durur; `view` her oyuncuya yalnızca kendi elini verir.
 */
import { shuffle } from "./util.js";

export const meta = { seats: [4, 4], fillBots: true };
export const FAKE = [104, 105];

export const tileColor = (id) => (id >= 104 ? -1 : Math.floor((id % 52) / 13));
export const tileNum = (id) => (id >= 104 ? 0 : (id % 52) % 13 + 1);

/** Okey yüzü (renk, sayı) göstergeden */
export const okeyFace = (indicatorId) => {
  const c = tileColor(indicatorId);
  const n = tileNum(indicatorId);
  return { c, n: n === 13 ? 1 : n + 1 };
};
const isWild = (id, okey) => id < 104 && tileColor(id) === okey.c && tileNum(id) === okey.n;

/** 14 taşın tamamı geçerli perlere bölünebilir mi? */
export function canWin(ids, okey) {
  if (ids.length !== 14) return false;
  const cnt = Array.from({ length: 4 }, () => new Array(15).fill(0));
  let jokers = 0;
  for (const id of ids) {
    if (isWild(id, okey)) jokers++;
    else if (id >= 104) cnt[okey.c][okey.n]++;
    else cnt[tileColor(id)][tileNum(id)]++;
  }
  return solve(cnt, jokers);
}

function solve(cnt, jokers) {
  let c = -1;
  let n = 0;
  outer2: for (let ci = 0; ci < 4; ci++) for (let ni = 1; ni <= 13; ni++) if (cnt[ci][ni] > 0) { c = ci; n = ni; break outer2; }
  if (c < 0) return jokers === 0;

  // Seri (düşük): n en küçük taş; öncesi joker olabilir
  for (let s = Math.max(1, n - 2); s <= n; s++) {
    for (let L = Math.max(3, n - s + 1); s + L - 1 <= 13; L++) {
      const used = [];
      let need = 0;
      for (let p = s; p < s + L; p++) {
        if (p < n) need++;
        else if (cnt[c][p] > 0) used.push(p);
        else need++;
      }
      if (need > jokers) continue;
      for (const p of used) cnt[c][p]--;
      const ok = solve(cnt, jokers - need);
      for (const p of used) cnt[c][p]++;
      if (ok) return true;
    }
  }
  // Seri (yüksek): ... 12-13-1
  if (n === 1) {
    for (let s2 = 2; s2 <= 12; s2++) {
      const used = [];
      let need = 0;
      for (let p = s2; p <= 13; p++) (cnt[c][p] > 0 ? used.push(p) : need++);
      if (need > jokers) continue;
      cnt[c][1]--;
      for (const p of used) cnt[c][p]--;
      const ok = solve(cnt, jokers - need);
      cnt[c][1]++;
      for (const p of used) cnt[c][p]++;
      if (ok) return true;
    }
  }
  // Grup: aynı sayı, farklı renkler (3–4 taş)
  const others = [0, 1, 2, 3].filter((x) => x !== c && cnt[x][n] > 0);
  for (let mask = 0; mask < 1 << others.length; mask++) {
    const pick = others.filter((_, i) => mask & (1 << i));
    const real = 1 + pick.length;
    for (let j = Math.max(0, 3 - real); real + j <= 4 && j <= jokers; j++) {
      cnt[c][n]--;
      for (const x of pick) cnt[x][n]--;
      const ok = solve(cnt, jokers - j);
      cnt[c][n]++;
      for (const x of pick) cnt[x][n]++;
      if (ok) return true;
    }
  }
  return false;
}

export function create({ players, config = {}, rng = Math.random }) {
  const seats = players.slice(0, 4).map((p) => p.id);
  while (seats.length < 4) seats.push("@bot" + seats.length);
  const bots = seats.map((_, i) => !!players[i]?.bot || i >= players.length);
  const names = seats.map((_, i) => players[i]?.name || "Bot " + (i + 1));
  const deck = shuffle([...Array(106).keys()], rng);
  const indicator = deck.find((id) => id < 104); // sahte okey gösterge olamaz
  const rest = deck.filter((id) => id !== indicator);
  const first = Math.floor(rng() * 4);
  const hands = [0, 1, 2, 3].map((i) => rest.splice(0, i === first ? 15 : 14));
  return {
    t: "okey",
    rng,
    seats,
    bots,
    names,
    hands,
    stock: rest,
    indicator,
    okey: okeyFace(indicator),
    discards: [[], [], [], []],
    turn: first,
    phase: "discard", // draw | discard | over
    drew: false,
    winner: null,
    reason: "",
    botT: 1,
    level: config.botLevel || "normal",
    turnTime: [0, 30, 60, 90].includes(config.turnTime) ? config.turnTime : 0,
    turnLeft: [0, 30, 60, 90].includes(config.turnTime) ? config.turnTime : 0,
    hints: config.hints !== false,
  };
}

const seatOf = (s, pid) => s.seats.indexOf(pid);

function nextTurn(s) {
  s.turnLeft = s.turnTime;
  s.turn = (s.turn + 1) % 4;
  s.phase = "draw";
  s.drew = false;
}

export function input(s, pid, m) {
  if (!m || typeof m !== "object" || s.phase === "over") return false;
  const seat = seatOf(s, pid);
  if (seat < 0) return false;
  return act(s, seat, m);
}

function act(s, seat, m) {
  const hand = s.hands[seat];
  if (m.t === "arrange") {
    // yalnızca kendi taşlarının permütasyonu kabul edilir
    if (!Array.isArray(m.order) || m.order.length !== hand.length) return false;
    const set = new Set(hand);
    if (new Set(m.order).size !== hand.length || !m.order.every((id) => set.has(id))) return false;
    s.hands[seat] = m.order.slice();
    return true;
  }
  if (seat !== s.turn) return false;
  if (m.t === "draw" && s.phase === "draw") {
    if (m.from === "discard") {
      const pile = s.discards[(seat + 3) % 4];
      if (!pile.length) return false;
      hand.push(pile.pop());
    } else {
      if (!s.stock.length) return false;
      hand.push(s.stock.pop());
    }
    s.phase = "discard";
    s.drew = true;
    return true;
  }
  if ((m.t === "discard" || m.t === "finish") && s.phase === "discard") {
    const i = hand.indexOf(m.tile);
    if (i < 0 || hand.length !== 15) return false;
    if (m.t === "finish") {
      const rest = hand.filter((_, k) => k !== i);
      if (!canWin(rest, s.okey)) return false;
      hand.splice(i, 1);
      s.discards[seat].push(m.tile);
      s.phase = "over";
      s.winner = seat;
      s.reason = "win";
      return true;
    }
    hand.splice(i, 1);
    s.discards[seat].push(m.tile);
    if (!s.stock.length) {
      // sıradaki çekemez: yığın bitti
      s.turn = (seat + 1) % 4;
      s.phase = "over";
      s.reason = "draw";
      return true;
    }
    nextTurn(s);
    return true;
  }
  return false;
}

// ───────── Bot ─────────
function usefulness(id, hand, okey) {
  if (isWild(id, okey)) return 100;
  const face = id >= 104 ? { c: okey.c, n: okey.n } : { c: tileColor(id), n: tileNum(id) };
  let u = 0;
  for (const o of hand) {
    if (o === id || isWild(o, okey)) continue;
    const f = o >= 104 ? { c: okey.c, n: okey.n } : { c: tileColor(o), n: tileNum(o) };
    if (f.c === face.c) {
      const d = Math.min(Math.abs(f.n - face.n), 13 - Math.abs(f.n - face.n));
      if (d === 0) u += 1.5;
      else if (d === 1) u += 2;
      else if (d === 2) u += 1;
    } else if (f.n === face.n) u += 1.8;
  }
  return u;
}

function botAct(s) {
  const seat = s.turn;
  const hand = s.hands[seat];
  if (s.phase === "draw") {
    const top = s.discards[(seat + 3) % 4].at(-1);
    let from = "stock";
    if (top != null) {
      const withTop = [...hand, top];
      const bestUse = usefulness(top, withTop, s.okey);
      if (bestUse >= 3.5 || withTop.some((t) => canWin(withTop.filter((x) => x !== t), s.okey))) from = "discard";
    }
    if (!s.stock.length && from === "stock") from = "discard";
    return act(s, seat, { t: "draw", from }) || act(s, seat, { t: "draw", from: "stock" });
  }
  for (const t of hand) if (act2win(s, seat, t)) return act(s, seat, { t: "finish", tile: t });
  let worst = hand[0];
  let wu = Infinity;
  for (const t of hand) {
    const u = usefulness(t, hand, s.okey) + s.rng() * 0.3;
    if (u < wu) ((wu = u), (worst = t));
  }
  return act(s, seat, { t: "discard", tile: worst });
}
const act2win = (s, seat, t) => s.hands[seat].length === 15 && canWin(s.hands[seat].filter((x) => x !== t), s.okey);

export function tick(s, dt) {
  if (s.phase === "over") return;
  // Tur süresi dolan insan oyuncunun yerine hamleyi bot oynar (oyun kilitlenmez)
  if (s.turnTime && !s.bots[s.turn]) {
    s.turnLeft -= dt;
    if (s.turnLeft <= 0) {
      s.turnLeft = s.turnTime;
      if (s.phase === "draw") botAct(s);
      if (s.phase === "discard" && !s.bots[s.turn]) botAct(s);
    }
    return;
  }
  if (!s.bots[s.turn]) return;
  s.botT -= Math.min(dt, 1);
  if (s.botT > 0) return;
  s.botT = s.level === "easy" ? 1.8 : s.level === "hard" ? 0.7 : 1.1;
  botAct(s);
}

export function playerLeft(s, pid) {
  const seat = seatOf(s, pid);
  if (seat < 0 || s.phase === "over") return;
  s.bots[seat] = true; // ayrılanın yerini bot alır, oyun sürer
  s.names[seat] = "Bot (" + s.names[seat] + ")";
}

export const isOver = (s) => s.phase === "over";

export function view(s, pid) {
  const me = seatOf(s, pid);
  const over = s.phase === "over";
  return {
    t: "okey",
    seats: s.seats,
    names: s.names,
    bots: s.bots,
    me,
    turn: s.turn,
    phase: s.phase,
    drew: s.drew,
    turnTime: s.turnTime,
    turnLeft: Math.ceil(Math.max(0, s.turnLeft)),
    hints: s.hints,
    indicator: s.indicator,
    okey: s.okey,
    stock: s.stock.length,
    counts: s.hands.map((h) => h.length),
    discards: s.discards.map((p) => p.slice(-6)),
    discardCounts: s.discards.map((p) => p.length),
    hand: me >= 0 ? s.hands[me] : [],
    winner: s.winner,
    reason: s.reason,
    // oyun bitince eller açılır; bitmeden kimse başkasının elini göremez
    reveal: over ? s.hands : null,
  };
}
