import test from "node:test";
import assert from "node:assert/strict";
import { createRun, step, pickupsIn, makeTerrain, STAGES, VEHICLES, STAGE_ORDER, upgradeCost } from "../engines/hillclimb.js";

const drive = (opts, secs, input) => {
  const run = createRun(opts);
  while (run.t < secs && !run.over) step(run, typeof input === "function" ? input(run) : input, 1 / 60);
  return run;
};

test("hillclimb: araç duruşta oturur, titremez, düşmez (tüm araç ve bölümler)", () => {
  for (const vehicleId of Object.keys(VEHICLES)) {
    for (const stageId of STAGE_ORDER) {
      const run = createRun({ vehicleId, stageId });
      const y0 = run.y;
      for (let i = 0; i < 60 * 5; i++) step(run, {}, 1 / 60);
      assert.equal(run.over, null, `${vehicleId}/${stageId}`);
      assert.ok(Math.hypot(run.vx, run.vy) < 0.25, `${vehicleId}/${stageId} hız ${Math.hypot(run.vx, run.vy)}`);
      assert.ok(Math.abs(run.y - y0) < 0.6, `${vehicleId}/${stageId} dikey kayma`);
      assert.ok(Math.abs(run.a) < 0.1, `${vehicleId}/${stageId} eğim`);
    }
  }
});

test("hillclimb: gazla ilerler, sayılar sonlu, hız makul, patlama yok", () => {
  for (const vehicleId of Object.keys(VEHICLES)) {
    const run = drive({ vehicleId, stageId: "countryside" }, 30, { gas: 1 });
    assert.ok(Number.isFinite(run.x) && Number.isFinite(run.y) && Number.isFinite(run.a), vehicleId);
    assert.ok(run.dist > 100, `${vehicleId} ilerlemedi (${run.dist})`);
    assert.ok(run.maxSpeed < 40, `${vehicleId} hız patladı (${run.maxSpeed})`);
  }
});

test("hillclimb: deterministik (aynı tohum aynı sonuç) ve tohum araziyi değiştirir", () => {
  const a = drive({ seed: 5 }, 12, { gas: 1 }), b = drive({ seed: 5 }, 12, { gas: 1 });
  assert.equal(a.x, b.x);
  assert.equal(a.coins, b.coins);
  const t1 = makeTerrain(STAGES.countryside, 1), t2 = makeTerrain(STAGES.countryside, 2);
  assert.notEqual(t1.h(300), t2.h(300));
  assert.ok(Math.abs(t1.h(0)) < 1e-9 && Math.abs(t1.h(5)) < 1e-9, "başlangıç düzlüğü");
  assert.deepEqual(pickupsIn(t1, 100, 300).map((p) => p.id), pickupsIn(t1, 100, 300).map((p) => p.id));
});

test("hillclimb: baş yere değince biter; benzin bitip durunca biter; benzin gaz basılıyken daha hızlı azalır", () => {
  const flip = createRun({});
  flip.a = Math.PI;
  for (let i = 0; i < 60 && !flip.over; i++) step(flip, {}, 1 / 60);
  assert.equal(flip.over?.reason, "head");

  const dry = createRun({});
  dry.fuel = 0;
  for (let i = 0; i < 60 * 4 && !dry.over; i++) step(dry, { gas: 1 }, 1 / 60);
  assert.equal(dry.over?.reason, "fuel");
  assert.ok(dry.x < 6, "benzinsiz gaz araç sürmez");

  const idle = createRun({}), gas = createRun({});
  for (let i = 0; i < 60 * 3; i++) { step(idle, {}, 1 / 60); step(gas, { gas: 1 }, 1 / 60); }
  assert.ok(gas.fuel < idle.fuel);
});

test("hillclimb: altın ve benzin bidonu toplanır (bir kez), benzin dolar", () => {
  const run = createRun({});
  const coin = pickupsIn(run.terrain, 0, 400).find((p) => p.kind === "coin");
  const can = pickupsIn(run.terrain, 0, 400).find((p) => p.kind === "fuel");
  assert.ok(coin && can);
  Object.assign(run, { x: coin.x, y: coin.y + 0.2, vx: 0, vy: 0 });
  step(run, {}, 1 / 60);
  assert.equal(run.coins, coin.v);
  assert.ok(run.taken.has(coin.id));
  const c1 = run.coins;
  Object.assign(run, { x: coin.x, y: coin.y + 0.2, vx: 0, vy: 0 });
  step(run, {}, 1 / 60);
  assert.equal(run.coins, c1, "ikinci kez toplanmaz");
  run.fuel = 10;
  Object.assign(run, { x: can.x, y: can.y, vx: 0, vy: 0 });
  step(run, {}, 1 / 60);
  assert.equal(run.fuel > 90, true);
});

test("hillclimb: yükseltmeler işe yarar (motor daha hızlı ivmelenir), maliyet artar", () => {
  const base = drive({}, 6, { gas: 1 }), up = drive({ upgrades: { engine: 5 } }, 6, { gas: 1 });
  assert.ok(up.dist > base.dist, `motor ${up.dist} > ${base.dist}`);
  assert.ok(upgradeCost("engine", 1) > upgradeCost("engine", 0));
  assert.ok(upgradeCost("awd", 0) > 0);
});

test("hillclimb: takla bonusu — havada tam tur dönüp inince ödül ve olay", () => {
  const run = createRun({});
  // Yapay: havada 1 tam tur dönmüş say, sonra yere değdir
  Object.assign(run.air, { t: 1.2, rot: -2 * Math.PI * 1.05 });
  for (const w of run.wheels) w.ground = false;
  // araç zeminde: ilk alt adımda grounded > 0 → ödül
  step(run, {}, 1 / 60);
  const ev = run.events.find((e) => e.type === "flip");
  assert.ok(ev && ev.kind === "front" && ev.n === 1, JSON.stringify(run.events));
  assert.equal(run.flips, 1);
});
