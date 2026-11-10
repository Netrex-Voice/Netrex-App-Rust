// Motorlar için küçük ortak yardımcılar (saf, bağımlılıksız — Node'da test edilir)

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const fin = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
export const r1 = (v) => Math.round(v * 10) / 10;

/** Tohumlanabilir RNG (mulberry32): testlerde deterministik, canlıda Math.random ile tohumlanır */
export function makeRng(seed = Math.floor(Math.random() * 2 ** 31)) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
