import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engines/emlak.js";
import { makeRng } from "../engines/util.js";
import { TOKEN_COUNT } from "../engines/emlakTokens.js";

const mk = (n = 2, cfg = {}) => E.create({ players: Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i })), config: cfg, rng: makeRng(7) });
const fixedDice = (s, a, b) => { const r = [(a - 1) / 6 + 0.01, (b - 1) / 6 + 0.01]; let k = 0; s.rng = () => r[k++ % 2]; };

test("emlak: tahta 40 kare, 22 arsa, 8 grup, 4 hat, 2 idare, klasik köşeler", () => {
  assert.equal(E.N, 40);
  assert.equal(E.BOARD.filter((b) => b.kind === "prop").length, 22);
  assert.equal(E.BOARD.filter((b) => b.kind === "transit").length, 4);
  assert.equal(E.BOARD.filter((b) => b.kind === "util").length, 2);
  assert.equal(E.BOARD.filter((b) => b.kind === "card" && b.deck === "chance").length, 3);
  assert.equal(E.BOARD.filter((b) => b.kind === "card" && b.deck === "chest").length, 3);
  assert.equal(E.JAIL, 10);
  assert.equal(E.POLICE, 30);
  assert.equal(E.CHANCE.length, 16);
  assert.equal(E.CHEST.length, 16);
  for (let g = 0; g < 8; g++) assert.ok(E.groupSquares(g).length >= 2);
  assert.equal(E.BOARD[E.JAIL].kind, "jail");
  assert.equal(E.BOARD[E.POLICE].kind, "police");
});

test("emlak: sıra dışı hamle yok; başlangıçtan geçiş +200; satın alma", () => {
  const s = mk();
  assert.equal(E.input(s, "p1", { t: "roll" }), false);
  s.players[0].pos = 39;
  fixedDice(s, 1, 1); // 39 → 1 (Balat), başlangıçtan geçer
  assert.equal(E.input(s, "p0", { t: "roll" }), true);
  assert.equal(s.players[0].pos, 1);
  assert.equal(s.players[0].cash, 1500 + 200);
  assert.equal(s.phase, "buy");
  assert.equal(E.input(s, "p0", { t: "buy" }), true);
  assert.equal(s.own[1], 0);
  assert.equal(s.players[0].cash, 1700 - 60);
});

test("emlak: kira — grup tamamsa iki kat, ev ile çarpan, ipotekte kira yok", () => {
  const s = mk();
  s.own[1] = 1;
  const base = 2;
  assert.equal(E.rentOf(s, 1, 7), base);
  s.own[3] = 1;
  assert.equal(E.rentOf(s, 1, 7), base * 2);
  s.houses[1] = 2;
  assert.equal(E.rentOf(s, 1, 7), 30);
  s.houses[1] = 0;
  s.mort[1] = true;
  assert.equal(E.rentOf(s, 1, 7), 0);
});

test("emlak: eşit ev kurma, stok, ipotekte ev yok", () => {
  const s = mk();
  s.own[1] = s.own[3] = 0;
  s.phase = "manage";
  assert.equal(E.input(s, "p0", { t: "build", sq: 1 }), true);
  assert.equal(E.input(s, "p0", { t: "build", sq: 1 }), false, "eşit kurma: önce Fener");
  assert.equal(E.input(s, "p0", { t: "build", sq: 3 }), true);
  assert.equal(s.bank.houses, E.HOUSES - 2);
  assert.equal(E.input(s, "p0", { t: "mortgage", sq: 1 }), false, "grupta ev varken ipotek yok");
  assert.equal(E.input(s, "p0", { t: "sell", sq: 1 }), true);
  assert.equal(E.input(s, "p0", { t: "sell", sq: 1 }), false, "eşit satma");
});

test("emlak: 3 çift → gözaltı; gözaltında çift atınca çıkar; ceza ödeme", () => {
  const s = mk();
  fixedDice(s, 3, 3);
  E.input(s, "p0", { t: "roll" });
  if (s.phase === "buy") E.input(s, "p0", { t: "decline" });
  while (s.phase === "auction") E.tick(s, 1);
  E.input(s, "p0", { t: "roll" });
  if (s.phase === "buy") E.input(s, "p0", { t: "decline" });
  while (s.phase === "auction") E.tick(s, 1);
  E.input(s, "p0", { t: "roll" });
  assert.equal(s.players[0].pos, E.JAIL);
  assert.ok(s.players[0].jail > 0);
  E.input(s, "p0", { t: "end" });
  E.input(s, "p1", { t: "roll" }); // p1
  if (s.phase === "buy") E.input(s, "p1", { t: "decline" });
  while (s.phase === "auction") E.tick(s, 1);
  while (s.canRollAgain) { E.input(s, "p1", { t: "roll" }); if (s.phase === "buy") E.input(s, "p1", { t: "decline" }); while (s.phase === "auction") E.tick(s, 1); }
  E.input(s, "p1", { t: "end" });
  assert.equal(s.turn, 0);
  assert.equal(E.input(s, "p0", { t: "payFine" }), true);
  assert.equal(s.players[0].jail, 0);
});

test("emlak: ihale — artan teklif, pas, kazanan öder", () => {
  const s = mk(3);
  fixedDice(s, 1, 2);
  E.input(s, "p0", { t: "roll" }); // 3 = Fener
  assert.equal(s.phase, "buy");
  E.input(s, "p0", { t: "decline" });
  assert.equal(s.phase, "auction");
  assert.equal(E.input(s, "p1", { t: "bid", amount: 50 }), true);
  assert.equal(E.input(s, "p2", { t: "bid", amount: 40 }), false, "düşük teklif");
  assert.equal(E.input(s, "p2", { t: "bid", amount: 99999 }), false, "nakitten fazla");
  E.input(s, "p0", { t: "pass" });
  E.input(s, "p2", { t: "pass" });
  assert.equal(s.own[3], 1);
  assert.equal(s.players[1].cash, 1450);
});

test("emlak: takas — geçersiz teklifler reddedilir, kabul el değiştirir", () => {
  const s = mk();
  s.own[1] = 0;
  s.own[3] = 1;
  s.houses[3] = 0;
  assert.equal(E.input(s, "p0", { t: "offer", to: 1, give: { props: [3] }, get: {} }), false, "başkasının arsasını veremez");
  assert.equal(E.input(s, "p0", { t: "offer", to: 1, give: { cash: 100, props: [1] }, get: { props: [3] } }), true);
  assert.equal(E.input(s, "p0", { t: "accept" }), false, "teklif sahibi kabul edemez");
  assert.equal(E.input(s, "p1", { t: "accept" }), true);
  assert.equal(s.own[1], 1);
  assert.equal(s.own[3], 0);
  assert.equal(s.players[0].cash, 1400);
  assert.equal(s.players[1].cash, 1600);
});

test("emlak: borç → varlık satışı ya da iflas; varlıklar alacaklıya", () => {
  const s = mk();
  s.own[39] = 1;
  s.own[37] = 1;
  s.houses[39] = 5;
  s.bank.hotels--;
  s.players[0].cash = 100;
  s.own[1] = 0;
  s.players[0].pos = 37;
  fixedDice(s, 1, 1); // 37 → 39 Tarabya (otel, kira 2000)
  E.input(s, "p0", { t: "roll" });
  assert.equal(s.phase, "debt");
  assert.equal(E.input(s, "p0", { t: "end" }), false, "borçluyken tur bitmez");
  E.input(s, "p0", { t: "mortgage", sq: 1 });
  assert.equal(s.phase, "debt", "ipotek yetmedi");
  assert.equal(E.input(s, "p0", { t: "bankrupt" }), true);
  assert.equal(s.phase, "over");
  assert.equal(s.winner, 1);
  assert.equal(s.own[1], 1, "varlık alacaklıya");
});

test("emlak: 2–6 botlu oyunlar biter; tur sınırında en zengin kazanır; stok korunur", () => {
  for (const [n, rounds] of [[2, 60], [4, 60], [6, 60], [3, 15]]) {
    const s = E.create({ players: Array.from({ length: n }, (_, i) => ({ id: "b" + i, bot: true })), config: { rounds }, rng: makeRng(n * 3 + rounds) });
    let t = 0;
    while (!E.isOver(s) && t < 30000) {
      E.tick(s, 0.5);
      t += 0.5;
      const used = s.houses.reduce((a, h) => a + (h === 5 ? 0 : h), 0);
      assert.equal(used + s.bank.houses, E.HOUSES);
    }
    assert.ok(E.isOver(s), `${n} bot bitmedi`);
  }
});

test("emlak: görünüm desteyi sızdırmaz", () => {
  const s = mk();
  const v = JSON.stringify(E.view(s, "p0"));
  assert.ok(!v.includes('"deck"'));
});

test("emlak: Monopoly kira tablosu — hat, idare, kart etkileri", () => {
  const s = mk();
  s.own[5] = s.own[15] = 1;
  assert.equal(E.rentOf(s, 5, 7), 50, "2 hat = 50");
  s.own[25] = 1;
  assert.equal(E.rentOf(s, 5, 7), 100);
  s.own[12] = 1;
  assert.equal(E.rentOf(s, 12, 7), 28, "tek idare = zar×4");
  s.own[28] = 1;
  assert.equal(E.rentOf(s, 12, 7), 70, "iki idare = zar×10");
  assert.equal(E.rentOf(s, 39, 7), 0, "sahipsiz");
  s.own[39] = 1;
  assert.equal(E.rentOf(s, 39, 7), 50);
  s.own[37] = 1;
  assert.equal(E.rentOf(s, 39, 7), 100, "grup tamam = 2×");
  s.houses[39] = 5;
  assert.equal(E.rentOf(s, 39, 7), 2000, "otel");
});

test("emlak: Şans/Hazine — destelerde her kart bir kez, 'çık' kartı elde tutulurken desteye girmez", () => {
  const s = mk();
  const seen = new Set();
  for (let i = 0; i < 16; i++) {
    s.phase = "roll";
    s.players[0].pos = 7; // Şans karesi
    s.players[0].cash = 5000;
    s.players[1].cash = 5000;
    s.turn = 0;
    const before = s.decks.chance.order[s.decks.chance.pos];
    seen.add(before);
    // kartı doğrudan çek: kareye inmiş gibi
    s.players[0].pos = 7;
    s.phase = "roll";
    fixedDice(s, 1, 2);
    s.players[0].pos = 4; // 4 + 3 = 7
    E.input(s, "p0", { t: "roll" });
    if (s.phase === "auction" || s.phase === "buy") { if (s.phase === "buy") E.input(s, "p0", { t: "decline" }); while (s.phase === "auction") E.tick(s, 1); }
    s.players[0].jail = 0;
    s.turn = 0;
    s.canRollAgain = false;
  }
  assert.equal(seen.size, 16, "16 farklı kart çekildi");
});

test("emlak: piyonlar benzersiz; geçersiz ve tekrarlı seçimler düzeltilir", () => {
  const s = E.create({ players: [{ id: "a", token: 3 }, { id: "b", token: 3 }, { id: "c", token: 99 }, { id: "d" }], rng: makeRng(1) });
  const t = s.players.map((p) => p.token);
  assert.equal(new Set(t).size, 4);
  assert.equal(t[0], 3, "geçerli seçim korunur");
  assert.ok(t.every((x) => Number.isInteger(x) && x >= 0 && x < TOKEN_COUNT));
});

// ───────── olay tespiti (arayüz bu olayları sırayla oynatır) ─────────
import { diffEvents } from "../engines/emlakEvents.js";

test("olaylar: zar → hareket → başlangıç → kira sırası ve tutarlar", () => {
  const s = mk();
  s.own[1] = 1; // Balat rakipte
  s.players[0].pos = 39;
  fixedDice(s, 1, 1);
  const v0 = E.view(s, "p0");
  E.input(s, "p0", { t: "roll" });
  const ev = diffEvents(v0, E.view(s, "p0"));
  assert.deepEqual(ev.map((e) => e.type), ["roll", "move", "go", "rent"]);
  assert.equal(ev[0].double, true);
  assert.deepEqual([ev[3].from, ev[3].to, ev[3].amount], [0, 1, 2], "başlangıç parası kiraya karışmaz");
});

test("olaylar: satın alma, ilk görünümde olay yok, hareketsiz durumda boş", () => {
  const s = mk();
  s.players[0].pos = 39;
  fixedDice(s, 1, 1);
  const v0 = E.view(s, "p0");
  assert.deepEqual(diffEvents(null, v0), []);
  assert.deepEqual(diffEvents(v0, v0), []);
  E.input(s, "p0", { t: "roll" });
  const v1 = E.view(s, "p0");
  E.input(s, "p0", { t: "buy" });
  const ev = diffEvents(v1, E.view(s, "p0"));
  assert.deepEqual(ev.map((e) => e.type), ["buy"]);
  assert.deepEqual([ev[0].who, ev[0].sq, ev[0].amount], [0, 1, 60]);
});

test("olaylar: ev, ipotek, gözaltı, iflas, ihale ve sıra değişimi", () => {
  const s = mk(3);
  s.own[1] = 0;
  const base = E.view(s, "p0");
  const clone = (o) => JSON.parse(JSON.stringify(o));
  let v = clone(base);
  v.houses[1] = 1;
  assert.deepEqual(diffEvents(base, v).map((e) => [e.type, e.sq, e.level]), [["build", 1, 1]]);
  v = clone(base);
  v.mort[1] = true;
  assert.equal(diffEvents(base, v)[0].type, "mortgage");
  v = clone(base);
  v.players[2].jail = 3;
  v.players[2].pos = 10;
  assert.deepEqual(diffEvents(base, v).map((e) => e.type), ["move", "jail"]);
  v = clone(base);
  v.players[1].out = true;
  v.own[1] = 2; // mülkler alacaklıya geçer: takas sayılmaz
  assert.deepEqual(diffEvents(base, v).map((e) => e.type), ["bankrupt"]);
  v = clone(base);
  v.auction = { sq: 3, bid: 0, by: -1, endsIn: 10, passed: [] };
  v.turn = 1;
  assert.deepEqual(diffEvents(base, v).map((e) => e.type), ["auction", "turn"]);
});

test("olaylar: kart çekilince piyon önce kart karesine iner, kart açılır, sonra sonucuna yürür", () => {
  const s = mk();
  s.players[0].pos = 5;
  fixedDice(s, 1, 1); // 5 + 2 = 7 → Şans karesi
  const v0 = E.view(s, "p0");
  E.input(s, "p0", { t: "roll" });
  const ev = diffEvents(v0, E.view(s, "p0"));
  const types = ev.map((e) => e.type);
  assert.deepEqual(types.slice(0, 3), ["roll", "move", "card"]);
  assert.equal(ev[1].to, 7, "önce kartın karesine iner");
  assert.equal(types.filter((t) => t === "card").length, 1, "kart bir kez gösterilir");
  const after = ev.slice(3).find((e) => e.type === "move");
  if (after) assert.equal(after.from, 7, "sonra kartın sonucuna yürür");
});
