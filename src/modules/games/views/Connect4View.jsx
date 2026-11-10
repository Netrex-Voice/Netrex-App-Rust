"use client";

import { useEffect, useRef, useState } from "react";
import { ArcadeBtn } from "../ui";
import { Frame, Overlay, useSoloScores, sfx } from "../solo/kit";
import * as C from "../solo/engines/connect4";

const ACCENT = "#3b82f6";
const LEVELS = { easy: { label: "Kolay", depth: 2, mistake: 0.3 }, medium: { label: "Orta", depth: 4, mistake: 0.08 }, hard: { label: "Zor", depth: 7, mistake: 0 } };

export default function Connect4View() {
  const [level, setLevel] = useState("medium");
  const [board, setBoard] = useState(C.emptyBoard());
  const [turn, setTurn] = useState(1); // 1 sen (kırmızı), 2 bot (sarı)
  const [hover, setHover] = useState(-1);
  const [last, setLast] = useState(null);
  const [streak, setStreak] = useState(0);
  const best = useSoloScores((s) => s.best["c4:" + level] || 0);
  const submit = useSoloScores((s) => s.submit);
  const busy = useRef(false);
  const win = C.winLine(board);
  const full = C.isFull(board);
  const over = !!win || full;
  const winner = win ? board[win[0][0]][win[0][1]] : 0;

  const restart = (lv = level) => { setLevel(lv); setBoard(C.emptyBoard()); setTurn(1); setLast(null); busy.current = false; };
  const play = (b, c, who) => { const d = C.drop(b, c, who); if (!d) return null; sfx.pop(); setBoard(d.board); setLast([c, d.row]); return d.board; };

  const click = (c) => {
    if (over || turn !== 1 || busy.current || !C.canDrop(board, c)) return;
    const nb = play(board, c, 1);
    if (!nb) return;
    if (C.winLine(nb) || C.isFull(nb)) return;
    setTurn(2);
  };
  useEffect(() => {
    if (turn !== 2 || over) return;
    busy.current = true;
    const t = setTimeout(() => {
      const L = LEVELS[level];
      const c = C.botMove(board, 2, L.depth, L.mistake);
      if (c >= 0) play(board, c, 2);
      busy.current = false;
      setTurn(1);
    }, 450);
    return () => clearTimeout(t);
  }, [turn]); // eslint-disable-line

  // sonuç: seri ve rekor (kazanılan maçlarda üst üste seri)
  const reported = useRef(null);
  useEffect(() => {
    if (!over || reported.current === board) return;
    reported.current = board;
    if (winner === 1) { const n = streak + 1; setStreak(n); submit("c4:" + level, n); sfx.win(); }
    else { if (winner === 2) sfx.lose(); setStreak(0); }
  }, [over]); // eslint-disable-line

  return (
    <Frame accent={ACCENT} title="4 Bağla" emoji="🔴" stats={[["Seri", streak], ["Rekor", Math.max(best, streak)]]} onRestart={() => restart()} hint="Bir sütuna tıkla; yatay, dikey ya da çapraz dört taşı yan yana getiren kazanır">
      <div className="mb-3 flex flex-wrap justify-center gap-2">{Object.entries(LEVELS).map(([k, v]) => <ArcadeBtn key={k} xs tone={k === level ? "roll" : "ghost"} onClick={() => { setStreak(0); restart(k); }}>{v.label}</ArcadeBtn>)}</div>
      <div className="relative mx-auto w-full max-w-[520px]">
        <div className="grid grid-cols-7 gap-1 rounded-3xl p-2" style={{ background: "linear-gradient(180deg,#2563eb,#1d4ed8)", boxShadow: "0 8px 0 #1e3a8a, inset 0 2px 0 rgba(255,255,255,.3)" }} onMouseLeave={() => setHover(-1)}>
          {Array.from({ length: C.COLS }, (_, c) => (
            <button key={c} type="button" aria-label={`Sütun ${c + 1}`} onMouseEnter={() => setHover(c)} onClick={() => click(c)} disabled={over} className="flex flex-col-reverse gap-1 rounded-xl p-0.5 transition" style={{ background: hover === c && !over && turn === 1 ? "rgba(255,255,255,.14)" : "transparent" }}>
              {Array.from({ length: C.ROWS }, (_, r) => {
                const v = board[c][r];
                const w = win?.some(([wc, wr]) => wc === c && wr === r);
                const isLast = last && last[0] === c && last[1] === r;
                return (
                  <span key={r} className="relative block aspect-square w-full rounded-full" style={{ background: "#0b1d4d", boxShadow: "inset 0 4px 8px rgba(0,0,0,.55)" }}>
                    {v !== 0 && <span className="absolute inset-[7%] rounded-full" style={{ background: v === 1 ? "radial-gradient(circle at 35% 30%,#fca5a5,#ef4444 55%,#b91c1c)" : "radial-gradient(circle at 35% 30%,#fef08a,#facc15 55%,#ca8a04)", boxShadow: w ? "0 0 0 4px #fff, 0 0 18px #fff" : "inset 0 -4px 0 rgba(0,0,0,.2)", animation: isLast ? "c4drop .35s cubic-bezier(.3,1.4,.5,1)" : undefined }} />}
                  </span>
                );
              })}
            </button>
          ))}
        </div>
        <style>{"@keyframes c4drop{0%{transform:translateY(-420%)}100%{transform:translateY(0)}}"}</style>
        {!over && <p className="mt-3 text-center text-sm font-black text-white/80">{turn === 1 ? "🔴 Sıra sende" : "🟡 Bot düşünüyor…"}</p>}
        {over && <Overlay emoji={winner === 1 ? "🏆" : winner === 2 ? "🤖" : "🤝"} title={winner === 1 ? "Kazandın!" : winner === 2 ? "Bot kazandı" : "Berabere"} sub={winner === 1 ? `${streak} galibiyet serisi` : "Bir tane daha?"} actions={<ArcadeBtn tone="good" big onClick={() => restart()}>Yeni oyun</ArcadeBtn>} />}
      </div>
    </Frame>
  );
}
