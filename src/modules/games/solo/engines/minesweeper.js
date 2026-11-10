/** Mayın Tarlası — saf mantık. Hücre: {mine, n (komşu mayın), open, flag}. İlk tık ve çevresi güvenlidir. */
export const LEVELS = {
  easy: { w: 9, h: 9, mines: 10, label: "Kolay" },
  medium: { w: 16, h: 16, mines: 40, label: "Orta" },
  hard: { w: 24, h: 16, mines: 80, label: "Zor" },
};

export function blank(w, h) {
  return { w, h, cells: Array.from({ length: w * h }, () => ({ mine: false, n: 0, open: false, flag: false })), placed: false, lost: false, won: false, opened: 0, mines: 0 };
}
const around = (g, i) => {
  const x = i % g.w, y = (i / g.w) | 0, out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < g.w && ny < g.h) out.push(ny * g.w + nx);
  }
  return out;
};

function place(g, safe, mines, rng) {
  const bad = new Set([safe, ...around(g, safe)]);
  const pool = [];
  for (let i = 0; i < g.cells.length; i++) if (!bad.has(i)) pool.push(i);
  for (let k = 0; k < mines && pool.length; k++) {
    const j = Math.floor(rng() * pool.length);
    g.cells[pool[j]].mine = true;
    pool.splice(j, 1);
    g.mines++;
  }
  g.cells.forEach((c, i) => (c.n = around(g, i).filter((j) => g.cells[j].mine).length));
  g.placed = true;
}

/** Açar; ilk açılışta mayınları yerleştirir. g'yi yerinde değiştirir. */
export function reveal(g, i, mines, rng = Math.random) {
  if (g.lost || g.won) return g;
  const c = g.cells[i];
  if (c.open || c.flag) return g;
  if (!g.placed) place(g, i, mines, rng);
  if (c.mine) { c.open = true; g.lost = true; return g; }
  const stack = [i];
  while (stack.length) {
    const k = stack.pop(), ck = g.cells[k];
    if (ck.open || ck.flag) continue;
    ck.open = true;
    g.opened++;
    if (ck.n === 0) for (const j of around(g, k)) if (!g.cells[j].open) stack.push(j);
  }
  if (g.opened === g.cells.length - g.mines) { g.won = true; g.cells.forEach((x) => x.mine && (x.flag = true)); }
  return g;
}
export function flag(g, i) {
  const c = g.cells[i];
  if (g.lost || g.won || c.open) return g;
  c.flag = !c.flag;
  return g;
}
/** Açık sayıya çift tık: etraftaki bayrak sayısı eşitse kalanları aç */
export function chord(g, i, mines, rng) {
  const c = g.cells[i];
  if (!c.open || c.n === 0) return g;
  const ar = around(g, i);
  if (ar.filter((j) => g.cells[j].flag).length !== c.n) return g;
  for (const j of ar) if (!g.cells[j].flag) reveal(g, j, mines, rng);
  return g;
}
export const flagsLeft = (g, mines) => mines - g.cells.filter((c) => c.flag).length;
