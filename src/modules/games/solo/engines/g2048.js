/** 2048 — saf mantık. Tahta: 16 sayı (satır-major), 0 = boş. */
export const N = 4;
export const empty = () => new Array(N * N).fill(0);

export function spawn(b, rng = Math.random) {
  const free = [];
  b.forEach((v, i) => v === 0 && free.push(i));
  if (!free.length) return b;
  const nb = b.slice();
  nb[free[Math.floor(rng() * free.length)]] = rng() < 0.9 ? 2 : 4;
  return nb;
}
export function start(rng = Math.random) {
  return spawn(spawn(empty(), rng), rng);
}

/** Bir satırı sola kaydır/birleştir → { line, gained } */
function slide(line) {
  const t = line.filter(Boolean);
  const out = [];
  let gained = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === t[i + 1]) { out.push(t[i] * 2); gained += t[i] * 2; i++; }
    else out.push(t[i]);
  }
  while (out.length < N) out.push(0);
  return { line: out, gained };
}

/** dir: left | right | up | down → { board, gained, moved } (yeni taş EKLENMEZ) */
export function move(b, dir) {
  const nb = b.slice();
  let gained = 0;
  for (let k = 0; k < N; k++) {
    const idx = [];
    for (let j = 0; j < N; j++) idx.push(dir === "left" ? k * N + j : dir === "right" ? k * N + (N - 1 - j) : dir === "up" ? j * N + k : (N - 1 - j) * N + k);
    const r = slide(idx.map((i) => b[i]));
    gained += r.gained;
    idx.forEach((i, j) => (nb[i] = r.line[j]));
  }
  return { board: nb, gained, moved: nb.some((v, i) => v !== b[i]) };
}
export const canMove = (b) => ["left", "right", "up", "down"].some((d) => move(b, d).moved);
export const maxTile = (b) => Math.max(...b);
