/**
 * Bot düşünme isteği: Web Worker varsa orada, yoksa (ya da Worker açılamazsa) ana iş parçacığında kısa süreyle.
 * think({fen, moves, opts}) → Promise<{move:uci|null, score, depth}>
 */
import { bestMove, replay } from "./search.js";
import { moveUci } from "./core.js";

let worker = null; // null: denenmedi · false: kullanılamaz · Worker
let seq = 0;
const pending = new Map();
const FALLBACK_MS = 700; // Worker yoksa arayüzü uzun dondurmamak için üst sınır

function runSync({ fen, moves, opts }) {
  const { p, history } = replay(fen, moves);
  const r = bestMove(p, { ...opts, timeMs: Math.min(opts.timeMs ?? FALLBACK_MS, FALLBACK_MS), depth: Math.min(opts.depth ?? 4, 6), history });
  return { move: r.move ? moveUci(r.move) : null, score: r.score, depth: r.depth };
}

function ensure() {
  if (worker !== null) return worker;
  try {
    if (typeof Worker === "undefined") return (worker = false);
    const w = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    w.onmessage = (e) => {
      const { id, error, ...res } = e.data;
      const job = pending.get(id);
      if (!job) return;
      pending.delete(id);
      if (error) job.resolve(runSync(job.req));
      else job.resolve(res);
    };
    w.onerror = () => {
      // Worker yüklenemedi: bekleyenleri ana iş parçacığında çöz ve bir daha deneme
      worker = false;
      for (const [, job] of pending) setTimeout(() => job.resolve(runSync(job.req)), 0);
      pending.clear();
    };
    return (worker = w);
  } catch (e) {
    return (worker = false);
  }
}

export function think(req) {
  return new Promise((resolve) => {
    const w = ensure();
    if (!w) return setTimeout(() => resolve(runSync(req)), 0);
    const id = ++seq;
    pending.set(id, { resolve, req });
    w.postMessage({ id, ...req });
  });
}

export function stopThinking() {
  // Süren aramayı iptal etmenin ucuz yolu: Worker'ı kapatıp bir sonrakinde yenisini açmak
  if (worker) worker.terminate();
  worker = null;
  for (const [, job] of pending) job.resolve({ move: null, cancelled: true });
  pending.clear();
}
