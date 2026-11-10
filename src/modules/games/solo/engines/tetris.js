/** Blok Yığma (Tetris tarzı) — saf mantık. 10×20, 7 parça, 7'li torba, duvar tepmesi, kademeli hız. */
export const W = 10, H = 20;
export const KINDS = ["I", "O", "T", "S", "Z", "J", "L"];
const SHAPES = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
};
export const COLORS = { I: "#22d3ee", O: "#facc15", T: "#a855f7", S: "#22c55e", Z: "#ef4444", J: "#3b82f6", L: "#f97316" };
const SIZE = { I: 4, O: 4, T: 3, S: 3, Z: 3, J: 3, L: 3 };

/** Parçanın hücreleri (rot 0..3), kutu içinde saat yönünde döndürülmüş */
export function cells(kind, rot) {
  const n = SIZE[kind];
  let c = SHAPES[kind];
  for (let r = 0; r < rot; r++) c = c.map(([x, y]) => [n - 1 - y, x]);
  return c;
}

export function newGame(rng = Math.random) {
  const g = { grid: Array.from({ length: H }, () => new Array(W).fill(null)), bag: [], piece: null, next: null, score: 0, lines: 0, level: 1, over: false, rng, combo: 0 };
  g.next = draw(g);
  spawn(g);
  return g;
}
function draw(g) {
  if (!g.bag.length) {
    g.bag = KINDS.slice();
    for (let i = g.bag.length - 1; i > 0; i--) { const j = Math.floor(g.rng() * (i + 1)); [g.bag[i], g.bag[j]] = [g.bag[j], g.bag[i]]; }
  }
  return g.bag.pop();
}
const fits = (g, kind, rot, x, y) => cells(kind, rot).every(([cx, cy]) => {
  const gx = x + cx, gy = y + cy;
  return gx >= 0 && gx < W && gy < H && (gy < 0 || !g.grid[gy][gx]);
});
function spawn(g) {
  const kind = g.next;
  g.next = draw(g);
  g.piece = { kind, rot: 0, x: 3, y: -1 };
  if (!fits(g, kind, 0, 3, -1) && !fits(g, kind, 0, 3, 0)) g.over = true;
  return g;
}
export function tryMove(g, dx, dy) {
  const p = g.piece;
  if (g.over || !fits(g, p.kind, p.rot, p.x + dx, p.y + dy)) return false;
  p.x += dx; p.y += dy;
  return true;
}
export function rotate(g, dir = 1) {
  const p = g.piece;
  if (g.over) return false;
  const rot = (p.rot + dir + 4) % 4;
  for (const kx of [0, -1, 1, -2, 2]) if (fits(g, p.kind, rot, p.x + kx, p.y)) { p.rot = rot; p.x += kx; return true; }
  return false;
}
export function ghostY(g) {
  const p = g.piece;
  let y = p.y;
  while (fits(g, p.kind, p.rot, p.x, y + 1)) y++;
  return y;
}
const POINTS = [0, 100, 300, 500, 800];
/** Parçayı kilitle, satırları temizle, yenisini getir → temizlenen satır sayısı */
export function lock(g) {
  const p = g.piece;
  for (const [cx, cy] of cells(p.kind, p.rot)) {
    const gy = p.y + cy;
    if (gy < 0) { g.over = true; return 0; }
    g.grid[gy][p.x + cx] = p.kind;
  }
  let cleared = 0;
  for (let y = H - 1; y >= 0; y--) {
    if (g.grid[y].every(Boolean)) { g.grid.splice(y, 1); g.grid.unshift(new Array(W).fill(null)); cleared++; y++; }
  }
  g.lines += cleared;
  g.combo = cleared ? g.combo + 1 : 0;
  g.score += POINTS[cleared] * g.level + (cleared && g.combo > 1 ? 50 * (g.combo - 1) * g.level : 0);
  g.level = 1 + Math.floor(g.lines / 10);
  spawn(g);
  return cleared;
}
export function hardDrop(g) {
  const y = ghostY(g);
  g.score += 2 * (y - g.piece.y);
  g.piece.y = y;
  return lock(g);
}
/** Bir yerçekimi adımı: inemiyorsa kilitler. → {locked, cleared} */
export function gravity(g) {
  if (tryMove(g, 0, 1)) return { locked: false, cleared: 0 };
  return { locked: true, cleared: lock(g) };
}
export const dropInterval = (level) => Math.max(0.07, 0.8 * Math.pow(0.82, level - 1)); // saniye
