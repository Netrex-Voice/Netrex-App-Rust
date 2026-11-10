"use client";

import { useRef, useState } from "react";
import { ArcadeBtn, useFitCanvas } from "../ui";
import { Frame, Overlay, useKeys, useLoop, useSoloScores, sfx } from "../solo/kit";
import * as T from "../solo/engines/tetris";

const CELL = 30, PW = T.W * CELL, SIDE = 130, W = PW + SIDE, H = T.H * CELL, ACCENT = "#a855f7";

export default function TetrisView() {
  const { ref, box, scale } = useFitCanvas(W, H);
  const g = useRef(T.newGame());
  const st = useRef({ acc: 0, soft: 0, das: 0, dir: 0, paused: false, lock: 0 });
  const [ui, setUi] = useState({ score: 0, lines: 0, level: 1, over: false, record: false, paused: false });
  const best = useSoloScores((s) => s.best.tetris || 0);
  const submit = useSoloScores((s) => s.submit);
  const sync = () => { const s = g.current; setUi((u) => ({ ...u, score: s.score, lines: s.lines, level: s.level })); };
  const end = () => { const s = g.current; sfx.lose(); setUi((u) => ({ ...u, over: true, score: s.score, record: submit("tetris", s.score) })); };

  const restart = () => { g.current = T.newGame(); st.current = { acc: 0, soft: 0, das: 0, dir: 0, paused: false, lock: 0 }; setUi({ score: 0, lines: 0, level: 1, over: false, record: false, paused: false }); };
  const act = (f) => () => { if (g.current.over || st.current.paused) return; f(g.current); };
  const after = (cl) => { if (cl) sfx.win(); else sfx.pop(); sync(); if (g.current.over) end(); };
  const hard = act((s) => after(T.hardDrop(s)));
  const rot = act((s) => { if (T.rotate(s, 1)) sfx.tick(); });
  const mv = (d) => act((s) => { if (T.tryMove(s, d, 0)) sfx.tick(); });
  const pause = () => { st.current.paused = !st.current.paused; setUi((u) => ({ ...u, paused: st.current.paused })); };
  useKeys({
    ArrowLeft: { down: mv(-1), repeat: true }, KeyA: { down: mv(-1), repeat: true }, ArrowRight: { down: mv(1), repeat: true }, KeyD: { down: mv(1), repeat: true },
    ArrowUp: { down: rot }, KeyW: { down: rot }, KeyX: { down: rot }, KeyZ: { down: act((s) => T.rotate(s, -1)) },
    ArrowDown: { down: () => (st.current.soft = 1), up: () => (st.current.soft = 0) }, KeyS: { down: () => (st.current.soft = 1), up: () => (st.current.soft = 0) },
    Space: { down: hard }, KeyP: { down: pause },
  });

  useLoop((dt) => {
    const s = g.current, k = st.current;
    if (!s.over && !k.paused) {
      k.acc += dt;
      const iv = k.soft ? Math.min(0.05, T.dropInterval(s.level)) : T.dropInterval(s.level);
      while (k.acc >= iv && !s.over) {
        k.acc -= iv;
        const r = T.gravity(s);
        if (k.soft && !r.locked) s.score += 1;
        if (r.locked) after(r.cleared);
      }
    }
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d"), sc = scale.current.k;
    ctx.setTransform(sc, 0, 0, sc, 0, 0);
    ctx.fillStyle = "#0d0f26"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#151839"; ctx.fillRect(0, 0, PW, H);
    ctx.strokeStyle = "rgba(255,255,255,.05)"; ctx.lineWidth = 1;
    for (let x = 0; x <= T.W; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, H); ctx.stroke(); }
    for (let y = 0; y <= T.H; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(PW, y * CELL); ctx.stroke(); }
    const block = (x, y, kind, a = 1) => {
      ctx.globalAlpha = a; ctx.fillStyle = T.COLORS[kind]; ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, 5);
      ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(x * CELL + 1, y * CELL + CELL - 6, CELL - 2, 5); ctx.globalAlpha = 1;
    };
    s.grid.forEach((row, y) => row.forEach((c, x) => c && block(x, y, c)));
    if (!s.over) {
      const gy = T.ghostY(s);
      for (const [cx, cy] of T.cells(s.piece.kind, s.piece.rot)) { if (gy + cy >= 0) block(s.piece.x + cx, gy + cy, s.piece.kind, 0.22); }
      for (const [cx, cy] of T.cells(s.piece.kind, s.piece.rot)) { if (s.piece.y + cy >= 0) block(s.piece.x + cx, s.piece.y + cy, s.piece.kind); }
    }
    ctx.fillStyle = "#fff"; ctx.font = "bold 14px sans-serif"; ctx.textAlign = "left";
    ctx.fillText("SIRADAKİ", PW + 16, 28);
    const n = T.cells(s.next, 0);
    n.forEach(([cx, cy]) => { ctx.fillStyle = T.COLORS[s.next]; ctx.fillRect(PW + 22 + cx * 22, 44 + cy * 22, 20, 20); });
    ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.fillText("SEVİYE", PW + 16, 170); ctx.fillText("SATIR", PW + 16, 230);
    ctx.fillStyle = "#fff"; ctx.font = "bold 26px sans-serif"; ctx.fillText(String(s.level), PW + 16, 200); ctx.fillText(String(s.lines), PW + 16, 260);
  });

  const pad = "flex h-12 flex-1 items-center justify-center rounded-xl bg-white/10 text-lg font-black text-white active:bg-white/25";
  return (
    <Frame accent={ACCENT} title="Blok Yığma" emoji="🧩" stats={[["Skor", ui.score], ["Rekor", Math.max(best, ui.score)]]} onRestart={restart} hint="← → / A D yana · ↑ / W döndür · ↓ / S hızlı indir · Boşluk anında bırak · P duraklat">
      <div ref={box} className="relative mx-auto flex w-full items-center justify-center select-none" style={{ height: "min(70vh, 640px)" }}>
        <canvas ref={ref} className="rounded-xl" />
        {ui.paused && <Overlay emoji="⏸️" title="Duraklatıldı" actions={<ArcadeBtn tone="good" onClick={pause}>Devam</ArcadeBtn>} />}
        {ui.over && <Overlay emoji="🏁" title="Oyun bitti" sub={`${ui.score} puan · ${ui.lines} satır`} record={ui.record} actions={<ArcadeBtn tone="good" big onClick={restart}>Tekrar oyna</ArcadeBtn>} />}
      </div>
      <div className="mt-2 flex gap-2 sm:hidden">
        <button className={pad} onClick={mv(-1)}>◀</button><button className={pad} onClick={rot}>⟳</button><button className={pad} onClick={mv(1)}>▶</button><button className={pad} onClick={hard}>⤓</button>
      </div>
    </Frame>
  );
}
