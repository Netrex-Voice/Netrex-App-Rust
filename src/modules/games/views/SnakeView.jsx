"use client";

import { useEffect, useRef, useState } from "react";
import { ArcadeBtn, useFitCanvas } from "../ui";
import { Frame, Overlay, useKeys, swipeHandlers, useLoop, useSoloScores, sfx } from "../solo/kit";

const N = 20, CELL = 28, SIZE = N * CELL, ACCENT = "#22c55e";
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const fresh = () => ({ body: [[10, 10], [9, 10], [8, 10]], dir: "right", queue: [], food: [15, 10], acc: 0, score: 0, over: false, started: false, golden: null, t: 0 });
const placeFood = (g) => {
  for (;;) {
    const p = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)];
    if (!g.body.some(([x, y]) => x === p[0] && y === p[1])) return p;
  }
};

export default function SnakeView() {
  const { ref, box, scale } = useFitCanvas(SIZE, SIZE);
  const g = useRef(fresh());
  const [ui, setUi] = useState({ score: 0, over: false, started: false, record: false, paused: false });
  const best = useSoloScores((s) => s.best.snake || 0);
  const submit = useSoloScores((s) => s.submit);
  const paused = useRef(false);

  const restart = () => { g.current = fresh(); paused.current = false; setUi({ score: 0, over: false, started: false, record: false, paused: false }); };
  const turn = (d) => {
    const s = g.current;
    if (!s.started) { s.started = true; setUi((u) => ({ ...u, started: true })); }
    const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
    if (DIRS[d][0] + DIRS[last][0] === 0 && DIRS[d][1] + DIRS[last][1] === 0) return; // ters yön yok
    if (d !== last && s.queue.length < 3) s.queue.push(d);
  };
  useKeys({
    ArrowUp: { down: () => turn("up") }, KeyW: { down: () => turn("up") }, ArrowDown: { down: () => turn("down") }, KeyS: { down: () => turn("down") },
    ArrowLeft: { down: () => turn("left") }, KeyA: { down: () => turn("left") }, ArrowRight: { down: () => turn("right") }, KeyD: { down: () => turn("right") },
    KeyP: { down: () => { paused.current = !paused.current; setUi((u) => ({ ...u, paused: paused.current })); } },
  });
  const sw = useRef(swipeHandlers((d) => turn(d), 18)).current;

  useLoop((dt) => {
    const s = g.current;
    s.t += dt;
    if (s.started && !s.over && !paused.current) {
      const speed = 7 + Math.min(10, s.score * 0.35); // hücre/sn
      s.acc += dt * speed;
      while (s.acc >= 1 && !s.over) {
        s.acc -= 1;
        if (s.queue.length) s.dir = s.queue.shift();
        const [dx, dy] = DIRS[s.dir];
        const head = [s.body[0][0] + dx, s.body[0][1] + dy];
        const hit = head[0] < 0 || head[1] < 0 || head[0] >= N || head[1] >= N || s.body.slice(0, -1).some(([x, y]) => x === head[0] && y === head[1]);
        if (hit) { s.over = true; sfx.lose(); setUi((u) => ({ ...u, over: true, score: s.score, record: submit("snake", s.score) })); break; }
        s.body.unshift(head);
        if (head[0] === s.food[0] && head[1] === s.food[1]) {
          s.score++; sfx.good(); s.food = placeFood(s);
          if (s.score % 5 === 0) s.golden = { p: placeFood(s), left: 6 };
          setUi((u) => ({ ...u, score: s.score }));
        } else if (s.golden && head[0] === s.golden.p[0] && head[1] === s.golden.p[1]) {
          s.score += 5; sfx.win(); s.golden = null; setUi((u) => ({ ...u, score: s.score }));
        } else s.body.pop();
        if (s.golden && (s.golden.left -= 1 / speed) <= 0) s.golden = null;
      }
    }
    // çizim
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const k = scale.current.k;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { ctx.fillStyle = (x + y) % 2 ? "#1d2a1f" : "#223326"; ctx.fillRect(x * CELL, y * CELL, CELL, CELL); }
    const dot = (p, c, r = 0.42, glow) => { ctx.fillStyle = c; if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 14; } ctx.beginPath(); ctx.arc(p[0] * CELL + CELL / 2, p[1] * CELL + CELL / 2, CELL * r, 0, 7); ctx.fill(); ctx.shadowBlur = 0; };
    dot(s.food, "#ef4444", 0.38 + Math.sin(s.t * 6) * 0.03, "#ef4444");
    ctx.fillStyle = "#16a34a"; ctx.fillRect(s.food[0] * CELL + CELL / 2 - 1, s.food[1] * CELL + 3, 3, 6);
    if (s.golden) dot(s.golden.p, "#fde047", 0.4 + Math.sin(s.t * 12) * 0.06, "#facc15");
    s.body.forEach((p, i) => {
      const t = 1 - i / s.body.length;
      ctx.fillStyle = `hsl(${130 + t * 10},${60 + t * 20}%,${38 + t * 14}%)`;
      ctx.beginPath(); ctx.roundRect?.(p[0] * CELL + 2, p[1] * CELL + 2, CELL - 4, CELL - 4, i === 0 ? 10 : 7); if (!ctx.roundRect) ctx.rect(p[0] * CELL + 2, p[1] * CELL + 2, CELL - 4, CELL - 4); ctx.fill();
    });
    const h = s.body[0], [dx, dy] = DIRS[s.dir];
    ctx.fillStyle = "#fff";
    for (const o of [-1, 1]) { ctx.beginPath(); ctx.arc(h[0] * CELL + CELL / 2 + dx * 5 + -dy * o * 5, h[1] * CELL + CELL / 2 + dy * 5 + dx * o * 5, 3.4, 0, 7); ctx.fill(); }
    ctx.fillStyle = "#111";
    for (const o of [-1, 1]) { ctx.beginPath(); ctx.arc(h[0] * CELL + CELL / 2 + dx * 6.5 + -dy * o * 5, h[1] * CELL + CELL / 2 + dy * 6.5 + dx * o * 5, 1.6, 0, 7); ctx.fill(); }
  });

  return (
    <Frame accent={ACCENT} title="Yılan" emoji="🐍" stats={[["Skor", ui.score], ["Rekor", Math.max(best, ui.score)]]} onRestart={restart} hint="Ok tuşları / WASD ya da kaydır · P duraklat · her 5 elmada altın elma (+5)">
      <div ref={box} className="relative mx-auto flex w-full items-center justify-center touch-none select-none" style={{ height: "min(70vh, 620px)" }} {...sw}>
        <canvas ref={ref} className="rounded-xl" />
        {!ui.started && !ui.over && <Overlay emoji="🐍" title="Hazır mısın?" sub="Başlamak için bir yön tuşuna bas ya da kaydır." />}
        {ui.paused && <Overlay emoji="⏸️" title="Duraklatıldı" actions={<ArcadeBtn tone="good" onClick={() => { paused.current = false; setUi((u) => ({ ...u, paused: false })); }}>Devam</ArcadeBtn>} />}
        {ui.over && <Overlay emoji="💥" title="Oyun bitti" sub={`${ui.score} elma`} record={ui.record} actions={<ArcadeBtn tone="good" big onClick={restart}>Tekrar oyna</ArcadeBtn>} />}
      </div>
    </Frame>
  );
}
