"use client";

import { useEffect, useRef, useState } from "react";
import { Crown, Bot, Trophy, RotateCcw, LogOut } from "lucide-react";
import { useGamesPrefs, useGamesProgress } from "./store";
import { unlocksBetween } from "./themes";

/** Oyun arayüzlerinin ortak küçük parçaları */

export function Btn({ children, onClick, disabled, tone = "primary", className = "", ...rest }) {
  const tones = {
    primary: "gradient-primary hover:shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:brightness-110 text-white",
    ghost: "bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-[#dbdee1]",
    danger: "bg-[#da373c] hover:bg-[#c4292f] text-white",
    good: "bg-[#23a559] hover:bg-[#1a8047] text-white",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1] ${tones[tone]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Chip({ name, host, bot, you, accent = "#64748b" }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#dbdee1]">
      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-white" style={{ background: accent }}>
        {(name || "?").trim().charAt(0).toUpperCase()}
      </span>
      <span className="truncate max-w-[110px]">{name}</span>
      {host && <Crown size={12} className="text-amber-400" aria-label="Host" />}
      {bot && <Bot size={12} className="text-[#949ba4]" aria-label="Bot" />}
      {you && <span className="text-[10px] text-sky-300">(sen)</span>}
    </span>
  );
}

// ───────── Arcade parçaları (tüm oyunlarda ortak: skor tabelası, oyuncu plakası, ipucu, büyük yazı, düğme) ─────────
/** Hex rengi koyulaştır (k < 1) */
export const shade = (hex, k) => {
  const n = parseInt(String(hex).replace("#", "").padStart(6, "0").slice(0, 6), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
};

/** Zemin renginin üstünde okunur yazı rengi */
export const inkOn = (hex) => {
  const n = parseInt(String(hex).replace("#", "").padStart(6, "0").slice(0, 6), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 160 ? "#111827" : "#ffffff";
};

export const ARCADE = {
  roll: ["#ffc04d", "#f97316", "#b45309"],
  good: ["#5eea8f", "#16a34a", "#166534"],
  ghost: ["#a3b1c6", "#64748b", "#334155"],
  danger: ["#fb8a8a", "#dc2626", "#7f1d1d"],
  end: ["#9aa5ff", "#6366f1", "#3730a3"],
};

/** Kalın, parlak "arcade" düğme (alt kenarı gölgeli, basınca çöker) */
export function ArcadeBtn({ tone = "roll", big = false, xs = false, disabled, onClick, children, className = "", ...rest }) {
  const [a, b, c] = ARCADE[tone] || ARCADE.roll;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-2xl font-black uppercase tracking-wide text-white transition active:translate-y-[3px] hover:brightness-110 disabled:opacity-45 disabled:pointer-events-none focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70 ${big ? "px-9 py-3.5 text-xl" : xs ? "px-3 py-1.5 text-xs" : "px-5 py-2.5 text-sm"} whitespace-nowrap ${className}`}
      style={{ background: `linear-gradient(180deg, ${a}, ${b})`, boxShadow: `0 5px 0 ${c}, 0 11px 18px rgba(0,0,0,.4), inset 0 2px 0 rgba(255,255,255,.45)`, textShadow: "0 2px 0 rgba(0,0,0,.25)" }}
      {...rest}
    >
      {children}
    </button>
  );
}

const plateStyle = (color, active) => ({
  background: `linear-gradient(135deg, ${color}, ${shade(color, 0.6)})`,
  boxShadow: active ? `0 0 0 3px #fff, 0 0 24px ${color}, 0 7px 0 rgba(0,0,0,.3)` : "0 5px 0 rgba(0,0,0,.3), 0 10px 18px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.35)",
});

/** Yuvarlak beyaz harf/ikon rozeti (köşe bannerlarındaki piyon yuvarlağıyla aynı dil) */
export function Dot({ children, color = "#6366f1", size = "w-9 h-9 text-[15px]" }) {
  return <span className={`${size} shrink-0 rounded-full bg-white flex items-center justify-center font-black leading-none shadow-inner`} style={{ color, border: `3px solid ${shade(color, 0.75)}` }}>{children}</span>;
}

/** Oyuncu / takım plakası: renkli degrade, yuvarlak harf rozeti, isim + alt yazı; sırası gelen beyaz çerçeveyle parlar */
export function PlayerPlate({ name, sub, color = "#6366f1", active, badge, right, children, className = "" }) {
  return (
    <div className={`relative rounded-2xl px-3 py-2 text-white transition-all duration-300 ${active ? "scale-[1.04] z-10" : ""} ${className}`} style={plateStyle(color, active)}>
      <div className="flex items-center gap-2.5">
        <Dot color={color}>{(name || "?").trim().charAt(0).toUpperCase()}</Dot>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-extrabold" style={{ textShadow: "0 1px 2px rgba(0,0,0,.45)" }}>{name}</div>
          {sub && <div className="truncate text-[10px] font-bold opacity-90">{sub}</div>}
        </div>
        {badge}
        {right != null && <div className="text-[30px] font-black tabular-nums leading-none" style={{ textShadow: "0 3px 4px rgba(0,0,0,.45)" }}>{right}</div>}
      </div>
      {children && <div className="mt-1.5">{children}</div>}
    </div>
  );
}

/** Üst orta skor tabelası: iki renkli plaka + ortada hedef/ping rozeti */
export function ScoreBanner({ left, right, center }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2.5">
      <PlayerPlate name={left.name} sub={left.sub} color={left.color} active={left.active} right={left.score} className="min-w-[190px]" />
      {center && <div className="rounded-xl bg-black/60 px-3 py-1.5 text-center text-[11px] font-black uppercase leading-tight tracking-wider text-white/90 border-b-[3px] border-black/40">{center}</div>}
      <PlayerPlate name={right.name} sub={right.sub} color={right.color} active={right.active} right={right.score} className="min-w-[190px]" />
    </div>
  );
}

/** Alt orta ipucu hapı (kalın, okunur; masanın üstüne binmez) */
export function HintPill({ children, sub, className = "" }) {
  return (
    <div className={`pointer-events-none absolute bottom-4 left-1/2 z-10 max-w-[92%] -translate-x-1/2 rounded-2xl bg-black/65 px-4 py-2 text-center text-white backdrop-blur-sm border-b-[3px] border-black/40 ${className}`}>
      <div className="text-[13px] font-extrabold leading-snug">{children}</div>
      {sub && <div className="mt-0.5 text-[11px] font-semibold text-white/70">{sub}</div>}
    </div>
  );
}

/** Ekranın ortasında dev, konturlu yazı (GOL, sayaç, sayı mesajı) */
export function BigCall({ children, color = "#ffffff", size = "text-8xl", className = "" }) {
  return (
    <div className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center ${className}`}>
      <span key={String(children)} className={`${size} font-black uppercase tracking-tight animate-[gmPop_.3s_ease-out]`} style={{ color, WebkitTextStroke: "5px rgba(0,0,0,.55)", paintOrder: "stroke fill", textShadow: "0 8px 0 rgba(0,0,0,.35), 0 18px 40px rgba(0,0,0,.5)" }}>{children}</span>
    </div>
  );
}

/** Maç sonu kartı: kazanan, rövanş ve çıkış (arcade) */
export function EndCard({ title, subtitle, win, isHost, onRematch, onLobby, onLeave, children, rkey }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4" role="dialog" aria-label="Maç sonucu">
      <div className="w-full max-w-sm overflow-hidden rounded-[1.75rem] text-white animate-[gmPop_.3s_ease-out]" style={{ background: "linear-gradient(180deg, #2b3050, #161a2d)", border: `3px solid ${win ? "#f59e0b" : "#64748b"}`, boxShadow: "0 8px 0 rgba(0,0,0,.35), 0 24px 44px rgba(0,0,0,.55), inset 0 2px 0 rgba(255,255,255,.15)" }}>
        <div className="px-5 py-5 text-center" style={{ background: win ? "linear-gradient(135deg, #fde047, #f59e0b)" : "linear-gradient(135deg, #94a3b8, #475569)" }}>
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-white text-4xl shadow-inner" style={{ border: `3px solid ${win ? "#d97706" : "#64748b"}` }}>{win ? "🏆" : "🎮"}</div>
          <div className="text-[22px] font-black leading-tight" style={{ color: win ? "#78350f" : "#fff", textShadow: win ? "none" : "0 2px 3px rgba(0,0,0,.4)" }}>{title}</div>
          {subtitle && <div className="mt-0.5 text-sm font-bold" style={{ color: win ? "#92400e" : "rgba(255,255,255,.85)" }}>{subtitle}</div>}
        </div>
        <div className="p-4 text-center">
          {children}
          {rkey && <RewardPanel rkey={rkey} />}
          <div className="mt-4 flex flex-col gap-2.5">
            {isHost ? (
              <ArcadeBtn tone="good" onClick={onRematch} className="w-full"><RotateCcw size={15} className="inline -mt-0.5 mr-2" />Rövanş</ArcadeBtn>
            ) : (
              <div className="py-2 text-xs font-bold text-white/60">Rövanşı host başlatır…</div>
            )}
            {isHost && <ArcadeBtn tone="ghost" onClick={onLobby} className="w-full">Lobiye dön</ArcadeBtn>}
            <ArcadeBtn tone="ghost" onClick={onLeave} className="w-full"><LogOut size={15} className="inline -mt-0.5 mr-2" />Oyundan çık</ArcadeBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────── Ses (tercihler store'dan: sessiz + ses seviyesi) ─────────
let actx = null;
export function beep(freq = 440, dur = 0.08, type = "sine", gain = 0.05) {
  const { muted, vol } = useGamesPrefs.getState();
  if (muted || vol <= 0 || typeof window === "undefined") return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain * (vol / 70), actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + dur);
  } catch (e) {}
}

/** Canvas'ı kapsayıcıya sığdırır (DPR'lı); çizim mantıksal W×H koordinatlarında yapılır */
export function useFitCanvas(W, H) {
  const ref = useRef(null);
  const box = useRef(null);
  const scale = useRef({ k: 1, ox: 0, oy: 0 });
  useEffect(() => {
    const c = ref.current;
    const b = box.current;
    if (!c || !b) return;
    const fit = () => {
      const r = b.getBoundingClientRect();
      const k = Math.min(r.width / W, r.height / H);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.style.width = W * k + "px";
      c.style.height = H * k + "px";
      c.width = Math.round(W * k * dpr);
      c.height = Math.round(H * k * dpr);
      scale.current = { k: k * dpr, css: k };
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(b);
    return () => ro.disconnect();
  }, [W, H]);
  /** İmleç olayını mantıksal koordinata çevirir */
  const toLogical = (e) => {
    const r = ref.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  return { ref, box, scale, toLogical };
}

/** rAF döngüsü; bileşen sökülünce kesin durur */
export function useRaf(fn) {
  const f = useRef(fn);
  f.current = fn;
  useEffect(() => {
    let id;
    let last = performance.now();
    const loop = (t) => {
      f.current(t, Math.min(0.05, (t - last) / 1000));
      last = t;
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
}

/** Maç sonu ödül özeti: XP satırları, animasyonlu seviye çubuğu, açılan kozmetikler, görev/başarım */
export function RewardPanel({ rkey }) {
  const lr = useGamesProgress((s) => s.lastReward);
  const [fill, setFill] = useState(null);
  const r = lr?.key === rkey ? lr.reward : null;
  useEffect(() => {
    if (!r) return;
    setFill(r.before.into / r.before.need);
    const t = setTimeout(() => setFill(r.after.level > r.before.level ? 1 : r.after.into / r.after.need), 80);
    const t2 = r.after.level > r.before.level ? setTimeout(() => (setFill(0), setTimeout(() => setFill(r.after.into / r.after.need), 60)), 900) : null;
    if (r.after.level > r.before.level) setTimeout(() => beep(880, 0.25, "triangle", 0.07), 900);
    return () => (clearTimeout(t), t2 && clearTimeout(t2));
  }, [r]);
  if (!r) return null;
  const up = r.after.level > r.before.level;
  const unlocks = unlocksBetween(r.before.level, r.after.level);
  return (
    <div className="mt-4 text-left rounded-xl bg-[#1e1f22] border border-white/5 p-3">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-semibold text-[#949ba4]">Seviye {r.after.level}</span>
        <span className="text-sm font-bold text-indigo-400">+{r.total} XP</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full gradient-primary transition-[width] duration-700 ease-out" style={{ width: `${Math.round((fill ?? 0) * 100)}%` }} />
      </div>
      {up && <div className="mt-2 text-sm font-bold text-[#faa61a] animate-[gmPop_.3s_ease-out]">Seviye atladın: {r.after.level}!</div>}
      <ul className="mt-2 space-y-0.5 max-h-28 overflow-y-auto">
        {r.lines.map((l, i) => (
          <li key={i} className="flex justify-between text-xs text-[#b5bac1]"><span className="truncate">{l.label}</span><span className={`tabular-nums ${l.xp < 0 ? "text-[#949ba4]" : "text-[#dbdee1]"}`}>{l.xp > 0 ? "+" : ""}{l.xp}</span></li>
        ))}
      </ul>
      {unlocks.length > 0 && <div className="mt-2 text-xs text-[#23a559]">Açıldı: {unlocks.join(" · ")}</div>}
    </div>
  );
}
