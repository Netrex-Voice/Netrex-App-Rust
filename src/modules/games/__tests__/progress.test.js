import test from "node:test";
import assert from "node:assert/strict";
import { levelOf, LEVEL_XP, dailyIds, applyMatch, CHALLENGES } from "../progress.js";

const stats = (g, o) => ({ byGame: { [g]: { played: 1, wins: 0, losses: 0, draws: 0, streak: 0, best: 0, ...o } } });

test("seviye eğrisi", () => {
  assert.deepEqual(levelOf(0), { level: 1, into: 0, need: 100 });
  assert.equal(levelOf(99).level, 1);
  assert.equal(levelOf(100).level, 2);
  assert.equal(levelOf(100 + LEVEL_XP(2)).level, 3);
});

test("günlük görevler tarihe göre sabit, 3 farklı görev", () => {
  const a = dailyIds("2026-10-14");
  assert.deepEqual(a, dailyIds("2026-10-14"));
  assert.equal(new Set(a).size, 3);
  assert.ok(a.every((id) => CHALLENGES.some((c) => c.id === id)));
});

test("galibiyet XP'si, günün ilk galibiyeti, bot çarpanı, ilk galibiyet başarımı", () => {
  const { next, reward } = applyMatch(null, { game: "airhockey", result: "win", mine: 7, theirs: 3, vsHuman: true }, stats("airhockey", { wins: 1, streak: 1, best: 1 }), "2026-10-14");
  const l = Object.fromEntries(reward.lines.map((x) => [x.label, x.xp]));
  assert.equal(l["Galibiyet"], 100);
  assert.equal(l["7 sayı"], 42);
  assert.equal(l["Günün ilk galibiyeti"], 50);
  assert.ok(reward.ach.includes("İlk Galibiyet"));
  assert.equal(next.xp, reward.total);
  // aynı gün ikinci galibiyet: ilk galibiyet bonusu yok
  const r2 = applyMatch(next, { game: "airhockey", result: "win", mine: 7, theirs: 3, vsHuman: true }, stats("airhockey", { wins: 2, streak: 2, best: 2 }), "2026-10-14");
  assert.ok(!r2.reward.lines.some((x) => x.label === "Günün ilk galibiyeti"));
  assert.ok(r2.reward.lines.some((x) => x.label === "2 maçlık seri"));
  // bot maçında XP düşer
  const bot = applyMatch(null, { game: "airhockey", result: "loss", mine: 0, theirs: 7, vsHuman: false }, stats("airhockey", { losses: 1 }), "2026-10-15");
  assert.ok(bot.reward.total < 35 + 60);
});

test("görev bir kez tamamlanır, gün değişince sıfırlanır", () => {
  const day = "2026-10-14";
  let prog = null;
  let completed = 0;
  for (let i = 0; i < 6; i++) {
    const r = applyMatch(prog, { game: "tabu", result: "win", mine: null, theirs: null, vsHuman: true }, stats("tabu", { wins: i + 1, played: i + 1 }), day);
    completed += r.reward.done.length;
    prog = r.next;
  }
  assert.ok(completed <= 3);
  const r = applyMatch(prog, { game: "tabu", result: "loss", vsHuman: true }, stats("tabu", { played: 7 }), "2026-10-15");
  assert.equal(r.next.daily.date, "2026-10-15");
});
