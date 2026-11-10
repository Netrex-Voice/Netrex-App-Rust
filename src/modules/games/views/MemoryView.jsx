"use client";

import { useEffect, useRef, useState } from "react";
import { ArcadeBtn } from "../ui";
import { Frame, Overlay, useSoloScores, sfx } from "../solo/kit";

const ACCENT = "#ec4899";
const FACES = ["🐶", "🐱", "🦊", "🐼", "🐸", "🦁", "🐵", "🐙", "🦄", "🐢", "🦋", "🐧", "🍕", "🚀", "⚽", "🎸"];
const LEVELS = { easy: { cols: 4, pairs: 6, label: "Kolay (12)" }, medium: { cols: 4, pairs: 8, label: "Orta (16)" }, hard: { cols: 6, pairs: 12, label: "Zor (24)" } };

function deal(pairs) {
  const f = FACES.slice().sort(() => Math.random() - 0.5).slice(0, pairs);
  const cards = [...f, ...f].map((face, i) => ({ id: i, face }));
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return cards;
}

export default function MemoryView() {
  const [level, setLevel] = useState("medium");
  const L = LEVELS[level];
  const [cards, setCards] = useState(() => deal(L.pairs));
  const [open, setOpen] = useState([]); // geçici açık kart indeksleri
  const [done, setDone] = useState(new Set());
  const [moves, setMoves] = useState(0);
  const [secs, setSecs] = useState(0);
  const [record, setRecord] = useState(false);
  const lock = useRef(false);
  const t0 = useRef(0);
  const best = useSoloScores((s) => s.best["memory:" + level]);
  const submit = useSoloScores((s) => s.submit);
  const won = done.size === cards.length;

  const restart = (lv = level) => { setLevel(lv); setCards(deal(LEVELS[lv].pairs)); setOpen([]); setDone(new Set()); setMoves(0); setSecs(0); setRecord(false); t0.current = 0; lock.current = false; };
  useEffect(() => {
    if (!t0.current || won) return;
    const iv = setInterval(() => setSecs(Math.floor((Date.now() - t0.current) / 1000)), 500);
    return () => clearInterval(iv);
  }, [moves, won]);

  const flip = (i) => {
    if (lock.current || open.includes(i) || done.has(i)) return;
    if (!t0.current) t0.current = Date.now();
    sfx.tick();
    const next = [...open, i];
    setOpen(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      lock.current = true;
      const [a, b] = next;
      if (cards[a].face === cards[b].face) {
        setTimeout(() => { const nd = new Set(done); nd.add(a); nd.add(b); setDone(nd); setOpen([]); lock.current = false; sfx.good();
          if (nd.size === cards.length) { setRecord(submit("memory:" + level, moves + 1, true)); sfx.win(); } }, 350);
      } else setTimeout(() => { setOpen([]); lock.current = false; }, 800);
    }
  };

  return (
    <Frame accent={ACCENT} title="Hafıza" emoji="🧠" stats={[["Hamle", moves], ["Süre", secs], ["Rekor", best != null ? best + " hamle" : "—"]]} onRestart={() => restart()} hint="Kartları çevir, eşleşen çiftleri bul · en az hamleyle bitir">
      <div className="mb-3 flex flex-wrap justify-center gap-2">{Object.entries(LEVELS).map(([k, v]) => <ArcadeBtn key={k} xs tone={k === level ? "roll" : "ghost"} onClick={() => restart(k)}>{v.label}</ArcadeBtn>)}</div>
      <div className="relative mx-auto grid w-full max-w-[560px] gap-2.5" style={{ gridTemplateColumns: `repeat(${L.cols}, 1fr)` }}>
        {cards.map((c, i) => {
          const up = open.includes(i) || done.has(i);
          return (
            <button key={c.id} type="button" onClick={() => flip(i)} aria-label={up ? c.face : "kapalı kart"} className="relative aspect-square" style={{ perspective: 600 }}>
              <span className="absolute inset-0 transition-transform duration-300" style={{ transformStyle: "preserve-3d", transform: up ? "rotateY(180deg)" : "none" }}>
                <span className="absolute inset-0 flex items-center justify-center rounded-2xl text-2xl font-black text-white/60" style={{ backfaceVisibility: "hidden", background: "linear-gradient(135deg,#ec4899,#8b5cf6)", boxShadow: "0 4px 0 #5b21b6, inset 0 2px 0 rgba(255,255,255,.35)" }}>?</span>
                <span className="absolute inset-0 flex items-center justify-center rounded-2xl text-[clamp(26px,7vw,46px)]" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: done.has(i) ? "linear-gradient(180deg,#86efac,#22c55e)" : "linear-gradient(180deg,#fff,#e2e8f0)", boxShadow: "0 4px 0 rgba(0,0,0,.3)" }}>{c.face}</span>
              </span>
            </button>
          );
        })}
        {won && <Overlay emoji="🎉" title="Hepsini buldun!" sub={`${moves} hamle · ${secs} sn`} record={record} actions={<ArcadeBtn tone="good" big onClick={() => restart()}>Tekrar oyna</ArcadeBtn>} />}
      </div>
    </Frame>
  );
}
