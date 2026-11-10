/**
 * ♟️ Satranç yapay zekâsı: değerlendirme + alfa-beta araması (saf JS, Worker'da ya da Node'da çalışır)
 *
 * Arama: yinelemeli derinleştirme, negamax + alfa-beta, geçiş tablosu, boş hamle budaması, hamle sıralama
 * (TT / alma MVV-LVA / öldürücü / geçmiş), sakin arama (quiescence), şah çekme uzatması, LMR.
 * Seviye: derinlik + süre + "hata" (kök hamleleri arasında en iyiden cp farkı içinde seçim) + çuval (rastgele hamle) olasılığı.
 */
import { P, N, B, R, Q, K, WHITE, BLACK, genMoves, makeMove, unmakeMove, makeNull, unmakeNull, isAttacked, inCheck, mFrom, mTo, mPromo, mFlags, F_CAP, F_EP, legalMoves, fromFen, parseUci, posKey } from "./core.js";

export const MATE = 30000;
const INF = 32000;
const VAL = [0, 100, 320, 330, 500, 900, 0];

// Beyaz bakışıyla, 8. sıra ilk satır (Michniewski basit değerlendirme tabloları)
const PST = {
  [P]: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  [N]: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  [B]: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  [R]: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  [Q]: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  [K]: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};
const KING_END = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];
const pstIdx = (sq, color) => (color === WHITE ? (7 - (sq >> 3)) * 8 + (sq & 7) : (sq >> 3) * 8 + (sq & 7));

/** Statik değerlendirme (santipiyon), hamle sırası olanın bakışıyla */
export function evaluate(p) {
  const b = p.board;
  let score = 0, material = 0;
  const pawnFiles = [new Int8Array(8), new Int8Array(8)]; // [beyaz, siyah] dosya başına piyon
  const bishops = [0, 0];
  for (let s = 0; s < 64; s++) {
    const pc = b[s];
    if (!pc) continue;
    const t = Math.abs(pc);
    if (t === P) pawnFiles[pc > 0 ? 0 : 1][s & 7]++;
    else if (t !== K) material += VAL[t];
  }
  const endgame = material < 2600;
  for (let s = 0; s < 64; s++) {
    const pc = b[s];
    if (!pc) continue;
    const t = Math.abs(pc), c = pc > 0 ? WHITE : BLACK;
    const side = c === WHITE ? 0 : 1;
    let v = VAL[t] + (t === K && endgame ? KING_END[pstIdx(s, c)] : PST[t][pstIdx(s, c)]);
    const f = s & 7, r = s >> 3;
    if (t === P) {
      const mine = pawnFiles[side], theirs = pawnFiles[1 - side];
      if (mine[f] > 1) v -= 10;
      if ((f === 0 || !mine[f - 1]) && (f === 7 || !mine[f + 1])) v -= 12;
      // geçer piyon: önünde ve yanlarda rakip piyon yok
      let passed = !theirs[f];
      if (passed) {
        for (const nf of [f - 1, f + 1]) if (nf >= 0 && nf < 8 && theirs[nf]) passed = false;
        if (passed) {
          const adv = c === WHITE ? r - 1 : 6 - r; // 0..5
          v += 10 + 2 * adv * adv;
        }
      }
    } else if (t === R) {
      if (!pawnFiles[side][f] && !pawnFiles[1 - side][f]) v += 18; // açık hat
      else if (!pawnFiles[side][f]) v += 8; // yarı açık
    } else if (t === B) bishops[side]++;
    score += c * v;
  }
  if (bishops[0] >= 2) score += 30;
  if (bishops[1] >= 2) score -= 30;
  return score * p.turn + 8; // +8: hamle sırası avantajı
}

const hasPieces = (p, color) => {
  for (let s = 0; s < 64; s++) {
    const t = p.board[s] * color;
    if (t > P) if (t !== K) return true;
  }
  return false;
};

class Searcher {
  constructor(p, { timeMs = 1000, maxNodes = Infinity, history = [] } = {}) {
    this.p = p;
    this.deadline = Date.now() + timeMs;
    this.maxNodes = maxNodes;
    this.nodes = 0;
    this.stop = false;
    this.tt = new Map();
    this.killers = Array.from({ length: 160 }, () => [0, 0]);
    this.hist = new Int32Array(64 * 64);
    this.path = history.slice(); // tekrar tespiti için bu pozisyona kadar gelen hash'ler (lo)
  }

  tick() {
    if ((++this.nodes & 1023) === 0 && (Date.now() > this.deadline || this.nodes > this.maxNodes)) this.stop = true;
    return this.stop;
  }

  score(m, ttMove, ply) {
    if (m === ttMove) return 1e7;
    const fl = mFlags(m);
    if (fl & F_CAP) {
      const victim = fl & F_EP ? P : Math.abs(this.p.board[mTo(m)]);
      return 1e6 + victim * 16 - Math.abs(this.p.board[mFrom(m)]) + (mPromo(m) ? 800 : 0);
    }
    if (mPromo(m)) return 9e5 + mPromo(m);
    const k = this.killers[ply];
    if (m === k[0]) return 8e5;
    if (m === k[1]) return 7e5;
    return this.hist[mFrom(m) * 64 + mTo(m)];
  }

  ordered(moves, ttMove, ply) {
    const sc = moves.map((m) => this.score(m, ttMove, ply));
    const idx = moves.map((_, i) => i).sort((a, b) => sc[b] - sc[a]);
    return idx.map((i) => moves[i]);
  }

  repeated() {
    const p = this.p, n = this.path.length;
    for (let i = n - 2, c = 2; i >= 0 && c <= p.half; i -= 2, c += 2) if (this.path[i] === p.lo) return true;
    return false;
  }

  quiesce(alpha, beta, ply) {
    if (this.tick()) return 0;
    const p = this.p;
    const stand = evaluate(p);
    if (ply >= 64) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    const us = p.turn;
    for (const m of this.ordered(genMoves(p, true), 0, ply)) {
      // delta budaması: alınan taş + marj alfa'yı geçemiyorsa atla
      if (!mPromo(m) && stand + (mFlags(m) & F_EP ? 100 : VAL[Math.abs(p.board[mTo(m)])]) + 200 < alpha) continue;
      makeMove(p, m);
      if (isAttacked(p, p.king[us === WHITE ? 0 : 1], -us)) { unmakeMove(p); continue; }
      const s = -this.quiesce(-beta, -alpha, ply + 1);
      unmakeMove(p);
      if (this.stop) return 0;
      if (s >= beta) return s;
      if (s > alpha) alpha = s;
    }
    return alpha;
  }

  negamax(depth, alpha, beta, ply, canNull = true) {
    if (this.tick()) return 0;
    const p = this.p;
    if (ply > 0 && (p.half >= 100 || this.repeated())) return 0;
    const check = inCheck(p);
    if (check) depth++;
    if (depth <= 0) return this.quiesce(alpha, beta, ply);

    const alpha0 = alpha;
    const key = p.lo >>> 0;
    const e = this.tt.get(key);
    let ttMove = 0;
    if (e && e.hi === p.hi) {
      ttMove = e.move;
      if (e.depth >= depth && ply > 0) {
        if (e.flag === 0) return e.score;
        if (e.flag === 1 && e.score >= beta) return e.score;
        if (e.flag === 2 && e.score <= alpha) return e.score;
      }
    }
    const pv = beta - alpha > 1;
    // Boş hamle: pozisyon beta'yı zaten aşıyorsa tek hamle bırakmak bile yeter
    if (canNull && !pv && !check && depth >= 3 && hasPieces(p, p.turn) && evaluate(p) >= beta) {
      this.path.push(p.lo);
      makeNull(p);
      const s = -this.negamax(depth - 3, -beta, -beta + 1, ply + 1, false);
      unmakeNull(p);
      this.path.pop();
      if (this.stop) return 0;
      if (s >= beta) return s >= MATE - 100 ? beta : s;
    }

    const us = p.turn;
    let best = -INF, bestMove = 0, legal = 0;
    const moves = this.ordered(genMoves(p), ttMove, ply);
    this.path.push(p.lo);
    for (const m of moves) {
      makeMove(p, m);
      if (isAttacked(p, p.king[us === WHITE ? 0 : 1], -us)) { unmakeMove(p); continue; }
      legal++;
      const quiet = !(mFlags(m) & F_CAP) && !mPromo(m);
      let s;
      if (legal > 1) {
        const red = quiet && depth >= 3 && legal > 4 && !check ? 1 : 0;
        s = -this.negamax(depth - 1 - red, -alpha - 1, -alpha, ply + 1);
        if (s > alpha && (red || s < beta)) s = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      } else s = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      unmakeMove(p);
      if (this.stop) { this.path.pop(); return 0; }
      if (s > best) { best = s; bestMove = m; }
      if (s > alpha) alpha = s;
      if (alpha >= beta) {
        if (quiet) {
          const k = this.killers[ply];
          if (k[0] !== m) { k[1] = k[0]; k[0] = m; }
          this.hist[mFrom(m) * 64 + mTo(m)] += depth * depth;
        }
        break;
      }
    }
    this.path.pop();
    if (!legal) return check ? -MATE + ply : 0;
    if (this.tt.size > 300000) this.tt.clear();
    this.tt.set(key, { hi: p.hi, depth, score: best, move: bestMove, flag: best <= alpha0 ? 2 : best >= beta ? 1 : 0 });
    return best;
  }
}

/**
 * En iyi hamleyi bul.
 * @param p        pozisyon (değişmez: iş bittiğinde aynı durumda)
 * @param opts     { depth, timeMs, maxNodes, errorCp, blunder, rng, history }
 * @returns { move, score, depth, nodes, scores? }
 */
export function bestMove(p, { depth = 4, timeMs = 1000, maxNodes = Infinity, errorCp = 0, blunder = 0, rng = Math.random, history = [] } = {}) {
  const roots = legalMoves(p);
  if (!roots.length) return { move: 0, score: 0, depth: 0, nodes: 0 };
  if (roots.length === 1) return { move: roots[0], score: 0, depth: 0, nodes: 0, forced: true };
  // "Çuval": zayıf seviyelerde ara sıra tamamen rastgele (ama yasal) hamle
  if (blunder > 0 && rng() < blunder) return { move: roots[Math.floor(rng() * roots.length)], score: 0, depth: 0, nodes: 0, blunder: true };

  const S = new Searcher(p, { timeMs, maxNodes, history });
  let best = { move: roots[0], score: 0, depth: 0 };
  let scores = null;
  for (let d = 1; d <= depth; d++) {
    const ordered = S.ordered(roots, best.move, 0);
    const cur = [];
    let alpha = -INF;
    let done = true;
    for (const m of ordered) {
      makeMove(p, m);
      S.path.push(p.stack[p.stack.length - 1][5]);
      // hata payı olan seviyede tüm kök hamleler tam pencereyle ölçülür (seçim için gerçek puan gerekir)
      const s = -S.negamax(d - 1, -INF, errorCp ? INF : -alpha, 1);
      S.path.pop();
      unmakeMove(p);
      if (S.stop) { done = false; break; }
      cur.push([m, s]);
      if (s > alpha) alpha = s;
    }
    if (!done) {
      if (cur.length && d === 1) { best = pickBest(cur); scores = cur; }
      break;
    }
    cur.sort((a, b) => b[1] - a[1]);
    best = { move: cur[0][0], score: cur[0][1], depth: d };
    scores = cur;
    if (Math.abs(best.score) > MATE - 100) break; // mat bulundu
  }
  let move = best.move;
  if (errorCp > 0 && scores && Math.abs(best.score) < MATE - 100) {
    // En iyiden errorCp içindeki hamlelerden, daha iyi olana daha çok ağırlıkla seç
    const top = scores[0][1];
    const pool = scores.filter(([, s]) => s >= top - errorCp && s > -MATE + 100);
    let total = 0;
    const w = pool.map(([, s]) => { const x = 1 + (s - (top - errorCp)); total += x; return x; });
    let r = rng() * total;
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) { move = pool[i][0]; break; } }
  }
  return { move, score: best.score, depth: best.depth, nodes: S.nodes, scores };
}
const pickBest = (cur) => { const b = cur.reduce((a, c) => (c[1] > a[1] ? c : a)); return { move: b[0], score: b[1], depth: 1 }; };

/** Başlangıç FEN'i + UCI hamle listesinden pozisyon ve geçmiş hash'ler (worker/test için) */
export function replay(fen, moves = []) {
  const p = fromFen(fen);
  const history = [p.lo];
  for (const u of moves) {
    const m = parseUci(p, u);
    if (!m) break;
    makeMove(p, m);
    history.push(p.lo);
  }
  p.stack.length = 0; // geri alma yığınını bırak (arama kendi yığınını kullanır)
  return { p, history: history.slice(0, -1), keys: history };
}

export { posKey };
