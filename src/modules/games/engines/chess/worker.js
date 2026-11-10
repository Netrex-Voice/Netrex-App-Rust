/* Satranç botu Web Worker'ı: arama arayüzü dondurmasın diye ayrı iş parçacığında çalışır */
import { bestMove, replay } from "./search.js";
import { moveUci } from "./core.js";

self.onmessage = (e) => {
  const { id, fen, moves, opts } = e.data;
  try {
    const { p, history } = replay(fen, moves);
    const r = bestMove(p, { ...opts, history });
    self.postMessage({ id, move: r.move ? moveUci(r.move) : null, score: r.score, depth: r.depth, nodes: r.nodes });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message ? err.message : err) });
  }
};
