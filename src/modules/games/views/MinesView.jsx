"use client";

import { useEffect, useRef, useState } from "react";
import { Flag } from "lucide-react";
import { ArcadeBtn } from "../ui";
import { Frame, Overlay, useSoloScores, sfx } from "../solo/kit";
import * as M from "../solo/engines/minesweeper";

const ACCENT = "#ef4444";
const NUM = ["", "#38bdf8", "#4ade80", "#f87171", "#a78bfa", "#fb923c", "#2dd4bf", "#e5e7eb", "#94a3b8"];

export default function MinesView() {
  const [level, setLevel] = useState("easy");
  const L = M.LEVELS[level];
  const [g, setG] = useState(() => M.blank(L.w, L.h));
  const [, force] = useState(0);
  const [flagMode, setFlagMode] = useState(false);
  const [secs, setSecs] = useState(0);
  const [record, setRecord] = useState(false);
  const best = useSoloScores((s) => s.best["mines:" + level]);
  const submit = useSoloScores((s) => s.submit);
  const t0 = useRef(0);
  const press = useRef(null);

  const restart = (lv = level) => { const l = M.LEVELS[lv]; setLevel(lv); setG(M.blank(l.w, l.h)); setSecs(0); t0.current = 0; setRecord(false); setFlagMode(false); };
  const done = g.lost || g.won;

  useEffect(() => {
    if (!g.placed || done) return;
    const iv = setInterval(() => setSecs(Math.floor((Date.now() - t0.current) / 1000)), 250);
    return () => clearInterval(iv);
  }, [g.placed, done]);

  const after = (ng) => {
    if (ng.placed && !t0.current) t0.current = Date.now();
    if (ng.won) { const t = Math.max(1, Math.round((Date.now() - t0.current) / 1000)); setSecs(t); setRecord(submit("mines:" + level, t, true)); sfx.win(); }
    else if (ng.lost) sfx.lose();
    else sfx.tick();
    force((n) => n + 1);
  };
  const open = (i) => { const c = g.cells[i]; after(c.open ? M.chord(g, i, L.mines) : M.reveal(g, i, L.mines)); };
  const toggleFlag = (i) => { M.flag(g, i); sfx.pop(); force((n) => n + 1); };
  const cs = L.w > 16 ? 30 : L.w > 9 ? 34 : 44;

  return (
    <Frame accent={ACCENT} title="Mayın Tarlası" emoji="💣" wide
      stats={[["Mayın", M.flagsLeft(g, L.mines)], ["Süre", secs], ["Rekor", best != null ? best + " sn" : "—"]]} onRestart={() => restart()}
      hint="Sol tık aç · sağ tık / uzun bas bayrak · açık sayıya tıkla: çevresindeki bayrak sayısı tutuyorsa komşuları açar">
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        {Object.entries(M.LEVELS).map(([k, v]) => <ArcadeBtn key={k} xs tone={k === level ? "roll" : "ghost"} onClick={() => restart(k)}>{v.label}</ArcadeBtn>)}
        <ArcadeBtn xs tone={flagMode ? "danger" : "ghost"} onClick={() => setFlagMode((f) => !f)}><Flag size={12} className="mr-1 inline -mt-0.5" />Bayrak modu</ArcadeBtn>
      </div>
      <div className="relative overflow-auto rounded-2xl bg-[#10122a] p-2">
        <div className="mx-auto grid w-max select-none gap-[3px]" style={{ gridTemplateColumns: `repeat(${L.w}, ${cs}px)` }} onContextMenu={(e) => e.preventDefault()}>
          {g.cells.map((c, i) => (
            <button key={i} type="button" aria-label={`hücre ${i}`}
              onPointerDown={(e) => { if (e.button === 2) { toggleFlag(i); return; } press.current = { i, t: Date.now(), long: setTimeout(() => { press.current = { ...press.current, fired: true }; toggleFlag(i); }, 450) }; }}
              onPointerUp={(e) => { const p = press.current; if (e.button === 2 || !p || p.i !== i) return; clearTimeout(p.long); press.current = null; if (!p.fired) (flagMode && !c.open ? toggleFlag(i) : open(i)); }}
              onPointerLeave={() => { if (press.current) { clearTimeout(press.current.long); press.current = null; } }}
              className="flex items-center justify-center rounded-md font-black transition-colors"
              style={{ width: cs, height: cs, fontSize: cs * 0.5, background: c.open ? (c.mine ? "#7f1d1d" : "#232846") : "linear-gradient(180deg,#6b7bd6,#4f5db8)", boxShadow: c.open ? "inset 0 2px 4px rgba(0,0,0,.35)" : "0 3px 0 #2f3a85, inset 0 1px 0 rgba(255,255,255,.35)", color: NUM[c.n] }}>
              {c.open ? (c.mine ? "💥" : c.n || "") : c.flag ? "🚩" : g.lost && c.mine ? "💣" : ""}
            </button>
          ))}
        </div>
        {done && <Overlay emoji={g.won ? "🏆" : "💥"} title={g.won ? "Tarla temiz!" : "Mayına bastın"} sub={g.won ? `${secs} saniye` : "Bir dahaki sefere!"} record={g.won && record} actions={<ArcadeBtn tone="good" big onClick={() => restart()}>Tekrar oyna</ArcadeBtn>} />}
      </div>
    </Frame>
  );
}
