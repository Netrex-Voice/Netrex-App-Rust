"use client";

import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useLocalParticipant, useRemoteParticipants } from "@livekit/components-react";
import {
  Gamepad2, X, Maximize2, Minimize2, Crown, Search, Star, Users, Bot, Play, ArrowLeft, Plus, UserMinus, Wifi, WifiOff, Zap, Dumbbell,
  MessageCircleQuestion, LayoutGrid, Circle, Building2, Mountain, Clock, Info, LogOut, Palette, Check, Lock, Globe, UserPlus, Smile,
} from "lucide-react";
import { useGamesStore, useGamesLibrary, useGamesStats, useGamesPrefs } from "./store";
import { TOKENS } from "./engines/emlakTokens";
import { GAMES, CATEGORIES, getGame } from "./registry";
import { REACTIONS } from "./runtime";
import { gamesActions } from "./GamesHandler";
import { Btn, Chip, ArcadeBtn, shade, inkOn } from "./ui";
import Appearance from "./Appearance";
import Cover from "./covers";
import Profile from "./Profile";
import SoloRoom from "./SoloRoom";

const ICONS = { Zap, Dumbbell, MessageCircleQuestion, LayoutGrid, Circle, Building2, Crown, Mountain };
const GameIcon = ({ g, size = 20 }) => {
  const I = ICONS[g.icon] || Gamepad2;
  return <I size={size} style={{ color: g.accent }} />;
};
const Tile = ({ g, size = "md" }) => (
  <span className={`${size === "lg" ? "w-14 h-14" : "w-10 h-10"} shrink-0 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center`}><GameIcon g={g} size={size === "lg" ? 26 : 20} /></span>
);
const playersLabel = (g) => (g.solo ? "Tek kişilik" : g.players.min === g.players.max ? `${g.players.max} kişi` : `${g.players.min}–${g.players.max} kişi`);

const VIEWS = {};
const viewFor = (g) => (VIEWS[g.id] ||= lazy(g.view));

const Panel = ({ title, icon, children, className = "", accent = "#f59e0b" }) => (
  <section className={`rounded-3xl border-[3px] border-white/10 bg-[#171a2e]/90 p-4 shadow-[0_6px_0_rgba(0,0,0,.3),0_14px_26px_rgba(0,0,0,.3)] ${className}`}>
    {title && <h2 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white/85"><span className="flex h-7 w-7 items-center justify-center rounded-full text-white shadow-inner" style={{ background: `linear-gradient(180deg, ${accent}, ${shade(accent, 0.65)})`, border: `2px solid ${shade(accent, 0.55)}` }}>{icon || <Gamepad2 size={13} />}</span>{title}</h2>}
    {children}
  </section>
);

/** Küçük renkli rozet (kategori, oyuncu sayısı…) */
const Pill = ({ children, color = "#64748b", className = "" }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${className}`} style={{ background: `linear-gradient(180deg, ${color}, ${shade(color, 0.7)})`, color: inkOn(color), boxShadow: "0 2px 0 rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.3)" }}>{children}</span>
);

// ───────────────────────────── Mağaza ─────────────────────────────
function GameCard({ g, onOpen }) {
  const fav = useGamesLibrary((s) => s.favorites.includes(g.id));
  const toggleFav = useGamesLibrary((s) => s.toggleFav);
  const played = useGamesStats((s) => s.byGame[g.id]?.played || 0);
  const c = g.accent || "#6366f1";
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-3xl bg-[#171a2e] transition-all duration-200 hover:-translate-y-1" style={{ border: `3px solid ${c}`, boxShadow: `0 7px 0 ${shade(c, 0.5)}, 0 16px 28px rgba(0,0,0,.4)` }}>
      <div className="relative">
        <button type="button" onClick={() => onOpen(g.id)} className="relative block aspect-video w-full overflow-hidden focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70" aria-label={`${g.name} oyununu aç`}>
          <Cover g={g} className="transition-transform duration-500 group-hover:scale-110" />
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_5px_0_rgba(0,0,0,.35)]" style={{ color: c }}><Play size={24} className="ml-0.5 fill-current" /></span></span>
        </button>
        <Pill color={c} className="absolute left-3 top-3 uppercase tracking-wide">{CATEGORIES[g.category]}</Pill>
        <button type="button" onClick={() => toggleFav(g.id)} className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/30 bg-black/55 text-white/85 backdrop-blur transition hover:scale-110 hover:text-amber-300" aria-label={fav ? "Favorilerden çıkar" : "Favorilere ekle"} aria-pressed={fav}>
          <Star size={16} className={fav ? "fill-amber-300 text-amber-300" : ""} />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="text-xl font-black leading-tight text-white" style={{ textShadow: "0 2px 0 rgba(0,0,0,.35)" }}>{g.name}</div>
        <p className="flex-1 text-sm font-medium leading-snug text-white/70">{g.tagline}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill color="#334155" className="!text-white"><Users size={12} />{playersLabel(g)}</Pill>
          {g.bots && <Pill color="#334155" className="!text-white"><Bot size={12} />Bot</Pill>}
          {played > 0 && <Pill color="#a16207" className="ml-auto !text-amber-100">{played} maç</Pill>}
        </div>
        <ArcadeBtn tone="good" onClick={() => onOpen(g.id)} className="w-full"><Play size={14} className="mr-1.5 inline -mt-0.5 fill-current" />Oyna</ArcadeBtn>
      </div>
    </div>
  );
}

function StoreScreen() {
  const go = useGamesStore((s) => s.go);
  const { favorites, recent } = useGamesLibrary();
  const plays = useGamesStats((s) => s.byGame);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [onlyFav, setOnlyFav] = useState(false);
  const [sort, setSort] = useState("name");

  const list = useMemo(() => {
    const l = GAMES.filter((g) => (cat === "all" || g.category === cat) && (!onlyFav || favorites.includes(g.id)) && (g.name + g.tagline).toLowerCase().includes(q.trim().toLowerCase()));
    return l.slice().sort((a, b) => (sort === "played" ? (plays[b.id]?.played || 0) - (plays[a.id]?.played || 0) : a.name.localeCompare(b.name, "tr")));
  }, [q, cat, onlyFav, sort, favorites, plays]);
  const recents = recent.map((r) => getGame(r.id)).filter(Boolean);
  const chip = (on, color = "#f59e0b") => (on
    ? { background: `linear-gradient(180deg, ${color}, ${shade(color, 0.7)})`, color: inkOn(color), boxShadow: `0 3px 0 ${shade(color, 0.45)}, inset 0 1px 0 rgba(255,255,255,.4)` }
    : { background: "rgba(255,255,255,.08)", color: "#d4d8e6", boxShadow: "0 3px 0 rgba(0,0,0,.25)" });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-white" style={{ textShadow: "0 3px 0 rgba(0,0,0,.4)" }}>🎮 Oyun Mağazası</h1>
          <p className="mt-0.5 text-sm font-semibold text-white/60">Arkadaşlarınla ya da botlara karşı oyna — hepsi sesli sohbetin içinde.</p>
        </div>
        <Pill color="#6366f1" className="shrink-0">{GAMES.length} oyun</Pill>
      </div>
      {recents.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white/70"><Clock size={12} />Son oynadıkların</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {recents.map((g) => (
              <button key={g.id} type="button" onClick={() => go("detail", g.id)} className="flex shrink-0 items-center gap-2.5 rounded-2xl bg-[#171a2e] py-2 pl-2 pr-4 transition hover:-translate-y-0.5 hover:brightness-110" style={{ border: `2px solid ${g.accent}`, boxShadow: `0 4px 0 ${shade(g.accent || "#6366f1", 0.5)}` }}>
                <span className="aspect-video w-16 shrink-0 overflow-hidden rounded-lg border-2 border-white/20"><Cover g={g} /></span><span className="text-sm font-extrabold text-white">{g.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[190px] max-w-xs flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Oyun ara" aria-label="Oyun ara" className="w-full rounded-2xl border-2 border-white/15 bg-black/35 py-2 pl-9 pr-3 text-sm font-semibold text-white outline-none placeholder:text-white/40 focus:border-amber-400" />
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Kategoriler">
          {[["all", "Tümü"], ...Object.entries(CATEGORIES)].map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={cat === k} onClick={() => setCat(k)} className="rounded-full px-3.5 py-1.5 text-xs font-black transition active:translate-y-[2px]" style={chip(cat === k)}>{label}</button>
          ))}
        </div>
        <button type="button" aria-pressed={onlyFav} onClick={() => setOnlyFav((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-black transition active:translate-y-[2px]" style={chip(onlyFav, "#fbbf24")}><Star size={12} className={onlyFav ? "fill-current" : ""} />Favoriler</button>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sırala" className="ml-auto rounded-full border-2 border-white/15 bg-black/35 px-3 py-1.5 text-xs font-bold text-white">
          <option value="name">A–Z</option><option value="played">En çok oynadıklarım</option>
        </select>
      </div>
      {list.length === 0 ? (
        <div className="rounded-3xl border-[3px] border-dashed border-white/15 p-10 text-center">
          <Gamepad2 size={28} className="mx-auto mb-2 text-white/40" />
          <div className="text-base font-black text-white">{onlyFav ? "Henüz favorin yok" : "Aramayla eşleşen oyun yok"}</div>
          <p className="mt-1 text-sm font-semibold text-white/60">{onlyFav ? "Bir oyunun yıldızına dokun." : "Filtreleri temizle."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-5 pb-2">{list.map((g) => <GameCard key={g.id} g={g} onOpen={(id) => go("detail", id)} />)}</div>
      )}
    </div>
  );
}

// ───────────────────────────── Detay ─────────────────────────────
function DetailScreen({ id }) {
  const g = getGame(id);
  const go = useGamesStore((s) => s.go);
  const session = useGamesStore((s) => s.session);
  const fav = useGamesLibrary((s) => s.favorites.includes(id));
  const toggleFav = useGamesLibrary((s) => s.toggleFav);
  const st = useGamesStats((s) => s.byGame[id]);
  const [busy, setBusy] = useState(false);
  if (!g) return <div className="p-8 font-semibold text-white/60">Oyun bulunamadı.</div>;
  const c = g.accent || "#6366f1";
  const act = async (solo) => {
    setBusy(true);
    await gamesActions.create(id, { solo });
    setBusy(false);
  };
  const stat = [["Maç", st?.played || 0], ["Galibiyet", st?.wins || 0], ["Seri", st?.streak || 0], ["En iyi seri", st?.best || 0]];
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 sm:p-6">
      <ArcadeBtn tone="ghost" xs onClick={() => go("store")} className="self-start"><ArrowLeft size={13} className="mr-1 inline -mt-0.5" />Mağaza</ArcadeBtn>
      <div className="relative aspect-[21/9] max-h-80 w-full overflow-hidden rounded-3xl" style={{ border: `4px solid ${c}`, boxShadow: `0 8px 0 ${shade(c, 0.5)}, 0 20px 36px rgba(0,0,0,.45)` }}>
        <Cover g={g} />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap gap-1.5"><Pill color={c} className="uppercase tracking-wide">{CATEGORIES[g.category]}</Pill><Pill color="#334155" className="!text-white"><Users size={12} />{playersLabel(g)}</Pill>{g.bots && <Pill color="#334155" className="!text-white"><Bot size={12} />Botlu</Pill>}</div>
            <h1 className="truncate text-3xl font-black text-white sm:text-4xl" style={{ textShadow: "0 3px 0 rgba(0,0,0,.5)" }}>{g.name}</h1>
          </div>
          <button type="button" onClick={() => toggleFav(id)} aria-pressed={fav} aria-label={fav ? "Favorilerden çıkar" : "Favorilere ekle"} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-white/30 bg-black/55 text-white/85 transition hover:scale-110 hover:text-amber-300"><Star size={20} className={fav ? "fill-amber-300 text-amber-300" : ""} /></button>
        </div>
      </div>
      <Panel accent={c}>
        <p className="text-base font-semibold leading-snug text-white/85">{g.tagline}</p>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {stat.map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-black/30 px-3 py-2 text-center">
              <div className="text-2xl font-black tabular-nums text-white">{v}</div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/55">{k}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {g.solo ? (
            <ArcadeBtn tone="good" big onClick={() => go("solo", id)}><Play size={20} className="mr-2 inline -mt-1 fill-current" />Oyna</ArcadeBtn>
          ) : session ? (
            <ArcadeBtn tone="roll" big onClick={() => go("room")}>Odadaki oyuna dön</ArcadeBtn>
          ) : (
            <>
              {g.bots && <ArcadeBtn tone="good" big disabled={busy} onClick={() => act(true)}><Bot size={20} className="mr-2 inline -mt-1" />Botlara karşı oyna</ArcadeBtn>}
              <ArcadeBtn tone={g.bots ? "end" : "good"} big={!g.bots} disabled={busy} onClick={() => act(false)}><Users size={g.bots ? 15 : 20} className="mr-2 inline -mt-1" />Lobi aç, arkadaşlarını davet et</ArcadeBtn>
            </>
          )}
        </div>
        {!g.solo && session && <p className="mt-3 rounded-xl bg-amber-400/15 px-3 py-2 text-xs font-bold text-amber-300">Bu odada zaten bir oyun oturumu var. Önce ondan çık ya da ona katıl.</p>}
      </Panel>
      <Panel title="Hakkında" icon={<Info size={13} />} accent={c}><p className="text-sm font-medium leading-relaxed text-white/80">{g.description}</p></Panel>
      <div className="grid gap-5 sm:grid-cols-2">
        <Panel title="Nasıl oynanır" accent={c}>
          <ol className="space-y-2 text-sm font-medium text-white/80">{g.howTo.map((h, i) => <li key={h} className="flex gap-2.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black" style={{ background: c, color: inkOn(c) }}>{i + 1}</span>{h}</li>)}</ol>
        </Panel>
        <Panel title="Kontroller" accent={c}>
          <ul className="space-y-2 text-sm font-medium text-white/80">{g.controls.map((k) => <li key={k} className="flex gap-2"><span style={{ color: c }}>▸</span>{k}</li>)}</ul>
        </Panel>
      </div>
      {g.config.length > 0 && <Panel title="Ayarlanabilir kurallar" accent={c}>
        <div className="flex flex-wrap gap-2">{g.config.map((k) => <span key={k.key} className="rounded-full border-2 border-white/10 bg-black/30 px-3 py-1 text-xs font-bold text-white/75">{k.label}</span>)}</div>
      </Panel>}
    </div>
  );
}

// ───────────────────────────── Lobi ─────────────────────────────
const field = "bg-[#1e1f22] border border-white/10 focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1]/40 outline-none rounded-xl px-2.5 py-1.5 text-sm text-white disabled:opacity-60";

function ConfigField({ c, value, disabled, onChange }) {
  if (c.type === "toggle")
    return (
      <label className="flex items-center justify-between gap-3 text-sm text-[#dbdee1]">
        <span>{c.label}</span>
        <input type="checkbox" disabled={disabled} checked={!!value} onChange={(e) => onChange(e.target.checked)} className="accent-[#6366f1] w-4 h-4" />
      </label>
    );
  if (c.type === "text")
    return (
      <label className="flex items-center justify-between gap-3 text-sm text-[#dbdee1]">
        <span className="shrink-0">{c.label}</span>
        <input disabled={disabled} maxLength={c.max} value={value} onChange={(e) => onChange(e.target.value)} className={`${field} w-40`} />
      </label>
    );
  if (c.type === "area")
    return (
      <label className="flex flex-col gap-1.5 text-sm text-[#dbdee1]">
        <span>{c.label}</span>
        <textarea disabled={disabled} maxLength={c.max} rows={5} value={value} onChange={(e) => onChange(e.target.value)} placeholder={c.hint} className={`${field} font-mono text-xs resize-y`} />
        <span className="text-[11px] text-[#6b7280]">{c.hint} · {String(value).length}/{c.max}</span>
      </label>
    );
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-[#dbdee1]">
      <span>{c.label}</span>
      <select disabled={disabled} value={value} onChange={(e) => onChange(typeof c.options[0] === "number" ? Number(e.target.value) : e.target.value)} className={field}>
        {c.options.map((o) => <option key={o} value={o}>{c.labels?.[o] || o}</option>)}
      </select>
    </label>
  );
}

function Config({ g, session, isHost }) {
  const [draft, setDraft] = useState(session.config);
  useEffect(() => setDraft(session.config), [session.config]);
  const groups = [...new Set(g.config.map((c) => c.group || "Ayarlar"))];
  // Metin alanları yazarken değil, alandan çıkınca gönderilir (ağı yormaz)
  const send = (cfg) => isHost && gamesActions.cmd({ k: "cfg", cfg });
  return (
    <div className="flex flex-col gap-3">
      {groups.map((gr) => (
        <Panel key={gr} title={gr}>
          <div className="flex flex-col gap-2.5" onBlur={(e) => e.target.tagName !== "SELECT" && send(draft)}>
            {g.config.filter((c) => (c.group || "Ayarlar") === gr).map((c) => (
              <ConfigField key={c.key} c={c} value={draft[c.key]} disabled={!isHost}
                onChange={(v) => { const n = { ...draft, [c.key]: v }; setDraft(n); if (c.type !== "text" && c.type !== "area") send(n); }} />
            ))}
          </div>
        </Panel>
      ))}
      {!isHost && <p className="text-[11px] text-[#6b7280]">Kuralları yalnızca lobiyi açan kişi değiştirebilir.</p>}
    </div>
  );
}

function InvitePanel({ session, myId }) {
  const remotes = useRemoteParticipants();
  const inLobby = new Set(session.players.map((p) => p.id));
  const invited = new Set(session.invited || []);
  const list = remotes.filter((p) => p.identity !== myId);
  return (
    <Panel title="Davet" icon={<UserPlus size={12} />}>
      <div className="flex gap-1.5 mb-3" role="radiogroup" aria-label="Lobi erişimi">
        {[["open", "Herkese açık", Globe], ["invite", "Sadece davetli", Lock]].map(([k, label, I]) => (
          <button key={k} type="button" role="radio" aria-checked={session.access === k} onClick={() => gamesActions.cmd({ k: "access", v: k })}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition ${session.access === k ? "gradient-primary text-white" : "bg-white/5 text-[#b5bac1] hover:bg-white/10"}`}><I size={13} />{label}</button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-[#949ba4]">Odada başka kimse yok. Birisi odaya katılınca burada görünür.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {list.map((p) => (
            <li key={p.identity} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
              <Chip name={p.name || p.identity} accent="#4b5563" />
              {inLobby.has(p.identity) ? <span className="ml-auto text-xs text-[#23a559] inline-flex items-center gap-1"><Check size={12} />Lobide</span>
                : invited.has(p.identity) ? <span className="ml-auto text-xs text-[#949ba4]">Davet edildi</span>
                : <Btn tone="ghost" className="ml-auto !py-1 !px-2.5 text-xs" onClick={() => gamesActions.cmd({ k: "invite", ids: [p.identity] })}>Davet et</Btn>}
            </li>
          ))}
        </ul>
      )}
      {list.length > 1 && <Btn tone="ghost" className="w-full mt-2 !py-1.5 text-xs" onClick={() => gamesActions.cmd({ k: "invite", ids: list.filter((p) => !inLobby.has(p.identity)).map((p) => p.identity) })}>Herkesi davet et</Btn>}
    </Panel>
  );
}

/** Sıradaki boş piyon (botun piyonunu döndürmek için) */
const nextFreeToken = (players, from) => {
  const used = new Set(players.map((p) => p.token));
  for (let k = 1; k <= TOKENS.length; k++) {
    const t = (from + k) % TOKENS.length;
    if (!used.has(t)) return t;
  }
  return from;
};

/** Piyon seçimi: dolu olanlar kilitli ve sahibinin adını gösterir; son seçim bu cihazda hatırlanır */
function TokenPicker({ session, myId }) {
  const players = session.players;
  const me = players.find((p) => p.id === myId);
  const pref = useGamesPrefs((s) => s.emlak?.token ?? 0);
  const setPref = useGamesPrefs((s) => s.setPref);
  const synced = useRef(false);
  useEffect(() => {
    if (!me || synced.current) return;
    synced.current = true; // katılınca bir kez: kayıtlı piyonu boşsa iste
    if (me.token !== pref && !players.some((p) => p.token === pref && p.id !== myId)) gamesActions.cmd({ k: "token", v: pref });
  }, [me?.id]); // eslint-disable-line
  if (!me) return null;
  return (
    <Panel title="Piyonun">
      <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Piyon seç">
        {TOKENS.map((t) => {
          const owner = players.find((p) => p.token === t.id && p.id !== myId);
          const sel = me.token === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={sel}
              disabled={!!owner}
              title={owner ? `${t.label} — ${owner.name} seçti` : t.label}
              onClick={() => (gamesActions.cmd({ k: "token", v: t.id }), setPref("emlak", "token", t.id))}
              className={`rounded-xl border-2 py-2 flex flex-col items-center gap-0.5 transition ${sel ? "border-indigo-400 bg-indigo-500/15 scale-[1.03]" : "border-white/10 bg-[#1e1f22] enabled:hover:border-white/30"} disabled:opacity-35 disabled:cursor-not-allowed`}
            >
              <span className="text-2xl leading-none">{t.icon}</span>
              <span className="text-[10px] text-[#b5bac1] truncate max-w-full px-1">{owner ? owner.name : t.label}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function Lobby({ session, g, myId, isHost, isMember }) {
  const players = session.players;
  const me = players.find((p) => p.id === myId);
  const notReady = players.filter((p) => !p.ready).map((p) => p.name);
  const startErr = (() => {
    if (!g.fillBots && players.length < g.players.min) return `${g.players.min - players.length} oyuncu daha gerekli`;
    if (g.teams && !(players.some((p) => p.team === 0) && players.some((p) => p.team === 1))) return "Her takımda en az bir oyuncu olmalı";
    if (notReady.length) return `Hazır değil: ${notReady.join(", ")}`;
    return "";
  })();
  // Çok koltuklu oyunlarda yalnızca ilk boş koltuk gösterilir (liste uzamasın)
  const slots = g.players.max > 4 ? [...players, ...(players.length < g.players.max ? [null] : [])] : Array.from({ length: g.players.max }, (_, i) => players[i] || null);
  const cfg = session.config;

  return (
    <div className="max-w-5xl mx-auto w-full p-4 sm:p-6 grid gap-4 lg:grid-cols-[1fr_380px] items-start">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Tile g={g} size="lg" />
          <div><div className="text-xs text-[#949ba4]">Lobi · {session.access === "invite" ? "sadece davetli" : "herkese açık"}</div><h1 className="text-2xl font-bold text-white">{g.name}</h1></div>
        </div>
        <Panel title={`Oyuncular (${players.length}/${g.players.max})`}>
          <ul className="flex flex-col gap-1.5">
            {slots.map((p, i) => (
              <li key={i} className="flex items-center gap-3 rounded-lg bg-[#1e1f22] border border-white/5 px-3 py-2.5 min-h-[46px]">
                {p ? (
                  <>
                    <Chip name={p.name} host={p.id === session.hostId} bot={p.bot} you={p.id === myId} accent="#4b5563" />
                    {g.tokens && p.token != null && (p.bot && isHost
                      ? <button type="button" title={`${TOKENS[p.token]?.label} — değiştirmek için tıkla`} onClick={() => gamesActions.cmd({ k: "token", id: p.id, v: nextFreeToken(session.players, p.token) })} className="text-lg leading-none px-1 rounded hover:bg-white/10">{TOKENS[p.token]?.icon}</button>
                      : <span className="text-lg leading-none" title={TOKENS[p.token]?.label}>{TOKENS[p.token]?.icon}</span>)}
                    {!p.bot && p.id !== session.hostId && <span className={`text-[11px] font-semibold ${p.ready ? "text-[#23a559]" : "text-[#6b7280]"}`}>{p.ready ? "Hazır" : "Bekleniyor"}</span>}
                    {g.teams && (
                      <div className="ml-auto flex gap-1">
                        {[0, 1].map((t) => (
                          <button key={t} type="button" disabled={!(isHost || p.id === myId)} onClick={() => gamesActions.cmd({ k: "team", team: t, id: p.id })} aria-pressed={p.team === t}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition disabled:cursor-default text-white"
                            style={p.team === t ? { background: cfg[`color${t}`] ? ({ red: "#ef4444", blue: "#6366f1", green: "#23a559", amber: "#faa61a", pink: "#ec4899", teal: "#14b8a6" })[cfg[`color${t}`]] : "#6366f1" } : { background: "rgba(255,255,255,.05)", color: "#6b7280" }}>
                            {cfg[`name${t}`] || `Takım ${t + 1}`}
                          </button>
                        ))}
                      </div>
                    )}
                    {isHost && p.id !== myId && (
                      <button type="button" className={`${g.teams ? "" : "ml-auto"} p-1.5 rounded-md text-[#6b7280] hover:text-[#da373c] hover:bg-white/5 transition`} aria-label={`${p.name} oyuncusunu çıkar`} onClick={() => gamesActions.cmd({ k: p.bot ? "rmbot" : "kick", id: p.id })}><UserMinus size={14} /></button>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-sm text-[#6b7280]">{g.fillBots ? "Boş koltuk — başlayınca bot oturur" : g.players.max > 4 ? `Boş koltuk (${g.players.max - players.length} tane daha)` : "Boş koltuk"}</span>
                    {isHost && g.bots && <Btn tone="ghost" className="ml-auto !py-1 !px-2.5 text-xs" onClick={() => gamesActions.cmd({ k: "bot" })}><Plus size={12} className="inline -mt-0.5 mr-1" />Bot ekle</Btn>}
                  </>
                )}
              </li>
            ))}
          </ul>
          {session.watchers > 0 && <p className="text-[11px] text-[#6b7280] mt-2">{session.watchers} izleyici</p>}
        </Panel>
        {g.tokens && isMember && <TokenPicker session={session} myId={myId} />}
        {isHost && <InvitePanel session={session} myId={myId} />}
        <div className="flex flex-wrap items-center gap-2">
          {isHost ? (
            <>
              <Btn disabled={!!startErr} onClick={() => gamesActions.cmd({ k: "start" })} className="px-6"><Play size={14} className="inline -mt-0.5 mr-1.5" />Başlat</Btn>
              {startErr && <span className="text-xs text-[#faa61a]">{startErr}</span>}
            </>
          ) : isMember ? (
            <Btn tone={me?.ready ? "good" : "primary"} onClick={() => gamesActions.cmd({ k: "ready", v: !me?.ready })} className="px-6">{me?.ready ? <><Check size={14} className="inline -mt-0.5 mr-1.5" />Hazırsın</> : "Hazırım"}</Btn>
          ) : (
            <Btn onClick={() => gamesActions.join()} className="px-6"><Users size={14} className="inline -mt-0.5 mr-1.5" />{session.access === "invite" ? "İzleyici olarak gir" : "Lobiye katıl"}</Btn>
          )}
          <Btn tone="ghost" onClick={() => gamesActions.leave()}><LogOut size={14} className="inline -mt-0.5 mr-1.5" />{isHost ? "Oturumu kapat" : "Ayrıl"}</Btn>
        </div>
      </div>
      <Config g={g} session={session} isHost={isHost} />
    </div>
  );
}

// ───────────────────────────── Tepkiler ─────────────────────────────
function Reactions() {
  const list = useGamesStore((s) => s.reactions);
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="absolute left-3 bottom-3 z-30 flex flex-col gap-1 pointer-events-none" aria-live="polite">
        {list.map((r) => (
          <div key={r.id} className="flex items-center gap-2 rounded-xl bg-[#1e1f22]/95 border border-white/10 px-2.5 py-1 animate-[gmPop_.2s_ease-out]"><span className="text-lg leading-none">{r.e}</span><span className="text-xs text-[#b5bac1]">{r.name}</span></div>
        ))}
      </div>
      <div className="absolute right-3 bottom-3 z-30 flex items-center gap-1">
        {open && <div className="flex gap-0.5 rounded-lg bg-[#1e1f22] border border-white/10 p-1">{REACTIONS.map((e) => <button key={e} type="button" onClick={() => (gamesActions.cmd({ k: "react", e }), setOpen(false))} className="w-8 h-8 rounded-md hover:bg-white/10 text-base" aria-label={`Tepki: ${e}`}>{e}</button>)}</div>}
        <button type="button" onClick={() => setOpen((v) => !v)} className="w-9 h-9 rounded-lg bg-[#1e1f22] border border-white/10 text-[#b5bac1] hover:text-white flex items-center justify-center" aria-label="Tepki gönder" aria-expanded={open}><Smile size={17} /></button>
      </div>
    </>
  );
}

// ───────────────────────────── Oda ─────────────────────────────
const AVATAR_COLORS = ["#6366f1", "#ec4899", "#22c55e", "#f59e0b", "#06b6d4", "#a855f7", "#ef4444", "#14b8a6"];
const avatarColor = (name) => AVATAR_COLORS[[...String(name || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

/** Oyun odası üst çubuğu: oyun karesi + oyuncu avatarları + bağlantı durumu + düğmeler (Netrex koyu cam stili) */
export function RoomBar({ g, session, myId, conn, fs, onFs, onAppearance, onLeave }) {
  const players = session.players;
  const names = players.slice(0, 4).map((p) => p.name).join(" · ");
  const ok = conn === "ok";
  const iconBtn = "w-9 h-9 rounded-xl border border-white/10 bg-white/[0.04] text-[#c4c9d4] hover:bg-white/10 hover:text-white hover:border-white/20 transition flex items-center justify-center";
  return (
    <div className="relative">
      <div className="flex h-[52px] items-center gap-3 bg-[#0f1115]/90 px-4 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `linear-gradient(135deg, ${g.accent}38, ${g.accent}10)`, border: `1px solid ${g.accent}66`, boxShadow: `0 0 18px ${g.accent}22` }}>
            <GameIcon g={g} size={18} />
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[15px] font-extrabold tracking-tight text-white">{g.name}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8b93a3]">{players.length} oyuncu{session.round > 1 ? ` · ${session.round}. maç` : ""}</div>
          </div>
        </div>

        <div className="ml-1 hidden items-center gap-2.5 border-l border-white/10 pl-3.5 md:flex">
          <div className="flex -space-x-2">
            {players.slice(0, 6).map((p) => (
              <span key={p.id} title={`${p.name}${p.id === session.hostId ? " · host" : ""}${p.bot ? " · bot" : ""}${p.id === myId ? " (sen)" : ""}`} className={`relative flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-black text-white ring-2 ${p.id === myId ? "ring-indigo-400" : "ring-[#0f1115]"}`} style={{ background: avatarColor(p.name) }}>
                {(p.name || "?").trim().charAt(0).toUpperCase()}
                {p.id === session.hostId && <Crown size={11} className="absolute -right-1 -top-1.5 text-amber-300 drop-shadow" aria-label="Host" />}
                {p.bot && <Bot size={11} className="absolute -bottom-1 -right-1 rounded-full bg-[#0f1115] p-[1px] text-[#9aa3b5]" aria-label="Bot" />}
              </span>
            ))}
            {players.length > 6 && <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#2b2f3a] text-[11px] font-bold text-[#c4c9d4] ring-2 ring-[#0f1115]">+{players.length - 6}</span>}
          </div>
          <span className="hidden max-w-[220px] truncate text-[11px] font-medium text-[#8b93a3] lg:block">{names}{players.length > 4 ? "…" : ""}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold ${ok ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-amber-400/30 bg-amber-400/10 text-amber-300"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : "animate-pulse bg-amber-400"}`} />
            {ok ? "Bağlı" : "Yeniden bağlanıyor"}
          </span>
          <button type="button" onClick={onFs} className={iconBtn} aria-label={fs ? "Tam ekrandan çık" : "Tam ekran"} title={fs ? "Tam ekrandan çık (F / Esc)" : "Tam ekran (F)"}>{fs ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
          <button type="button" onClick={onAppearance} className={iconBtn} aria-label="Görünüm ve ses" title="Görünüm ve ses"><Palette size={16} /></button>
          <button type="button" onClick={onLeave} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 text-xs font-bold text-rose-300 transition hover:bg-rose-500/20 hover:text-rose-200">
            <LogOut size={14} />Çık
          </button>
        </div>
      </div>
      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${g.accent}, transparent)` }} />
    </div>
  );
}

function Room({ myId, onAppearance }) {
  const session = useGamesStore((s) => s.session);
  const view = useGamesStore((s) => s.view);
  const conn = useGamesStore((s) => s.conn);
  const go = useGamesStore((s) => s.go);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const rootRef = useRef(null);
  const [fs, setFs] = useState(false);
  const [barShown, setBarShown] = useState(true);
  const barHover = useRef(false);
  const barSched = useRef(null);
  const g = session ? getGame(session.gameId) : null;
  useEffect(() => { if (!session) go("store"); }, [session, go]);
  // Tam ekran: oyun odası (başlık + oyun) ekranı kaplar; Esc ya da düğmeyle çıkılır, F kısayolu
  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  };
  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement && document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key !== "f" && e.key !== "F") || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      toggleFs();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line
  useEffect(() => () => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); }, []);
  // Tam ekranda çubuk oyunun üstünde yüzer (oyun alanı değişmez); fare üst kenara gelince ya da tuşa basınca görünür, bir süre sonra gizlenir
  useEffect(() => {
    if (!fs) { setBarShown(true); return; }
    let timer;
    const sched = (ms = 350) => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (!barHover.current) setBarShown(false); }, ms);
    };
    barSched.current = sched;
    const show = (ms = 1200) => { setBarShown(true); sched(ms); };
    // fare üst kenardaysa görünür; uzaklaşır uzaklaşmaz (≈0,3 sn) gizlenir
    const onMove = (e) => { if (e.clientY < 72) show(600); else if (!barHover.current) sched(250); };
    const onKey = () => show();
    const onTouch = () => show();
    show(1400);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouch, { passive: true });
    return () => {
      clearTimeout(timer);
      barSched.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouch);
    };
  }, [fs]);
  if (!session || !g) return null;
  const isHost = session.hostId === myId;
  const isMember = session.players.some((p) => p.id === myId);
  if (session.status === "lobby") return <Lobby session={session} g={g} myId={myId} isHost={isHost} isMember={isMember} />;

  const View = viewFor(g);
  const send = (m, reliable = true) => gamesActions.input(m, reliable);
  const rematch = () => { gamesActions.cmd({ k: "lobby" }); setTimeout(() => gamesActions.cmd({ k: "start" }), 30); };

  return (
    <div ref={rootRef} className={`flex-1 min-h-0 flex flex-col ${fs ? "bg-[#0b0b0e]" : ""}`}>
      <div
        className={fs ? `absolute inset-x-0 top-0 z-40 shadow-[0_12px_30px_rgba(0,0,0,.5)] transition-transform duration-300 ${barShown || conn !== "ok" ? "translate-y-0" : "-translate-y-full"}` : "relative z-10 shrink-0"}
        onMouseEnter={() => { barHover.current = true; }}
        onMouseLeave={() => { barHover.current = false; barSched.current?.(300); }}
      >
        <RoomBar g={g} session={session} myId={myId} conn={conn} fs={fs} onFs={toggleFs} onAppearance={onAppearance} onLeave={() => setConfirmLeave(true)} />
      </div>
      {fs && !barShown && conn === "ok" && <div className="pointer-events-none absolute left-1/2 top-0 z-40 h-1.5 w-24 -translate-x-1/2 rounded-b-full bg-white/25" aria-hidden />}
      <div className="flex-1 min-h-0 relative">
        {view ? (
          <Suspense fallback={<Loading text={`${g.name} yükleniyor`} />}>
            <View view={view} session={session} myId={myId} send={send} isHost={isHost} onRematch={rematch} onLobby={() => gamesActions.cmd({ k: "lobby" })} onLeave={() => gamesActions.leave()} />
          </Suspense>
        ) : <Loading text="Oyun durumu bekleniyor" />}
        {conn !== "ok" && <div className="absolute inset-x-0 top-0 bg-[#faa61a] text-black text-xs font-bold text-center py-1.5 z-30">Bağlantı kesildi — yeniden bağlanıyor</div>}
        <Reactions />
      </div>
      {confirmLeave && (
        <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" role="alertdialog" aria-label="Oyundan çık">
          <div className="max-w-sm w-full rounded-2xl glass-modal shadow-soft-lg p-5 text-center">
            <div className="text-base font-bold text-white mb-1">Oyundan çıkılsın mı?</div>
            <p className="text-sm text-[#949ba4] mb-4">{isHost ? "Oturumu sen açtığın için kapanır ve herkes atılır." : "Oyun sensiz devam eder."}</p>
            <div className="flex gap-2 justify-center"><Btn tone="ghost" onClick={() => setConfirmLeave(false)}>Vazgeç</Btn><Btn tone="danger" onClick={() => { setConfirmLeave(false); gamesActions.leave(); }}>Çık</Btn></div>
          </div>
        </div>
      )}
    </div>
  );
}

const Loading = ({ text }) => <div className="absolute inset-0 flex items-center justify-center text-[#949ba4] text-sm gap-2"><Gamepad2 size={16} className="animate-pulse" />{text}…</div>;

function useMyId() {
  const { localParticipant } = useLocalParticipant();
  return localParticipant?.identity;
}

// ───────────────────────────── Kabuk ─────────────────────────────
export default function GamesHub() {
  const { screen, detailId, session, go } = useGamesStore();
  const setOpen = useGamesStore((s) => s.setOpen);
  const myId = useMyId();
  const [showLook, setShowLook] = useState(false);
  const sg = session ? getGame(session.gameId) : null;

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !e.defaultPrevented && !session && !showLook && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session, showLook, setOpen]);
  useEffect(() => { if (session && screen === "store") go("room"); }, []); // eslint-disable-line

  const tab = (id, label) => {
    const on = screen === id || (id === "store" && (screen === "detail" || screen === "solo"));
    return (
      <button type="button" onClick={() => go(id)} aria-current={on ? "page" : undefined}
        className="rounded-full px-4 py-1.5 text-sm font-black transition active:translate-y-[2px] hover:brightness-110"
        style={on ? { background: "linear-gradient(180deg,#ffc04d,#f97316)", color: "#fff", textShadow: "0 1px 0 rgba(0,0,0,.3)", boxShadow: "0 3px 0 #b45309, inset 0 1px 0 rgba(255,255,255,.45)" } : { background: "rgba(255,255,255,.08)", color: "#d4d8e6", boxShadow: "0 3px 0 rgba(0,0,0,.25)" }}>{label}</button>
    );
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col" style={{ background: "linear-gradient(180deg, #1b1040, #2a1a60 60%, #1d1248)" }} role="dialog" aria-label="Netrex Games">
      <header className="flex h-16 shrink-0 items-center gap-2.5 border-b-[3px] border-black/40 px-4" style={{ background: "linear-gradient(180deg, #3b2a85, #2a1d63)", boxShadow: "0 4px 14px rgba(0,0,0,.35)" }}>
        <span className="mr-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-b from-indigo-400 to-indigo-700 shadow-[0_3px_0_#1e1b4b,inset_0_1px_0_rgba(255,255,255,.4)]"><Gamepad2 size={20} className="text-white" /></span>
        <span className="mr-3 hidden text-lg font-black tracking-wide text-white sm:inline" style={{ textShadow: "0 2px 0 rgba(0,0,0,.4)" }}>OYUNLAR</span>
        {tab("store", "Mağaza")}
        {tab("profile", "Profilim")}
        {session && sg && <button type="button" onClick={() => go("room")} className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-black transition active:translate-y-[2px] hover:brightness-110" style={screen === "room" ? { background: "linear-gradient(180deg,#5eea8f,#16a34a)", color: "#fff", boxShadow: "0 3px 0 #166534, inset 0 1px 0 rgba(255,255,255,.45)" } : { background: "rgba(34,197,94,.18)", color: "#86efac", boxShadow: "0 3px 0 rgba(0,0,0,.25)" }}><span className="h-2 w-2 animate-pulse rounded-full bg-current" />{sg.name}</button>}
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => setShowLook(true)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/85 shadow-[0_3px_0_rgba(0,0,0,.25)] transition hover:bg-white/20 active:translate-y-[2px]" aria-label="Görünüm ve ses" title="Görünüm ve ses"><Palette size={16} /></button>
          <button type="button" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/80 text-white shadow-[0_3px_0_#7f1d1d] transition hover:bg-red-500 active:translate-y-[2px]" aria-label="Paneli kapat (oyun arka planda sürer)" title="Kapat — oyun arka planda sürer"><X size={16} /></button>
        </div>
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        {screen === "store" && <StoreScreen />}
        {screen === "detail" && <DetailScreen id={detailId} />}
        {screen === "profile" && <Profile />}
        {screen === "room" && <Room myId={myId} onAppearance={() => setShowLook(true)} />}
        {screen === "solo" && <SoloRoom id={detailId} onLeave={() => go("store")} />}
      </main>
      {showLook && <Appearance onClose={() => setShowLook(false)} />}
    </div>
  );
}
