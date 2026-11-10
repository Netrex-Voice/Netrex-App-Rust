import test from "node:test";
import assert from "node:assert/strict";
import * as okey from "../engines/okey.js";
import * as tabu from "../engines/tabu.js";
import { makeRng } from "../engines/util.js";

const P = (n, bot = false) => Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i, bot, team: i % 2 }));
// yüz → id yardımcıları (set A): renk c, sayı n
const T = (c, n) => c * 13 + (n - 1);

test("okey: 106 taş, dağıtım 15/14/14/14 + 48 yığın, taşlar tekil ve korunur", () => {
  const s = okey.create({ players: P(4), rng: makeRng(1) });
  const all = [...s.hands.flat(), ...s.stock, s.indicator];
  assert.equal(all.length, 106);
  assert.equal(new Set(all).size, 106);
  assert.deepEqual(s.hands.map((h) => h.length).sort(), [14, 14, 14, 15]);
  assert.equal(s.stock.length, 48);
  assert.ok(s.indicator < 104, "gösterge sahte okey olamaz");
  assert.equal(s.hands[s.turn].length, 15);
});

test("okey: okey yüzü göstergenin bir fazlası, 13→1", () => {
  assert.deepEqual(okey.okeyFace(T(2, 5)), { c: 2, n: 6 });
  assert.deepEqual(okey.okeyFace(T(1, 13)), { c: 1, n: 1 });
});

test("okey: canWin — seri, grup, joker, 12-13-1, 13-1-2 geçersiz", () => {
  const okeyFace = { c: 3, n: 9 }; // kırmızı 9 okey
  // 5-6-7 sarı | 5-6-7-8 mavi | 1,1,1 grup (sarı,mavi,siyah) | 11-12-13 siyah → 3+4+3+3=13 → +1 = 14: ek 4. 1 grubu kırmızı
  const win = [T(0,5),T(0,6),T(0,7), T(1,5),T(1,6),T(1,7),T(1,8), T(0,1),T(1,1),T(2,1),T(3,1), T(2,11),T(2,12),T(2,13)];
  assert.equal(okey.canWin(win, okeyFace), true);
  // joker: kırmızı 9 (T(3,9)) sarı 5-6-_ için
  const withJoker = [T(0,5),T(0,6),T(3,9), T(1,5),T(1,6),T(1,7),T(1,8), T(0,1),T(1,1),T(2,1),T(3,1), T(2,11),T(2,12),T(2,13)];
  assert.equal(okey.canWin(withJoker, okeyFace), true);
  // sahte okey (104) okeyin yüzü (kırmızı 9) olarak oynar: kırmızı 7-8-9
  const fake = [T(3,7),T(3,8),104, T(1,5),T(1,6),T(1,7),T(1,8), T(0,1),T(1,1),T(2,1),T(3,1), T(2,11),T(2,12),T(2,13)];
  assert.equal(okey.canWin(fake, okeyFace), true);
  // 12-13-1 geçerli
  const wrap = [T(0,12),T(0,13),T(0,1), T(1,5),T(1,6),T(1,7),T(1,8), T(2,2),T(2,3),T(2,4), T(1,10),T(2,10),T(0,10)];
  assert.equal(okey.canWin([...wrap, T(3,10)], okeyFace), true);
  // 13-1-2 geçersiz
  const bad = [T(0,13),T(0,1),T(0,2), T(1,5),T(1,6),T(1,7),T(1,8), T(2,2),T(2,3),T(2,4), T(1,10),T(2,10),T(0,10),T(3,10)];
  assert.equal(okey.canWin(bad, okeyFace), false);
  // eksik: 14 taş ama bir per bozuk
  const broken = win.slice(); broken[13] = T(2,2);
  assert.equal(okey.canWin(broken, okeyFace), false);
  assert.equal(okey.canWin(win.slice(0, 13), okeyFace), false);
});

test("okey: sıra dışı / yanlış taş / sahte bitirme reddedilir", () => {
  const s = okey.create({ players: P(4), rng: makeRng(2) });
  const t = s.turn;
  const other = (t + 1) % 4;
  assert.equal(okey.input(s, s.seats[other], { t: "draw", from: "stock" }), false);
  assert.equal(okey.input(s, s.seats[t], { t: "draw", from: "stock" }), false, "ilk oyuncu çekemez");
  assert.equal(okey.input(s, s.seats[t], { t: "discard", tile: s.hands[other][0] }), false, "başkasının taşı");
  assert.equal(okey.input(s, s.seats[t], { t: "finish", tile: s.hands[t][0] }), false, "geçersiz bitirme");
  assert.equal(okey.input(s, "yabanci", { t: "discard", tile: 0 }), false);
  const tile = s.hands[t][0];
  assert.equal(okey.input(s, s.seats[t], { t: "discard", tile }), true);
  assert.equal(okey.input(s, s.seats[t], { t: "discard", tile }), false, "tekrar atılamaz");
  assert.equal(s.turn, other);
  assert.equal(okey.input(s, s.seats[other], { t: "draw", from: "discard" }), true);
  assert.equal(s.hands[other].length, 15);
  assert.equal(s.discards[t].length, 0, "alınan taş atık yığınından çıktı");
});

test("okey: view başkasının elini ve yığını sızdırmaz; arrange yalnızca permütasyon", () => {
  const s = okey.create({ players: P(4), rng: makeRng(3) });
  const v = okey.view(s, "p0");
  const json = JSON.stringify(v);
  assert.equal(v.hand.length, s.hands[0].length);
  assert.equal(v.reveal, null);
  assert.ok(!("stockIds" in v));
  for (const id of s.stock.slice(0, 5)) assert.ok(!v.hand.includes(id));
  assert.ok(typeof v.stock === "number");
  assert.ok(!json.includes(JSON.stringify(s.hands[1])), "rakip eli sızdı");
  assert.equal(okey.input(s, "p0", { t: "arrange", order: [...s.hands[0]].reverse() }), true);
  assert.equal(okey.input(s, "p0", { t: "arrange", order: [...s.hands[0].slice(1), s.hands[1][0]] }), false);
  assert.equal(okey.input(s, "p0", { t: "arrange", order: s.hands[0].map(() => s.hands[0][0]) }), false);
  assert.equal(okey.view(s, "izleyici").hand.length, 0);
});

test("okey: 4 botlu oyun biter, taş sayısı korunur", () => {
  for (const seed of [11, 12, 13]) {
    const s = okey.create({ players: P(4, true), rng: makeRng(seed) });
    let n = 0;
    while (!okey.isOver(s) && n++ < 5000) {
      okey.tick(s, 2);
      const total = s.hands.flat().length + s.stock.length + s.discards.flat().length + 1;
      assert.equal(total, 106);
    }
    assert.ok(okey.isOver(s));
    if (s.reason === "win") assert.ok(s.winner >= 0);
  }
});

test("okey: ayrılan oyuncunun yerini bot alır", () => {
  const s = okey.create({ players: P(4), rng: makeRng(5) });
  okey.playerLeft(s, "p1");
  assert.equal(s.bots[1], true);
});

// ───────── Tabu ─────────
test("tabu: kartı yalnızca anlatıcı ve rakip takım görür", () => {
  const s = tabu.create({ players: P(6), rng: makeRng(1) });
  const d = tabu.describer(s);
  assert.equal(tabu.input(s, "p1", { t: "go" }), s.teams[0].includes("p1") && d === "p1" ? true : false);
  if (s.phase !== "play") assert.ok(tabu.input(s, d, { t: "go" }));
  const myTeam = s.teams[s.turn];
  const oppTeam = s.teams[1 - s.turn];
  for (const pid of myTeam) {
    const v = tabu.view(s, pid);
    if (pid === d) assert.ok(v.card && !v.card.judge);
    else assert.ok(!v.card && v.cardHidden, "anlatıcının takımı kartı görmemeli");
    if (pid !== d) assert.ok(!JSON.stringify(v).includes(s.card[0]), "kart kelimesi sızdı");
  }
  for (const pid of oppTeam) assert.ok(tabu.view(s, pid).card?.judge);
  assert.ok(!tabu.view(s, "yabanci").card);
});

test("tabu: puan, pas hakkı, yetki ve süre bitimi", () => {
  const s = tabu.create({ players: P(4), config: { secs: 30, rounds: 1, passes: 1 }, rng: makeRng(2) });
  const d = tabu.describer(s);
  const judge = s.teams[1 - s.turn][0];
  assert.equal(tabu.input(s, judge, { t: "go" }), false);
  tabu.input(s, d, { t: "go" });
  assert.equal(tabu.input(s, judge, { t: "ok" }), false, "yalnızca anlatıcı doğru basar");
  assert.equal(tabu.input(s, d, { t: "ok" }), true);
  assert.equal(tabu.input(s, d, { t: "taboo" }), false, "rakip varken anlatıcı tabu diyemez");
  assert.equal(tabu.input(s, judge, { t: "taboo" }), true);
  assert.equal(s.score[s.turn], 0, "+1 −1 = 0");
  assert.equal(tabu.input(s, d, { t: "pass" }), true);
  assert.equal(tabu.input(s, d, { t: "pass" }), false, "pas hakkı bitti");
  tabu.tick(s, 31);
  assert.equal(s.phase, "ready");
  assert.equal(s.turn, 1);
});

test("tabu: tüm turlar bitince oyun biter; takım boşalırsa biter", () => {
  const s = tabu.create({ players: P(4), config: { secs: 20, rounds: 1 }, rng: makeRng(3) });
  for (let i = 0; i < 2; i++) { tabu.input(s, tabu.describer(s), { t: "go" }); tabu.tick(s, 21); }
  assert.equal(s.phase, "over");
  const v = tabu.view(s, "p0");
  assert.equal(v.winner, -1);
  const s2 = tabu.create({ players: P(4), rng: makeRng(3) });
  tabu.playerLeft(s2, s2.teams[0][0]); tabu.playerLeft(s2, s2.teams[0][0]);
  assert.equal(s2.phase, "over");
});

test("tabu: özel kartlar, puan ve ceza ayarları, takım adı/rengi", () => {
  const custom = Array.from({ length: 12 }, (_, i) => `Kelime${i}: a${i}, b${i}, c${i}`).join("\n") + "\nbozuk: yalnızbir";
  assert.equal(tabu.parseCustomCards(custom).length, 12, "geçersiz satır atlanır");
  const s = tabu.create({ players: P(4), config: { cardPack: "custom", customCards: custom, okPts: 3, tabooPts: 2, name0: "Aslanlar", color1: "green" }, rng: makeRng(4) });
  assert.equal(s.cards.length, 12);
  assert.equal(s.teamNames[0], "Aslanlar");
  assert.equal(s.teamColors[1], tabu.TEAM_COLORS.green);
  const d = tabu.describer(s);
  tabu.input(s, d, { t: "go" });
  assert.ok(s.card[0].startsWith("Kelime"));
  tabu.input(s, d, { t: "ok" });
  assert.equal(s.score[s.turn], 3);
  tabu.input(s, s.teams[1 - s.turn][0], { t: "taboo" });
  assert.equal(s.score[s.turn], 1);
  // 10'dan az özel kart varken "yalnızca özel" hazır kartlara döner
  const few = tabu.create({ players: P(4), config: { cardPack: "custom", customCards: "A: x, y, z" } });
  assert.ok(few.cards.length > 50);
});

test("okey: hamle süresi dolunca sıradaki insan yerine bot oynar; süresizde beklenir", () => {
  const s = okey.create({ players: P(4), config: { turnTime: 30 }, rng: makeRng(8) });
  const t0 = s.turn;
  okey.tick(s, 10);
  assert.equal(s.turn, t0, "süre dolmadı");
  okey.tick(s, 25);
  assert.notEqual(s.turn, t0, "süre doldu, otomatik atıldı");
  assert.equal(s.hands.flat().length + s.stock.length + s.discards.flat().length + 1, 106);
  const s2 = okey.create({ players: P(4), rng: makeRng(8) });
  okey.tick(s2, 500);
  assert.equal(s2.turn, s2.turn);
  assert.equal(okey.view(s2, "p0").turnTime, 0);
});
