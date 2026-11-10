"use client";

import { useRef, useState } from "react";
import { ArcadeBtn, useFitCanvas } from "../ui";
import { Frame, Overlay, useKeys, useLoop, useSoloScores, sfx } from "../solo/kit";

const W = 400, H = 600, ACCENT = "#facc15", GAP = 150, PIPE_W = 64, G = 1500, FLAP = -430;
const fresh = () => ({ y: H / 2, vy: 0, pipes: [], score: 0, t: 0, started: false, over: false, spawn: 1.2, ground: 0 });

export default function FlappyView() {
  const { ref, box, scale } = useFitCanvas(W, H);
  const g = useRef(fresh());
  const [ui, setUi] = useState({ score: 0, over: false, started: false, record: false });
  const best = useSoloScores((s) => s.best.flappy || 0);
  const submit = useSoloScores((s) => s.submit);

  const restart = () => { g.current = fresh(); setUi({ score: 0, over: false, started: false, record: false }); };
  const flap = () => {
    const s = g.current;
    if (s.over) return;
    if (!s.started) { s.started = true; setUi((u) => ({ ...u, started: true })); }
    s.vy = FLAP; sfx.tick();
  };
  useKeys({ Space: { down: flap }, ArrowUp: { down: flap }, KeyW: { down: flap } });

  useLoop((dt) => {
    const s = g.current;
    s.t += dt;
    if (!s.over) s.ground = (s.ground + (s.started ? 150 : 60) * dt) % 40;
    if (s.started && !s.over) {
      s.vy += G * dt; s.y += s.vy * dt;
      s.spawn -= dt;
      if (s.spawn <= 0) { s.spawn = 1.55; s.pipes.push({ x: W + 10, gy: 110 + Math.random() * (H - 220 - GAP), passed: false }); }
      const sp = 150 + Math.min(80, s.score * 3);
      for (const p of s.pipes) {
        p.x -= sp * dt;
        if (!p.passed && p.x + PIPE_W < 90) { p.passed = true; s.score++; sfx.good(); setUi((u) => ({ ...u, score: s.score })); }
        if (90 + 14 > p.x && 90 - 14 < p.x + PIPE_W && (s.y - 12 < p.gy || s.y + 12 > p.gy + GAP)) s.over = true;
      }
      s.pipes = s.pipes.filter((p) => p.x > -PIPE_W - 10);
      if (s.y > H - 40 || s.y < -20) s.over = true;
      if (s.over) { sfx.lose(); setUi((u) => ({ ...u, over: true, score: s.score, record: submit("flappy", s.score) })); }
    } else if (!s.started) s.y = H / 2 + Math.sin(s.t * 4) * 8;
    else { s.vy += G * dt; s.y = Math.min(H - 40, s.y + s.vy * dt); }

    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d"), k = scale.current.k;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#38bdf8"); sky.addColorStop(1, "#bae6fd");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,.85)";
    for (let i = 0; i < 4; i++) { const x = ((i * 150 - s.t * 18) % (W + 120) + W + 120) % (W + 120) - 60; ctx.beginPath(); ctx.ellipse(x, 90 + i * 55, 44, 16, 0, 0, 7); ctx.ellipse(x + 26, 80 + i * 55, 28, 14, 0, 0, 7); ctx.fill(); }
    for (const p of s.pipes) {
      for (const [y0, h, cap] of [[0, p.gy, p.gy - 22], [p.gy + GAP, H, p.gy + GAP]]) {
        ctx.fillStyle = "#22c55e"; ctx.fillRect(p.x, y0, PIPE_W, h - y0);
        ctx.fillStyle = "#16a34a"; ctx.fillRect(p.x + PIPE_W - 12, y0, 12, h - y0);
        ctx.fillStyle = "#4ade80"; ctx.fillRect(p.x + 6, y0, 6, h - y0);
        ctx.fillStyle = "#15803d"; ctx.fillRect(p.x - 4, cap, PIPE_W + 8, 22); ctx.fillStyle = "#22c55e"; ctx.fillRect(p.x - 4, cap, PIPE_W + 8, 18);
      }
    }
    ctx.fillStyle = "#d9a441"; ctx.fillRect(0, H - 40, W, 40);
    ctx.fillStyle = "#65a30d"; ctx.fillRect(0, H - 40, W, 10);
    ctx.fillStyle = "rgba(0,0,0,.12)"; for (let x = -s.ground; x < W; x += 40) ctx.fillRect(x, H - 28, 20, 6);
    ctx.save(); ctx.translate(90, s.y); ctx.rotate(Math.max(-0.5, Math.min(1.2, s.vy / 700)));
    ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.ellipse(0, 0, 19, 15, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#fb923c"; ctx.beginPath(); ctx.moveTo(14, 2); ctx.lineTo(28, 6); ctx.lineTo(14, 10); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(8, -5, 6, 0, 7); ctx.fill(); ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(10, -5, 2.6, 0, 7); ctx.fill();
    ctx.fillStyle = "#f59e0b"; ctx.beginPath(); ctx.ellipse(-6, 3 + Math.sin(s.t * 22) * 4, 11, 6, 0, 0, 7); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.lineWidth = 5; ctx.font = "900 54px sans-serif"; ctx.textAlign = "center";
    ctx.strokeText(String(s.score), W / 2, 80); ctx.fillText(String(s.score), W / 2, 80);
  });

  return (
    <Frame accent={ACCENT} title="Kanatlı" emoji="🐤" stats={[["Skor", ui.score], ["Rekor", Math.max(best, ui.score)]]} onRestart={restart} hint="Boşluk / ↑ / tıkla ile kanat çırp · borulara değme">
      <div ref={box} className="relative mx-auto flex w-full items-center justify-center touch-none select-none" style={{ height: "min(72vh, 680px)" }} onPointerDown={flap}>
        <canvas ref={ref} className="rounded-xl" />
        {!ui.started && !ui.over && <div className="pointer-events-none absolute bottom-[18%] rounded-full bg-black/55 px-4 py-1.5 text-sm font-black text-white">Başlamak için tıkla ya da boşluğa bas</div>}
        {ui.over && <Overlay emoji="🐥" title="Düştün!" sub={`${ui.score} boru`} record={ui.record} actions={<ArcadeBtn tone="good" big onClick={restart}>Tekrar oyna</ArcadeBtn>} />}
      </div>
    </Frame>
  );
}
