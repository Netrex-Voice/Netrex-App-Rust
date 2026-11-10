import test from "node:test";
import assert from "node:assert/strict";
import { fromFen, toFen, perft, legalMoves, makeMove, unmakeMove, parseUci, toSan, gameStatus, posKey, START_FEN, insufficientMaterial, canMate, WHITE, BLACK } from "../engines/chess/core.js";

// Bilinen perft sayıları (chessprogramming.org)
const PERFT = [
  [START_FEN, [20, 400, 8902, 197281]],
  ["r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", [48, 2039, 97862]], // Kiwipete
  ["8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", [14, 191, 2812, 43238]],
  ["r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", [6, 264, 9467]],
  ["rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", [44, 1486, 62379]],
];
for (const [fen, counts] of PERFT) {
  test(`perft ${fen.split(" ")[0].slice(0, 20)}…`, () => {
    const p = fromFen(fen);
    counts.forEach((n, i) => assert.equal(perft(p, i + 1), n, `derinlik ${i + 1}`));
    assert.equal(toFen(p), toFen(fromFen(fen)), "make/unmake pozisyonu bozmadı");
  });
}

test("FEN gidiş-dönüş, hash tutarlılığı (make/unmake ve yer değiştirme)", () => {
  const p = fromFen(START_FEN);
  assert.equal(toFen(p), START_FEN);
  const k0 = posKey(p);
  for (const m of legalMoves(p)) { makeMove(p, m); unmakeMove(p); assert.equal(posKey(p), k0); }
  // Nf3 Nf6 Ng1 Ng8 → başlangıç pozisyonu aynı hash (üçlü tekrar altyapısı)
  for (const u of ["g1f3", "g8f6", "f3g1", "f6g8"]) makeMove(p, parseUci(p, u));
  assert.equal(posKey(p), k0);
  // aynı pozisyona farklı hamle sırası
  const a = fromFen(START_FEN), b = fromFen(START_FEN);
  for (const u of ["e2e4", "e7e5", "g1f3"]) makeMove(a, parseUci(a, u));
  for (const u of ["g1f3", "e7e5", "e2e4"]) makeMove(b, parseUci(b, u));
  assert.equal(posKey(a), posKey(b), "transpozisyon");
});

test("SAN: rok, terfi, belirsizlik, şah ve mat", () => {
  let p = fromFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  assert.equal(toSan(p, parseUci(p, "e1g1")), "O-O");
  assert.equal(toSan(p, parseUci(p, "e1c1")), "O-O-O");
  p = fromFen("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
  assert.equal(toSan(p, parseUci(p, "a7a8q")), "a8=Q+");
  p = fromFen("7k/8/8/8/8/8/8/R3R1K1 w - - 0 1");
  assert.equal(toSan(p, parseUci(p, "a1c1")), "Rac1");
  assert.equal(toSan(p, parseUci(p, "e1c1")), "Rec1");
  p = fromFen("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
  assert.equal(toSan(p, parseUci(p, "a1a8")), "Ra8#");
  // kısa mat (çoban matı)
  p = fromFen(START_FEN);
  const san = [];
  for (const u of ["e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6", "h5f7"]) { const m = parseUci(p, u); san.push(toSan(p, m)); makeMove(p, m); }
  assert.deepEqual(san.slice(-1), ["Qxf7#"]);
  assert.equal(gameStatus(p).reason, "checkmate");
  assert.equal(gameStatus(p).result, "1-0");
});

test("pat, yetersiz materyal, 50 hamle, üçlü tekrar, geçerken alma / rok hakları", () => {
  assert.equal(gameStatus(fromFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")).reason, "stalemate");
  assert.equal(insufficientMaterial(fromFen("8/8/4k3/8/8/3K4/8/8 w - - 0 1")), true);
  assert.equal(insufficientMaterial(fromFen("8/8/4k3/8/8/3KB3/8/8 w - - 0 1")), true);
  assert.equal(insufficientMaterial(fromFen("8/8/4k3/8/8/3KB1B1/8/8 w - - 0 1")), true, "aynı renk kareli iki fil: mat imkânsız");
  assert.equal(insufficientMaterial(fromFen("8/8/4k3/8/8/3KBB2/8/8 w - - 0 1")), false, "zıt renk kareli filler mat verebilir");
  assert.equal(insufficientMaterial(fromFen("8/8/4k3/8/8/3KP3/8/8 w - - 0 1")), false);
  assert.equal(gameStatus(fromFen("8/8/4k3/8/8/3KR3/8/8 w - - 100 80")).reason, "fifty");
  const p = fromFen(START_FEN);
  const keys = [posKey(p)];
  for (let i = 0; i < 2; i++) for (const u of ["g1f3", "g8f6", "f3g1", "f6g8"]) { makeMove(p, parseUci(p, u)); keys.push(posKey(p)); }
  assert.equal(gameStatus(p, keys).reason, "repetition");
  // geçerken alma
  const e = fromFen("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
  assert.ok(parseUci(e, "e5d6"), "ep yasal");
  makeMove(e, parseUci(e, "e5d6"));
  assert.equal(toFen(e).split(" ")[0], "4k3/8/3P4/8/8/8/8/4K3");
  unmakeMove(e);
  assert.equal(e.board[35], -1, "ep geri alınınca piyon geri gelir");
  // şah çekilmişken rok yok, kule hareket edince hak gider
  const c = fromFen("4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1");
  assert.equal(parseUci(c, "e1g1"), null, "şahta rok yapılamaz");
  assert.equal(canMate(fromFen("8/8/4k3/8/8/3KN3/8/8 w - - 0 1"), WHITE), false);
  assert.equal(canMate(fromFen("8/8/4k3/8/8/3KNN2/8/8 w - - 0 1"), WHITE), true);
});

// ───────── Arama ─────────
import { bestMove, replay, evaluate, MATE } from "../engines/chess/search.js";
import { moveUci } from "../engines/chess/core.js";

test("arama: bir hamlede mat, iki hamlede mat, bedava taş", () => {
  let p = fromFen("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
  assert.equal(moveUci(bestMove(p, { depth: 3, timeMs: 3000 }).move), "a1a8");
  // iki hamlede mat (Lucena benzeri basit merdiven): iki kule
  p = fromFen("7k/8/8/8/8/8/R7/1R4K1 w - - 0 1");
  const r = bestMove(p, { depth: 4, timeMs: 5000 });
  assert.ok(r.score > MATE - 10, `mat görülmeli (${r.score})`);
  // bedava vezir
  p = fromFen("4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1");
  assert.equal(moveUci(bestMove(p, { depth: 3, timeMs: 3000 }).move), "d1d5");
  assert.equal(toFen(p), "4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1", "arama pozisyonu bozmaz");
});

test("değerlendirme: simetrik ve materyali tanır", () => {
  assert.equal(evaluate(fromFen(START_FEN)), evaluate(fromFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1")) , "başlangıçta iki taraf eşit bakar");
  assert.ok(evaluate(fromFen("rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")) > 700, "vezir üstünlüğü");
});

test("seviyeler: derin bot sığ botu yener, hata/çuval parametreleri rastgeleliği getirir", () => {
  const rngOf = (seed) => { let s = seed; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const play = (wDepth, bDepth, seed) => {
    const rng = rngOf(seed);
    const moves = [];
    for (let i = 0; i < 160; i++) {
      const { p, keys } = replay(START_FEN, moves);
      const st = gameStatus(p);
      if (st) return st.result;
      const lvl = p.turn === WHITE ? wDepth : bDepth;
      const r = bestMove(p, { depth: lvl, timeMs: 400, errorCp: lvl <= 1 ? 150 : 0, blunder: lvl <= 1 ? 0.2 : 0, rng, history: keys.slice(0, -1) });
      if (!r.move) break;
      moves.push(moveUci(r.move));
    }
    return "1/2-1/2";
  };
  let deepPts = 0;
  for (const [w, b, seed] of [[4, 1, 1], [1, 4, 2]]) {
    const res = play(w, b, seed);
    const deepIsWhite = w > b;
    deepPts += res === "1/2-1/2" ? 0.5 : (res === "1-0") === deepIsWhite ? 1 : 0;
  }
  assert.ok(deepPts >= 1.5, `derin bot en az 1.5/2 almalı (${deepPts})`);
});
