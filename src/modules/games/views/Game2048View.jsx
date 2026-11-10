"use client";

import { useCallback, useRef, useState } from "react";
import { ArcadeBtn } from "../ui";
import { Frame, Overlay, useKeys, swipeHandlers, useSoloScores, sfx } from "../solo/kit";
import * as G from "../solo/engines/g2048";

const COLORS = {
  0: ["#2a2f4a", "#fff"], 2: ["#eee4da", "#776e65"], 4: ["#ede0c8", "#776e65"], 8: ["#f2b179", "#fff"], 16: ["#f59563", "#fff"], 32: ["#f67c5f", "#fff"],
  64: ["#f65e3b", "#fff"], 128: ["#edcf72", "#fff"], 256: ["#edcc61", "#fff"], 512: ["#edc850", "#fff"], 1024: ["#edc53f", "#fff"], 2048: ["#edc22e", "#fff"],
};
const ACCENT = "#f59e0b";

export default function Game2048View() {
  const [board, setBoard] = useState(() => G.start());
  const [score, setScore] = useState(0);
  const [won, setWon] = useState(false);
  const [keepGoing, setKeepGoing] = useState(false);
  const [record, setRecord] = useState(false);
  const best = useSoloScores((s) => s.best.g2048 || 0);
  const submit = useSoloScores((s) => s.submit);
  const st = useRef({ board, score });
  st.current = { board, score };
  const over = !G.canMove(board);

  const play = useCallback((dir) => {
    const { board: b, score: sc } = st.current;
    const r = G.move(b, dir);
    if (!r.moved) return;
    const nb = G.spawn(r.board);
    const ns = sc + r.gained;
    r.gained ? sfx.good() : sfx.tick();
    setBoard(nb);
    setScore(ns);
    if (!G.canMove(nb)) { setRecord(submit("g2048", ns)); sfx.lose(); }
    else if (G.maxTile(nb) >= 2048 && !won) { setWon(true); sfx.win(); }
  }, [won, submit]);

  const restart = () => { setBoard(G.start()); setScore(0); setWon(false); setKeepGoing(false); setRecord(false); };
  useKeys({
    ArrowLeft: { down: () => play("left") }, KeyA: { down: () => play("left") },
    ArrowRight: { down: () => play("right") }, KeyD: { down: () => play("right") },
    ArrowUp: { down: () => play("up") }, KeyW: { down: () => play("up") },
    ArrowDown: { down: () => play("down") }, KeyS: { down: () => play("down") },
  });
  const sw = useRef(swipeHandlers((d) => play(d))).current;

  return (
    <Frame accent={ACCENT} title="2048" emoji="🔢" stats={[["Skor", score], ["Rekor", Math.max(best, score)]]} onRestart={restart} hint="Ok tuşları / WASD ya da kaydır · aynı sayıları birleştirip 2048'e ulaş">
      <div className="relative mx-auto grid aspect-square w-full max-w-[460px] touch-none select-none grid-cols-4 gap-2.5 rounded-2xl bg-[#171a2e] p-2.5" {...sw}>
        {board.map((v, i) => {
          const [bg, fg] = COLORS[v] || ["#3c3a32", "#fff"];
          return (
            <div key={i} className="flex items-center justify-center rounded-xl font-black transition-colors" style={{ background: bg, color: fg, fontSize: v >= 1024 ? "clamp(18px,5vw,30px)" : v >= 128 ? "clamp(22px,6vw,36px)" : "clamp(26px,7vw,44px)", boxShadow: v ? "inset 0 -4px 0 rgba(0,0,0,.18)" : "none", animation: v ? "pop2048 .12s ease-out" : undefined }}>
              {v || ""}
            </div>
          );
        })}
        <style>{"@keyframes pop2048{0%{transform:scale(.8)}100%{transform:scale(1)}}"}</style>
        {over && <Overlay emoji="😵" title="Hamle kalmadı" sub={`${score} puan`} record={record} actions={<ArcadeBtn tone="good" big onClick={restart}>Tekrar oyna</ArcadeBtn>} />}
        {won && !keepGoing && !over && <Overlay emoji="🏆" title="2048!" sub="Tebrikler! Devam edebilirsin." actions={<><ArcadeBtn tone="good" onClick={() => setKeepGoing(true)}>Devam et</ArcadeBtn><ArcadeBtn tone="ghost" onClick={restart}>Yeni oyun</ArcadeBtn></>} />}
      </div>
    </Frame>
  );
}
