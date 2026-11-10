"use client";

import { useEffect, useRef } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { RotateCcw, Trophy } from "lucide-react";
import { ArcadeBtn, shade, beep } from "../ui";

/**
 * Tek kişilik oyunlar için ortak arcade çatı: hub ile aynı görsel dil (kalın renkli kenarlık, gölgeli düğmeler,
 * mor degrade zemin), rekor deposu, klavye/kaydırma yardımcıları. Rekorlar bu cihazda saklanır.
 */
export const useSoloScores = create(
  persist(
    (set, get) => ({
      best: {}, // oyunId[:mod] → en iyi skor (ya da süre/hamle: lowerBetter)
      plays: {},
      /** @returns {boolean} yeni rekor mu */
      submit: (key, value, lowerBetter = false) => {
        const s = get();
        const cur = s.best[key];
        const rec = cur == null || (lowerBetter ? value < cur : value > cur);
        set({ plays: { ...s.plays, [key]: (s.plays[key] || 0) + 1 }, best: rec ? { ...s.best, [key]: value } : s.best });
        return rec;
      },
      reset: () => set({ best: {}, plays: {} }),
    }),
    { name: "netrex-solo-scores", version: 1, storage: createJSONStorage(() => localStorage) }
  )
);

export const sfx = {
  tick: () => beep(420, 0.04, "triangle", 0.05),
  good: () => beep(760, 0.08, "triangle", 0.06),
  pop: () => beep(300, 0.06, "square", 0.04),
  win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.16, "triangle", 0.07), i * 110)),
  lose: () => [330, 262, 196].forEach((f, i) => setTimeout(() => beep(f, 0.2, "sawtooth", 0.05), i * 150)),
};

/** Oyun çerçevesi: başlık çubuğu (skor/rekor hapları) + içerik + alt ipucu */
export function Frame({ accent, title, emoji, stats = [], onRestart, hint, children, wide = false }) {
  return (
    <div className="mx-auto flex w-full flex-col items-center gap-4 p-3 sm:p-5" style={{ maxWidth: wide ? 980 : 640 }}>
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-black text-white sm:text-3xl" style={{ textShadow: "0 3px 0 rgba(0,0,0,.4)" }}><span>{emoji}</span>{title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {stats.map(([k, v]) => <Stat key={k} label={k} value={v} color={accent} />)}
          {onRestart && <ArcadeBtn tone="roll" xs onClick={onRestart} aria-label="Yeniden başlat"><RotateCcw size={13} className="mr-1 inline -mt-0.5" />Yeniden</ArcadeBtn>}
        </div>
      </div>
      <div className="relative w-full rounded-3xl p-2 sm:p-3" style={{ background: "linear-gradient(180deg,#171a2e,#10122a)", border: `4px solid ${accent}`, boxShadow: `0 8px 0 ${shade(accent, 0.5)}, 0 18px 34px rgba(0,0,0,.45)` }}>{children}</div>
      {hint && <p className="text-center text-xs font-bold text-white/55">{hint}</p>}
    </div>
  );
}

export function Stat({ label, value, color = "#f59e0b" }) {
  return (
    <span className="inline-flex min-w-[72px] flex-col items-center rounded-2xl px-3 py-1 leading-tight" style={{ background: `linear-gradient(180deg, ${color}, ${shade(color, 0.65)})`, boxShadow: "0 3px 0 rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.35)" }}>
      <span className="text-[9px] font-black uppercase tracking-wider text-white/80">{label}</span>
      <span className="text-lg font-black tabular-nums text-white" style={{ textShadow: "0 2px 0 rgba(0,0,0,.25)" }}>{value}</span>
    </span>
  );
}

/** Oyun sonu / duraklatma kartı (çerçevenin üstüne biner) */
export function Overlay({ title, sub, emoji, record, children, actions }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/65 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xs rounded-3xl border-[3px] border-white/15 bg-[#171a2e] p-5 text-center shadow-2xl">
        {emoji && <div className="text-5xl">{emoji}</div>}
        <h2 className="mt-1 text-3xl font-black text-white" style={{ textShadow: "0 3px 0 rgba(0,0,0,.4)" }}>{title}</h2>
        {record && <div className="mx-auto mt-1 inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-0.5 text-xs font-black uppercase text-amber-300"><Trophy size={12} />Yeni rekor</div>}
        {sub && <p className="mt-1 text-sm font-semibold text-white/70">{sub}</p>}
        {children}
        <div className="mt-4 flex flex-col gap-2">{actions}</div>
      </div>
    </div>
  );
}

/** Klavye: tuş → eylem (hem e.code hem e.key; yazı alanındayken devre dışı). Pencere odağı kaybedince bırakılmış sayılır. */
export function useKeys(map, deps = []) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    const find = (e) => ref.current[e.code] || ref.current[e.key] || ref.current[(e.key || "").toLowerCase()];
    const kd = (e) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const f = find(e);
      if (f?.down) { if (!e.repeat || f.repeat) f.down(e); e.preventDefault(); }
    };
    const ku = (e) => { const f = find(e); if (f?.up) { f.up(e); e.preventDefault(); } };
    const bl = () => Object.values(ref.current).forEach((f) => f?.up?.());
    window.addEventListener("keydown", kd, true);
    window.addEventListener("keyup", ku, true);
    window.addEventListener("blur", bl);
    return () => { window.removeEventListener("keydown", kd, true); window.removeEventListener("keyup", ku, true); window.removeEventListener("blur", bl); };
  }, deps); // eslint-disable-line
}

/** Kaydırma (swipe) yön algılama: (dx,dy) eşiği aşınca onSwipe('left'|'right'|'up'|'down') */
export function swipeHandlers(onSwipe, min = 24) {
  let sx = 0, sy = 0, on = false;
  return {
    onPointerDown: (e) => { sx = e.clientX; sy = e.clientY; on = true; },
    onPointerUp: (e) => {
      if (!on) return;
      on = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return;
      onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
    },
  };
}

/** requestAnimationFrame döngüsü: fn(dt sn); bileşen sökülünce durur; sekme gizlenince dt kırpılır */
export function useLoop(fn, active = true) {
  const f = useRef(fn);
  f.current = fn;
  useEffect(() => {
    if (!active) return;
    let raf, last = performance.now();
    const loop = (t) => { raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (t - last) / 1000); last = t; f.current(dt); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}

export const Cell = ({ children, className = "", style, ...rest }) => <div className={`flex items-center justify-center ${className}`} style={style} {...rest}>{children}</div>;
