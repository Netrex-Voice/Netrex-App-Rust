/** 4 Bağla — saf mantık + alfa-beta botu. Tahta: 7 sütun × 6 satır; hücre 0 boş, 1 insan, 2 bot. board[col][row], row 0 = alt. */
export const COLS = 7, ROWS = 6;
export const emptyBoard = () => Array.from({ length: COLS }, () => new Array(ROWS).fill(0));
export const canDrop = (b, c) => b[c][ROWS - 1] === 0;
export function drop(b, c, who) {
  if (c < 0 || c >= COLS || !canDrop(b, c)) return null;
  const nb = b.map((col) => col.slice());
  const r = nb[c].indexOf(0);
  nb[c][r] = who;
  return { board: nb, row: r };
}
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
/** Kazanan dizi → [[c,r]x4] ya da null */
export function winLine(b) {
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    const w = b[c][r];
    if (!w) continue;
    for (const [dc, dr] of DIRS) {
      const line = [[c, r]];
      for (let k = 1; k < 4; k++) {
        const nc = c + dc * k, nr = r + dr * k;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS || b[nc][nr] !== w) break;
        line.push([nc, nr]);
      }
      if (line.length === 4) return line;
    }
  }
  return null;
}
export const isFull = (b) => b.every((col) => col[ROWS - 1] !== 0);

function scoreWindow(w, who) {
  const mine = w.filter((x) => x === who).length, opp = w.filter((x) => x === 3 - who).length, e = w.filter((x) => !x).length;
  if (mine && opp) return 0;
  if (mine === 3 && e === 1) return 50;
  if (mine === 2 && e === 2) return 8;
  if (opp === 3 && e === 1) return -60;
  if (opp === 2 && e === 2) return -6;
  return 0;
}
function evaluate(b, who) {
  let s = 0;
  for (let r = 0; r < ROWS; r++) if (b[3][r] === who) s += 4;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) for (const [dc, dr] of DIRS) {
    const w = [];
    for (let k = 0; k < 4; k++) { const nc = c + dc * k, nr = r + dr * k; if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) break; w.push(b[nc][nr]); }
    if (w.length === 4) s += scoreWindow(w, who);
  }
  return s;
}
const ORDER = [3, 2, 4, 1, 5, 0, 6];
function search(b, depth, alpha, beta, turn, me) {
  if (winLine(b)) return { s: turn === me ? -100000 - depth : 100000 + depth }; // son hamleyi yapan kazandı
  if (isFull(b)) return { s: 0 };
  if (depth === 0) return { s: evaluate(b, me) };
  let best = { s: turn === me ? -Infinity : Infinity, c: -1 };
  for (const c of ORDER) {
    const d = drop(b, c, turn);
    if (!d) continue;
    const r = search(d.board, depth - 1, alpha, beta, 3 - turn, me);
    if (turn === me ? r.s > best.s : r.s < best.s) best = { s: r.s, c };
    if (turn === me) alpha = Math.max(alpha, best.s); else beta = Math.min(beta, best.s);
    if (alpha >= beta) break;
  }
  return best;
}
/** Botun hamlesi (sütun). depth: 1 çok kolay … 8 zor. mistake: rastgele hamle olasılığı */
export function botMove(b, who = 2, depth = 5, mistake = 0, rng = Math.random) {
  const legal = ORDER.filter((c) => canDrop(b, c));
  if (!legal.length) return -1;
  if (mistake && rng() < mistake) return legal[Math.floor(rng() * legal.length)];
  return search(b, depth, -Infinity, Infinity, who, who).c;
}
