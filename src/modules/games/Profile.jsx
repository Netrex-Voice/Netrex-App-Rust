"use client";

import { Trophy, Flame, Trash2, Target, Award, Lock, Check } from "lucide-react";
import { useGamesStats, useGamesProgress } from "./store";
import { levelOf, CHALLENGES, dailyIds, ACHIEVEMENTS } from "./progress";
import { GAMES, getGame } from "./registry";
import { ArcadeBtn, shade } from "./ui";
import Cover from "./covers";

const RES = { win: ["Galibiyet", "#22c55e"], loss: ["Mağlubiyet", "#ef4444"], draw: ["Berabere", "#f59e0b"] };
const ago = (t) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "az önce" : m < 60 ? `${m} dk önce` : m < 1440 ? `${Math.round(m / 60)} sa önce` : `${Math.round(m / 1440)} gün önce`;
};

const card = "rounded-3xl border-[3px] border-white/10 bg-[#171a2e]/90 shadow-[0_6px_0_rgba(0,0,0,.3),0_14px_26px_rgba(0,0,0,.3)]";
const H = ({ icon, children, color = "#f59e0b" }) => (
  <h2 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white/85">
    <span className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: `linear-gradient(180deg, ${color}, ${shade(color, 0.65)})`, border: `2px solid ${shade(color, 0.55)}` }}>{icon}</span>
    {children}
  </h2>
);
const Bar = ({ pct, from = "#ffc04d", to = "#f97316", h = "h-4" }) => (
  <div className={`${h} overflow-hidden rounded-full border-2 border-white/15 bg-black/40 p-[2px]`}>
    <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: `linear-gradient(180deg, ${from}, ${to})` }} />
  </div>
);

/** Kişisel profil: bu cihazda oynanan gerçek maçlardan istatistikler */
export default function Profile() {
  const { byGame, history, reset } = useGamesStats();
  const total = Object.values(byGame).reduce((a, g) => ({ p: a.p + g.played, w: a.w + g.wins }), { p: 0, w: 0 });
  const rate = total.p ? Math.round((total.w / total.p) * 100) : 0;
  const prog = useGamesProgress((s) => s.prog);
  const resetProg = useGamesProgress((s) => s.reset);
  const lv = levelOf(prog?.xp || 0);
  const today = new Date().toISOString().slice(0, 10);
  const daily = prog?.daily?.date === today ? prog.daily : { ids: dailyIds(today), prog: {}, done: [] };
  const ach = new Set(prog?.ach || []);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 sm:p-6">
      {/* Seviye */}
      <section className="flex items-center gap-4 rounded-3xl p-4" style={{ background: "linear-gradient(135deg, #6366f1, #4338ca)", border: "3px solid #a5b4fc", boxShadow: "0 7px 0 #312e81, 0 16px 28px rgba(0,0,0,.4)" }}>
        <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full bg-white shadow-[0_5px_0_rgba(0,0,0,.3)]" style={{ border: "5px solid #fbbf24", color: "#4338ca" }}>
          <span className="text-[9px] font-black leading-none tracking-widest opacity-70">SEVİYE</span>
          <span className="text-3xl font-black leading-tight">{lv.level}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex justify-between text-xs font-black text-white"><span>Sonraki seviyeye</span><span className="tabular-nums">{lv.into} / {lv.need} XP</span></div>
          <Bar pct={(lv.into / lv.need) * 100} />
          <div className="mt-2 text-[11px] font-semibold text-indigo-100/80">Seviye atladıkça yeni masa, raket rengi ve iz efektleri açılır.</div>
        </div>
      </section>

      {/* Genel istatistik */}
      <div className="grid grid-cols-3 gap-3">
        {[["Oynanan maç", total.p, "#38bdf8"], ["Galibiyet", total.w, "#22c55e"], ["Kazanma oranı", total.p ? `%${rate}` : "—", "#f59e0b"]].map(([k, v, c]) => (
          <div key={k} className="rounded-3xl p-4 text-center" style={{ background: `linear-gradient(160deg, ${c}, ${shade(c, 0.55)})`, border: `3px solid ${shade(c, 1.15)}`, boxShadow: `0 6px 0 ${shade(c, 0.4)}, 0 12px 20px rgba(0,0,0,.35)` }}>
            <div className="text-3xl font-black tabular-nums text-white" style={{ textShadow: "0 3px 0 rgba(0,0,0,.3)" }}>{v}</div>
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-white/90">{k}</div>
          </div>
        ))}
      </div>

      {/* Günlük görevler */}
      <section className={`${card} p-4`}>
        <H icon={<Target size={13} />} color="#ec4899">Günlük görevler</H>
        <ul className="flex flex-col gap-3">
          {daily.ids.map((id) => {
            const c = CHALLENGES.find((x) => x.id === id);
            const n = Math.min(c.goal, daily.prog[id] || 0);
            const done = daily.done.includes(id);
            return (
              <li key={id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm font-bold">
                  <span className={`flex items-center gap-1.5 ${done ? "text-green-400" : "text-white"}`}>{done && <Check size={15} />}{c.text}</span>
                  <span className="shrink-0 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-black tabular-nums text-amber-300">{n}/{c.goal} · +60 XP</span>
                </div>
                <Bar pct={(n / c.goal) * 100} h="h-3" from={done ? "#5eea8f" : "#ffc04d"} to={done ? "#16a34a" : "#f97316"} />
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[11px] font-semibold text-white/50">Görevler her gün yenilenir.</p>
      </section>

      {/* Oyunlara göre */}
      <section>
        <H icon={<Trophy size={13} />} color="#38bdf8">Oyunlara göre</H>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3">
          {GAMES.map((g) => {
            const s = byGame[g.id];
            const c = g.accent || "#6366f1";
            return (
              <div key={g.id} className="flex items-center gap-3 rounded-2xl bg-[#171a2e] p-2.5" style={{ border: `2px solid ${c}`, boxShadow: `0 4px 0 ${shade(c, 0.5)}` }}>
                <span className="aspect-video w-20 shrink-0 overflow-hidden rounded-xl border-2 border-white/20"><Cover g={g} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black text-white">{g.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[11px] font-bold tabular-nums text-white/70">
                    <span>{s?.played || 0} maç</span>
                    <span className="text-green-400">{s?.wins || 0} G</span>
                    <span className="text-red-400">{s?.losses || 0} M</span>
                    <span>{s?.draws || 0} B</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] font-bold text-white/55">
                    {s?.streak ? <span className="inline-flex items-center gap-0.5 text-amber-400"><Flame size={12} />{s.streak} seri</span> : <span>Seri yok</span>}
                    <span>· en iyi {s?.best || 0}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Son maçlar */}
      <section className={card}>
        <div className="px-4 pt-4"><H icon={<Trophy size={13} />} color="#22c55e">Son maçlar</H></div>
        {history.length === 0 ? (
          <div className="px-4 pb-6 pt-1 text-center text-sm font-semibold text-white/60"><Trophy size={26} className="mx-auto mb-2 text-white/30" />Henüz maç oynamadın. İlk maçından sonra burada görünür.</div>
        ) : (
          <ul className="pb-2">
            {history.map((h, i) => (
              <li key={i} className="flex items-center gap-3 border-t border-white/10 px-4 py-2.5 text-sm">
                <span className="w-28 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-black text-white" style={{ background: RES[h.result][1], boxShadow: "0 2px 0 rgba(0,0,0,.3)" }}>{RES[h.result][0]}</span>
                <span className="font-extrabold text-white">{getGame(h.game)?.name}</span>
                <span className="font-bold tabular-nums text-white/60">{h.detail}</span>
                {h.withWho && <span className="hidden truncate font-semibold text-white/40 sm:inline">· {h.withWho}</span>}
                <span className="ml-auto shrink-0 text-xs font-semibold text-white/45">{ago(h.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Başarımlar */}
      <section className={`${card} p-4`}>
        <H icon={<Award size={13} />} color="#a855f7">Başarımlar ({ach.size}/{ACHIEVEMENTS.length})</H>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2.5">
          {ACHIEVEMENTS.map((a) => {
            const on = ach.has(a.id);
            return (
              <div key={a.id} className="flex items-start gap-2.5 rounded-2xl p-3" style={on ? { background: "linear-gradient(135deg, rgba(251,191,36,.28), rgba(249,115,22,.18))", border: "2px solid #fbbf24" } : { background: "rgba(0,0,0,.3)", border: "2px solid rgba(255,255,255,.06)" }}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${on ? "text-white shadow-[0_3px_0_#b45309]" : "bg-white/5 text-white/30"}`} style={on ? { background: "linear-gradient(180deg,#ffc04d,#f97316)" } : undefined}>{on ? <Award size={18} /> : <Lock size={14} />}</span>
                <div className="min-w-0"><div className={`text-sm font-black ${on ? "text-white" : "text-white/50"}`}>{a.name}</div><div className={`text-[11px] font-semibold leading-snug ${on ? "text-white/75" : "text-white/35"}`}>{a.desc}</div></div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 pb-2 text-xs font-semibold text-white/45">
        <span>İstatistik, XP ve başarımlar yalnızca bu cihazda saklanır.</span>
        {(history.length > 0 || prog) && <ArcadeBtn tone="danger" xs onClick={() => confirm("Tüm istatistikler, XP ve başarımlar silinsin mi?") && (reset(), resetProg())}><Trash2 size={12} className="mr-1 inline -mt-0.5" />Sıfırla</ArcadeBtn>}
      </div>
    </div>
  );
}
