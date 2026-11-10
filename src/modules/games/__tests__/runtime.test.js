import test from "node:test";
import assert from "node:assert/strict";
import { HostSession, LIMITS } from "../runtime.js";
import { GAMES, getGame, validateManifest, cleanConfig } from "../registry.js";
import * as okey from "../engines/okey.js";
import * as tabu from "../engines/tabu.js";
import * as hockey from "../engines/airhockey.js";
import * as emlak from "../engines/emlak.js";
import { makeRng } from "../engines/util.js";

function mk(gameId, engine, host = "h") {
  const sent = [];
  let t = 1_000_000;
  const clock = { now: () => t, adv: (ms) => (t += ms) };
  const s = new HostSession({
    sid: "s1", manifest: getGame(gameId), engine, hostId: host, hostName: "Host",
    transport: { send: (topic, obj, dest, reliable) => sent.push({ topic, obj, dest, reliable }) },
    now: clock.now, rng: makeRng(9),
  });
  return { s, sent, clock };
}

test("manifestler geçerli, benzersiz ve cleanConfig ağdan gelen değeri sınırlar", () => {
  for (const g of GAMES) assert.deepEqual(validateManifest(g), [], g.id);
  assert.equal(new Set(GAMES.map((g) => g.id)).size, GAMES.length);
  assert.ok(validateManifest({ id: "X!" }).length > 0);
  const c = cleanConfig(getGame("airhockey"), { target: 9999, evil: 1, goal: "large" });
  assert.equal(c.target, 7);
  assert.equal(c.goal, "large");
  assert.ok(!("evil" in c));
  const tc = cleanConfig(getGame("tabu"), { name0: "<b>x</b>".repeat(10), customCards: "a".repeat(9999), okPts: "7" });
  assert.ok(tc.name0.length <= 16 && !tc.name0.includes("<") && tc.customCards.length <= 2400 && tc.okPts === 1);
});

test("lobi: yetki, kapasite, tekrar katılım, bot, yalnız host başlatır", () => {
  const { s } = mk("airhockey", hockey);
  assert.equal(s.join("a", "Ali"), true);
  assert.equal(s.join("a", "Ali"), true);
  assert.equal(s.players.size, 2, "yinelenen katılım ikinci koltuk açmaz");
  s.join("c", "Can"); // dolu → izleyici
  assert.ok(s.watchers.has("c") && !s.players.has("c"));
  assert.equal(s.start("a"), false, "host olmayan başlatamaz");
  assert.equal(s.setConfig("a", { target: 3 }), false);
  assert.equal(s.addBot("a"), false);
  assert.equal(s.start("h"), false, "hazır olmayan oyuncu varken başlamaz");
  assert.equal(s.setReady("a", true), true);
  assert.equal(s.start("h"), true);
  assert.equal(s.status, "playing");
  assert.equal(s.round, 1);
  assert.equal(s.kick("a", "h"), false);
});

test("hockey: host+bot ile başlar; yabancı ve izleyici girdi gönderemez", () => {
  const { s } = mk("airhockey", hockey);
  assert.equal(s.addBot("h"), true);
  s.start("h");
  assert.equal(s.input("yabanci", { t: "move", x: 1, y: 1 }), false);
  s.watchers.add("w");
  assert.equal(s.input("w", { t: "move", x: 1, y: 1 }), false, "izleyici oynayamaz");
  assert.equal(s.input("h", { t: "move", x: 100, y: 100 }), true);
});

test("hız sınırı: saniyede fazla mesaj düşürülür", () => {
  const { s } = mk("airhockey", hockey);
  s.addBot("h"); s.start("h");
  let ok = 0;
  for (let i = 0; i < LIMITS.MSGS_PER_SEC + 50; i++) ok += s.input("h", { t: "move", x: 100, y: 100 }) ? 1 : 0;
  assert.equal(ok, LIMITS.MSGS_PER_SEC);
  assert.equal(s.stats.rateLimited, 50);
});

test("okey: her oyuncuya yalnızca kendi eli gider, izleyici elsiz; yığın hiç gitmez", () => {
  const { s, sent } = mk("okey", okey);
  ["a", "b"].forEach((id) => (s.join(id, id), s.setReady(id, true)));
  s.start("h");
  const states = sent.filter((m) => m.topic === "gm_state");
  const byDest = Object.fromEntries(states.map((m) => [m.dest[0], m.obj.v]));
  assert.deepEqual(Object.keys(byDest).sort(), ["a", "b", "h"]);
  for (const id of ["a", "b", "h"]) {
    const seat = s.state.seats.indexOf(id);
    assert.deepEqual(byDest[id].hand, s.state.hands[seat]);
    const others = JSON.stringify(byDest[id]);
    s.state.stock.slice(0, 8).forEach((tile) => assert.ok(!byDest[id].hand.includes(tile)));
    assert.ok(!others.includes('"stockIds"'));
    for (const o of [0, 1, 2, 3]) if (o !== seat) assert.notDeepEqual(byDest[id].hand, s.state.hands[o]);
    assert.equal(byDest[id].reveal, null);
  }
  // hiçbir gm_state tüm odaya (dest=null) yayınlanmaz
  assert.ok(states.every((m) => Array.isArray(m.dest) && m.dest.length === 1));
});

test("tabu: kart sızıntısı yok — anlatıcının takımına kart gitmez", () => {
  const { s, sent } = mk("tabu", tabu);
  ["a", "b", "c"].forEach((id) => (s.join(id, id), s.setReady(id, true)));
  s.setTeam("h", 0); s.setTeam("a", 1); s.setTeam("b", 0); s.setTeam("c", 1);
  assert.equal(s.start("h"), true);
  const d = tabu.describer(s.state);
  s.input(d, { t: "go" });
  const last = {};
  for (const m of sent.filter((x) => x.topic === "gm_state")) last[m.dest[0]] = m.obj.v;
  const word = s.state.card[0];
  const team = s.state.turn;
  for (const id of ["h", "a", "b", "c"]) {
    const myTeam = s.state.teams[0].includes(id) ? 0 : 1;
    const sees = !!last[id].card;
    assert.equal(sees, id === d || myTeam !== team, id);
    if (!sees) assert.ok(!JSON.stringify(last[id]).includes(word), id + " kelimeyi sızdırdı");
  }
});

test("okey: bitişte durum 'over', host lobiye dönebilir; ayrılan oyuncunun yerini bot alır", () => {
  const { s } = mk("okey", okey);
  s.join("a", "a"); s.setReady("a", true); s.start("h");
  s.leave("a");
  assert.equal(s.state.bots[s.state.seats.indexOf("a")], true);
  let n = 0;
  while (s.status === "playing" && n++ < 4000) s.tick(2); // bot + host oynamaz → host sırası gelirse ilerlemez
  s.status = "over";
  assert.equal(s.backToLobby("h"), true);
  assert.equal(s.status, "lobby");
  assert.equal(s.backToLobby("a"), false);
});

test("resync: geç gelen/yeniden bağlanan sadece kendi durumunu alır", () => {
  const { s, sent } = mk("airhockey", hockey);
  s.addBot("h"); s.start("h");
  sent.length = 0;
  s.resync("h");
  assert.ok(sent.some((m) => m.topic === "gm_lobby" && m.dest?.[0] === "h"));
  assert.ok(sent.some((m) => m.topic === "gm_state" && m.dest?.[0] === "h"));
});

test("hockey gerçek zamanlı: misafire ~60 Hz kayıplı kanal, host'a her tik", () => {
  const { s, sent, clock } = mk("airhockey", hockey);
  s.join("g", "Misafir"); s.setReady("g", true); s.start("h");
  sent.length = 0;
  for (let i = 0; i < 60; i++) { clock.adv(16); s.tick(0.016); }
  const toG = sent.filter((m) => m.topic === "gm_state" && m.dest[0] === "g");
  const toH = sent.filter((m) => m.topic === "gm_state" && m.dest[0] === "h");
  assert.ok(toG.length >= 55 && toG.length <= 61, "misafire " + toG.length);
  assert.equal(toH.length, 60);
  assert.ok(toG.some((m) => m.reliable === false));
  assert.ok(JSON.stringify(toG[0].obj).length < 1100, "kayıplı paket sınırı");
});

test("davetli lobi: davetsiz katılımcı izleyici olur, davetli oyuncu olur ve bildirim alır", () => {
  const { s, sent } = mk("airhockey", hockey);
  assert.equal(s.setAccess("a", "invite"), false);
  assert.equal(s.setAccess("h", "invite"), true);
  s.join("x", "Yabancı");
  assert.ok(s.watchers.has("x") && !s.players.has("x"));
  assert.equal(s.invite("x", ["y"]), false, "host olmayan davet edemez");
  assert.equal(s.invite("h", ["y"]), true);
  assert.ok(sent.some((m) => m.topic === "gm_invite" && m.dest[0] === "y"));
  s.join("y", "Davetli");
  assert.ok(s.players.has("y"));
});

test("emoji tepkisi: izinli liste, saniyede 1, yalnızca katılımcı", () => {
  const { s, sent, clock } = mk("airhockey", hockey);
  assert.equal(s.react("h", "💣"), false);
  assert.equal(s.react("dışarıdan", "👍"), false);
  assert.equal(s.react("h", "👍"), true);
  assert.equal(s.react("h", "🔥"), false, "çok sık");
  clock.adv(1100);
  assert.equal(s.react("h", "🔥"), true);
  assert.equal(sent.filter((m) => m.topic === "gm_react").length, 2);
});

test("hockey ayarları: kale/raket/hız motora işler", () => {
  const s = hockey.create({ players: P2(), config: { goal: "small", padSize: "large", puckSpeed: "fast" } });
  assert.equal(s.goal, 0.2);
  assert.equal(s.padR, 0.056);
  assert.equal(s.maxPuck, 19);
  s.phase = "play";
  s.puck = { x: -0.9, y: 0.12, vx: -10, vy: 0, w: 0 }; // dar kalede ağız dışı → gol değil
  hockey.tick(s, 0.05);
  assert.deepEqual(s.score, [0, 0]);
});
const P2 = () => [{ id: "p0" }, { id: "p1" }];


test("emlak: piyon seçimi — benzersiz, yetkili, botlara otomatik, lobiden sonra kilitli", () => {
  const { s } = mk("emlak", emlak);
  assert.equal(s.players.get("h").token, 0);
  s.join("a", "Ali");
  assert.equal(s.players.get("a").token, 1);
  assert.equal(s.setToken("a", "a", 0), false, "başkasının piyonu alınamaz");
  assert.equal(s.setToken("a", "a", 7), true);
  assert.equal(s.setToken("a", "h", 3), false, "başkası adına seçilemez");
  s.addBot("h");
  const bot = [...s.players.values()].find((p) => p.bot);
  assert.equal(bot.token, 1, "bot ilk boş piyonu alır");
  assert.equal(s.setToken("a", bot.id, 4), false, "bot piyonunu yalnızca host değiştirir");
  assert.equal(s.setToken("h", bot.id, 4), true);
  assert.equal(s.setToken("a", "a", 99), false);
  assert.equal(s.setToken("a", "a", 1.5), false);
  assert.equal(s.setToken("a", "a", "3"), false, "sayı olmayan değer reddedilir");
  s.setReady("a", true);
  assert.equal(s.start("h"), true);
  assert.deepEqual(emlak.view(s.state, "h").players.map((p) => p.token), [0, 7, 4]);
  assert.equal(s.setToken("a", "a", 2), false, "oyun başladıktan sonra değişmez");
  const o = mk("airhockey", hockey).s;
  assert.ok(!("token" in o.players.get("h")), "piyonu olmayan oyunlarda alan eklenmez");
});
