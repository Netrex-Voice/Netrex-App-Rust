/**
 * Satranç oyunu yardımcıları (saf): UCI hamle listesinden pozisyon, SAN, alınan taşlar, süre ve sonuç mantığı.
 * Bir oyun yalnızca { startFen, moves:[uci] } ile tanımlanır; her şey buradan türetilir (kaydetmesi/yüklemesi kolay).
 */
import { fromFen, makeMove, parseUci, toSan, gameStatus, posKey, moveUci, mFrom, mTo, canMate, inCheck, WHITE, BLACK, START_FEN } from "./core.js";

export { START_FEN };

/** @returns { pos, sans, keys, last:{from,to}|null, status } — geçersiz hamle gelirse orada keser */
export function build(startFen, moves) {
  const pos = fromFen(startFen);
  const sans = [];
  const keys = [posKey(pos)];
  let last = null;
  const played = [];
  for (const u of moves) {
    const m = parseUci(pos, u);
    if (!m) break;
    sans.push(toSan(pos, m));
    makeMove(pos, m);
    played.push(u);
    keys.push(posKey(pos));
    last = { from: mFrom(m), to: mTo(m) };
  }
  pos.stack.length = 0;
  return { pos, sans, keys, last, played, status: gameStatus(pos, keys) };
}

/** Belirli bir yarım hamlede (0 = başlangıç) pozisyon: inceleme için */
export function at(startFen, moves, ply) {
  return build(startFen, moves.slice(0, ply));
}

const START_COUNT = { 1: 8, 2: 2, 3: 2, 4: 2, 5: 1 };
const VAL = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9 };

/** Her renk için alınmış (karşı tarafça) taşlar ve materyal farkı (beyaz lehine +) */
export function captured(board) {
  const count = { 1: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, [-1]: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  for (let s = 0; s < 64; s++) {
    const pc = board[s];
    if (pc && Math.abs(pc) !== 6) count[pc > 0 ? 1 : -1][Math.abs(pc)]++;
  }
  const lost = { 1: [], [-1]: [] }; // renk → o rengin kaybettiği taşlar (tür)
  let mat = 0;
  for (const c of [1, -1]) {
    for (const t of [5, 4, 3, 2, 1]) {
      for (let i = count[c][t]; i < START_COUNT[t]; i++) lost[c].push(t);
      mat += c * VAL[t] * count[c][t];
    }
  }
  return { lost, diff: mat };
}

/** Süre bitince sonuç: rakip mat edemiyorsa beraberlik */
export function flagResult(pos, flaggedColor) {
  const other = -flaggedColor;
  if (!canMate(pos, other)) return { result: "1/2-1/2", reason: "timeout_vs_insufficient" };
  return { result: flaggedColor === WHITE ? "0-1" : "1-0", reason: "timeout" };
}

export const REASON_TEXT = {
  checkmate: "Şah mat",
  stalemate: "Pat",
  insufficient: "Yetersiz materyal",
  fifty: "50 hamle kuralı",
  repetition: "Üçlü tekrar",
  resign: "Terk",
  timeout: "Süre bitti",
  timeout_vs_insufficient: "Süre bitti (rakip mat edemez)",
  agreed: "Beraberlik anlaşması",
};

/** Oyuncunun bakışıyla sonuç: 1 / 0.5 / 0 */
export function scoreFor(result, myColor) {
  if (result === "1/2-1/2") return 0.5;
  return (result === "1-0") === (myColor === "w") ? 1 : 0;
}

export const timeText = (ms) => {
  const t = Math.max(0, ms);
  if (t < 10000) return (t / 1000).toFixed(1);
  const s = Math.ceil(t / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const TIME_CONTROLS = [
  { id: "1+0", min: 1, inc: 0 },
  { id: "2+1", min: 2, inc: 1 },
  { id: "3+0", min: 3, inc: 0 },
  { id: "3+2", min: 3, inc: 2 },
  { id: "5+0", min: 5, inc: 0 },
  { id: "5+3", min: 5, inc: 3 },
  { id: "10+0", min: 10, inc: 0 },
  { id: "15+10", min: 15, inc: 10 },
  { id: "30+0", min: 30, inc: 0 },
];
export { moveUci, inCheck, BLACK, WHITE };
