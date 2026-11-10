/** Kanvas efektleri: parçacık, iz, ekran sarsıntısı, flaş. Saf çizim yardımcıları (React yok, bellek sınırlı). */

const MAX_PARTICLES = 160;

export function makeFx() {
  return { parts: [], trail: [], shake: 0, flash: 0, flashColor: "#fff", banner: null };
}

export function burst(fx, x, y, color, n = 10, speed = 260) {
  for (let i = 0; i < n && fx.parts.length < MAX_PARTICLES; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.35 + Math.random() * 0.65);
    fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.3, max: 0.65, color, r: 1.5 + Math.random() * 2.2 });
  }
}

export function pushTrail(fx, x, y, max = 16) {
  fx.trail.push([x, y]);
  if (fx.trail.length > max) fx.trail.shift();
}

export function step(fx, dt, gravity = 0) {
  for (const p of fx.parts) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 3 * dt;
    p.vy = p.vy * (1 - 3 * dt) + gravity * dt;
    p.life -= dt;
  }
  fx.parts = fx.parts.filter((p) => p.life > 0);
  fx.shake = Math.max(0, fx.shake - dt * 30);
  fx.flash = Math.max(0, fx.flash - dt * 2.5);
  if (fx.banner) {
    fx.banner.t += dt;
    if (fx.banner.t > fx.banner.dur) fx.banner = null;
  }
}

/** Sarsıntı ofseti (çizimden önce translate) */
export const shakeOffset = (fx) => (fx.shake > 0 ? [(Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake] : [0, 0]);

export function drawParts(g, fx) {
  for (const p of fx.parts) {
    g.globalAlpha = Math.max(0, p.life / p.max);
    g.fillStyle = p.color;
    g.beginPath();
    g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

/** İz çizimi: kind = none | line | spark | comet */
export function drawTrail(g, fx, kind, color, radius) {
  const t = fx.trail;
  if (kind === "none" || t.length < 2) return;
  if (kind === "comet") {
    for (let i = 0; i < t.length; i++) {
      const a = i / t.length;
      g.globalAlpha = a * 0.35;
      g.fillStyle = color;
      g.beginPath();
      g.arc(t[i][0], t[i][1], radius * (0.4 + a * 0.6), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    return;
  }
  g.lineCap = "round";
  for (let i = 1; i < t.length; i++) {
    const a = i / t.length;
    g.globalAlpha = a * (kind === "spark" ? 0.55 : 0.35);
    g.strokeStyle = kind === "spark" ? color : "#ffffff";
    g.lineWidth = radius * 1.4 * a;
    g.beginPath();
    g.moveTo(t[i - 1][0], t[i - 1][1]);
    g.lineTo(t[i][0], t[i][1]);
    g.stroke();
  }
  g.globalAlpha = 1;
}

export function drawBanner(g, fx, W, H) {
  const b = fx.banner;
  if (!b) return;
  const k = Math.min(1, b.t / 0.18);
  const fade = b.t > b.dur - 0.3 ? Math.max(0, (b.dur - b.t) / 0.3) : 1;
  g.save();
  g.globalAlpha = fade;
  g.translate(W / 2, H / 2);
  g.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
  g.textAlign = "center";
  g.fillStyle = b.color;
  g.font = "800 92px system-ui, sans-serif";
  g.fillText(b.text, 0, 18);
  if (b.sub) {
    g.fillStyle = "rgba(255,255,255,.85)";
    g.font = "600 24px system-ui, sans-serif";
    g.fillText(b.sub, 0, 58);
  }
  g.restore();
}
