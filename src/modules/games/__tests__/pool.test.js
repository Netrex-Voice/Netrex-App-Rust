import test from "node:test";
import assert from "node:assert/strict";
import * as P from "../engines/pool.js";
import { makeRng } from "../engines/util.js";

const B = (n, x, z) => ({ n, x, z, vx: 0, vz: 0, wx: 0, wy: 0, wz: 0, on: true });
const after = (balls, shot, sec) => {
  const bs = balls.map((b) => ({ ...b }));
  P.strike(bs[0], shot.dx, shot.dz, shot.power, shot.a, shot.b);
  let hit = -1;
  let t = 0;
  const ev = [];
  for (let i = 0; i < 960 * 6; i++) {
    ev.length = 0;
    P.stepBalls(bs, 1 / 960, ev);
    t += 1 / 960;
    if (hit < 0 && ev.some((e) => e.e === "ball")) hit = t;
    if (hit > 0 && t - hit > sec) break;
  }
  return bs;
};

test("bilardo: vuruş deterministik ve JSON üzerinden bit bit aynı", () => {
  const balls = P.rack(makeRng(3));
  const shot = { dx: 1, dz: 0.0031, power: 0.93, a: 0.1, b: 0.12 };
  const a = P.simulateShot(balls, shot);
  const b = P.simulateShot(JSON.parse(JSON.stringify(balls)), JSON.parse(JSON.stringify(shot)));
  assert.equal(JSON.stringify(a.balls), JSON.stringify(b.balls));
  assert.ok(a.events.filter((e) => e.e === "ball").length > 10, "açılış dağıtmalı");
});

test("bilardo: takip ileri, stop yerinde, geri çekme geri", () => {
  const two = [B(0, -0.15, 0), B(1, 0, 0)];
  const vx = (b) => after(two, { dx: 1, dz: 0, power: 0.3, a: 0, b }, 0.5)[0].vx;
  assert.ok(vx(0.45) > 0.3, "takip");
  assert.ok(Math.abs(vx(0)) < 0.15, "stop");
  assert.ok(vx(-0.45) < -0.3, "geri çekme");
});

test("bilardo: yan falso bant açısını değiştirir; sürtünme topu durdurur", () => {
  const end = (a) => P.simulateShot([B(0, 0, 0)], { dx: 0.6, dz: 0.8, power: 0.3, a, b: 0 }).balls[0];
  const l = end(-0.4);
  const r = end(0.4);
  assert.ok(Math.abs(l.x - r.x) > 0.2, "yan falso sonucu değiştirmeli");
  const s = P.simulateShot([B(0, 0, 0)], { dx: 1, dz: 0, power: 0.1, a: 0, b: 0 });
  assert.ok(s.t < 15 && s.balls[0].vx === 0, "durmalı");
});

test("bilardo: cebe giriş ve toplar masadan çıkmaz", () => {
  // köşe cebine doğru düz vuruş
  const r = P.simulateShot([B(0, 0.9, 0.34), B(1, 1.0, 0.44)], { dx: 0.1, dz: 0.1, power: 0.3, a: 0, b: 0 });
  assert.ok(r.events.some((e) => e.e === "pocket" && e.n === 1), "1 numara cebe girmeli");
  const many = P.simulateShot(P.rack(makeRng(9)), { dx: 1, dz: 0, power: 1, a: 0, b: 0 });
  for (const b of many.balls) if (b.on) assert.ok(Math.abs(b.x) <= P.A && Math.abs(b.z) <= P.B, "top masadan çıktı");
});

const game = () => P.create({ players: [{ id: "p0" }, { id: "p1" }], rng: makeRng(5) });
const finish = (s) => { while (s.phase === "moving") P.tick(s, 0.5); };

test("bilardo kurallar: sıra dışı / NaN / beyaz yerleştirme doğrulaması", () => {
  const s = game();
  assert.equal(P.input(s, "p1", { t: "shoot", dx: 1, dz: 0, power: 0.5 }), false, "sıra p0'da");
  assert.equal(P.input(s, "p0", { t: "shoot", dx: "x", dz: 0, power: 0.5 }), false);
  assert.equal(P.canPlace(s, 0.5, 0), false, "açılışta baş çizgisinin önüne konamaz");
  assert.equal(P.canPlace(s, -0.8, 0), true);
  assert.equal(P.canPlace(s, 5, 0), false);
});

test("bilardo kurallar: beyaz cebe → faul, rakibe elde top", () => {
  const s = game();
  s.breakShot = false;
  s.kitchenOnly = false;
  s.balls = [B(0, 0.9, 0.36), B(1, -0.5, 0), B(9, -0.6, 0.2), B(8, -0.7, -0.2)];
  P.input(s, "p0", { t: "shoot", dx: 0.6, dz: 0.5, power: 0.4, a: 0, b: 0 }); // beyaz cebe
  finish(s);
  assert.equal(s.turn, 1);
  assert.equal(s.ballInHand, true);
  assert.equal(s.phase, "place");
  assert.ok(s.fouls[0] === 1);
  assert.equal(P.input(s, "p1", { t: "place", x: -0.5, z: 0 }), false, "topun üstüne konamaz");
  assert.equal(P.input(s, "p1", { t: "place", x: 0.3, z: 0.2 }), true);
});

test("bilardo kurallar: grup atama ve erken 8 = kayıp", () => {
  const s = game();
  s.breakShot = false;
  s.kitchenOnly = false;
  s.balls = [B(0, 0.7, 0.2), B(3, 0.95, 0.38), B(11, -0.5, 0), B(8, -0.2, -0.3)];
  P.input(s, "p0", { t: "shoot", dx: 0.25, dz: 0.18, power: 0.35, a: 0, b: 0 });
  finish(s);
  if (s.groups[0]) {
    assert.equal(s.groups[0], "solid");
    assert.equal(s.groups[1], "stripe");
  }
  const t = game();
  t.breakShot = false;
  t.kitchenOnly = false;
  t.groups = ["solid", "stripe"];
  t.balls = [B(0, 0.7, 0.2), B(8, 0.95, 0.38), B(2, -0.5, 0)];
  P.input(t, "p0", { t: "shoot", dx: 0.25, dz: 0.18, power: 0.35, a: 0, b: 0 });
  finish(t);
  if (t.balls.find((b) => b.n === 8).on === false) {
    assert.equal(t.phase, "over");
    assert.equal(t.winner, 1, "grubu bitirmeden 8 → kaybeder");
  }
});

test("bilardo: bot-bot oyunları kurallarla biter", () => {
  for (const seed of [1, 2, 3]) {
    const s = P.create({ players: [{ id: "a", bot: true }, { id: "b", bot: true }], config: { botLevel: "hard" }, rng: makeRng(seed) });
    let t = 0;
    while (!P.isOver(s) && t < 2400) (P.tick(s, 1 / 20), (t += 1 / 20));
    assert.ok(P.isOver(s), "oyun bitmedi " + seed);
    assert.ok(["eight", "eight_foul"].includes(s.reason));
  }
});
