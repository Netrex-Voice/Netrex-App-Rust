import test from "node:test";
import assert from "node:assert/strict";
import * as hockey from "../engines/airhockey.js";
import * as pong from "../engines/pingpong.js";
import { makeRng } from "../engines/util.js";

const P = (n) => Array.from({ length: n }, (_, i) => ({ id: "p" + i }));
const BOTS = [{ id: "b0", bot: true }, { id: "b1", bot: true }];

test("hockey: gol yalnızca kale ağzında, raylar geri sekme katsayısıyla seker", () => {
  const s = hockey.create({ players: P(2), config: { target: 3 } });
  s.phase = "play";
  s.puck = { x: -0.9, y: 0.35, vx: -8, vy: 0, w: 0 }; // ağız dışı → ray
  hockey.tick(s, 0.05);
  assert.deepEqual(s.score, [0, 0]);
  assert.ok(s.puck.vx > 0 && s.puck.vx < 8 * 0.85, "e≈0.8 ile geri sekmeli");
  s.puck = { x: -0.9, y: 0, vx: -10, vy: 0, w: 0 }; // ağız → gol
  hockey.tick(s, 0.05);
  assert.deepEqual(s.score, [0, 1]);
  assert.equal(s.phase, "goal");
});

test("hockey: sürtünmeli ray teması spin üretir ve yansıma açısını değiştirir", () => {
  const s = hockey.create({ players: P(2) });
  s.phase = "play";
  s.pads[0].x = s.pads[0].tx = -0.9; s.pads[1].x = s.pads[1].tx = 0.9;
  s.puck = { x: 0, y: 0.4, vx: 3, vy: 5, w: 0 };
  hockey.tick(s, 0.03);
  assert.ok(s.puck.vy < 0, "üst raydan döndü");
  assert.ok(Math.abs(s.puck.w) > 1, "spin oluştu: " + s.puck.w);
  assert.ok(s.puck.vx < 3, "teğet hız sürtünmeyle azaldı");
  // dönen disk: aynı geliş, ters spin → farklı çıkış
  const a = hockey.create({ players: P(2) }); a.phase = "play"; a.pads = s.pads;
  const b = hockey.create({ players: P(2) }); b.phase = "play"; b.pads = s.pads;
  a.puck = { x: 0, y: 0.4, vx: 2, vy: 5, w: 60 };
  b.puck = { x: 0, y: 0.4, vx: 2, vy: 5, w: -60 };
  hockey.tick(a, 0.03); hockey.tick(b, 0.03);
  assert.ok(Math.abs(a.puck.vx - b.puck.vx) > 0.3, "spin sekme açısını etkilemeli");
});

test("hockey: köşe yayından sekme, disk asla masadan çıkmaz", () => {
  const s = hockey.create({ players: P(2) });
  s.phase = "play";
  s.puck = { x: 0.85, y: 0.4, vx: 9, vy: 9, w: 0 };
  for (let i = 0; i < 30; i++) hockey.tick(s, 1 / 60);
  assert.ok(Math.abs(s.puck.y) <= hockey.WD / 2 && Math.abs(s.puck.x) <= hockey.L / 2 + 0.1);
});

test("hockey: hızlı disk raketten geçemez, hız sınırı korunur", () => {
  const s = hockey.create({ players: P(2) });
  s.phase = "play";
  s.pads[1].x = s.pads[1].tx = 0.5;
  s.pads[1].y = s.pads[1].ty = 0;
  s.puck = { x: 0.1, y: 0, vx: 40, vy: 0, w: 0 };
  for (let i = 0; i < 10; i++) hockey.tick(s, 1 / 60);
  assert.ok(s.puck.x < 0.5, "disk raketin ötesine geçti");
  assert.ok(Math.hypot(s.puck.vx, s.puck.vy) <= hockey.MAX_PUCK + 1e-9);
});

test("hockey: raket kendi yarısında, hız ve ivme sınırlı", () => {
  const s = hockey.create({ players: P(2) });
  assert.ok(hockey.input(s, "p0", { t: "move", x: 5, y: -5 }));
  const b = hockey.bounds(s, 0);
  assert.ok(s.pads[0].tx <= b.x1 && s.pads[0].ty >= b.y0);
  assert.ok(hockey.input(s, "p0", { t: "move", x: "abc", y: NaN }));
  assert.ok(!hockey.input(s, "yabanci", { t: "move", x: 0, y: 0 }));
  s.phase = "play";
  s.pads[0].tx = b.x1 - 0.15; s.pads[0].ty = 0.2; // sınıra çarpmadan (sınırda el durur)
  let vmax = 0;
  let prevV = 0;
  let amax = 0;
  for (let i = 0; i < 60; i++) {
    hockey.tick(s, 1 / 120);
    const v = Math.hypot(s.pads[0].vx, s.pads[0].vy);
    vmax = Math.max(vmax, v);
    amax = Math.max(amax, Math.abs(v - prevV) * 120);
    prevV = v;
  }
  assert.ok(vmax <= hockey.PAD_VMAX + 1e-9, "hız " + vmax);
  assert.ok(amax <= hockey.PAD_AMAX * 1.05, "ivme " + amax);
});

test("hockey: bot-bot maçı biter, disk takılı kalmaz ve masadan çıkmaz", () => {
  for (const lvl of ["easy", "hard"]) {
    const s = hockey.create({ players: BOTS, config: { target: 3, botLevel: lvl }, rng: makeRng(7) });
    let t = 0;
    while (!hockey.isOver(s) && t < 900) {
      hockey.tick(s, 1 / 60);
      t += 1 / 60;
      assert.ok(Math.abs(s.puck.y) <= hockey.WD / 2 + 1e-9, "disk yandan taştı");
    }
    assert.ok(hockey.isOver(s), lvl + " bitmedi");
  }
});

test("hockey: ayrılan oyuncu hükmen yenilir", () => {
  const s = hockey.create({ players: P(2) });
  hockey.playerLeft(s, "p0");
  assert.equal(s.winner, 1);
  assert.equal(s.reason, "forfeit");
});

// ───────── Masa tenisi (3B) ─────────
const rally = (o = {}) => {
  const s = pong.create({ players: P(2), config: o.config || {} });
  s.phase = "rally"; s.stage = "rally"; s.lastHit = 0;
  return s;
};

test("pong fizik: 30 cm düşüşte ~23 cm sekme (ITTF), masa sürtünmesi falsoyu hıza çevirir", () => {
  const s = rally();
  s.ball = { x: 0, y: pong.TABLE_Y + 0.3 + pong.R_BALL, z: 0.5, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0 };
  let top = 0;
  for (let i = 0; i < 480 * 1.2 && s.bounces < 2; i++) {
    pong.simulate(s, 1 / 480);
    if (s.bounces === 1) top = Math.max(top, s.ball.y - pong.TABLE_Y - pong.R_BALL);
  }
  assert.ok(top > 0.2 && top < 0.26, "sekme " + top);
  // topspin: sekme sonrası ileri hız artar; backspin: azalır
  const spin = (wx) => {
    const t = rally();
    t.ball = { x: 0, y: pong.TABLE_Y + 0.1, z: 0.3, vx: 0, vy: -2, vz: 4, wx, wy: 0, wz: 0 };
    for (let i = 0; i < 480 && t.bounces < 1; i++) pong.simulate(t, 1 / 480);
    return t.ball;
  };
  // topspin kaymayı azaltır → daha az yavaşlar; çok güçlü topspin ileri fırlatır; backspin ≥ sürtünme sınırında yavaşlatır
  assert.ok(spin(150).vz > spin(0).vz, "topspin sekmede daha az yavaşlar");
  assert.ok(spin(400).vz > 4, "güçlü topspin sekmede ileri fırlar: " + spin(400).vz);
  const back = spin(-150);
  assert.ok(back.wx > -150 && back.vz < 4, "backspin sürtünmeyle azalır, top yavaşlar");
});

test("pong fizik: Magnus — topspin dalar, backspin süzülür, yan falso kavis yapar", () => {
  const landZ = (wx, wy = 0) => {
    const t = rally();
    t.ball = { x: 0, y: pong.TABLE_Y + 0.3, z: -1.3, vx: 0, vy: 1.2, vz: 8, wx, wy, wz: 0 };
    for (let i = 0; i < 480 * 2 && t.bounces < 1; i++) pong.simulate(t, 1 / 480);
    return t.ball;
  };
  assert.ok(landZ(150).z < landZ(0).z && landZ(0).z < landZ(-150).z);
  assert.ok(Math.abs(landZ(0, 80).x) > 0.03, "yan falso kavis");
});

test("pong vuruş: çözücü hedefe düşürür ve fileyi geçer; servis her raket durumunda kurallara uygun", () => {
  let legal = 0;
  let n = 0;
  for (const x of [-0.4, 0, 0.4]) for (const vx of [-1.5, 0, 1.5]) for (const vy of [-2, 0, 2]) {
    n++;
    const s = pong.create({ players: P(2) });
    s.pads[0].x = s.pads[0].tx = x;
    s.pads[0].vx = vx;
    s.pads[0].vy = vy;
    pong.input(s, "p0", { t: "serve" });
    let first = null, second = null;
    for (let i = 0; i < 60 * 4 && s.phase !== "point"; i++) {
      const b0 = s.bounces;
      pong.tick(s, 1 / 60);
      if (s.bounces > b0) (first == null ? (first = s.ball.z) : second == null && (second = s.ball.z));
      if (second != null) break;
    }
    if (first < 0 && second > 0) legal++;
  }
  assert.ok(legal / n >= 0.95, `kurallara uygun servis ${legal}/${n}`);
});

test("pong kurallar: kendi yarına düşen, çift sekme, dışarı", () => {
  const a = rally();
  a.ball = { x: 0, y: pong.TABLE_Y + 0.1, z: -0.5, vx: 0, vy: -2, vz: 0.5, wx: 0, wy: 0, wz: 0 };
  pong.tick(a, 0.2);
  assert.deepEqual(a.score, [0, 1], "vuran kendi yarısına düşürdü");
  const b = rally();
  b.ball = { x: 0, y: pong.TABLE_Y + 0.1, z: 0.5, vx: 0, vy: -2, vz: 0.4, wx: 0, wy: 0, wz: 0 };
  for (let i = 0; i < 60 && b.phase === "rally"; i++) pong.tick(b, 1 / 60);
  assert.deepEqual(b.score, [1, 0], "rakip yarısında çift sekme");
  const c = rally();
  c.ball = { x: 0, y: pong.TABLE_Y + 0.3, z: 0.5, vx: 0, vy: 0, vz: 12, wx: 0, wy: 0, wz: 0 };
  for (let i = 0; i < 120 && c.phase === "rally"; i++) pong.tick(c, 1 / 60);
  assert.deepEqual(c.score, [0, 1], "sekmeden dışarı");
});

test("pong: bot-bot maçı biter, raliler oluşur, 2 fark kuralı", () => {
  const s = pong.create({ players: BOTS, config: { target: 11, botLevel: "normal" }, rng: makeRng(4) });
  let t = 0;
  while (!pong.isOver(s) && t < 1200) (pong.tick(s, 1 / 60), (t += 1 / 60));
  assert.ok(pong.isOver(s), "maç bitmedi");
  assert.ok(s.longest >= 4, "rali yok: " + s.longest);
  assert.ok(Math.max(...s.score) >= 11 && Math.abs(s.score[0] - s.score[1]) >= 2);
});

test("pong: sadece servis sırası olan servis atar; 2 fark kapalıysa hedefte biter", () => {
  const s = pong.create({ players: P(2) });
  assert.equal(pong.input(s, "p1", { t: "serve" }), false);
  assert.equal(pong.input(s, "p0", { t: "serve" }), true);
  assert.equal(s.phase, "toss");
  const w = pong.create({ players: P(2), config: { target: 5, winBy2: false } });
  w.score = [4, 4]; w.phase = "rally"; w.stage = "rally"; w.lastHit = 0; w.bounceSide = 1;
  w.ball = { x: 0, y: 0.05, z: 1.6, vx: 0, vy: -1, vz: 0, wx: 0, wy: 0, wz: 0 };
  pong.tick(w, 0.05);
  assert.equal(w.phase, "over");
  assert.equal(w.winner, 0);
});

test("hockey: disk bir yarıda 7 sn kalırsa rakibe geçer (kilitlenme yok)", () => {
  const s = hockey.create({ players: [{ id: "p0" }, { id: "p1" }] });
  s.phase = "play";
  s.puck = { x: -0.5, y: 0.3, vx: 0, vy: 0, w: 0 };
  s.pads[0].x = s.pads[0].tx = -0.9; s.pads[0].y = s.pads[0].ty = -0.4;
  for (let i = 0; i < 60 * 6; i++) hockey.tick(s, 1 / 60);
  assert.ok(s.puck.x < 0, "6 sn: hâlâ sol yarıda");
  for (let i = 0; i < 60 * 2; i++) hockey.tick(s, 1 / 60);
  assert.ok(s.puck.x > 0, "7 sn sonra sağ yarıya geçti");
});
