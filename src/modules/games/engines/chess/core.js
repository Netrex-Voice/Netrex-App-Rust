/**
 * ♟️ Satranç çekirdeği — kurallar (saf JS; React/ağ yok, Node'da perft ile test edilir)
 *
 * Tahta: Int8Array(64), kare = rank*8 + file (a1 = 0, h8 = 63). Taş: +1..+6 beyaz, −1..−6 siyah (P N B R Q K).
 * Hamle: tek tamsayı  from | to<<6 | promo<<12 | flags<<15   (flags: 1 alma, 2 geçerken alma, 4 rok, 8 çift adım)
 * Kurallar: rok, geçerken alma, terfi, mat/pat, yetersiz materyal, 50 hamle, üçlü tekrar.
 */

export const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
export const WHITE = 1, BLACK = -1;
export const F_CAP = 1, F_EP = 2, F_CASTLE = 4, F_DOUBLE = 8;
export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const mFrom = (m) => m & 63;
export const mTo = (m) => (m >> 6) & 63;
export const mPromo = (m) => (m >> 12) & 7;
export const mFlags = (m) => m >> 15;
export const mk = (from, to, promo = 0, flags = 0) => from | (to << 6) | (promo << 12) | (flags << 15);
export const sqName = (s) => "abcdefgh"[s & 7] + ((s >> 3) + 1);
export const sqOf = (name) => name.charCodeAt(0) - 97 + (name.charCodeAt(1) - 49) * 8;
export const moveUci = (m) => sqName(mFrom(m)) + sqName(mTo(m)) + (mPromo(m) ? "nbrq"[mPromo(m) - 2] : "");

// ───────── Tablolar ─────────
const file = (s) => s & 7;
const rank = (s) => s >> 3;
const KNIGHT = [], KING = [], PAWN_ATT = { 1: [], [-1]: [] };
const RAYS = []; // 8 yön × 64 kare → kare dizisi (0-3 vezir: K,G,D,B; 4-7 fil)
const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]; // [dFile, dRank]
for (let s = 0; s < 64; s++) {
  const f = file(s), r = rank(s);
  const add = (arr, df, dr) => {
    const nf = f + df, nr = r + dr;
    if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) arr.push(nr * 8 + nf);
  };
  KNIGHT[s] = [];
  KING[s] = [];
  for (const [df, dr] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) add(KNIGHT[s], df, dr);
  for (const [df, dr] of DIRS) add(KING[s], df, dr);
  // Bu karenin üstüne saldıran piyonun bulunabileceği kareler (rengine göre)
  PAWN_ATT[1][s] = [];
  PAWN_ATT[-1][s] = [];
  add(PAWN_ATT[1][s], -1, -1);
  add(PAWN_ATT[1][s], 1, -1);
  add(PAWN_ATT[-1][s], -1, 1);
  add(PAWN_ATT[-1][s], 1, 1);
}
for (let d = 0; d < 8; d++) {
  RAYS[d] = [];
  for (let s = 0; s < 64; s++) {
    const ray = [];
    let f = file(s) + DIRS[d][0], r = rank(s) + DIRS[d][1];
    while (f >= 0 && f < 8 && r >= 0 && r < 8) {
      ray.push(r * 8 + f);
      f += DIRS[d][0];
      r += DIRS[d][1];
    }
    RAYS[d][s] = ray;
  }
}
const CASTLE_MASK = new Int8Array(64).fill(15);
CASTLE_MASK[0] = 13; CASTLE_MASK[4] = 12; CASTLE_MASK[7] = 14;
CASTLE_MASK[56] = 7; CASTLE_MASK[60] = 3; CASTLE_MASK[63] = 11;

// ───────── Zobrist (tekrar tespiti ve TT için) ─────────
let seed = 0x9e3779b9;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return (t ^ (t >>> 14)) | 0;
};
const Z = { piece: [], side: [rnd(), rnd()], castle: [], ep: [] };
for (let i = 0; i < 13 * 64; i++) Z.piece.push([rnd(), rnd()]);
for (let i = 0; i < 16; i++) Z.castle.push([rnd(), rnd()]);
for (let i = 0; i < 8; i++) Z.ep.push([rnd(), rnd()]);
const zp = (piece, sq) => Z.piece[(piece + 6) * 64 + sq];

// ───────── Pozisyon ─────────
export function emptyPos() {
  return { board: new Int8Array(64), turn: WHITE, castle: 0, ep: -1, half: 0, full: 1, king: [-1, -1], lo: 0, hi: 0, stack: [] };
}

function rehash(p) {
  let lo = 0, hi = 0;
  for (let s = 0; s < 64; s++) {
    const pc = p.board[s];
    if (pc) { const z = zp(pc, s); lo ^= z[0]; hi ^= z[1]; }
  }
  if (p.turn === BLACK) { lo ^= Z.side[0]; hi ^= Z.side[1]; }
  lo ^= Z.castle[p.castle][0]; hi ^= Z.castle[p.castle][1];
  if (epCapturable(p)) { lo ^= Z.ep[file(p.ep)][0]; hi ^= Z.ep[file(p.ep)][1]; }
  p.lo = lo; p.hi = hi;
}

/** Geçerken alma gerçekten mümkünse (rakip piyon yanda) hash'e girer */
function epCapturable(p) {
  if (p.ep < 0) return false;
  const mine = p.turn === WHITE ? P : -P;
  for (const s of PAWN_ATT[p.turn][p.ep]) if (p.board[s] === mine) return true;
  return false;
}

export function fromFen(fen = START_FEN) {
  const p = emptyPos();
  const [placement, turn = "w", castle = "-", ep = "-", half = "0", full = "1"] = fen.trim().split(/\s+/);
  const rows = placement.split("/");
  if (rows.length !== 8) throw new Error("FEN geçersiz");
  const map = { p: P, n: N, b: B, r: R, q: Q, k: K };
  rows.forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += +ch;
      else {
        const t = map[ch.toLowerCase()];
        if (!t || f > 7) throw new Error("FEN geçersiz");
        const sq = (7 - i) * 8 + f++;
        p.board[sq] = ch === ch.toLowerCase() ? -t : t;
        if (t === K) p.king[ch === ch.toLowerCase() ? 1 : 0] = sq;
      }
    }
  });
  if (p.king[0] < 0 || p.king[1] < 0) throw new Error("FEN: şah yok");
  p.turn = turn === "b" ? BLACK : WHITE;
  p.castle = (castle.includes("K") ? 1 : 0) | (castle.includes("Q") ? 2 : 0) | (castle.includes("k") ? 4 : 0) | (castle.includes("q") ? 8 : 0);
  p.ep = ep === "-" ? -1 : sqOf(ep);
  p.half = +half || 0;
  p.full = +full || 1;
  rehash(p);
  return p;
}

export function toFen(p) {
  let out = "";
  for (let r = 7; r >= 0; r--) {
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const pc = p.board[r * 8 + f];
      if (!pc) { empty++; continue; }
      if (empty) { out += empty; empty = 0; }
      const ch = "pnbrqk"[Math.abs(pc) - 1];
      out += pc > 0 ? ch.toUpperCase() : ch;
    }
    if (empty) out += empty;
    if (r) out += "/";
  }
  const c = (p.castle & 1 ? "K" : "") + (p.castle & 2 ? "Q" : "") + (p.castle & 4 ? "k" : "") + (p.castle & 8 ? "q" : "");
  return `${out} ${p.turn === WHITE ? "w" : "b"} ${c || "-"} ${p.ep >= 0 ? sqName(p.ep) : "-"} ${p.half} ${p.full}`;
}

export function clonePos(p) {
  return { ...p, board: Int8Array.from(p.board), king: [...p.king], stack: [] };
}

// ───────── Saldırı ─────────
export function isAttacked(p, sq, by) {
  const b = p.board;
  for (const s of PAWN_ATT[by][sq]) if (b[s] === by * P) return true;
  for (const s of KNIGHT[sq]) if (b[s] === by * N) return true;
  for (const s of KING[sq]) if (b[s] === by * K) return true;
  for (let d = 0; d < 8; d++) {
    const diag = d >= 4;
    for (const s of RAYS[d][sq]) {
      const pc = b[s];
      if (!pc) continue;
      if (pc * by > 0) {
        const t = Math.abs(pc);
        if (t === Q || (diag ? t === B : t === R)) return true;
      }
      break;
    }
  }
  return false;
}

export const inCheck = (p, color = p.turn) => isAttacked(p, p.king[color === WHITE ? 0 : 1], -color);

// ───────── Hamle üretimi ─────────
/** Sözde-yasal hamleler (şahı açıkta bırakanlar sonradan elenir). caps: yalnızca alma + terfi */
export function genMoves(p, caps = false) {
  const out = [];
  const b = p.board, us = p.turn, them = -us;
  for (let from = 0; from < 64; from++) {
    const pc = b[from];
    if (pc * us <= 0) continue;
    const t = Math.abs(pc);
    if (t === P) {
      const dir = us === WHITE ? 8 : -8;
      const startRank = us === WHITE ? 1 : 6;
      const promoRank = us === WHITE ? 7 : 0;
      const one = from + dir;
      if (one >= 0 && one < 64 && !b[one]) {
        if (rank(one) === promoRank) for (let pr = Q; pr >= N; pr--) out.push(mk(from, one, pr));
        else if (!caps) {
          out.push(mk(from, one));
          if (rank(from) === startRank && !b[one + dir]) out.push(mk(from, one + dir, 0, F_DOUBLE));
        }
      }
      for (const to of PAWN_ATT[them][from]) {
        // from karesinden saldırılan kareler = rakip rengin "saldıran" tablosunun tersi
        if (b[to] * us < 0) {
          if (rank(to) === promoRank) for (let pr = Q; pr >= N; pr--) out.push(mk(from, to, pr, F_CAP));
          else out.push(mk(from, to, 0, F_CAP));
        } else if (to === p.ep && p.ep >= 0 && rank(from) === (us === WHITE ? 4 : 3)) out.push(mk(from, to, 0, F_CAP | F_EP));
      }
    } else if (t === N || t === K) {
      for (const to of (t === N ? KNIGHT : KING)[from]) {
        const x = b[to];
        if (x * us > 0) continue;
        if (x) out.push(mk(from, to, 0, F_CAP));
        else if (!caps) out.push(mk(from, to));
      }
      if (t === K && !caps) genCastle(p, from, out);
    } else {
      const d0 = t === B ? 4 : 0, d1 = t === R ? 4 : 8;
      for (let d = d0; d < d1; d++) {
        for (const to of RAYS[d][from]) {
          const x = b[to];
          if (x * us > 0) break;
          if (x) { out.push(mk(from, to, 0, F_CAP)); break; }
          if (!caps) out.push(mk(from, to));
        }
      }
    }
  }
  return out;
}

function genCastle(p, from, out) {
  const us = p.turn, b = p.board;
  const base = us === WHITE ? 0 : 56;
  if (from !== base + 4) return;
  const ks = us === WHITE ? 1 : 4, qs = us === WHITE ? 2 : 8;
  if (!(p.castle & (ks | qs))) return;
  if (isAttacked(p, from, -us)) return;
  if (p.castle & ks && !b[base + 5] && !b[base + 6] && b[base + 7] === us * R && !isAttacked(p, base + 5, -us) && !isAttacked(p, base + 6, -us)) out.push(mk(from, base + 6, 0, F_CASTLE));
  if (p.castle & qs && !b[base + 3] && !b[base + 2] && !b[base + 1] && b[base] === us * R && !isAttacked(p, base + 3, -us) && !isAttacked(p, base + 2, -us)) out.push(mk(from, base + 2, 0, F_CASTLE));
}

// ───────── Hamle yap / geri al ─────────
export function makeMove(p, m) {
  const b = p.board;
  const from = mFrom(m), to = mTo(m), fl = mFlags(m), promo = mPromo(m);
  const us = p.turn;
  const pc = b[from];
  let cap = b[to];
  const prev = [m, 0, p.castle, p.ep, p.half, p.lo, p.hi];
  let lo = p.lo, hi = p.hi;
  const xor = (z) => { lo ^= z[0]; hi ^= z[1]; };
  // eski ep / rok hash'ini çıkar
  if (epCapturable(p)) xor(Z.ep[file(p.ep)]);
  xor(Z.castle[p.castle]);

  xor(zp(pc, from));
  b[from] = 0;
  if (fl & F_EP) {
    const csq = to - (us === WHITE ? 8 : -8);
    cap = b[csq];
    xor(zp(cap, csq));
    b[csq] = 0;
  } else if (cap) xor(zp(cap, to));
  const placed = promo ? us * promo : pc;
  b[to] = placed;
  xor(zp(placed, to));
  if (fl & F_CASTLE) {
    const rf = to > from ? to + 1 : to - 2, rt = to > from ? to - 1 : to + 1;
    const rook = b[rf];
    xor(zp(rook, rf)); b[rf] = 0;
    b[rt] = rook; xor(zp(rook, rt));
  }
  if (Math.abs(pc) === K) p.king[us === WHITE ? 0 : 1] = to;
  prev[1] = cap;
  p.castle &= CASTLE_MASK[from] & CASTLE_MASK[to];
  p.ep = fl & F_DOUBLE ? (from + to) >> 1 : -1;
  p.half = Math.abs(pc) === P || cap ? 0 : p.half + 1;
  if (us === BLACK) p.full++;
  p.turn = -us;
  xor(Z.side);
  xor(Z.castle[p.castle]);
  p.lo = lo; p.hi = hi;
  if (epCapturable(p)) { p.lo ^= Z.ep[file(p.ep)][0]; p.hi ^= Z.ep[file(p.ep)][1]; }
  p.stack.push(prev);
}

export function unmakeMove(p) {
  const [m, cap, castle, ep, half, lo, hi] = p.stack.pop();
  const b = p.board;
  const from = mFrom(m), to = mTo(m), fl = mFlags(m), promo = mPromo(m);
  p.turn = -p.turn;
  const us = p.turn;
  if (us === BLACK) p.full--;
  const pc = promo ? us * P : b[to];
  b[from] = pc;
  b[to] = 0;
  if (fl & F_EP) b[to - (us === WHITE ? 8 : -8)] = cap;
  else b[to] = cap;
  if (fl & F_CASTLE) {
    const rf = to > from ? to + 1 : to - 2, rt = to > from ? to - 1 : to + 1;
    b[rf] = b[rt];
    b[rt] = 0;
  }
  if (Math.abs(pc) === K) p.king[us === WHITE ? 0 : 1] = from;
  p.castle = castle; p.ep = ep; p.half = half; p.lo = lo; p.hi = hi;
}

/** Null hamle (arama için): sıra değişir, ep silinir */
export function makeNull(p) {
  p.stack.push([0, 0, p.castle, p.ep, p.half, p.lo, p.hi]);
  if (epCapturable(p)) { p.lo ^= Z.ep[file(p.ep)][0]; p.hi ^= Z.ep[file(p.ep)][1]; }
  p.ep = -1;
  p.turn = -p.turn;
  p.lo ^= Z.side[0]; p.hi ^= Z.side[1];
}
export function unmakeNull(p) {
  const [, , castle, ep, half, lo, hi] = p.stack.pop();
  p.turn = -p.turn; p.castle = castle; p.ep = ep; p.half = half; p.lo = lo; p.hi = hi;
}

export function legalMoves(p, caps = false) {
  const out = [];
  const us = p.turn;
  for (const m of genMoves(p, caps)) {
    makeMove(p, m);
    if (!isAttacked(p, p.king[us === WHITE ? 0 : 1], -us)) out.push(m);
    unmakeMove(p);
  }
  return out;
}

export function perft(p, depth) {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of legalMoves(p)) {
    makeMove(p, m);
    n += perft(p, depth - 1);
    unmakeMove(p);
  }
  return n;
}

/** UCI metninden (e2e4, e7e8q) yasal hamle bul */
export function parseUci(p, str) {
  return legalMoves(p).find((m) => moveUci(m) === str) ?? null;
}

// ───────── SAN ─────────
export function toSan(p, m) {
  const from = mFrom(m), to = mTo(m), fl = mFlags(m), promo = mPromo(m);
  const t = Math.abs(p.board[from]);
  let san;
  if (fl & F_CASTLE) san = to > from ? "O-O" : "O-O-O";
  else {
    const isCap = fl & F_CAP;
    if (t === P) san = (isCap ? "abcdefgh"[file(from)] + "x" : "") + sqName(to) + (promo ? "=" + "NBRQ"[promo - 2] : "");
    else {
      let dis = "";
      const rivals = legalMoves(p).filter((x) => x !== m && mTo(x) === to && Math.abs(p.board[mFrom(x)]) === t);
      if (rivals.length) {
        const sameFile = rivals.some((x) => file(mFrom(x)) === file(from));
        const sameRank = rivals.some((x) => rank(mFrom(x)) === rank(from));
        dis = !sameFile ? "abcdefgh"[file(from)] : !sameRank ? String(rank(from) + 1) : sqName(from);
      }
      san = "NBRQK"[t - 2] + dis + (isCap ? "x" : "") + sqName(to);
    }
  }
  makeMove(p, m);
  const chk = inCheck(p);
  const any = chk ? legalMoves(p).length > 0 : true;
  unmakeMove(p);
  return san + (chk ? (any ? "+" : "#") : "");
}

// ───────── Oyun durumu ─────────
export const posKey = (p) => p.lo + ":" + p.hi;

export function insufficientMaterial(p) {
  const minors = [];
  for (let s = 0; s < 64; s++) {
    const t = Math.abs(p.board[s]);
    if (!t || t === K) continue;
    if (t === P || t === R || t === Q) return false;
    minors.push([t, (file(s) + rank(s)) & 1]);
  }
  if (minors.length <= 1) return true;
  // yalnızca aynı renk kareli filler (her iki tarafta bile) → mat imkânsız
  return minors.every(([t, c]) => t === B && c === minors[0][1]);
}

/** Verilen renk tek başına mat edebilir mi? (süre bitince beraberlik/galibiyet kararı için) */
export function canMate(p, color) {
  let minors = 0;
  for (let s = 0; s < 64; s++) {
    const pc = p.board[s];
    if (pc * color <= 0) continue;
    const t = Math.abs(pc);
    if (t === P || t === R || t === Q) return true;
    if (t !== K) minors++;
  }
  return minors >= 2;
}

/**
 * @param keys  bu pozisyona kadar olan pozisyon anahtarları (posKey) — üçlü tekrar için, mevcut dahil
 * @returns {null | {over:true, result:"1-0"|"0-1"|"1/2-1/2", reason:string}}
 */
export function gameStatus(p, keys = []) {
  const moves = legalMoves(p);
  if (!moves.length) {
    if (inCheck(p)) return { over: true, result: p.turn === WHITE ? "0-1" : "1-0", reason: "checkmate" };
    return { over: true, result: "1/2-1/2", reason: "stalemate" };
  }
  if (insufficientMaterial(p)) return { over: true, result: "1/2-1/2", reason: "insufficient" };
  if (p.half >= 100) return { over: true, result: "1/2-1/2", reason: "fifty" };
  const k = posKey(p);
  if (keys.filter((x) => x === k).length >= 3) return { over: true, result: "1/2-1/2", reason: "repetition" };
  return null;
}
