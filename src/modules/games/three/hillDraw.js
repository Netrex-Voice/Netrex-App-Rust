/**
 * Tepe Tırmanışı çizimi (Canvas 2B). Tüm görseller bu oyun için kodla çizilmiş özgün vektörlerdir (dış dosya yok).
 * Dünya koordinatı: metre, y yukarı → bağlam dönüşümü `world()` ile kurulur.
 */
import { pickupsIn, wheelPose } from "../engines/hillclimb";

const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Dünya → ekran dönüşümü: k piksel/metre, kamera merkezi (cx,cy) */
export function world(ctx, w, h, dpr, cam, k) {
  ctx.setTransform(k * dpr, 0, 0, -k * dpr, (w / 2 - cam.x * k) * dpr, (h / 2 + cam.y * k) * dpr);
}

function hills(ctx, w, h, dpr, cam, k, factor, baseY, amp, freq, color, seed) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  const off = cam.x * factor * k;
  for (let sx = 0; sx <= w + 8; sx += 8) {
    const wx = (sx + off) / k;
    const y = baseY - (Math.sin(wx * freq + seed) * 0.6 + Math.sin(wx * freq * 2.3 + seed * 2) * 0.3 + 1) * amp - cam.y * k * factor * 0.15;
    ctx.lineTo(sx, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

function drawSky(ctx, w, h, dpr, st, cam, k, t) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, st.sky[0]);
  g.addColorStop(1, st.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (st.id === "moon") {
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.35 + hash(i + 3) * 0.6})`;
      ctx.fillRect(hash(i) * w, hash(i + 90) * h * 0.75, 1.6, 1.6);
    }
    ctx.fillStyle = "#4b79d6";
    ctx.beginPath();
    ctx.arc(w * 0.78, h * 0.2, Math.min(w, h) * 0.07, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#39a566";
    ctx.beginPath();
    ctx.arc(w * 0.775, h * 0.19, Math.min(w, h) * 0.035, 0, 7);
    ctx.fill();
  } else {
    // güneş
    const sx = w * 0.8, sy = h * 0.18;
    const sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, Math.min(w, h) * 0.14);
    sg.addColorStop(0, "rgba(255,244,190,1)");
    sg.addColorStop(0.35, "rgba(255,230,150,.55)");
    sg.addColorStop(1, "rgba(255,230,150,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(sx - 200, sy - 200, 400, 400);
    // bulutlar
    ctx.fillStyle = st.id === "arctic" ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.9)";
    for (let i = 0; i < 7; i++) {
      const base = hash(i + 11) * 2600;
      const x = ((base - cam.x * k * 0.06 + t * 6 * (0.4 + hash(i) * 0.5)) % (w + 320) + (w + 320)) % (w + 320) - 160;
      const y = h * (0.08 + hash(i + 40) * 0.3);
      const s = 28 + hash(i + 70) * 34;
      ctx.beginPath();
      ctx.ellipse(x, y, s * 1.5, s * 0.55, 0, 0, 7);
      ctx.ellipse(x - s * 0.7, y + s * 0.1, s * 0.9, s * 0.45, 0, 0, 7);
      ctx.ellipse(x + s * 0.8, y + s * 0.12, s, s * 0.45, 0, 0, 7);
      ctx.fill();
    }
  }
  hills(ctx, w, h, dpr, cam, k, 0.12, h * 0.62, h * 0.12, 0.004, st.far2, 1.3);
  hills(ctx, w, h, dpr, cam, k, 0.28, h * 0.72, h * 0.1, 0.007, st.far, 4.1);
}

function decor(ctx, run, st, x0, x1) {
  const T = run.terrain;
  for (let ix = Math.floor(x0 / 6); ix <= Math.floor(x1 / 6); ix++) {
    const r = hash(ix * 3.7 + run.terrain.seed);
    if (r > 0.62 || ix * 6 < 16) continue;
    const x = ix * 6 + hash(ix + 5) * 5;
    const y = T.h(x);
    const s = 0.8 + hash(ix + 9) * 0.9;
    ctx.save();
    ctx.translate(x, y - 0.1);
    if (st.id === "countryside") {
      ctx.fillStyle = "#7a4a1f";
      ctx.fillRect(-0.12 * s, 0, 0.24 * s, 1.5 * s);
      ctx.fillStyle = "#3d8f2c";
      ctx.beginPath(); ctx.arc(0, 1.9 * s, 0.9 * s, 0, 7); ctx.arc(-0.6 * s, 1.5 * s, 0.6 * s, 0, 7); ctx.arc(0.6 * s, 1.5 * s, 0.6 * s, 0, 7); ctx.fill();
      ctx.fillStyle = "#4fae3a";
      ctx.beginPath(); ctx.arc(-0.2 * s, 2.2 * s, 0.5 * s, 0, 7); ctx.fill();
    } else if (st.id === "desert") {
      ctx.fillStyle = "#4f9d52";
      ctx.fillRect(-0.18 * s, 0, 0.36 * s, 1.8 * s);
      ctx.fillRect(-0.7 * s, 0.7 * s, 0.55 * s, 0.22 * s); ctx.fillRect(-0.7 * s, 0.7 * s, 0.2 * s, 0.7 * s);
      ctx.fillRect(0.15 * s, 1.0 * s, 0.55 * s, 0.22 * s); ctx.fillRect(0.5 * s, 1.0 * s, 0.2 * s, 0.6 * s);
    } else if (st.id === "arctic") {
      ctx.fillStyle = "#3c6e55";
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-0.8 * s + i * 0.12, 0.5 * s + i * 0.7 * s); ctx.lineTo(0.8 * s - i * 0.12, 0.5 * s + i * 0.7 * s); ctx.lineTo(0, 1.5 * s + i * 0.7 * s); ctx.fill(); }
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.moveTo(-0.3 * s, 2.7 * s); ctx.lineTo(0.3 * s, 2.7 * s); ctx.lineTo(0, 3.4 * s); ctx.fill();
    } else {
      ctx.fillStyle = "#8d909c";
      ctx.beginPath(); ctx.ellipse(0, 0.2 * s, 0.8 * s, 0.5 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#a7aab6";
      ctx.beginPath(); ctx.ellipse(-0.15 * s, 0.3 * s, 0.4 * s, 0.25 * s, 0, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
}

function drawTerrain(ctx, run, st, cam, w, h, k) {
  const T = run.terrain;
  const x0 = cam.x - w / (2 * k) - 1, x1 = cam.x + w / (2 * k) + 1;
  const bottom = cam.y - h / (2 * k) - 2;
  const path = (dy) => {
    ctx.beginPath();
    ctx.moveTo(x0, bottom);
    for (let x = x0; x <= x1; x += 0.35) ctx.lineTo(x, T.h(x) - dy);
    ctx.lineTo(x1, bottom);
    ctx.closePath();
  };
  decor(ctx, run, st, x0, x1);
  ctx.fillStyle = st.dirt;
  path(0);
  ctx.fill();
  ctx.fillStyle = st.dirt2;
  path(1.6);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,.14)";
  path(3.6);
  ctx.fill();
  // çakıl/taş benekleri
  ctx.fillStyle = "rgba(0,0,0,.16)";
  for (let ix = Math.floor(x0 / 2.5); ix <= Math.floor(x1 / 2.5); ix++) {
    for (let j = 0; j < 2; j++) {
      const x = ix * 2.5 + hash(ix * 2 + j) * 2.4;
      const y = T.h(x) - 0.7 - hash(ix * 5 + j) * 2.6;
      ctx.beginPath();
      ctx.ellipse(x, y, 0.16 + hash(ix + j) * 0.12, 0.1, 0, 0, 7);
      ctx.fill();
    }
  }
  // üst çim/kar/toz şeridi
  ctx.lineJoin = "round";
  ctx.strokeStyle = st.ground;
  ctx.lineWidth = 0.46;
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 0.35) (x === x0 ? ctx.moveTo : ctx.lineTo).call(ctx, x, T.h(x) - 0.05);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.28)";
  ctx.lineWidth = 0.1;
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 0.35) (x === x0 ? ctx.moveTo : ctx.lineTo).call(ctx, x, T.h(x) + 0.12);
  ctx.stroke();
}

function drawPickups(ctx, run, t) {
  for (const p of pickupsIn(run.terrain, run.x - 40, run.x + 40)) {
    if (run.taken.has(p.id)) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.kind === "coin") {
      const sx = Math.abs(Math.cos(t * 4 + p.x));
      const col = p.v >= 100 ? ["#fde047", "#ca8a04"] : p.v >= 50 ? ["#e5e7eb", "#9ca3af"] : ["#fbbf24", "#b45309"];
      ctx.fillStyle = col[1];
      ctx.beginPath(); ctx.ellipse(0, 0, 0.42 * Math.max(0.12, sx), 0.42, 0, 0, 7); ctx.fill();
      ctx.fillStyle = col[0];
      ctx.beginPath(); ctx.ellipse(0, 0, 0.33 * Math.max(0.1, sx), 0.33, 0, 0, 7); ctx.fill();
    } else {
      // kırmızı bidon
      ctx.scale(1, 1);
      ctx.fillStyle = "#c81e1e";
      ctx.fillRect(-0.4, -0.5, 0.8, 1.0);
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(-0.4, 0.15, 0.8, 0.35);
      ctx.fillStyle = "#7f1d1d";
      ctx.fillRect(-0.2, 0.5, 0.4, 0.18);
      ctx.fillRect(0.12, 0.5, 0.2, 0.28);
      ctx.fillStyle = "#fff";
      ctx.fillRect(-0.18, -0.25, 0.36, 0.1);
      ctx.fillRect(-0.05, -0.38, 0.1, 0.36);
    }
    ctx.restore();
  }
}

function wheel(ctx, x, y, R, rot, tire, rim, treads) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = tire;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
  if (treads) {
    ctx.fillStyle = "#0b0b0d";
    for (let i = 0; i < 14; i++) {
      ctx.save(); ctx.rotate((i / 14) * Math.PI * 2);
      ctx.fillRect(R - 0.12, -0.07, 0.17, 0.14);
      ctx.restore();
    }
  }
  ctx.fillStyle = rim;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.58, 0, 7); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.35)";
  ctx.lineWidth = R * 0.07;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0, 0); const a = (i / 5) * Math.PI * 2; ctx.lineTo(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55); ctx.stroke(); }
  ctx.fillStyle = "#374151";
  ctx.beginPath(); ctx.arc(0, 0, R * 0.14, 0, 7); ctx.fill();
  ctx.restore();
}

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

function rider(ctx, hx, hy, bike) {
  // gövde + kafa + kask
  ctx.fillStyle = "#f59e0b";
  ctx.fillRect(hx - 0.18, hy - 0.62, 0.36, 0.5);
  ctx.fillStyle = "#fcd9b6";
  ctx.beginPath(); ctx.arc(hx, hy, 0.24, 0, 7); ctx.fill();
  ctx.fillStyle = bike ? "#111827" : "#facc15";
  ctx.beginPath(); ctx.arc(hx, hy + 0.04, 0.27, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
  ctx.fillStyle = "#111";
  ctx.beginPath(); ctx.arc(hx + 0.1, hy + 0.02, 0.04, 0, 7); ctx.fill();
}

/** Aracı çizer. Yerel eksen: x ileri, y yukarı. pose.wheels: [{x,y,rot}] dünya konumu */
export function drawVehicle(ctx, P, pose) {
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.a);
  const hw = P.hw, hh = P.hh;
  // süspansiyon kolları (yerel koordinat)
  const wl = pose.wheels.map((wh) => {
    const dx = wh.x - pose.x, dy = wh.y - pose.y;
    const c = Math.cos(-pose.a), s = Math.sin(-pose.a);
    return { x: dx * c - dy * s, y: dx * s + dy * c };
  });
  ctx.strokeStyle = "#4b5563";
  ctx.lineWidth = 0.1;
  for (const w of wl) { ctx.beginPath(); ctx.moveTo(w.x, -P.ax); ctx.lineTo(w.x, w.y); ctx.stroke(); }
  if (P.id === "moto") {
    ctx.strokeStyle = P.color;
    ctx.lineWidth = 0.14;
    ctx.beginPath(); ctx.moveTo(wl[0].x, wl[0].y); ctx.lineTo(-0.2, 0.15); ctx.lineTo(0.45, 0.3); ctx.lineTo(wl[1].x, wl[1].y); ctx.stroke();
    ctx.fillStyle = P.color;
    roundRect(ctx, -0.55, 0.05, 1.0, 0.36, 0.14); ctx.fill();
    ctx.fillStyle = P.color2;
    roundRect(ctx, -0.2, 0.3, 0.7, 0.2, 0.08); ctx.fill();
    ctx.fillStyle = "#111827";
    roundRect(ctx, -0.65, 0.4, 0.8, 0.14, 0.06); ctx.fill();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 0.08;
    ctx.beginPath(); ctx.moveTo(0.5, 0.35); ctx.lineTo(0.62, 0.78); ctx.lineTo(0.5, 0.85); ctx.stroke();
    rider(ctx, P.head[0], P.head[1], true);
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(P.head[0] - 0.05, P.head[1] - 0.55, 0.12, 0.5);
  } else {
    // gövde
    ctx.fillStyle = P.color;
    roundRect(ctx, -hw, -hh, hw * 2, hh * 1.5, 0.18); ctx.fill();
    ctx.fillStyle = P.color2;
    roundRect(ctx, -hw + 0.08, -hh * 0.1, hw * 2 - 0.16, hh * 0.5, 0.1); ctx.fill();
    // kabin
    ctx.fillStyle = P.color;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.62, hh * 0.5); ctx.lineTo(-hw * 0.38, hh * 1.6); ctx.lineTo(hw * 0.28, hh * 1.6); ctx.lineTo(hw * 0.52, hh * 0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#bae6fd";
    ctx.beginPath();
    ctx.moveTo(-hw * 0.5, hh * 0.58); ctx.lineTo(-hw * 0.32, hh * 1.48); ctx.lineTo(hw * 0.22, hh * 1.48); ctx.lineTo(hw * 0.4, hh * 0.58); ctx.closePath(); ctx.fill();
    // sürücü (camın arkasında)
    rider(ctx, P.head[0], P.head[1] - 0.04, false);
    // tampon, far
    ctx.fillStyle = "#111827";
    roundRect(ctx, hw - 0.1, -hh, 0.28, 0.2, 0.06); ctx.fill();
    roundRect(ctx, -hw - 0.18, -hh, 0.28, 0.2, 0.06); ctx.fill();
    ctx.fillStyle = "#fef08a";
    ctx.beginPath(); ctx.ellipse(hw - 0.05, hh * 0.28, 0.1, 0.14, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(-hw + 0.0, hh * 0.2, 0.1, 0.22);
    // çamurluk kemerleri: gövde şeklinde kırpılır (dışarı taşmaz)
    ctx.save();
    roundRect(ctx, -hw, -hh, hw * 2, hh * 1.5, 0.18);
    ctx.clip();
    ctx.fillStyle = "rgba(0,0,0,.4)";
    for (const w of wl) { ctx.beginPath(); ctx.arc(w.x, w.y, P.R * 1.18, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  ctx.restore();
  // tekerlekler (gövde dönüşünün dışında, dünya konumunda)
  pose.wheels.forEach((wh) => wheel(ctx, wh.x, wh.y, P.R, wh.rot, "#15171c", P.id === "monster" ? "#d4d4d8" : "#cbd5e1", P.id === "monster"));
}

/** Parçacıklar (toz, kar, yaprak, altın kıvılcımı) */
export function drawParticles(ctx, parts) {
  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawScene(ctx, run, st, cam, w, h, dpr, k, t, parts, wheelRot) {
  drawSky(ctx, w, h, dpr, st, cam, k, t);
  world(ctx, w, h, dpr, cam, k);
  drawTerrain(ctx, run, st, cam, w, h, k);
  drawPickups(ctx, run, t);
  const wheels = [0, 1].map((i) => ({ ...wheelPose(run, i), rot: wheelRot[i] }));
  drawVehicle(ctx, run.params, { x: run.x, y: run.y, a: run.a, wheels });
  drawParticles(ctx, parts);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
