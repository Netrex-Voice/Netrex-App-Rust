"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Flag, Handshake, RotateCcw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Repeat, Swords, Trophy, Clock, Infinity as InfIcon } from "lucide-react";
import { useChessStore } from "../chessStore";
import { useGamesStats } from "../store";
import { legalMoves, inCheck, mFrom, mTo, mPromo, moveUci, WHITE, BLACK } from "../engines/chess/core";
import { build, captured, flagResult, scoreFor, timeText, REASON_TEXT, TIME_CONTROLS } from "../engines/chess/game";
import { BOTS, getBot, suggestedBot } from "../engines/chess/bots";
import { CATEGORY_LABEL, categoryOf, expectedScore, leagueOf, START_RATINGS } from "../engines/chess/rating";
import { think } from "../engines/chess/botClient";
import Board, { BOARD_THEMES, Piece } from "../chess/Board";
import { beep } from "../ui";

const GREEN = "#81b64c";
const card = "rounded-2xl border border-white/10 bg-[#1b1d22]/90";
const sfx = {
  move: () => beep(300, 0.05, "triangle", 0.07),
  capture: () => beep(190, 0.09, "sawtooth", 0.06),
  check: () => (beep(520, 0.08, "square", 0.05), setTimeout(() => beep(420, 0.1, "square", 0.05), 90)),
  end: (win) => (win ? [523, 659, 784] : [392, 330, 262]).forEach((f, i) => setTimeout(() => beep(f, 0.18, "triangle", 0.07), i * 140)),
};

export default function ChessView({ onLeave }) {
  const ratings = useChessStore((s) => s.ratings);
  const game = useChessStore((s) => s.game);
  if (!ratings) return <Placement />;
  if (!game) return <Lobby />;
  return <GameScreen key={game.id} onLeave={onLeave} />;
}

// ───────────────────────────── Seviye belirleme ─────────────────────────────
function Placement() {
  const place = useChessStore((s) => s.place);
  const opts = [["beginner", "Yeni başlıyorum", "Taşların hareketini öğreniyorum"], ["intermediate", "Orta seviye", "Kuralları ve temel taktikleri biliyorum"], ["advanced", "İleri", "Düzenli oynuyorum, açılış bilgim var"], ["expert", "Uzman", "Turnuva tecrübem var"]];
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-6">
      <h1 className="text-3xl font-black text-white">♟️ Satranç seviyeni seç</h1>
      <p className="text-sm font-medium text-white/70">Başlangıç puanını belirler. Bullet, Blitz ve Rapid için ayrı puan tutulur; ilk 30 maçta puan daha hızlı oynar, sonra seviyene oturur.</p>
      {opts.map(([k, t, d]) => (
        <button key={k} type="button" onClick={() => place(k)} className={`${card} flex items-center justify-between p-4 text-left transition hover:-translate-y-0.5 hover:border-[#81b64c]/60`}>
          <span><span className="block text-lg font-extrabold text-white">{t}</span><span className="text-sm text-white/60">{d}</span></span>
          <span className="rounded-full bg-[#81b64c]/20 px-3 py-1 text-sm font-black text-[#bef264]">{START_RATINGS[k]}</span>
        </button>
      ))}
    </div>
  );
}

// ───────────────────────────── Lobi ─────────────────────────────
function Spark({ data, color }) {
  if (data.length < 2) return <div className="h-10" />;
  const min = Math.min(...data), max = Math.max(...data), span = Math.max(1, max - min);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${36 - ((v - min) / span) * 32}`).join(" ");
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-10 w-full" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function RatingCard({ cat, data, active, onPick }) {
  const lg = leagueOf(data.r);
  return (
    <button type="button" onClick={onPick} aria-pressed={active} className={`${card} p-4 text-left transition ${active ? "ring-2 ring-[#81b64c]" : "hover:border-white/25"}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-black uppercase tracking-wider text-white/60">{CATEGORY_LABEL[cat]}</span>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: lg.color + "33", color: lg.color }}>{lg.name}</span>
      </div>
      <div className="mt-1 text-4xl font-black tabular-nums text-white">{data.r}</div>
      <Spark data={data.hist} color={lg.color} />
      <div className="mt-1 flex justify-between text-[11px] font-bold text-white/55">
        <span>{data.w}G · {data.d}B · {data.l}M</span><span>En yüksek {data.peak}</span>
      </div>
      {data.games < 30 && <div className="mt-1 text-[10px] font-bold text-amber-300">Yerleşme: {data.games}/30 maç (puan hızlı değişir)</div>}
    </button>
  );
}

function Lobby() {
  const { ratings, prefs, history, beaten, setPref, start, resetAll } = useChessStore();
  const tc = TIME_CONTROLS.find((t) => t.id === prefs.tc) || null;
  const unlimited = prefs.tc === "none";
  const cat = unlimited ? null : categoryOf(tc.min, tc.inc);
  const myRating = cat ? ratings[cat].r : ratings.blitz.r;
  const rec = suggestedBot(myRating);
  const bot = getBot(prefs.botId);
  const exp = Math.round(expectedScore(myRating, bot.rating) * 100);
  const [confirmReset, setConfirmReset] = useState(false);

  const go = () => {
    const color = prefs.color === "random" ? (Math.random() < 0.5 ? "w" : "b") : prefs.color;
    start({ botId: bot.id, color, tc: unlimited ? null : tc, rated: prefs.rated });
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-white">♟️ Satranç</h1>
          <p className="text-sm font-medium text-white/60">Merdiveni tırman: her kategori için ayrı Elo puanı.</p>
        </div>
        <button type="button" onClick={() => setConfirmReset(true)} className="text-xs font-bold text-white/40 transition hover:text-red-300">Puanları sıfırla</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {["bullet", "blitz", "rapid"].map((c) => <RatingCard key={c} cat={c} data={ratings[c]} active={cat === c} onPick={() => setPref("tc", { bullet: "1+0", blitz: "5+0", rapid: "10+0" }[c])} />)}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <section className={`${card} p-4`}>
          <h2 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white/70"><Swords size={14} />Rakip merdiveni</h2>
          <div className="flex max-h-[430px] flex-col gap-1.5 overflow-y-auto pr-1">
            {BOTS.map((b) => {
              const on = b.id === bot.id;
              const e = Math.round(expectedScore(myRating, b.rating) * 100);
              return (
                <button key={b.id} type="button" onClick={() => setPref("botId", b.id)} aria-pressed={on} className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${on ? "border-[#81b64c] bg-[#81b64c]/15" : "border-white/5 bg-white/[0.03] hover:bg-white/[0.07]"}`}>
                  <span className="text-2xl">{b.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 truncate text-sm font-extrabold text-white">{b.name}{b.id === rec.id && <span className="rounded bg-amber-400/20 px-1.5 text-[9px] font-black uppercase text-amber-300">Önerilen</span>}{beaten[b.id] > 0 && <span className="text-[10px] font-bold text-emerald-300">✓ {beaten[b.id]}</span>}</span>
                    <span className="block truncate text-[11px] text-white/50">{b.blurb}</span>
                  </span>
                  <span className="text-right"><span className="block text-sm font-black tabular-nums text-white">{b.rating}</span><span className={`block text-[10px] font-bold ${e >= 60 ? "text-emerald-300" : e >= 40 ? "text-amber-300" : "text-rose-300"}`}>%{e} kazanma</span></span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] leading-snug text-white/35">Bot puanları tahminidir; gerçek bir Elo havuzuyla kalibre edilmedi.</p>
        </section>

        <div className="flex flex-col gap-5">
          <section className={`${card} p-4`}>
            <h2 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white/70"><Clock size={14} />Süre</h2>
            <div className="grid grid-cols-3 gap-1.5">
              {TIME_CONTROLS.map((t) => (
                <button key={t.id} type="button" onClick={() => setPref("tc", t.id)} aria-pressed={prefs.tc === t.id} className={`rounded-lg py-2 text-center text-sm font-black transition ${prefs.tc === t.id ? "bg-[#81b64c] text-[#14210b]" : "bg-white/[0.06] text-white hover:bg-white/10"}`}>
                  {t.min}{t.inc ? `|${t.inc}` : " dk"}<span className="block text-[9px] font-bold opacity-70">{CATEGORY_LABEL[categoryOf(t.min, t.inc)]}</span>
                </button>
              ))}
              <button type="button" onClick={() => setPref("tc", "none")} aria-pressed={unlimited} className={`col-span-3 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-black transition ${unlimited ? "bg-[#81b64c] text-[#14210b]" : "bg-white/[0.06] text-white hover:bg-white/10"}`}><InfIcon size={15} />Süresiz (antrenman, puansız)</button>
            </div>
            <h2 className="mb-2 mt-4 text-xs font-black uppercase tracking-wider text-white/70">Renk</h2>
            <div className="grid grid-cols-3 gap-1.5">
              {[["w", "Beyaz"], ["random", "Rastgele"], ["b", "Siyah"]].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setPref("color", k)} aria-pressed={prefs.color === k} className={`rounded-lg py-2 text-sm font-black transition ${prefs.color === k ? "bg-[#81b64c] text-[#14210b]" : "bg-white/[0.06] text-white hover:bg-white/10"}`}>{l}</button>
              ))}
            </div>
            {!unlimited && (
              <label className="mt-4 flex items-center justify-between text-sm font-bold text-white/85">Puanlı maç<input type="checkbox" checked={prefs.rated} onChange={(e) => setPref("rated", e.target.checked)} className="h-4 w-4 accent-[#81b64c]" /></label>
            )}
            <div className="sticky bottom-0 z-10 -mx-4 -mb-4 mt-4 rounded-b-2xl border-t border-white/10 bg-[#1b1d22]/95 p-3 backdrop-blur">
            <div className="rounded-xl bg-black/30 p-3 text-center text-xs font-semibold text-white/70">
              {bot.emoji} <b className="text-white">{bot.name}</b> ({bot.rating}) · beklenen sonuç %{exp}
              {!unlimited && prefs.rated && <div className="mt-0.5 text-[11px] text-white/50">Galibiyet ≈ <b className="text-emerald-300">+{Math.max(1, Math.round((ratings[cat].games < 30 ? 40 : 20) * (1 - expectedScore(myRating, bot.rating))))}</b> · Mağlubiyet ≈ <b className="text-rose-300">−{Math.max(1, Math.round((ratings[cat].games < 30 ? 40 : 20) * expectedScore(myRating, bot.rating)))}</b></div>}
            </div>
            <button type="button" onClick={go} className="mt-3 w-full rounded-xl py-3 text-lg font-black text-[#14210b] shadow-[0_4px_0_#4d6b27] transition hover:brightness-110 active:translate-y-[2px] active:shadow-[0_2px_0_#4d6b27]" style={{ background: GREEN }}>Oyna</button>
            </div>
          </section>

          <section className={`${card} p-4`}>
            <h2 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white/70"><Trophy size={14} />Son maçlar</h2>
            {history.length === 0 ? <p className="text-xs text-white/40">Henüz maç yok.</p> : (
              <ul className="flex max-h-44 flex-col gap-1 overflow-y-auto pr-1">
                {history.slice(0, 12).map((h) => (
                  <li key={h.id} className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2 py-1 text-xs">
                    <span className={`w-5 text-center font-black ${h.score === 1 ? "text-emerald-300" : h.score === 0 ? "text-rose-300" : "text-white/60"}`}>{h.score === 1 ? "G" : h.score === 0 ? "M" : "B"}</span>
                    <span className="min-w-0 flex-1 truncate text-white/80">{getBot(h.botId).name} <span className="text-white/40">({h.botRating})</span></span>
                    <span className="text-white/40">{h.tc || "süresiz"}</span>
                    <span className={`w-10 text-right font-black tabular-nums ${h.delta > 0 ? "text-emerald-300" : h.delta < 0 ? "text-rose-300" : "text-white/40"}`}>{h.delta == null ? "—" : h.delta > 0 ? `+${h.delta}` : h.delta}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {confirmReset && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="alertdialog">
          <div className={`${card} max-w-sm p-5 text-center`}>
            <div className="mb-1 text-base font-bold text-white">Tüm puanlar sıfırlansın mı?</div>
            <p className="mb-4 text-sm text-white/60">Puanların, maç geçmişin ve yenilen botlar silinir. Geri alınamaz.</p>
            <div className="flex justify-center gap-2">
              <button className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white" onClick={() => setConfirmReset(false)}>Vazgeç</button>
              <button className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white" onClick={() => { resetAll(); setConfirmReset(false); }}>Sıfırla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────── Oyun ─────────────────────────────
function PlayerBar({ name, sub, emoji, clock, low, active, taken, lead }) {
  return (
    <div className="flex items-center gap-3 px-1 py-1">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-2xl">{emoji}</span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-sm font-extrabold text-white">{name} <span className="font-bold text-white/45">{sub}</span></div>
        <div className="flex h-5 items-center gap-px">
          {taken.map((pc, i) => <Piece key={i} piece={pc} size="15px" />)}
          {lead > 0 && <span className="ml-1 text-[11px] font-bold text-white/55">+{lead}</span>}
        </div>
      </div>
      {clock != null && (
        <div className={`min-w-[84px] rounded-lg px-3 py-1.5 text-right font-mono text-2xl font-black tabular-nums transition-colors ${active ? (low ? "bg-rose-600 text-white" : "bg-white text-[#1b1d22]") : "bg-black/40 text-white/60"}`}>{timeText(clock)}</div>
      )}
    </div>
  );
}

function GameScreen({ onLeave }) {
  const game = useChessStore((s) => s.game);
  const prefs = useChessStore((s) => s.prefs);
  const ratings = useChessStore((s) => s.ratings);
  const { playMove, finish, clearGame, start, setPref } = useChessStore.getState();
  const recordStat = useGamesStats((s) => s.record);

  const bot = getBot(game.botId);
  const me = game.color === "w" ? WHITE : BLACK;
  const built = useMemo(() => build(game.startFen, game.moves), [game.startFen, game.moves]);
  const [view, setView] = useState(null); // null: canlı · sayı: o yarım hamle (inceleme)
  const shown = useMemo(() => (view == null || view >= game.moves.length ? built : build(game.startFen, game.moves.slice(0, view))), [view, built, game.startFen, game.moves]);
  const [flipped, setFlipped] = useState(game.color === "b");
  const [now, setNow] = useState(Date.now());
  const [promo, setPromo] = useState(null); // { from, to, options:[uci] }
  const [confirm, setConfirm] = useState(null); // 'resign' | 'abort'
  const [notice, setNotice] = useState("");
  const [thinking, setThinking] = useState(false);
  const [modalOpen, setModalOpen] = useState(true);
  const turn = built.pos.turn;
  const live = view == null || view >= game.moves.length;
  const over = game.over;

  // ── Saat ──
  const clockOf = (i) => {
    if (!game.tc) return null;
    const running = !over && game.tickAt != null && (turn === WHITE ? 0 : 1) === i;
    return game.clocks[i] - (running ? Math.max(0, now - game.tickAt) : 0);
  };
  useEffect(() => {
    if (!game.tc || over) return;
    const iv = setInterval(() => {
      const g = useChessStore.getState().game;
      if (!g || g.over) return;
      const t = Date.now();
      setNow(t);
      if (g.tickAt != null) {
        const side = g.moves.length % 2;
        if (g.clocks[side] - (t - g.tickAt) <= 0) {
          const fr = flagResult(build(g.startFen, g.moves).pos, side === 0 ? WHITE : BLACK);
          useChessStore.getState().finish(fr.result, fr.reason);
        }
      }
    }, 100);
    return () => clearInterval(iv);
  }, [game.tc, over, game.id]);

  // ── Oyun sonu (mat, pat, tekrar…) ──
  useEffect(() => {
    if (!over && built.status) finish(built.status.result, built.status.reason);
  }, [built.status]); // eslint-disable-line

  // Sonuç sesi + genel istatistik (Profilim) — her oyun için bir kez
  const reported = useRef(false);
  useEffect(() => {
    if (!over || reported.current) return;
    reported.current = true;
    const sc = scoreFor(over.result, game.color);
    if (prefs.sound) sfx.end(sc === 1);
    recordStat("chess", sc === 1 ? "win" : sc === 0 ? "loss" : "draw", `${getBot(game.botId).name} · ${REASON_TEXT[over.reason] || over.reason}`, getBot(game.botId).name);
  }, [over]); // eslint-disable-line

  // ── Bot ──
  const botTurn = !over && !built.status && turn !== me;
  useEffect(() => {
    if (!botTurn) { setThinking(false); return; }
    let cancelled = false;
    const t0 = performance.now();
    const gid = game.id, ply = game.moves.length;
    setThinking(true);
    const botIdx = turn === WHITE ? 0 : 1;
    const left = game.tc ? Math.max(0, game.clocks[botIdx] - (game.tickAt != null ? Date.now() - game.tickAt : 0)) : Infinity;
    const budget = game.tc ? Math.max(60, Math.min(bot.timeMs, left / 28)) : bot.timeMs;
    const minWait = game.tc ? Math.min(left / 14, 150 + Math.random() * 450) : 450 + Math.random() * 450;
    think({ fen: game.startFen, moves: game.moves, opts: { depth: bot.depth, timeMs: budget, errorCp: bot.errorCp, blunder: bot.blunder } }).then((res) => {
      if (cancelled || !res?.move) return;
      setTimeout(() => {
        const cur = useChessStore.getState().game;
        if (cancelled || !cur || cur.id !== gid || cur.over || cur.moves.length !== ply) return;
        useChessStore.getState().playMove(res.move);
        setThinking(false);
      }, Math.max(0, minWait - (performance.now() - t0)));
    });
    return () => { cancelled = true; };
  }, [botTurn, game.id, game.moves.length]); // eslint-disable-line

  // ── Ses ──
  const lastLen = useRef(game.moves.length);
  useEffect(() => {
    if (game.moves.length > lastLen.current && prefs.sound && !over) {
      const san = built.sans[built.sans.length - 1] || "";
      if (san.includes("+") || san.includes("#")) sfx.check();
      else if (san.includes("x")) sfx.capture();
      else sfx.move();
    }
    lastLen.current = game.moves.length;
    setView(null);
  }, [game.moves.length]); // eslint-disable-line

  // ── Hamle girişi ──
  const targets = useMemo(() => {
    const t = new Map();
    if (over || !live || turn !== me || built.status) return t;
    for (const m of legalMoves(built.pos)) {
      const f = mFrom(m);
      if (!t.has(f)) t.set(f, new Set());
      t.get(f).add(mTo(m));
    }
    return t;
  }, [built, over, live, turn, me]);

  const onMove = useCallback((from, to) => {
    const ms = legalMoves(built.pos).filter((m) => mFrom(m) === from && mTo(m) === to);
    if (!ms.length) return;
    if (ms.length > 1) return setPromo({ from, to, options: ms.map((m) => ({ uci: moveUci(m), piece: mPromo(m) })) });
    playMove(moveUci(ms[0]));
  }, [built, playMove]);

  const checkSq = inCheck(shown.pos) ? shown.pos.king[shown.pos.turn === WHITE ? 0 : 1] : -1;

  // ── Klavye ──
  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.tagName === "INPUT") return;
      const n = game.moves.length;
      if (e.key === "ArrowLeft") { e.preventDefault(); setView((v) => Math.max(0, (v ?? n) - 1)); }
      else if (e.key === "ArrowRight") { e.preventDefault(); setView((v) => (v == null ? null : v + 1 >= n ? null : v + 1)); }
      else if (e.key === "Home") setView(0);
      else if (e.key === "End") setView(null);
      else if (e.key === "f" || e.key === "F") setFlipped((f) => !f);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game.moves.length]);

  // ── Beraberlik teklifi ──
  const offerDraw = async () => {
    if (turn !== me || over) return;
    setNotice("Bot düşünüyor…");
    const r = await think({ fen: game.startFen, moves: game.moves, opts: { depth: 5, timeMs: 600 } });
    const botScore = -(r.score ?? 0); // sıra bende: puan benim bakışım
    if (game.moves.length >= 30 && botScore <= 30) finish("1/2-1/2", "agreed");
    else setNotice(game.moves.length < 30 ? "Bot erken beraberliği reddetti (en az 15 hamle)." : "Bot beraberliği reddetti.");
    setTimeout(() => setNotice(""), 3500);
  };

  const resign = () => { setConfirm(null); finish(game.color === "w" ? "0-1" : "1-0", "resign"); };
  const abort = () => { setConfirm(null); clearGame(); };
  const rematch = () => { const c = game.color === "w" ? "b" : "w"; clearGame(); start({ botId: game.botId, color: c, tc: game.tc, rated: game.rated }); };
  const nextBot = () => {
    const i = BOTS.findIndex((b) => b.id === game.botId);
    const nb = BOTS[Math.min(BOTS.length - 1, i + 1)];
    setPref("botId", nb.id);
    clearGame();
  };

  const cap = useMemo(() => captured(shown.pos.board), [shown]);
  const pairs = [];
  for (let i = 0; i < built.sans.length; i += 2) pairs.push([built.sans[i], built.sans[i + 1]]);
  const reviewing = view != null && view < game.moves.length;
  const result = over ? scoreFor(over.result, game.color) : null;
  const myR = game.cat ? ratings[game.cat] : null;

  // Altta hangi renk: tahta çevrilmediyse beyaz. Her çubuk o rengin oyuncusunu gösterir.
  const bar = (c) => {
    const isMe = c === me;
    const idx = c === WHITE ? 0 : 1;
    const clock = clockOf(idx);
    return (
      <PlayerBar
        name={isMe ? "Sen" : bot.name} sub={isMe ? (myR ? `(${myR.r})` : "") : `(${bot.rating})`} emoji={isMe ? "🙂" : bot.emoji}
        clock={clock} low={clock != null && clock < 10000} active={!over && turn === c}
        taken={cap.lost[-c].map((t) => -c * t)} lead={Math.max(0, c * cap.diff)}
      />
    );
  };
  const bottom = flipped ? BLACK : WHITE;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 p-3 sm:p-5 lg:flex-row lg:items-start lg:justify-center">
      <div className="w-full max-w-[min(100%,calc(100vh-190px))] shrink-0 lg:max-w-[min(62vw,calc(100vh-190px))]">
        {bar(-bottom)}
        <div className="relative">
          <Board board={shown.pos.board} flipped={flipped} targets={targets} last={shown.last} checkSq={checkSq} interactive={!over && live && turn === me && !promo} onMove={onMove} theme={prefs.board} coords={prefs.coords} highlight={prefs.highlight} />
          {promo && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55" onClick={() => setPromo(null)}>
              <div className="flex gap-2 rounded-2xl bg-[#262a33] p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                {[5, 4, 3, 2].map((pt) => {
                  const o = promo.options.find((x) => x.piece === pt);
                  return o && (
                    <button key={pt} type="button" aria-label={["", "", "At", "Fil", "Kale", "Vezir"][pt]} onClick={() => { playMove(o.uci); setPromo(null); }} className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#3a3f4b] text-5xl transition hover:bg-[#4b5160]">
                      <Piece piece={me * pt} size="48px" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {reviewing && <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-[11px] font-bold text-white">İnceleme · canlıya dönmek için End</div>}
        </div>
        {bar(bottom)}
      </div>

      <aside className={`${card} flex w-full max-w-[min(100%,420px)] shrink-0 flex-col gap-3 p-3 lg:w-[300px]`}>
        <div className="flex items-center justify-between text-xs font-bold text-white/60">
          <span>{game.tc ? `${game.tc.id} · ${CATEGORY_LABEL[game.cat]}${game.rated ? " · Puanlı" : " · Puansız"}` : "Süresiz · Antrenman"}</span>
          {thinking && !over && <span className="animate-pulse text-[#bef264]">{bot.name} düşünüyor…</span>}
        </div>
        <div className="h-52 overflow-y-auto rounded-xl bg-black/30 p-1.5 text-sm" aria-label="Hamle listesi">
          {pairs.length === 0 && <div className="p-3 text-center text-xs text-white/40">Beyaz başlar. Hamleni yap!</div>}
          {pairs.map((p, i) => (
            <div key={i} className="grid grid-cols-[28px_1fr_1fr] items-center gap-1">
              <span className="text-right text-[11px] text-white/35">{i + 1}.</span>
              {[0, 1].map((k) => {
                const ply = i * 2 + k + 1;
                const cur = (view ?? game.moves.length) === ply;
                return p[k] ? <button key={k} type="button" onClick={() => setView(ply >= game.moves.length ? null : ply)} className={`rounded px-1.5 py-0.5 text-left font-bold ${cur ? "bg-white/20 text-white" : "text-white/75 hover:bg-white/10"}`}>{p[k]}</button> : <span key={k} />;
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-1">
          {[[ChevronsLeft, () => setView(0), "Başa"], [ChevronLeft, () => setView((v) => Math.max(0, (v ?? game.moves.length) - 1)), "Geri"], [ChevronRight, () => setView((v) => (v == null || v + 1 >= game.moves.length ? null : v + 1)), "İleri"], [ChevronsRight, () => setView(null), "Sona"]].map(([I, fn, l]) => (
            <button key={l} type="button" onClick={fn} aria-label={l} className="flex h-9 w-12 items-center justify-center rounded-lg bg-white/[0.07] text-white transition hover:bg-white/15"><I size={18} /></button>
          ))}
          <button type="button" onClick={() => setFlipped((f) => !f)} aria-label="Tahtayı çevir" title="Tahtayı çevir (F)" className="ml-1 flex h-9 w-10 items-center justify-center rounded-lg bg-white/[0.07] text-white transition hover:bg-white/15"><Repeat size={17} /></button>
        </div>
        {notice && <div className="rounded-lg bg-amber-400/15 px-3 py-2 text-center text-xs font-bold text-amber-300">{notice}</div>}
        {!over ? (
          <div className="grid grid-cols-2 gap-2">
            {game.moves.length < 2
              ? <button type="button" onClick={() => setConfirm("abort")} className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2.5 text-sm font-black text-white transition hover:bg-white/15"><RotateCcw size={15} />Vazgeç (puansız)</button>
              : <>
                <button type="button" onClick={offerDraw} disabled={turn !== me} className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2.5 text-sm font-black text-white transition hover:bg-white/15 disabled:opacity-40"><Handshake size={15} />Beraberlik</button>
                <button type="button" onClick={() => setConfirm("resign")} className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-500/20 py-2.5 text-sm font-black text-rose-300 transition hover:bg-rose-500/30"><Flag size={15} />Pes et</button>
              </>}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => setModalOpen(true)} className="rounded-xl py-2.5 text-sm font-black text-[#14210b]" style={{ background: GREEN }}>Sonuç kartı</button>
          </div>
        )}
        <div className="flex items-center justify-between text-[11px] font-semibold text-white/40">
          <span>Tahta</span>
          <span className="flex gap-1">{Object.entries(BOARD_THEMES).map(([k, t]) => <button key={k} type="button" onClick={() => setPref("board", k)} aria-label={t.label} aria-pressed={prefs.board === k} className={`h-5 w-5 rounded border-2 ${prefs.board === k ? "border-white" : "border-transparent"}`} style={{ background: `linear-gradient(135deg, ${t.light} 50%, ${t.dark} 50%)` }} />)}</span>
        </div>
      </aside>

      {confirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="alertdialog">
          <div className={`${card} max-w-sm p-5 text-center`}>
            <div className="mb-1 text-base font-bold text-white">{confirm === "resign" ? "Pes etmek istiyor musun?" : "Maçtan vazgeçilsin mi?"}</div>
            <p className="mb-4 text-sm text-white/60">{confirm === "resign" ? (game.rated ? "Puanlı maç: mağlubiyet sayılır ve puan düşer." : "Mağlubiyet sayılır.") : "İki hamle yapılmadan vazgeçmek puanı etkilemez."}</p>
            <div className="flex justify-center gap-2">
              <button className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white" onClick={() => setConfirm(null)}>İptal</button>
              <button className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white" onClick={confirm === "resign" ? resign : abort}>{confirm === "resign" ? "Pes et" : "Vazgeç"}</button>
            </div>
          </div>
        </div>
      )}

      {over && modalOpen && (
        <ResultModal game={game} bot={bot} result={result} onClose={() => setModalOpen(false)} onRematch={rematch} onLobby={clearGame} onNext={result === 1 ? nextBot : null} />
      )}
    </div>
  );
}

// ───────────────────────────── Sonuç kartı ─────────────────────────────
function useCountUp(from, to, ms = 900) {
  const [v, setV] = useState(from);
  useEffect(() => {
    let raf;
    const t0 = performance.now();
    const loop = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [from, to, ms]);
  return v;
}

function ResultModal({ game, bot, result, onClose, onRematch, onLobby, onNext }) {
  const r = game.rating;
  const shownRating = useCountUp(r?.before ?? 0, r?.after ?? 0);
  const win = result === 1, draw = result === 0.5;
  const before = r ? leagueOf(r.before) : null, after = r ? leagueOf(r.after) : null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-label="Maç sonucu">
      <div className={`${card} w-full max-w-sm overflow-hidden text-center`}>
        <div className="px-5 pb-4 pt-6" style={{ background: win ? "linear-gradient(180deg,#2f4a17,#1b1d22)" : draw ? "linear-gradient(180deg,#3a3f4b,#1b1d22)" : "linear-gradient(180deg,#4a1d1d,#1b1d22)" }}>
          <div className="text-4xl">{win ? "🏆" : draw ? "🤝" : "💥"}</div>
          <h2 className="mt-1 text-3xl font-black text-white">{win ? "Kazandın!" : draw ? "Beraberlik" : "Kaybettin"}</h2>
          <p className="text-sm font-semibold text-white/65">{REASON_TEXT[game.over.reason] || game.over.reason} · {bot.name}</p>
        </div>
        <div className="px-5 pb-5">
          {r ? (
            <div className="mt-3 rounded-xl bg-black/30 p-3">
              <div className="text-[10px] font-black uppercase tracking-wider text-white/45">{CATEGORY_LABEL[r.cat]} puanı</div>
              <div className="flex items-baseline justify-center gap-3">
                <span className="text-5xl font-black tabular-nums text-white">{shownRating}</span>
                <span className={`text-xl font-black ${r.delta > 0 ? "text-emerald-300" : r.delta < 0 ? "text-rose-300" : "text-white/50"}`}>{r.delta > 0 ? `+${r.delta}` : r.delta}</span>
              </div>
              {before.name !== after.name && <div className="mt-1 text-xs font-black" style={{ color: after.color }}>{r.after > r.before ? "Yeni lig" : "Lig değişti"}: {after.name}</div>}
              <div className="mt-1 text-[11px] text-white/40">K={r.k} · beklenen sonuç %{Math.round(r.expected * 100)}</div>
            </div>
          ) : <div className="mt-3 rounded-xl bg-black/30 p-3 text-xs font-semibold text-white/50">Bu maç puansızdı.</div>}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={onRematch} className="rounded-xl py-2.5 text-sm font-black text-[#14210b]" style={{ background: GREEN }}>Rövanş</button>
            <button type="button" onClick={onLobby} className="rounded-xl bg-white/10 py-2.5 text-sm font-black text-white hover:bg-white/15">Yeni rakip</button>
            {onNext && <button type="button" onClick={onNext} className="col-span-2 rounded-xl bg-amber-400/20 py-2.5 text-sm font-black text-amber-300 hover:bg-amber-400/30">Merdivende bir sonraki bot →</button>}
            <button type="button" onClick={onClose} className="col-span-2 rounded-xl bg-white/[0.06] py-2 text-xs font-bold text-white/70 hover:bg-white/10">Tahtayı incele</button>
          </div>
        </div>
      </div>
    </div>
  );
}
