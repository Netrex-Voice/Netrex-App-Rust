import test from "node:test";
import assert from "node:assert/strict";
import { eloChange, expectedScore, kFactor, categoryOf, leagueOf, MIN_RATING } from "../engines/chess/rating.js";
import { BOTS, suggestedBot } from "../engines/chess/bots.js";
import { build, captured, flagResult, scoreFor } from "../engines/chess/game.js";
import { fromFen } from "../engines/chess/core.js";

test("Elo: beklenen skor, K katsayısı, simetri ve alt sınır", () => {
  assert.equal(expectedScore(1000, 1000), 0.5);
  assert.ok(Math.abs(expectedScore(1400, 1000) - 0.909) < 0.001);
  assert.equal(kFactor(900, 5), 40);
  assert.equal(kFactor(1500, 30), 20);
  assert.equal(kFactor(2450, 90), 10);
  assert.equal(eloChange(1000, 1000, 1, 0).delta, 20, "eşit rakibi yenmek K/2");
  assert.equal(eloChange(1000, 1000, 0.5, 40).delta, 0);
  assert.ok(eloChange(1000, 1400, 1, 40).delta > eloChange(1000, 1000, 1, 40).delta, "güçlü rakibi yenmek daha çok puan");
  assert.ok(eloChange(1400, 1000, 0, 40).delta < -10);
  assert.equal(eloChange(MIN_RATING, 2000, 0, 50).next, MIN_RATING, "puan 100'ün altına inmez");
});

test("kategori, lig ve bot merdiveni", () => {
  assert.equal(categoryOf(1, 0), "bullet");
  assert.equal(categoryOf(2, 1), "bullet");
  assert.equal(categoryOf(3, 0), "blitz");
  assert.equal(categoryOf(5, 3), "blitz");
  assert.equal(categoryOf(10, 0), "rapid");
  assert.equal(categoryOf(15, 10), "rapid");
  assert.equal(leagueOf(2500).name, "Büyük Usta");
  for (let i = 1; i < BOTS.length; i++) assert.ok(BOTS[i].rating > BOTS[i - 1].rating && BOTS[i].depth >= BOTS[i - 1].depth);
  assert.equal(suggestedBot(780).rating, 850);
  assert.equal(suggestedBot(100).rating, 250);
  assert.equal(suggestedBot(9999).rating, 2400);
});

test("oyun yardımcıları: yeniden oynatma, SAN, alınan taşlar, süre sonu", () => {
  const g = build("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ["e2e4", "d7d5", "e4d5", "d8d5", "zzzz", "g1f3"]);
  assert.deepEqual(g.sans, ["e4", "d5", "exd5", "Qxd5"], "geçersiz hamlede keser");
  assert.equal(g.played.length, 4);
  const cap = captured(g.pos.board);
  assert.deepEqual(cap.lost[1], [1], "beyaz bir piyon kaybetti");
  assert.deepEqual(cap.lost[-1], [1], "siyah bir piyon kaybetti");
  assert.equal(cap.diff, 0);
  assert.equal(flagResult(fromFen("8/8/4k3/8/8/3KN3/8/8 w - - 0 1"), -1).result, "1/2-1/2", "siyahın süresi bitti ama beyaz mat edemez");
  assert.equal(flagResult(fromFen("8/8/4k3/8/8/3KR3/8/8 w - - 0 1"), -1).result, "1-0");
  assert.equal(scoreFor("1-0", "w"), 1);
  assert.equal(scoreFor("1-0", "b"), 0);
  assert.equal(scoreFor("1/2-1/2", "b"), 0.5);
});

test("depo: puanlı oyun Elo'yu günceller, tek kez uygulanır; puansız oyun etkilemez; saat artışı ve bedava ilk hamleler", async () => {
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  const { useChessStore } = await import("../chessStore.js");
  const st = () => useChessStore.getState();
  st().place("intermediate");
  assert.equal(st().ratings.blitz.r, 800);
  st().start({ botId: "b850", color: "w", tc: { id: "3+2", min: 3, inc: 2 }, rated: true });
  assert.equal(st().game.cat, "blitz");
  st().playMove("e2e4", 1000);
  assert.equal(st().game.tickAt, null, "ilk hamle saati başlatmaz");
  assert.equal(st().game.clocks[0], 180000);
  st().playMove("e7e5", 2000);
  assert.equal(st().game.tickAt, 2000, "ikinci yarım hamleden sonra saat işler");
  st().playMove("g1f3", 5000); // beyaz 3 sn harcadı, +2 sn artış
  assert.equal(st().game.clocks[0], 180000 - 3000 + 2000);
  st().finish("0-1", "resign");
  const g = st().game;
  assert.equal(g.rating.before, 800);
  assert.ok(g.rating.delta < 0 && g.rating.after === 800 + g.rating.delta);
  assert.equal(st().ratings.blitz.games, 1);
  assert.equal(st().ratings.blitz.l, 1);
  assert.equal(st().ratings.rapid.games, 0, "yalnızca ilgili kategori");
  const after = st().ratings.blitz.r;
  st().finish("1-0", "checkmate"); // ikinci kez: etkisiz
  assert.equal(st().ratings.blitz.r, after);
  assert.equal(st().history.length, 1);
  st().start({ botId: "b250", color: "b", tc: null, rated: true });
  assert.equal(st().game.rated, false, "süresiz oyun puansızdır");
  st().finish("0-1", "checkmate");
  assert.equal(st().ratings.blitz.r, after);
  assert.equal(st().beaten.b250, 1);
});
