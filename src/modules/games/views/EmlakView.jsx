"use client";

import { useEffect, useRef, useState } from "react";
import { Dices, Home, Hammer, Landmark, Handshake, Gavel, LogOut as Exit, X } from "lucide-react";
import { BOARD, GROUPS, groupSquares, canBuild, canSell, canMortgage, JAIL_FINE } from "../engines/emlak";
import { Btn, EndCard, shade, ArcadeBtn } from "../ui";
import { useGamesPrefs } from "../store";
import { EmlakScene, squareCenter } from "../three/emlakScene";
import { diffEvents } from "../engines/emlakEvents";
import { TOKENS } from "../engines/emlakTokens";
import { sfx, preloadSamples } from "../three/sound";

const money = (n) => `₺${Math.round(n).toLocaleString("tr-TR")}`;

const BILLS = [
  { v: 500, bg: "#f59e42", fg: "#5b2d00" },
  { v: 100, bg: "#e6d3a3", fg: "#4a3a12" },
  { v: 50, bg: "#8ab4e8", fg: "#0f2b52" },
  { v: 20, bg: "#8fd19e", fg: "#0f3d1e" },
  { v: 10, bg: "#f2e46b", fg: "#4a4300" },
  { v: 5, bg: "#f3a6c8", fg: "#5a1238" },
  { v: 1, bg: "#f1f1f1", fg: "#333333" },
];

/** Parayı banknotlara böl (büyükten küçüğe) */
function breakdown(cash) {
  let r = Math.max(0, Math.round(cash));
  return BILLS.map((b) => {
    const n = Math.floor(r / b.v);
    r -= n * b.v;
    return { ...b, n };
  }).filter((b) => b.n > 0);
}

/** Elindeki para: banknot destesi (monopoly tarzı) */
function Bills({ cash }) {
  return (
    <div className="absolute left-3 bottom-3 hidden lg:flex items-end gap-2 pointer-events-none" aria-label={`Nakit ${money(cash)}`}>
      {breakdown(cash).map((b) => (
        <div key={b.v} className="relative" style={{ transform: "perspective(260px) rotateX(28deg)" }}>
          {Array.from({ length: Math.min(3, b.n) - 1 }).map((_, k) => (
            <div key={k} className="absolute inset-0 rounded-[5px] border border-black/25" style={{ background: b.bg, transform: `translate(${(k + 1) * 3}px, ${-(k + 1) * 3}px)`, filter: "brightness(.88)" }} />
          ))}
          <div className="relative w-[58px] h-[34px] rounded-[5px] border border-black/30 shadow-[0_3px_8px_rgba(0,0,0,.45)] flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${b.bg}, ${b.bg}dd)`, color: b.fg }}>
            <span className="absolute inset-[3px] rounded-[3px] border" style={{ borderColor: `${b.fg}55` }} />
            <span className="text-[15px] font-black tabular-nums leading-none">{b.v}</span>
            {b.n > 1 && <span className="absolute -right-2 -top-2 rounded-full bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">×{b.n}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Sayıyı yumuşakça yeni değere kaydır */
function useCountUp(value) {
  const [shown, setShown] = useState(value);
  const ref = useRef(value);
  useEffect(() => {
    const from = ref.current;
    if (from === value) return;
    const t0 = performance.now();
    let raf;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 600);
      const val = Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3)));
      ref.current = val;
      setShown(val);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
/** Zar yüzü (CSS): sonuç kartında gösterilir */
function DiceFace({ n }) {
  return (
    <div className="grid grid-cols-3 grid-rows-3 w-12 h-12 p-1.5 rounded-xl bg-white shadow-[inset_0_-3px_0_rgba(0,0,0,.15),0_4px_8px_rgba(0,0,0,.35)]" aria-label={`Zar: ${n}`}>
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className={`m-auto w-2.5 h-2.5 rounded-full ${PIPS[n]?.includes(i) ? (n === 1 ? "bg-red-600" : "bg-slate-800") : ""}`} />
      ))}
    </div>
  );
}

/** Köşe bannerı: oyuncu renginde, piyon simgesi ve iri nakit; sırası gelen parlar */
function PlayerCard({ pl, k, v, me, onTrade, focused, onFocus }) {
  const cash = useCountUp(pl.cash);
  const prev = useRef(pl.cash);
  const [delta, setDelta] = useState(null);
  useEffect(() => {
    const d = pl.cash - prev.current;
    prev.current = pl.cash;
    if (!d) return;
    setDelta({ d, key: Date.now() });
    const t = setTimeout(() => setDelta(null), 1800);
    return () => clearTimeout(t);
  }, [pl.cash]);
  const owned = BOARD.map((_, i) => i).filter((i) => v.own[i] === k);
  const active = v.turn === k && v.phase !== "over";
  return (
    <div
      onClick={() => onFocus(k)}
      title="Tıkla: mülklerini tahtada göster"
      className={`relative w-60 rounded-2xl text-white transition-all duration-300 cursor-pointer ${active ? "scale-[1.05] z-10" : ""} ${pl.out ? "grayscale opacity-50" : ""} ${focused ? "outline outline-[3px] outline-offset-2 outline-white" : ""}`}
      style={{
        background: `linear-gradient(135deg, ${pl.color}, ${shade(pl.color, 0.6)})`,
        boxShadow: active ? `0 0 0 3px #fff, 0 0 26px ${pl.color}, 0 10px 22px rgba(0,0,0,.5)` : "0 8px 18px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.35)",
      }}
    >
      <div className="flex items-center gap-2.5 px-2.5 pt-2 pb-1.5">
        <span className="w-12 h-12 shrink-0 rounded-full bg-white flex items-center justify-center text-[26px] leading-none shadow-inner border-[3px]" style={{ borderColor: shade(pl.color, 0.75) }}>
          {TOKENS[pl.token]?.icon ?? "🙂"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="text-[13px] font-extrabold truncate" style={{ textShadow: "0 1px 2px rgba(0,0,0,.45)" }}>{pl.name}{k === me ? " (sen)" : ""}</span>
            {me >= 0 && k !== me && !pl.out && !v.trade && (
              <button type="button" onClick={(ev) => (ev.stopPropagation(), onTrade(k))} className="ml-auto p-1 rounded-lg bg-white/20 hover:bg-white/35 transition" title="Takas teklif et" aria-label={`${pl.name} ile takas`}><Handshake size={13} /></button>
            )}
          </div>
          <div className="text-[22px] font-black tabular-nums leading-tight" style={{ textShadow: "0 2px 3px rgba(0,0,0,.45)" }}>{money(cash)}</div>
        </div>
      </div>
      <div className="mx-2 mb-2 flex items-center gap-1.5 rounded-lg bg-black/25 px-2 py-1">
        <span className="text-[10px] font-bold text-white/80 shrink-0">değer {money(v.worth[k])}</span>
        <div className="flex flex-wrap gap-[3px] ml-auto justify-end" aria-label={`${owned.length} mülk`}>
          {owned.map((i) => {
            const sq = BOARD[i];
            const col = sq.kind === "prop" ? GROUPS[sq.g].color : sq.kind === "transit" ? "#94a3b8" : "#e2e8f0";
            return <span key={i} title={sq.name} className="w-2.5 h-3.5 rounded-[2px] border border-black/50" style={{ background: col, opacity: v.mort[i] ? 0.3 : 1 }} />;
          })}
        </div>
      </div>
      {delta && <span key={delta.key} className="absolute right-3 -top-2 text-lg font-black pointer-events-none animate-[gmFloat_1.8s_ease-out_forwards]" style={{ color: delta.d > 0 ? "#bbf7d0" : "#fecaca", textShadow: "0 2px 5px rgba(0,0,0,.75)" }}>{delta.d > 0 ? "+" : "−"}{money(Math.abs(delta.d))}</span>}
      {(pl.jail > 0 || pl.free > 0) && <div className="px-3 pb-1.5 text-[11px] font-bold text-amber-100">{pl.jail > 0 ? "🔒 Gözaltında" : ""}{pl.free > 0 ? ` · ${pl.free} çıkış kartı` : ""}</div>}
    </div>
  );
}

/** Fare kareye gelince: ad, sahibi, kira (imleç yanında) */
function SquareTip({ i, v, x, y, w }) {
  const sq = BOARD[i];
  const owner = v.own[i];
  const own = owner != null ? v.players[owner] : null;
  const g = sq.kind === "prop" ? GROUPS[sq.g] : null;
  const h = v.houses[i];
  const flip = x > w - 250;
  return (
    <div className="absolute z-20 pointer-events-none rounded-xl bg-[#14161a]/90 backdrop-blur px-3 py-2 text-xs text-white shadow-[0_8px_20px_rgba(0,0,0,.5)] border border-white/10 max-w-[230px]" style={{ left: flip ? x - 16 : x + 16, top: y + 16, transform: flip ? "translateX(-100%)" : undefined }}>
      <div className="flex items-center gap-2 font-extrabold">
        <span className="w-2.5 h-4 rounded-[2px] border border-black/40" style={{ background: g ? g.color : "#94a3b8" }} />
        {sq.name}
      </div>
      {sq.price != null && (own ? (
        <div className="mt-1 flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border border-white/70" style={{ background: own.color }} />
          <span>Sahibi: <b style={{ color: own.color }}>{own.name}</b> {TOKENS[own.token]?.icon}{v.mort[i] ? " · ipotekli" : ""}</span>
        </div>
      ) : <div className="mt-1 text-white/70">Sahipsiz · {money(sq.price)}</div>)}
      {own && sq.kind === "prop" && <div className="mt-0.5 text-white/80">{h === 5 ? "Otel" : h > 0 ? `${h} ev` : "Boş arsa"} · kira {money(sq.rent[h])}</div>}
    </div>
  );
}

const PANEL_BG = "linear-gradient(180deg, #2b3050, #161a2d)";
const panelShadow = "0 8px 0 rgba(0,0,0,.35), 0 22px 40px rgba(0,0,0,.55), inset 0 2px 0 rgba(255,255,255,.15)";

function squareIcon(sq) {
  if (sq.kind === "prop") return "🏠";
  if (sq.kind === "transit") return sq.name.includes("Vapur") ? "⛴️" : sq.name.includes("Metro") ? "🚇" : sq.name.includes("Teleferik") ? "🚡" : "🚆";
  if (sq.kind === "util") return sq.name.includes("Elektrik") ? "💡" : "💧";
  return "📍";
}

/** Yuvarlak beyaz ikon (köşe bannerlarındaki piyon yuvarlağıyla aynı dil) */
function IconDot({ icon, color, size = "w-12 h-12 text-[26px]" }) {
  return <span className={`${size} shrink-0 rounded-full bg-white flex items-center justify-center leading-none shadow-inner`} style={{ border: `3px solid ${shade(color, 0.75)}` }}>{icon}</span>;
}

/** Zemin renginin üstünde okunur yazı rengi */
const ink = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 160 ? "#111827" : "#ffffff";
};

/** Noktalı kılavuzlu satır (Monopoly kira tablosu): geçerli seviye kırmızı ve vurgulu */
function DeedRow({ label, value, on, bold }) {
  return (
    <div className={`flex items-baseline gap-1.5 rounded px-1.5 py-[1px] ${on ? "bg-[#f4dca0] text-[#b91c1c] font-black" : bold ? "font-extrabold" : ""}`}>
      <span>{label}</span>
      <span className="min-w-3 flex-1 -translate-y-[3px] border-b-[1.5px] border-dotted border-black/45" />
      <span className="tabular-nums font-extrabold">{value}</span>
    </div>
  );
}

/** Kareye tıklayınca açılan kart: gerçek Monopoly tapu senedi (krem kâğıt, siyah çerçeve, renkli başlık bandı, noktalı kira tablosu) */
function PropCard({ i, v, me, send, onClose }) {
  const sq = BOARD[i];
  const owner = v.own[i];
  const g = sq.kind === "prop" ? GROUPS[sq.g] : null;
  const o = owner != null ? v.players[owner] : null;
  const mine = owner === me && me >= 0;
  const h = v.houses[i];
  const state = { own: v.own, houses: v.houses, mort: v.mort, bank: v.bank, players: v.players };
  const band = g ? g.color : "#e5e7eb";
  const bandInk = ink(band);
  const nOwned = (kind) => (owner == null ? 0 : BOARD.filter((q, k) => q.kind === kind && v.own[k] === owner).length);
  const kindLabel = sq.kind === "prop" ? "TAPU SENEDİ" : sq.kind === "transit" ? "ULAŞIM" : sq.kind === "util" ? "İDARE" : "KARE";
  const flat = "rounded-md border-2 border-[#1a1a1a] px-2.5 py-1.5 text-[12px] font-extrabold transition active:translate-y-px disabled:opacity-40 disabled:pointer-events-none";
  return (
    <div className="absolute right-3 top-[30%] z-20 w-[18rem] animate-[gmPop_.2s_ease-out]" style={{ filter: "drop-shadow(0 14px 22px rgba(0,0,0,.55))" }}>
      <div className="relative rounded-[10px] border-[3px] border-[#1a1a1a] bg-[#fbf7ea] text-[#1a1a1a]" style={{ backgroundImage: "radial-gradient(circle at 25% 8%, rgba(255,255,255,.75), transparent 55%)" }}>
        <button type="button" onClick={onClose} className="absolute right-3.5 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/20 transition hover:bg-black/40" style={{ color: bandInk }} aria-label="Kapat"><X size={13} /></button>

        <div className="m-2 border-2 border-[#1a1a1a] text-center" style={{ background: band, color: bandInk }}>
          <div className="pt-1.5 text-[10px] font-extrabold tracking-[0.24em]">{kindLabel}</div>
          <div className="px-7 pb-2 text-[19px] font-black uppercase leading-tight tracking-wide">{sq.name}</div>
        </div>

        <div className="px-4 pb-2 pt-0.5 text-[13px] leading-snug">
          {sq.kind === "prop" && (
            <>
              <div className="mb-1 text-center text-[15px] font-black">KİRA {money(sq.rent[0])}</div>
              <DeedRow label="1 evle" value={money(sq.rent[1])} on={owner != null && h === 1} />
              <DeedRow label="2 evle" value={money(sq.rent[2])} on={owner != null && h === 2} />
              <DeedRow label="3 evle" value={money(sq.rent[3])} on={owner != null && h === 3} />
              <DeedRow label="4 evle" value={money(sq.rent[4])} on={owner != null && h === 4} />
              <DeedRow label="OTELLE" value={money(sq.rent[5])} on={owner != null && h === 5} bold />
              <div className="mt-2 border-t-2 border-[#1a1a1a]/25 pt-1.5 text-[12px]">
                <DeedRow label="Ev maliyeti (her biri)" value={money(g.house)} />
                <DeedRow label="Otel maliyeti" value={`${money(g.house)} + 4 ev`} />
                <DeedRow label="İpotek değeri" value={money(sq.price / 2)} />
              </div>
              <div className="mt-1.5 text-center text-[11px] italic text-[#5d5238]">Grubun tüm arsaları sendeyse boş arsa kirası iki katıdır.</div>
            </>
          )}
          {sq.kind === "transit" && (
            <>
              <div className="mb-1 text-center text-[15px] font-black">KİRA {money(25)}</div>
              <DeedRow label="2 hat sahibiyse" value={money(50)} on={nOwned("transit") === 2} />
              <DeedRow label="3 hat sahibiyse" value={money(100)} on={nOwned("transit") === 3} />
              <DeedRow label="4 hat sahibiyse" value={money(200)} on={nOwned("transit") === 4} bold />
              <div className="mt-2 border-t-2 border-[#1a1a1a]/25 pt-1.5 text-[12px]"><DeedRow label="İpotek değeri" value={money(sq.price / 2)} /></div>
            </>
          )}
          {sq.kind === "util" && (
            <>
              <div className={`rounded px-1.5 py-1 ${nOwned("util") === 1 ? "bg-[#f4dca0] font-black text-[#b91c1c]" : ""}`}>Tek idare sahibiyse kira, atılan zarın <b>4 katıdır</b>.</div>
              <div className={`mt-1 rounded px-1.5 py-1 ${nOwned("util") === 2 ? "bg-[#f4dca0] font-black text-[#b91c1c]" : ""}`}>İki idare birden sahibiyse zarın <b>10 katıdır</b>.</div>
              <div className="mt-2 border-t-2 border-[#1a1a1a]/25 pt-1.5 text-[12px]"><DeedRow label="İpotek değeri" value={money(sq.price / 2)} /></div>
            </>
          )}
          {!sq.price && <div className="py-3 text-center font-bold text-[#6b5f43]">Satılık değil</div>}
        </div>

        {sq.price ? (
          o ? (
            <div className="mx-2 mb-2 flex items-center gap-2 rounded-md border-2 border-[#1a1a1a] px-2.5 py-1.5" style={{ background: o.color, color: ink(o.color) }}>
              <span className="text-lg leading-none">{TOKENS[o.token]?.icon ?? "🙂"}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-black">Sahibi: {o.name}{mine ? " (sen)" : ""}</span>
              {v.mort[i] && <span className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-black tracking-wider">İPOTEKLİ</span>}
            </div>
          ) : (
            <div className="mx-2 mb-2 rounded-md border-2 border-dashed border-[#1a1a1a]/40 py-1.5 text-center text-[12px] font-bold text-[#6b5f43]">Sahipsiz — satın alınabilir ({money(sq.price)})</div>
          )
        ) : null}

        {mine && (
          <div className="grid grid-cols-2 gap-1.5 px-2 pb-2.5">
            {sq.kind === "prop" && (
              <button type="button" className={`${flat} bg-[#2f9e57] text-white`} disabled={!canBuild(state, me, i) || v.turn !== me} onClick={() => send({ t: "build", sq: i })}><Hammer size={12} className="mr-1 inline -mt-0.5" />{h === 4 ? "Otel kur" : "Ev kur"}</button>
            )}
            {sq.kind === "prop" && (
              <button type="button" className={`${flat} bg-[#efe6cb] text-[#3b3322]`} disabled={!canSell(state, me, i)} onClick={() => send({ t: "sell", sq: i })}>Ev sat</button>
            )}
            {!v.mort[i] ? (
              <button type="button" className={`${flat} col-span-2 bg-[#efe6cb] text-[#3b3322]`} disabled={!canMortgage(state, me, i)} onClick={() => send({ t: "mortgage", sq: i })}><Landmark size={12} className="mr-1 inline -mt-0.5" />İpotek et (+{money(sq.price / 2)})</button>
            ) : (
              <button type="button" className={`${flat} col-span-2 bg-[#4f5bd5] text-white`} onClick={() => send({ t: "unmortgage", sq: i })}>İpoteği kaldır ({money(Math.ceil((sq.price / 2) * 1.1))})</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TradeDialog({ v, me, to, send, onClose }) {
  const [give, setGive] = useState({ cash: 0, props: [] });
  const [get, setGet] = useState({ cash: 0, props: [] });
  const tradable = (who) => BOARD.map((_, i) => i).filter((i) => v.own[i] === who && !(BOARD[i].kind === "prop" && groupSquares(BOARD[i].g).some((q) => v.houses[q] > 0)));
  const toggle = (set, st, i) => set({ ...st, props: st.props.includes(i) ? st.props.filter((x) => x !== i) : [...st.props, i] });
  const col = (who, st, set, title) => {
    const pl = v.players[who];
    return (
      <div className="flex-1 min-w-0 rounded-2xl p-2.5" style={{ background: `linear-gradient(180deg, ${shade(pl.color, 0.5)}, rgba(0,0,0,.3))`, border: `2px solid ${pl.color}` }}>
        <div className="mb-2 flex items-center gap-2">
          <IconDot icon={TOKENS[pl.token]?.icon ?? "🙂"} color={pl.color} size="w-9 h-9 text-xl" />
          <div className="leading-tight"><div className="text-[10px] font-black tracking-widest opacity-80">{title}</div><div className="text-sm font-black">{pl.name}</div></div>
        </div>
        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto pb-1">
          {tradable(who).map((i) => {
            const on = st.props.includes(i);
            return (
              <button key={i} type="button" onClick={() => toggle(set, st, i)} aria-pressed={on} className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12px] font-extrabold transition active:translate-y-[2px] ${on ? "text-white ring-2 ring-white" : "bg-white/10 text-white/90 hover:bg-white/20"}`} style={on ? { background: "linear-gradient(180deg,#9aa5ff,#6366f1)", boxShadow: "0 3px 0 rgba(0,0,0,.3)" } : undefined}>
                <span className="inline-block h-3.5 w-2 rounded-[2px] border border-black/40" style={{ background: BOARD[i].kind === "prop" ? GROUPS[BOARD[i].g].color : "#94a3b8" }} />{BOARD[i].name}
              </button>
            );
          })}
          {!tradable(who).length && <span className="text-[11px] text-white/60">Takaslık arsa yok</span>}
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs font-bold text-white/85">
          Nakit
          <input type="number" min={0} max={pl.cash} step={10} value={st.cash} onChange={(e) => set({ ...st, cash: Math.max(0, Math.min(pl.cash, Number(e.target.value) || 0)) })} className="w-24 rounded-xl border-b-[3px] border-black/40 bg-black/40 px-2 py-1 text-sm font-black tabular-nums text-amber-200 outline-none focus:ring-2 focus:ring-white/60" />
        </label>
      </div>
    );
  };
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-label="Takas teklifi">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl text-white animate-[gmPop_.22s_ease-out]" style={{ background: PANEL_BG, border: "3px solid #6366f1", boxShadow: panelShadow }}>
        <div className="relative flex items-center gap-3 px-4 py-3" style={{ background: "linear-gradient(135deg, #818cf8, #4338ca)" }}>
          <IconDot icon="🤝" color="#6366f1" size="w-11 h-11 text-2xl" />
          <div className="leading-tight"><div className="text-[10px] font-black tracking-[0.18em] opacity-90">TAKAS</div><div className="text-[17px] font-black" style={{ textShadow: "0 2px 3px rgba(0,0,0,.4)" }}>{v.players[to].name} ile takas</div></div>
          <button type="button" onClick={onClose} className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-black/25 transition hover:bg-black/45" aria-label="Kapat"><X size={15} /></button>
        </div>
        <div className="flex gap-3 p-4">{col(me, give, setGive, "VERDİKLERİN")}{col(to, get, setGet, "İSTEDİKLERİN")}</div>
        <div className="flex justify-end gap-3 px-4 pb-4">
          <ArcadeBtn tone="ghost" onClick={onClose}>Vazgeç</ArcadeBtn>
          <ArcadeBtn tone="good" onClick={() => (send({ t: "offer", to, give, get }), onClose())}>Teklif gönder</ArcadeBtn>
        </div>
      </div>
    </div>
  );
}

/** Oyun akışı kartı: oyuncu renginde, ikon yuvarlağı + kalın yazı + tutar rozeti (köşe bannerlarıyla aynı dil) */
function FeedCard({ f }) {
  const c = f.color || "#64748b";
  return (
    <div
      className={`w-full flex items-center gap-2.5 rounded-2xl pl-2 pr-2.5 py-2 text-white transition-all duration-700 animate-[gmSlide_.32s_ease-out] ${f.fading ? "opacity-0 translate-x-6" : ""}`}
      style={{ background: `linear-gradient(135deg, ${c}, ${shade(c, 0.6)})`, boxShadow: "0 4px 0 rgba(0,0,0,.28), 0 10px 18px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.35)" }}
    >
      <span className="w-9 h-9 shrink-0 rounded-full bg-white flex items-center justify-center text-xl leading-none shadow-inner" style={{ border: `3px solid ${shade(c, 0.75)}` }}>{f.icon}</span>
      <span className="flex-1 text-[13px] font-extrabold leading-tight" style={{ textShadow: "0 1px 2px rgba(0,0,0,.5)" }}>{f.text}</span>
      {f.amt && (
        <span className="shrink-0 rounded-xl bg-black/30 border-b-[3px] border-black/30 px-2 py-1 text-[13px] font-black tabular-nums" style={{ color: f.amt.sign > 0 ? "#bbf7d0" : f.amt.sign < 0 ? "#fecaca" : "#fef08a" }}>{f.amt.label}</span>
      )}
    </div>
  );
}

export default function EmlakView({ view: v, session, myId, send, isHost, onRematch, onLobby, onLeave }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const gfx = useGamesPrefs((s) => s.gfx);
  const showFps = useGamesPrefs((s) => s.showFps);
  const me = v.me;
  const myTurn = me >= 0 && v.turn === me;
  const [sel, setSel] = useState(-1);
  const [tradeTo, setTradeTo] = useState(-1);
  const [hud, setHud] = useState(null);
  const [failed, setFailed] = useState(false);
  // olay kuyruğu: zar → yürüyüş → efekt/kamera/ses sırayla oynar (HUD'daki düğmeler bitene kadar bekler)
  const [busy, setBusy] = useState(false);
  const rolling = busy;
  const [diceShow, setDiceShow] = useState(null);
  const [banner, setBanner] = useState(null);
  const [floaters, setFloaters] = useState([]);
  const [feed, setFeed] = useState([]); // oyun geçmişi (oynatılan olaylar)
  const [recent, setRecent] = useState([]); // son olaylar: kısa süre görünen kartlar
  const [feedOpen, setFeedOpen] = useState(false);
  const [ownerFocus, setOwnerFocus] = useState(-1);
  const [hover, setHover] = useState(null);
  const follow = useGamesPrefs((s) => s.emlak?.follow ?? true); // otomatik kamera takibi
  const setPref = useGamesPrefs((s) => s.setPref);
  const [cardShow, setCardShow] = useState(null); // çekilen Şans/Hazine kartı (büyük açılış)
  const cardSkip = useRef(null);
  const prevRef = useRef(null);
  const queue = useRef([]);
  const pumping = useRef(false);
  const alive = useRef(true);
  const fid = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    let scene;
    try {
      scene = new EmlakScene(cv, { gfx });
    } catch (e) {
      console.error("[emlak] WebGL başlatılamadı", e);
      setFailed(true);
      return;
    }
    sceneRef.current = scene;
    scene.onStep = () => sfx("hop", 0.5, 0);
    preloadSamples(); // gerçek kayıt sesleri önceden yükle
    scene.setBoard(v.own, v.houses, v.mort, v.players); // kalite değişince sahne yeniden kurulur: durumu geri yükle
    scene.setPlayers(v.players);
    scene.setTurn(v.phase === "over" ? -1 : v.turn, v.players[v.turn]?.color);
    const ro = new ResizeObserver(() => scene.resize());
    ro.observe(cv);
    const onClick = (e) => {
      if (!scene.isClick(e)) return; // kamera sürüklemesi
      const i = scene.pickSquare(e.clientX, e.clientY);
      setSel(i);
    };
    cv.addEventListener("click", onClick);
    let lastMove = 0;
    const onMove = (e) => {
      const now = performance.now();
      if (now - lastMove < 70) return;
      lastMove = now;
      if (e.buttons) return setHover(null);
      const i = scene.pickSquare(e.clientX, e.clientY);
      if (i < 0) return setHover((h) => (h ? null : h));
      const r = cv.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      setHover((h) => (h && h.sq === i && Math.abs(h.x - x) < 8 && Math.abs(h.y - y) < 8 ? h : { sq: i, x, y, w: r.width }));
    };
    const onLeave = () => setHover(null);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerleave", onLeave);
    let raf;
    let last = performance.now();
    let hudT = 0;
    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      const ms = t - last;
      last = t;
      scene.update(Math.min(0.05, ms / 1000), ms);
      hudT += ms;
      if (hudT > 500) (hudT = 0), setHud(scene.stats);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cv.removeEventListener("click", onClick);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerleave", onLeave);
      scene.dispose();
      sceneRef.current = null;
    };
  }, [gfx]);

  // durum → sahne (tahta, sıra halkası); piyon/zar/efektler olay kuyruğundan gelir
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) return;
    sc.setBoard(v.own, v.houses, v.mort, v.players);
    sc.setTurn(v.phase === "over" ? -1 : v.turn, v.players[v.turn]?.color);
  }, [v]); // eslint-disable-line

  const nap = (ms) => new Promise((r) => setTimeout(r, ms * 1.3 * (queue.current.length >= 3 ? 0.3 : 1))); // birikme olursa hızlan
  const addFloater = (pt, text, color) => {
    const id = ++fid.current;
    setFloaters((f) => [...f.slice(-7), { id, ...pt, text, color }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 1700);
  };
  const pushFeed = (icon, text, color, amt, divider) => {
    const id = ++fid.current;
    const item = { id, icon, text, color, amt, divider };
    setFeed((f) => [item, ...f].slice(0, 40));
    if (divider) return;
    setRecent((r) => [item, ...r].slice(0, 4));
    setTimeout(() => setRecent((r) => r.map((x) => (x.id === id ? { ...x, fading: true } : x))), 6200);
    setTimeout(() => setRecent((r) => r.filter((x) => x.id !== id)), 7000);
  };
  /** Banner + akış satırı (amt: { label, sign } → akışta renkli tutar rozeti) */
  const say = (icon, text, color, amt) => {
    const key = ++fid.current;
    setBanner({ key, icon, text: amt ? `${text} · ${amt.label}` : text, color });
    setTimeout(() => setBanner((b) => (b && b.key === key ? null : b)), 3200);
    pushFeed(icon, text, color, amt);
  };

  /** Tek bir olayı oynat: efekt + kamera + ses + banner; bitince çözülür */
  const playEvent = async (e) => {
    const sc = sceneRef.current;
    if (!sc || !alive.current) return;
    const P = e.snap.players;
    const nm = (i) => P[i]?.name || "?";
    const col = (i) => P[i]?.color || "#ffffff";
    const sqn = (i) => BOARD[i]?.name || "";
    const fast = queue.current.length >= 3;
    const floatAt = (pt, text, color) => addFloater(sc.toScreen(pt.x, pt.z, 0.03), text, color);
    switch (e.type) {
      case "roll": {
        setDiceShow(null);
        if (!fast) sfx("rollStart", 0.8, 0);
        await sc.roll(e.dice, e.seed * 2654435761, (k) => !fast && sfx("dice", k, 0), { instant: fast });
        const key = ++fid.current;
        setDiceShow({ key, name: nm(e.who), color: col(e.who), dice: e.dice, double: e.double });
        setTimeout(() => setDiceShow((d) => (d && d.key === key ? null : d)), 4000);
        sfx(e.double ? "fanfare" : "ding", 0.6, 0);
        pushFeed("🎲", `${nm(e.who)} attı: ${e.dice[0]} + ${e.dice[1]} = ${e.dice[0] + e.dice[1]}${e.double ? " · çift!" : ""}`, col(e.who));
        await nap(800);
        break;
      }
      case "move": {
        sc.setPlayers(e.snap.players);
        await sc.whenPawnsIdle(9);
        const c = squareCenter(e.to);
        sc.burst(c.x, c.z, "#ffffff", 8);
        await nap(120);
        break;
      }
      case "go": {
        const c = squareCenter(0);
        sc.burst(c.x, c.z, "#ffd54a", 30);
        floatAt(sc.pawnPos(e.who), `+${money(e.amount)}`, "#86efac");
        say("🎉", `${nm(e.who)} Başlangıç'tan geçti`, col(e.who), { label: `+${money(e.amount)}`, sign: 1 });
        sfx("fanfare");
        await nap(1300);
        break;
      }
      case "buy":
      case "auctionWin": {
        const c = squareCenter(e.sq);
        sc.flash(e.sq, col(e.who));
        sc.burst(c.x, c.z, col(e.who), 32);
        floatAt(c, `-${money(e.amount)}`, "#fca5a5");
        say("🏠", `${nm(e.who)} ${sqn(e.sq)} mülkünü ${e.type === "buy" ? "satın aldı" : "ihaleyle aldı"}`, col(e.who), { label: `−${money(e.amount)}`, sign: -1 });
        sfx("coin");
        await nap(1700);
        break;
      }
      case "rent": {
        const a = sc.pawnPos(e.from);
        const b = sc.pawnPos(e.to);
        sc.coins(a, b, 10);
        floatAt(a, `-${money(e.amount)}`, "#fca5a5");
        setTimeout(() => alive.current && floatAt(b, `+${money(e.amount)}`, "#86efac"), 650);
        say("💸", `${nm(e.from)} → ${nm(e.to)} kira ödedi (${sqn(e.sq)})`, col(e.to), { label: money(e.amount), sign: 0 });
        sfx("coin");
        await nap(1700);
        break;
      }
      case "tax": {
        const a = sc.pawnPos(e.who);
        sc.burst(a.x, a.z, "#94a3b8", 18);
        floatAt(a, `-${money(e.amount)}`, "#fca5a5");
        say("🧾", `${nm(e.who)} vergi ödedi`, "#64748b", { label: `−${money(e.amount)}`, sign: -1 });
        sfx("bad");
        await nap(1300);
        break;
      }
      case "build": {
        const c = squareCenter(e.sq);
        sc.burst(c.x, c.z, "#ffd54a", 24, 0.01);
        say(e.level === 5 ? "🏨" : "🏗️", `${nm(e.who)} ${sqn(e.sq)} üzerine ${e.level === 5 ? "otel kurdu" : `${e.level}. evi kurdu`}`, col(e.who));
        sfx("build");
        await nap(1300);
        break;
      }
      case "sellHouse":
        say("🔨", `${nm(e.who)} ${sqn(e.sq)} üzerindeki evi sattı`, col(e.who));
        sfx("coin");
        await nap(900);
        break;
      case "mortgage":
      case "unmortgage":
        sc.flash(e.sq, "#94a3b8");
        say("🏦", `${nm(e.who)} ${sqn(e.sq)} ${e.type === "mortgage" ? "ipotek etti" : "ipoteğini kaldırdı"}`, col(e.who));
        sfx("coin");
        await nap(900);
        break;
      case "jail": {
        const c = squareCenter(e.sq);
        sc.burst(c.x, c.z, "#60a5fa", 26);
        say("🚓", `${nm(e.who)} gözaltına alındı`, "#2563eb");
        sfx("jail");
        await nap(1500);
        break;
      }
      case "free":
        say("🔓", `${nm(e.who)} gözaltından çıktı`, col(e.who));
        sfx("ding");
        await nap(900);
        break;
      case "bankrupt": {
        const a = sc.pawnPos(e.who);
        sc.burst(a.x, a.z, "#ef4444", 36);
        say("💥", `${nm(e.who)} iflas etti!`, "#dc2626");
        sfx("bad");
        sc.setPlayers(e.snap.players);
        await nap(1800);
        break;
      }
      case "auction":
        sc.flash(e.sq, "#f59e0b");
        say("⚖️", `İhale başladı: ${sqn(e.sq)}`, "#f59e0b");
        sfx("ding");
        await nap(900);
        break;
      case "trade":
        say("🤝", `${(e.who || []).map(nm).join(" ve ")} takas yaptı`, "#6366f1");
        sfx("coin");
        await nap(1300);
        break;
      case "card": {
        pushFeed(e.deck === "chest" ? "🧰" : "❓", `${nm(e.who)} ${e.deck === "chest" ? "Hazine" : "Şans"} kartı çekti: ${e.text}`, col(e.who));
        const key = ++fid.current;
        setCardShow({ key, deck: e.deck, text: e.text, name: nm(e.who), color: col(e.who), token: P[e.who]?.token });
        sfx("card", 0.9, 0);
        sfx("ding", 0.5, 0);
        // süre dolana ya da oyuncu tıklayana kadar göster (en fazla ~4,5 sn)
        await Promise.race([nap(3400), new Promise((r) => (cardSkip.current = r))]);
        cardSkip.current = null;
        setCardShow((c) => (c && c.key === key ? null : c));
        await nap(250);
        break;
      }
      case "turn":
        pushFeed(null, `${nm(e.who)} oynuyor`, col(e.who), null, true);
        if (e.who === me) sfx("ding", 0.5, 0);
        await nap(550);
        break;
      default:
    }
  };

  const pump = async () => {
    if (pumping.current) return;
    pumping.current = true;
    setBusy(true);
    try {
      while (queue.current.length && alive.current) {
        // çok biriktiyse önemsiz olayları at (botlar hızlı oynar)
        if (queue.current.length > 8) queue.current = queue.current.filter((x) => !["turn", "card", "mortgage", "unmortgage", "sellHouse"].includes(x.type));
        await playEvent(queue.current.shift());
      }
    } catch (err) {
      console.error("[emlak] olay oynatma hatası", err);
    } finally {
      pumping.current = false;
      if (alive.current) {
        setBusy(false);
        sceneRef.current?.setPlayers(prevRef.current.players); // her durumda son gerçek konumlara eşitle
      }
    }
  };

  // yeni görünüm → farktan olaylar (yeni oyun/rövanşta sıfırla)
  useEffect(() => {
    let prev = prevRef.current;
    if (prev && v.rolls < prev.rolls) {
      prev = null;
      queue.current = [];
    }
    prevRef.current = v;
    const evs = diffEvents(prev, v);
    if (evs.length) {
      queue.current.push(...evs.map((e) => ({ ...e, snap: v })));
      pump();
    } else if (!pumping.current) sceneRef.current?.setPlayers(v.players);
  }, [v]); // eslint-disable-line

  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) return;
    sc.follow = follow;
    if (!follow) sc.resetCamera();
  }, [follow, gfx]);

  useEffect(() => {
    sceneRef.current?.setOwnerFocus(ownerFocus, ownerFocus >= 0 ? v.players[ownerFocus]?.color : undefined);
  }, [ownerFocus, gfx]); // eslint-disable-line

  useEffect(() => {
    sceneRef.current?.setHighlight(sel);
  }, [sel, gfx]);

  const p = me >= 0 ? v.players[me] : null;
  const sq = p ? BOARD[p.pos] : null;
  const a = v.auction;
  const t = v.trade;
  const nextBid = (k) => (a ? a.bid + k : 0);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" aria-label="Emlak tahtası. Bir kareye tıklayarak bilgisini gör; sürükleyerek döndür, tekerlekle yakınlaştır." />
      {failed && <div className="absolute inset-0 flex items-center justify-center text-sm text-[#b5bac1]">Bu cihazda 3B grafik (WebGL) başlatılamadı.</div>}

      {/* Oyuncu bannerları: sol/sağ köşe sütunları */}
      <div className="absolute left-3 top-3 flex flex-col gap-2.5">
        {v.players.map((pl, k) => k % 2 === 0 && <PlayerCard key={pl.id} pl={pl} k={k} v={v} me={me} onTrade={setTradeTo} focused={ownerFocus === k} onFocus={(i) => setOwnerFocus((f) => (f === i ? -1 : i))} />)}
      </div>
      <div className="absolute right-3 top-3 flex flex-col gap-2.5 items-end">
        {v.players.map((pl, k) => k % 2 === 1 && <PlayerCard key={pl.id} pl={pl} k={k} v={v} me={me} onTrade={setTradeTo} focused={ownerFocus === k} onFocus={(i) => setOwnerFocus((f) => (f === i ? -1 : i))} />)}
      </div>

      {/* Sıra bannerı */}
      {v.phase !== "over" && v.players[v.turn] && (
        <div className="absolute left-1/2 top-0 -translate-x-1/2 flex flex-col items-center pointer-events-none">
          <div
            className={`px-7 py-1.5 rounded-b-2xl text-sm font-black tracking-widest text-white border-b-4 border-black/30 ${myTurn ? "animate-pulse" : ""}`}
            style={{ background: `linear-gradient(180deg, ${v.players[v.turn].color}, ${shade(v.players[v.turn].color, 0.65)})`, boxShadow: "0 8px 18px rgba(0,0,0,.45)", textShadow: "0 2px 3px rgba(0,0,0,.45)" }}
          >
            {myTurn ? "SIRA SENDE!" : `SIRA: ${v.players[v.turn].name.toLocaleUpperCase("tr-TR")}`}
          </div>
          <div className="mt-1.5 text-[11px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,.8)]">Tur {v.round}/{v.maxRounds} · banka: {v.bank.houses} ev, {v.bank.hotels} otel</div>
        </div>
      )}

      {/* Zar sonucu + olay bannerı */}
      <div className="absolute left-1/2 top-[72px] -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none z-10">
        {diceShow && (
          <div key={diceShow.key} className="flex items-center gap-3 rounded-2xl px-4 py-2.5 text-white animate-[gmPop_.25s_ease-out]" style={{ background: `linear-gradient(135deg, ${diceShow.color}, ${shade(diceShow.color, 0.6)})`, boxShadow: "0 10px 24px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.35)" }}>
            <div className="leading-tight">
              <div className="text-[11px] font-bold opacity-90">{diceShow.name} attı</div>
              <div className="text-3xl font-black tabular-nums" style={{ textShadow: "0 2px 3px rgba(0,0,0,.4)" }}>{diceShow.dice[0] + diceShow.dice[1]}</div>
            </div>
            <DiceFace n={diceShow.dice[0]} />
            <DiceFace n={diceShow.dice[1]} />
            {diceShow.double && <span className="rounded-full bg-amber-300 px-2.5 py-1 text-[11px] font-black tracking-wider text-amber-900 animate-pulse">ÇİFT!</span>}
          </div>
        )}
        {banner && (
          <div key={banner.key} className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-extrabold text-white animate-[gmPop_.22s_ease-out]" style={{ background: `linear-gradient(180deg, ${banner.color}, ${shade(banner.color, 0.65)})`, boxShadow: "0 8px 20px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.35)", textShadow: "0 1px 2px rgba(0,0,0,.45)" }}>
            <span className="text-lg leading-none">{banner.icon}</span>
            {banner.text}
          </div>
        )}
      </div>
      {floaters.map((f) => (
        <div key={f.id} className="absolute pointer-events-none z-10" style={{ left: f.x, top: f.y, transform: "translate(-50%, -50%)" }}>
          <span className="inline-block text-2xl font-black animate-[gmFloat_1.7s_ease-out_forwards]" style={{ color: f.color, textShadow: "0 2px 6px rgba(0,0,0,.85), 0 0 12px rgba(0,0,0,.6)" }}>{f.text}</span>
        </div>
      ))}

      {me >= 0 && <Bills cash={p.cash} />}

      {/* Oyun akışı: arcade kartları (son olaylar kısa süre görünür; Geçmiş ile hepsi) */}
      <div className="absolute right-3 bottom-4 w-[20rem] flex flex-col-reverse items-end gap-2.5 z-10" aria-live="polite">
        <div className="flex gap-2">
          <ArcadeBtn tone={follow ? "good" : "ghost"} xs onClick={() => setPref("emlak", "follow", !follow)}>🎥 Takip</ArcadeBtn>
          <ArcadeBtn tone="ghost" xs onClick={() => sceneRef.current?.resetCamera()}>🎯 Genel</ArcadeBtn>
          <ArcadeBtn tone="ghost" xs onClick={() => setFeedOpen((o) => !o)}>{feedOpen ? "📜 Kapat ▾" : "📜 Geçmiş ▴"}</ArcadeBtn>
        </div>
        {feedOpen ? (
          <div className="w-full max-h-[58vh] overflow-y-auto flex flex-col gap-2.5 pr-1 pb-1">
            {feed.length === 0 && <div className="rounded-xl bg-black/50 px-3 py-2 text-xs text-white/80">Henüz bir olay yok.</div>}
            {feed.map((f) =>
              f.divider ? (
                <div key={f.id} className="self-start rounded-full px-3 py-0.5 text-[11px] font-black uppercase tracking-wider text-white" style={{ background: f.color, boxShadow: "0 2px 0 rgba(0,0,0,.3)" }}>▶ {f.text}</div>
              ) : (
                <FeedCard key={f.id} f={f} />
              )
            )}
          </div>
        ) : (
          recent.map((f) => <FeedCard key={f.id} f={f} />)
        )}
      </div>
      {showFps && hud && <div className="absolute bottom-20 left-3 text-[11px] tabular-nums text-[#b5bac1] bg-black/45 rounded px-2 py-1">{hud.fps} fps · {hud.tier} · {hud.calls} çizim</div>}

      {hover && sel !== hover.sq && <SquareTip i={hover.sq} v={v} x={hover.x} y={hover.y} w={hover.w} />}
      {sel >= 0 && <PropCard i={sel} v={v} me={me} send={send} onClose={() => setSel(-1)} />}

      {/* Şans / Hazine kartı: ekranın ortasında büyük açılış (tıklayınca geçilir) */}
      {cardShow && (() => {
        const chest = cardShow.deck === "chest";
        const accent = chest ? "#1d4ed8" : "#ea580c";
        return (
          <div key={cardShow.key} className="absolute inset-0 z-30 flex cursor-pointer items-center justify-center bg-black/45 backdrop-blur-[2px] animate-[gmPop_.2s_ease-out]" onClick={() => cardSkip.current?.()} role="dialog" aria-label={chest ? "Hazine kartı" : "Şans kartı"}>
            <div className="w-[28rem] max-w-[94%] -rotate-2 animate-[gmFlip_.55s_cubic-bezier(.2,.8,.3,1)]" style={{ filter: "drop-shadow(0 20px 32px rgba(0,0,0,.65))" }}>
              <div className="rounded-xl border-[4px] border-[#1a1a1a] bg-[#fbf7ea] p-2" style={{ backgroundImage: "radial-gradient(circle at 25% 8%, rgba(255,255,255,.8), transparent 55%)" }}>
                <div className="rounded-lg border-[3px] px-6 pb-6 pt-5 text-center" style={{ borderColor: accent }}>
                  <div className="text-[96px] font-black leading-none" style={{ color: accent }}>{chest ? "🧰" : "?"}</div>
                  <div className="mt-1 text-[19px] font-black tracking-[0.34em]" style={{ color: accent }}>{chest ? "HAZİNE" : "ŞANS"}</div>
                  <div className="my-3 border-t-2 border-[#1a1a1a]/20" />
                  <div className="text-[26px] font-bold leading-snug text-[#1f1a10]">{cardShow.text}</div>
                </div>
              </div>
              <div className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-md border-2 border-[#1a1a1a] px-3.5 py-2 text-[15px] font-black" style={{ background: cardShow.color, color: ink(cardShow.color) }}>
                <span className="text-lg leading-none">{TOKENS[cardShow.token]?.icon ?? "🙂"}</span>
                {cardShow.name} çekti
              </div>
              <div className="mt-2 text-center text-[11px] font-bold text-white/85">devam için tıkla</div>
            </div>
          </div>
        );
      })()}

      {/* İhale */}
      {a && (
        <div className="absolute left-1/2 top-[28%] z-20 w-[22rem] -translate-x-1/2 overflow-hidden rounded-3xl text-white animate-[gmPop_.22s_ease-out]" style={{ background: PANEL_BG, border: "3px solid #f59e0b", boxShadow: panelShadow }}>
          <div className="relative flex items-center gap-3 px-3 py-3" style={{ background: "linear-gradient(135deg, #fbbf24, #d97706)" }}>
            <IconDot icon="⚖️" color="#d97706" />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-[10px] font-black tracking-[0.18em] opacity-90">İHALE</div>
              <div className="truncate text-[17px] font-black uppercase" style={{ textShadow: "0 2px 3px rgba(0,0,0,.4)" }}>{BOARD[a.sq].name}</div>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/30 text-lg font-black tabular-nums" aria-label={`${a.endsIn} saniye`}>{a.endsIn}</span>
          </div>
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-center justify-between rounded-2xl bg-white/[0.08] px-3 py-2">
              <span className="text-[11px] font-black tracking-wider text-white/70">EN YÜKSEK TEKLİF</span>
              <span className="rounded-xl bg-amber-300 px-3 py-1 text-lg font-black tabular-nums text-amber-950 border-b-[3px] border-amber-600/60">{money(a.bid)}</span>
            </div>
            {a.by >= 0 ? (
              <div className="flex items-center gap-2 rounded-2xl px-2.5 py-1.5" style={{ background: `linear-gradient(135deg, ${v.players[a.by].color}, ${shade(v.players[a.by].color, 0.6)})`, boxShadow: "0 3px 0 rgba(0,0,0,.3)" }}>
                <IconDot icon={TOKENS[v.players[a.by].token]?.icon ?? "🙂"} color={v.players[a.by].color} size="w-8 h-8 text-lg" />
                <span className="text-sm font-black">{v.players[a.by].name} önde</span>
              </div>
            ) : <div className="rounded-2xl bg-white/10 px-3 py-1.5 text-center text-sm font-bold text-white/75">Henüz teklif yok</div>}
            {me >= 0 && !v.players[me].out && !a.passed.includes(me) ? (
              <div className="mt-1 flex flex-wrap gap-2">
                {[10, 50, 100].map((k) => <ArcadeBtn key={k} tone="good" xs disabled={nextBid(k) > v.players[me].cash || a.by === me} onClick={() => send({ t: "bid", amount: nextBid(k) })}>+{k}</ArcadeBtn>)}
                <ArcadeBtn tone="ghost" xs className="ml-auto" onClick={() => send({ t: "pass" })}>Çekil</ArcadeBtn>
              </div>
            ) : <div className="text-center text-xs font-bold text-white/60">İhaleden çekildin.</div>}
          </div>
        </div>
      )}

      {/* Gelen takas */}
      {t && t.to === me && (
        <div className="absolute left-1/2 top-[28%] z-20 w-[26rem] -translate-x-1/2 overflow-hidden rounded-3xl text-white animate-[gmPop_.22s_ease-out]" style={{ background: PANEL_BG, border: "3px solid #6366f1", boxShadow: panelShadow }}>
          <div className="flex items-center gap-3 px-3 py-3" style={{ background: "linear-gradient(135deg, #818cf8, #4338ca)" }}>
            <IconDot icon="🤝" color="#6366f1" />
            <div className="leading-tight"><div className="text-[10px] font-black tracking-[0.18em] opacity-90">TAKAS TEKLİFİ</div><div className="text-[16px] font-black" style={{ textShadow: "0 2px 3px rgba(0,0,0,.4)" }}>{v.players[t.from].name} teklif ediyor</div></div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 p-3">
            {[["SANA VERİR", t.give], ["SENDEN İSTER", t.get]].map(([title, side]) => (
              <div key={title} className="rounded-2xl bg-white/[0.08] p-2.5">
                <div className="mb-1.5 text-[10px] font-black tracking-widest text-white/65">{title}</div>
                <div className="flex flex-col gap-1">
                  {side.props.map((i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[12px] font-extrabold"><span className="inline-block h-3.5 w-2 rounded-[2px] border border-black/40" style={{ background: BOARD[i].kind === "prop" ? GROUPS[BOARD[i].g].color : "#94a3b8" }} />{BOARD[i].name}</div>
                  ))}
                  {side.cash > 0 && <div className="mt-0.5 self-start rounded-xl bg-amber-300 px-2.5 py-0.5 text-sm font-black tabular-nums text-amber-950 border-b-[3px] border-amber-600/60">{money(side.cash)}</div>}
                  {!side.props.length && !(side.cash > 0) && <div className="text-[11px] text-white/50">—</div>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 px-3 pb-3">
            <ArcadeBtn tone="danger" xs onClick={() => send({ t: "reject" })}>Reddet</ArcadeBtn>
            <ArcadeBtn tone="good" xs onClick={() => send({ t: "accept" })}>Kabul et</ArcadeBtn>
          </div>
        </div>
      )}
      {t && t.from === me && (
        <div className="absolute bottom-[92px] left-1/2 z-10 flex -translate-x-1/2 items-center gap-2.5 rounded-full px-4 py-2 text-sm font-extrabold text-white" style={{ background: "linear-gradient(180deg, #818cf8, #4338ca)", boxShadow: "0 4px 0 rgba(0,0,0,.3), 0 10px 18px rgba(0,0,0,.4)" }}>
          <span>🤝 Teklifin {v.players[t.to].name} kişisinde…</span>
          <ArcadeBtn tone="ghost" xs onClick={() => send({ t: "cancel" })}>Geri çek</ArcadeBtn>
        </div>
      )}
      {tradeTo >= 0 && <TradeDialog v={v} me={me} to={tradeTo} send={send} onClose={() => setTradeTo(-1)} />}

      {/* Eylem çubuğu */}
      {me >= 0 && v.phase !== "over" && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-3">
          {v.phase === "debt" && v.debt?.who === me ? (
            <>
              <span className="rounded-full bg-black/60 px-4 py-1.5 text-sm font-bold text-amber-300">Borç: {money(v.debt.amount > 0 ? -p.cash : 0)} — arsa kartından ev sat / ipotek et</span>
              <ArcadeBtn tone="danger" onClick={() => send({ t: "bankrupt" })}>İflas et</ArcadeBtn>
            </>
          ) : myTurn ? (
            <>
              {v.phase === "roll" && p.jail > 0 && <ArcadeBtn tone="ghost" disabled={p.cash < JAIL_FINE} onClick={() => send({ t: "payFine" })}>Ceza öde ({money(JAIL_FINE)})</ArcadeBtn>}
              {v.phase === "roll" && p.jail > 0 && p.free > 0 && <ArcadeBtn tone="ghost" onClick={() => send({ t: "useCard" })}>Çıkış kartı</ArcadeBtn>}
              {(v.phase === "roll" || (v.phase === "manage" && v.canRollAgain)) && (
                <ArcadeBtn big disabled={rolling} onClick={() => send({ t: "roll" })}><Dices size={22} className="inline -mt-1 mr-2" />{v.canRollAgain ? "Tekrar at (çift)" : p.jail > 0 ? "Çift dene" : "Zar at"}</ArcadeBtn>
              )}
              {v.phase === "buy" && !rolling && (
                <>
                  <ArcadeBtn tone="good" big disabled={p.cash < sq.price} onClick={() => send({ t: "buy" })}><Home size={20} className="inline -mt-1 mr-2" />{sq.name} al ({money(sq.price)})</ArcadeBtn>
                  <ArcadeBtn tone="ghost" onClick={() => send({ t: "decline" })}>İhaleye çıkar</ArcadeBtn>
                </>
              )}
              {v.phase === "manage" && !v.canRollAgain && <ArcadeBtn tone="end" big onClick={() => send({ t: "end" })}><Exit size={20} className="inline -mt-1 mr-2" />Turu bitir</ArcadeBtn>}
              {v.turnTime > 0 && <span className="rounded-full bg-black/60 px-3 py-1 text-sm font-black text-amber-300 tabular-nums">{v.turnLeft} sn</span>}
            </>
          ) : (
            <span className="rounded-full bg-black/55 px-5 py-2 text-sm font-semibold text-white">{v.players[v.turn].name} oynuyor…</span>
          )}
        </div>
      )}

      {v.phase === "over" && (
        <EndCard
          win={v.winner === me}
          title={v.winner === me ? "Emlak kralı sensin!" : `${v.players[v.winner]?.name} kazandı`}
          subtitle={v.reason === "last" ? "Rakiplerin iflas etti" : `Tur sınırında en yüksek değer: ${money(v.worth[v.winner])}`}
          isHost={isHost}
          onRematch={onRematch}
          onLobby={onLobby}
          onLeave={onLeave}
          rkey={`${session.sid}-${session.round}`}
        />
      )}
    </div>
  );
}
