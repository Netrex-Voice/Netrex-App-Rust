import test from "node:test";
import assert from "node:assert/strict";
import * as hockey from "../engines/airhockey.js";
import * as pong from "../engines/pingpong.js";
import { Predictor } from "../netcode.js";
import { makeRng } from "../engines/util.js";

const pct = (arr, p) => {
  const a = arr.slice().sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(a.length * p))] || 0;
};

/**
 * Host (motor) ile misafir (Predictor) arasında yapay gecikmeli ağ. Host 60 Hz, anlık görüntü 60 Hz,
 * misafir 60 fps. Ölçüm: misafirin ÇİZDİĞİ disk konumu ile host'taki GERÇEK disk konumu arasındaki mesafe.
 */
export function netSim({ engine, config, rttMs, seconds, guest, seed = 1, jitterMs = 0 }) {
  const rng = makeRng(seed);
  const s = engine.create({ players: [{ id: "h", bot: true }, { id: "g", remote: true }], config, rng });
  const ballKey = engine === pong ? "ball" : "puck";
  const q = [];
  const oneWay = rttMs / 2000;
  const delay = () => oneWay + (jitterMs ? (rng() * jitterMs) / 1000 : 0);
  let now = 0;
  let pred = null;
  let lastSnapAt = -1;
  let naive = null;
  const errPred = [];
  const errNaive = [];
  let accepted = 0;
  let rejected = 0;
  const why = {};
  const sendToHost = (m) => q.push({ at: now + delay(), to: "host", m });
  const dt = 1 / 60;
  for (let i = 0; i < seconds * 60; i++) {
    now += dt;
    engine.tick(s, dt);
    if (now - lastSnapAt >= 1 / 60 - 1e-9) {
      lastSnapAt = now;
      q.push({ at: now + delay(), to: "guest", v: JSON.parse(JSON.stringify(engine.view(s))) });
    }
    q.sort((a, b) => a.at - b.at);
    while (q.length && q[0].at <= now) {
      const msg = q.shift();
      if (msg.to === "host") {
        const ok = engine.input(s, "g", msg.m);
        if (msg.m.t === "hit") {
          if (ok) accepted++;
          else {
            rejected++;
            why[s.claimReject] = (why[s.claimReject] || 0) + 1;
          }
        }
      } else {
        naive = msg.v;
        if (!pred) pred = new Predictor(engine, 1, msg.v);
        pred.setRtt(rttMs / 1000);
        pred.snapshot(msg.v, now);
      }
    }
    if (!pred) continue;
    if (engine === pong && s.phase === "serve" && s.server === 1 && rng() < 0.05) q.push({ at: now + delay(), to: "host", m: { t: "serve" } });
    const tgt = guest(pred.sim, rng);
    pred.aim(tgt.x, tgt.y);
    const r = pred.frame(now, dt, sendToHost);
    const live = s.phase === "play" || s.phase === "rally";
    if (live && naive && (naive.phase === "play" || naive.phase === "rally")) {
      const truth = s[ballKey];
      errPred.push(Math.hypot(r.ball[0] - truth.x, r.ball[1] - truth.y));
      errNaive.push(Math.hypot(naive[ballKey === "puck" ? "puck" : "ball"][0] - truth.x, naive[ballKey === "puck" ? "puck" : "ball"][1] - truth.y));
    }
  }
  return {
    s,
    accepted,
    rejected,
    pred: { p50: pct(errPred, 0.5), p95: pct(errPred, 0.95) },
    naive: { p50: pct(errNaive, 0.5), p95: pct(errNaive, 0.95) },
    stats: pred?.stats,
    why,
  };
}

// Misafir (sağ koltuk) için basit insan benzeri oyuncu: disk yarısındaysa arkasına geçip sola vurur
const hockeyGuest = (sim, rng) => {
  const k = sim.puck;
  if (k.x > 0.05 && (k.vx > -0.3 || Math.hypot(k.vx, k.vy) < 1.5)) {
    const behind = k.x + sim.padR + hockey.R_PUCK - 0.005;
    return { x: behind > k.x + 0.03 ? k.x + 0.01 : behind, y: k.y + (rng() - 0.5) * 0.04 };
  }
  return { x: hockey.L / 2 - 0.15, y: k.y * 0.6 };
};

// Misafir (koltuk 1, Z>0 ucu): temas tahminine git, yukarı doğru vur
const pongGuest = (sim) => {
  const c = sim.contact?.[1];
  if (c) return { x: c.x, y: c.y - 0.05 };
  return { x: 0, y: pong.TABLE_Y + 0.2 };
};

for (const rtt of [60, 150]) {
  test(`hockey ağ simülasyonu RTT ${rtt} ms: tahmin hatası tahminsizden küçük, vuruş iddiaları kabul ediliyor`, () => {
    const r = netSim({ engine: hockey, config: { target: 15 }, rttMs: rtt, seconds: 90, guest: hockeyGuest, seed: 3 });
    console.log(`  hockey RTT ${rtt}: tahminli p50=${(r.pred.p50*100).toFixed(1)} p95=${(r.pred.p95*100).toFixed(1)} | tahminsiz p50=${(r.naive.p50*100).toFixed(1)} p95=${(r.naive.p95*100).toFixed(1)} cm | iddia kabul ${r.accepted}/${r.accepted + r.rejected} ${JSON.stringify(r.why)} ${JSON.stringify(r.stats)}`);
    assert.ok(r.accepted >= 10, "yeterli vuruş olmadı");
    assert.ok(r.accepted / (r.accepted + r.rejected) >= 0.9, "iddiaların çoğu reddedildi");
    assert.ok(r.pred.p50 < r.naive.p50, "tahmin medyanı daha iyi olmalı");
  });
}

test("pong ağ simülasyonu RTT 120 ms: misafir topu karşılar, iddialar kabul", () => {
  const r = netSim({ engine: pong, config: { target: 21 }, rttMs: 120, seconds: 90, guest: pongGuest, seed: 5 });
  r.pred.p50 *= 100; r.pred.p95 *= 100; r.naive.p50 *= 100; r.naive.p95 *= 100; // cm
  console.log(`  pong RTT 120: tahminli p50=${r.pred.p50.toFixed(1)} p95=${r.pred.p95.toFixed(1)} | tahminsiz p50=${r.naive.p50.toFixed(1)} p95=${r.naive.p95.toFixed(1)} px cm | iddia kabul ${r.accepted}/${r.accepted + r.rejected} ${JSON.stringify(r.why)} skor ${r.s.score} en uzun rali ${r.s.longest}`);
  assert.ok(r.accepted >= 10);
  assert.ok(r.accepted / (r.accepted + r.rejected) >= 0.85);
  assert.ok(r.pred.p50 < r.naive.p50);
});

test("geçersiz vuruş iddiaları reddedilir (uzak, yanlış yön, hız aşımı, sıklık)", () => {
  const s = hockey.create({ players: [{ id: "h" }, { id: "g", remote: true }] });
  s.phase = "play";
  s.puck = { x: 0.5, y: 0, vx: 2, vy: 0, w: 0 };
  s.pads[1] = { ...s.pads[1], x: 0.6, y: 0 };
  const ok = { px: 0.5, py: 0, vx: -9, vy: 0, ax: 0.585, ay: 0 };
  assert.equal(hockey.input(s, "g", { t: "hit", ...ok, ax: -0.3 }), false, "raket kendi yarısında değil");
  assert.equal(hockey.input(s, "g", { t: "hit", ...ok, px: -0.5 }), false, "disk çok uzak");
  assert.equal(hockey.input(s, "g", { t: "hit", ...ok, vx: 9 }), false, "raketin içine doğru");
  assert.equal(hockey.input(s, "g", { t: "hit", ...ok, vx: -999 }), false, "hız sınırı");
  assert.equal(hockey.input(s, "g", { t: "hit", ...ok, ax: 0.7 }), false, "disk rakete değmiyor");
  assert.equal(hockey.input(s, "g", { t: "hit", ...ok, vx: "x" }), false, "sayı değil");
  assert.equal(hockey.input(s, "g", { t: "hit", ...ok }), true);
  assert.equal(s.puck.vx, -9);
  assert.equal(hockey.input(s, "g", { t: "hit", ...ok }), false, "80 ms içinde ikinci iddia");
  s.phase = "goal";
  hockey.tick(s, 0.2);
  assert.equal(hockey.input(s, "g", { t: "hit", ...ok }), false, "oyun durmuşken");
  assert.deepEqual(s.score, [0, 0]);
});

test("pong: iddia doğrulama — host çıkışı kendisi hesaplar, kilitli taraf vuramaz, uzak top reddedilir", () => {
  const s = pong.create({ players: [{ id: "h" }, { id: "g", remote: true }] });
  s.phase = "rally"; s.stage = "rally"; s.lastHit = 0; s.canHit = [false, true];
  s.ball = { x: 0.1, y: pong.TABLE_Y + 0.25, z: 1.6, vx: 0, vy: -0.5, vz: 5, wx: 0, wy: 0, wz: 0 };
  s.pads[1] = { ...s.pads[1], x: 0.1, y: pong.TABLE_Y + 0.25, z: 1.6, vx: 0, vy: 1 };
  const c = { t: "hit", px: 0.1, py: pong.TABLE_Y + 0.25, pz: 1.6, vx: 0, vy: -0.5, vz: 5, wx: 0, wy: 0, wz: 0, ax: 0.1, ay: pong.TABLE_Y + 0.25, az: 1.6, avx: 0, avy: 1.5 };
  assert.equal(pong.input(s, "g", { ...c, px: -0.8 }), false, "top uzak");
  assert.equal(pong.input(s, "g", { ...c, ax: 0.6 }), false, "raket uzak");
  assert.equal(pong.input(s, "g", { ...c, vx: "x" }), false);
  assert.equal(pong.input(s, "g", { ...c }), true);
  const expect = pong.shot(1, { x: 0.1, y: pong.TABLE_Y + 0.25, z: 1.6, vx: 0, vy: -0.5, vz: 5, wx: 0, wy: 0, wz: 0 }, { x: 0.1, y: pong.TABLE_Y + 0.25, z: 1.6, vx: 0, vy: 1.5 }, 1);
  assert.equal(s.ball.vz, expect.vz, "çıkışı host hesapladı (istemci hız yollamaz)");
  assert.ok(s.ball.vz < 0, "rakibe doğru");
  assert.equal(pong.input(s, "g", { ...c }), false, "üst üste vuramaz");
});

// Başlangıç titremesi regresyonu: geri sayımda (canlı olmayan faz) kendi raket, host'un eski kopyasına geri atılmamalı
test("hockey: geri sayımda kendi raket titremez (RTT 120 ms, işaretçi yumuşak hareket ediyor)", () => {
  const rtt = 0.12;
  const s = hockey.create({ players: [{ id: "h", bot: true }, { id: "g", remote: true }], config: {}, rng: makeRng(7) });
  assert.equal(s.phase, "countdown");
  const q = [];
  let pred = null;
  let now = 0;
  const dt = 1 / 60;
  const xs = [];
  for (let i = 0; i < 150 && s.phase === "countdown"; i++) {
    now += dt;
    hockey.tick(s, dt);
    q.push({ at: now + rtt / 2, to: "guest", v: JSON.parse(JSON.stringify(hockey.view(s))) });
    while (q.length && q[0].at <= now) {
      const m = q.shift();
      if (m.to === "host") hockey.input(s, "g", m.m);
      else {
        if (!pred) pred = new Predictor(hockey, 1, m.v);
        pred.setRtt(rtt);
        pred.snapshot(m.v, now);
      }
    }
    if (!pred) continue;
    pred.aim(hockey.L / 2 - 0.3, 0.1 * Math.sin(now * Math.PI));
    const r = pred.frame(now, dt, (m) => q.push({ at: now + rtt / 2, to: "host", m }));
    xs.push(r.pads[1][1]);
  }
  assert.ok(xs.length > 60, "yeterli kare yok");
  let worst = 0;
  for (let i = 2; i < xs.length; i++) worst = Math.max(worst, Math.abs(xs[i] - 2 * xs[i - 1] + xs[i - 2]));
  console.log(`  geri sayım raket en büyük ikinci fark: ${(worst * 1000).toFixed(2)} mm`);
  assert.ok(worst < 0.005, `raket titriyor (${worst})`);
});
