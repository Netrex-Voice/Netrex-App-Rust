"use client";

import { useRef, useState } from "react";
import { ArcadeBtn, useFitCanvas } from "../ui";
import { Frame, Overlay, useKeys, useLoop, useSoloScores, sfx } from "../solo/kit";

const W = 480, H = 640, ACCENT = "#38bdf8";
const COLS = 10, ROWS_BASE = 5, BW = W / COLS, BH = 24, TOP = 70;
const ROW_COLORS = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#38bdf8", "#a855f7", "#ec4899"];

function bricks(level) {
  const rows = Math.min(ROWS_BASE + level - 1, 8), out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) {
    if (level > 1 && (r + c * (level % 3 + 1)) % 7 === 0) continue; // seviyeye göre boşluklar
    out.push({ x: c * BW, y: TOP + r * BH, c: ROW_COLORS[r % ROW_COLORS.length], hp: r < Math.floor(level / 3) ? 2 : 1, alive: true });
  }
  return out;
}
const fresh = (level = 1, score = 0, lives = 3) => ({ level, score, lives, bricks: bricks(level), pad: { x: W / 2, w: 90 }, ball: { x: W / 2, y: H - 60, vx: 0, vy: 0, stuck: true }, keys: { l: 0, r: 0 }, over: false, cleared: false, parts: [], t: 0 });

export default function BreakoutView() {
  const { ref, box, scale } = useFitCanvas(W, H);
  const g = useRef(fresh());
  const [ui, setUi] = useState({ score: 0, lives: 3, level: 1, over: false, record: false, cleared: false });
  const best = useSoloScores((s) => s.best.breakout || 0);
  const submit = useSoloScores((s) => s.submit);
  const sync = () => setUi((u) => ({ ...u, score: g.current.score, lives: g.current.lives, level: g.current.level }));

  const restart = () => { g.current = fresh(); setUi({ score: 0, lives: 3, level: 1, over: false, record: false, cleared: false }); };
  const launch = () => { const b = g.current.ball; if (b.stuck && !g.current.over) { b.stuck = false; const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.7; const sp = 330 + g.current.level * 18; b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; sfx.pop(); } };
  const nextLevel = () => { const s = g.current; g.current = fresh(s.level + 1, s.score, s.lives); setUi((u) => ({ ...u, cleared: false, level: g.current.level })); };
  useKeys({
    ArrowLeft: { down: () => (g.current.keys.l = 1), up: () => (g.current.keys.l = 0), repeat: true }, KeyA: { down: () => (g.current.keys.l = 1), up: () => (g.current.keys.l = 0), repeat: true },
    ArrowRight: { down: () => (g.current.keys.r = 1), up: () => (g.current.keys.r = 0), repeat: true }, KeyD: { down: () => (g.current.keys.r = 1), up: () => (g.current.keys.r = 0), repeat: true },
    Space: { down: launch }, ArrowUp: { down: launch },
  });
  const pointer = (e) => { const r = ref.current.getBoundingClientRect(); g.current.pad.x = ((e.clientX - r.left) / r.width) * W; };

  useLoop((dt) => {
    const s = g.current;
    s.t += dt;
    if (!s.over && !s.cleared) {
      s.pad.x += (s.keys.r - s.keys.l) * 520 * dt;
      s.pad.x = Math.max(s.pad.w / 2, Math.min(W - s.pad.w / 2, s.pad.x));
      const b = s.ball;
      if (b.stuck) { b.x = s.pad.x; b.y = H - 60; }
      else {
        const steps = 3;
        for (let i = 0; i < steps; i++) {
          b.x += (b.vx * dt) / steps; b.y += (b.vy * dt) / steps;
          if (b.x < 8) { b.x = 8; b.vx = Math.abs(b.vx); sfx.tick(); }
          if (b.x > W - 8) { b.x = W - 8; b.vx = -Math.abs(b.vx); sfx.tick(); }
          if (b.y < 8) { b.y = 8; b.vy = Math.abs(b.vy); sfx.tick(); }
          const py = H - 40;
          if (b.vy > 0 && b.y > py - 8 && b.y < py + 6 && Math.abs(b.x - s.pad.x) < s.pad.w / 2 + 6) {
            const k = (b.x - s.pad.x) / (s.pad.w / 2), sp = Math.min(Math.hypot(b.vx, b.vy) * 1.015, 720), a = -Math.PI / 2 + k * 1.05;
            b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.y = py - 8; sfx.pop();
          }
          for (const br of s.bricks) {
            if (!br.alive || b.x < br.x - 6 || b.x > br.x + BW + 6 || b.y < br.y - 6 || b.y > br.y + BH + 6) continue;
            const ox = Math.min(b.x - br.x, br.x + BW - b.x), oy = Math.min(b.y - br.y, br.y + BH - b.y);
            if (ox < oy) b.vx = -b.vx; else b.vy = -b.vy;
            br.hp--; sfx.good();
            if (br.hp <= 0) { br.alive = false; s.score += 10 * s.level; for (let k = 0; k < 6; k++) s.parts.push({ x: br.x + BW / 2, y: br.y + BH / 2, vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.7) * 200, life: 0.5, c: br.c }); }
            else s.score += 3;
            sync();
            break;
          }
        }
        if (b.y > H + 20) {
          s.lives--; sfx.lose();
          if (s.lives <= 0) { s.over = true; setUi((u) => ({ ...u, over: true, score: s.score, lives: 0, record: submit("breakout", s.score) })); }
          else { s.ball = { x: s.pad.x, y: H - 60, vx: 0, vy: 0, stuck: true }; sync(); }
        }
        if (!s.bricks.some((x) => x.alive)) { s.cleared = true; sfx.win(); setUi((u) => ({ ...u, cleared: true })); }
      }
    }
    for (const p of s.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; p.life -= dt; }
    s.parts = s.parts.filter((p) => p.life > 0);

    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d"), k = scale.current.k;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#14183a"); bg.addColorStop(1, "#0b0d24");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    for (const br of s.bricks) {
      if (!br.alive) continue;
      ctx.fillStyle = br.hp > 1 ? "#cbd5e1" : br.c; ctx.fillRect(br.x + 2, br.y + 2, BW - 4, BH - 4);
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(br.x + 2, br.y + 2, BW - 4, 5);
      ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(br.x + 2, br.y + BH - 7, BW - 4, 5);
    }
    ctx.fillStyle = ACCENT; ctx.shadowColor = ACCENT; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.roundRect?.(s.pad.x - s.pad.w / 2, H - 40, s.pad.w, 14, 7); if (!ctx.roundRect) ctx.rect(s.pad.x - s.pad.w / 2, H - 40, s.pad.w, 14); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.shadowColor = "#fff"; ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, 8, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    for (const p of s.parts) { ctx.globalAlpha = Math.max(0, p.life * 2); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 5, 5); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.font = "bold 16px sans-serif"; ctx.textAlign = "left";
    ctx.fillText("♥".repeat(Math.max(0, s.lives)), 12, 28); ctx.textAlign = "right"; ctx.fillText(`Seviye ${s.level}`, W - 12, 28);
    if (s.ball.stuck && !s.over && !s.cleared) { ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.fillText("Fırlatmak için tıkla / boşluk", W / 2, H - 100); }
  });

  return (
    <Frame accent={ACCENT} title="Tuğla Kırma" emoji="🧱" stats={[["Skor", ui.score], ["Seviye", ui.level], ["Rekor", Math.max(best, ui.score)]]} onRestart={restart} hint="Fare / ← → / A D ile raketi sür · tıkla ya da boşlukla fırlat · topu düşürme">
      <div ref={box} className="relative mx-auto flex w-full items-center justify-center touch-none select-none" style={{ height: "min(72vh, 680px)" }} onPointerMove={pointer} onPointerDown={(e) => { pointer(e); launch(); }}>
        <canvas ref={ref} className="cursor-none rounded-xl" />
        {ui.cleared && !ui.over && <Overlay emoji="⭐" title={`Seviye ${ui.level} tamam!`} actions={<ArcadeBtn tone="good" big onClick={nextLevel}>Sonraki seviye</ArcadeBtn>} />}
        {ui.over && <Overlay emoji="💔" title="Oyun bitti" sub={`${ui.score} puan · seviye ${ui.level}`} record={ui.record} actions={<ArcadeBtn tone="good" big onClick={restart}>Tekrar oyna</ArcadeBtn>} />}
      </div>
    </Frame>
  );
}
