"use client";

import { useEffect, useRef } from "react";
import { Check, SkipForward, Siren, Play, ShieldAlert } from "lucide-react";
import { EndCard, beep, ArcadeBtn, PlayerPlate, Dot, inkOn, shade } from "../ui";

const TEAM_HEX = { red: "#ef4444", blue: "#6366f1", green: "#23a559", amber: "#f59e0b", pink: "#ec4899", teal: "#14b8a6" };
const hex = (c) => TEAM_HEX[c] || c || "#64748b";
const panel = "rounded-3xl border-[3px] border-white/15 bg-[#161a2d]/90 shadow-[0_8px_0_rgba(0,0,0,.35),0_20px_36px_rgba(0,0,0,.4)] backdrop-blur";

export default function TabuView({ view, session, myId, send, isHost, onRematch, onLobby, onLeave }) {
  const nameOf = (id) => view.names[id] || session.players.find((p) => p.id === id)?.name || "Oyuncu";
  const me = view.me;
  const iDescribe = view.describer === myId;
  const judge = view.card?.judge;
  const lastRemain = useRef(view.remain);

  useEffect(() => {
    if (view.phase === "play" && view.remain <= 5 && view.remain > 0 && view.remain !== lastRemain.current) beep(880, 0.06, "square", 0.04);
    lastRemain.current = view.remain;
  }, [view.remain, view.phase]);

  const TEAM = [0, 1].map((i) => ({ name: view.teamNames[i], c: hex(view.teamColors[i]) }));
  const pct = view.phase === "play" ? (view.remain / view.secs) * 100 : 100;
  const col = TEAM[view.turn].c;
  const urgent = view.remain <= 10 && view.phase === "play";

  return (
    <div className="relative h-full w-full overflow-y-auto" style={{ background: "linear-gradient(180deg, #1b1040, #2d1a66)" }}>
      <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-4 p-4">
        {/* Takım plakaları */}
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((t) => (
            <PlayerPlate key={t} name={`${TEAM[t].name}${me === t ? " · senin takımın" : ""}`} sub={view.teams[t].map(nameOf).join(", ") || "—"} color={TEAM[t].c} active={view.turn === t && view.phase !== "over"} right={view.score[t]} />
          ))}
        </div>

        {/* Süre */}
        <div className={`${panel} p-4`}>
          <div className="mb-2.5 flex items-center justify-between">
            <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white/85">Tur {Math.min(view.turnsPlayed + 1, view.totalTurns)} / {view.totalTurns}</span>
            <span className={`flex h-12 w-12 items-center justify-center rounded-full text-[19px] font-black tabular-nums text-white shadow-inner ${urgent ? "animate-pulse bg-red-500" : "bg-white/15"}`} style={{ border: `3px solid ${urgent ? "#fecaca" : "rgba(255,255,255,.35)"}` }} aria-label={`${view.phase === "play" ? view.remain : view.secs} saniye`}>
              {view.phase === "play" ? view.remain : view.secs}
            </span>
          </div>
          <div className="h-5 overflow-hidden rounded-full border-2 border-white/20 bg-black/40 p-[2px]" role="progressbar" aria-valuenow={view.remain} aria-valuemax={view.secs}>
            <div className="h-full rounded-full transition-[width] duration-1000 ease-linear" style={{ width: pct + "%", background: urgent ? "linear-gradient(180deg,#fb8a8a,#dc2626)" : `linear-gradient(180deg, ${col}, ${shade(col, 0.7)})` }} />
          </div>
          <div className="mt-3 text-[15px] text-white">
            <b style={{ color: col }} className="font-black">{TEAM[view.turn].name}</b> oynuyor · Anlatıcı: <b>{nameOf(view.describer)}</b>
            {iDescribe && <span className="font-bold text-sky-300"> (sen)</span>}
          </div>
          {view.last && <div className="mt-2 inline-block rounded-full bg-amber-400 px-3 py-1 text-xs font-extrabold text-amber-950 animate-[gmPop_.25s_ease-out]" aria-live="polite">{view.last}</div>}
        </div>

        {/* Hazır */}
        {view.phase === "ready" && (
          <div className={`${panel} p-8 text-center`}>
            <div className="mb-3 flex justify-center"><Dot color={col} size="w-16 h-16 text-3xl">{iDescribe ? "🎤" : "⏳"}</Dot></div>
            {iDescribe ? (
              <>
                <div className="mb-1 text-2xl font-black text-white">Sıra sende!</div>
                <p className="mb-6 text-sm font-semibold text-white/70">Kartı yalnızca sen ve rakip takım görecek. Hazır olunca başla, süre işler.</p>
                <ArcadeBtn tone="good" big onClick={() => send({ t: "go" })}><Play size={20} className="mr-2 inline -mt-1" />Başla</ArcadeBtn>
              </>
            ) : (
              <p className="text-base font-bold text-white/80">{nameOf(view.describer)} hazırlanıyor…</p>
            )}
          </div>
        )}

        {/* Oyun */}
        {view.phase === "play" && (
          view.card ? (
            <div className="mx-auto w-full max-w-xl animate-[gmPop_.2s_ease-out]">
              {judge && (
                <div className="mb-2 flex items-center justify-center gap-1.5 rounded-full bg-amber-400 px-4 py-1.5 text-xs font-black text-amber-950"><ShieldAlert size={14} />Denetçisin — yasaklı kelime söylenirse TABU'ya bas</div>
              )}
              {/* Gerçek Tabu kartı: renkli başlık bandı (kelime) + kırmızı yasaklı liste */}
              <div style={{ filter: "drop-shadow(0 16px 24px rgba(0,0,0,.55))" }}>
                <div className="overflow-hidden rounded-2xl border-[3px] border-[#1a1a1a] bg-[#fbf7ea]">
                  <div className="px-4 py-5 text-center" style={{ background: col, color: inkOn(col) }}>
                    <div className="text-[11px] font-black tracking-[0.32em] opacity-90">ANLATILACAK KELİME</div>
                    <div className="mt-1 text-4xl font-black uppercase tracking-wide sm:text-5xl" style={{ textShadow: inkOn(col) === "#ffffff" ? "0 3px 0 rgba(0,0,0,.3)" : "none" }}>{view.card.word}</div>
                  </div>
                  <div className="px-4 pb-3 pt-2.5">
                    <div className="mb-1 text-center text-[11px] font-black tracking-[0.32em] text-[#b91c1c]">YASAKLI KELİMELER</div>
                    {view.card.taboo.map((w) => (
                      <div key={w} className="flex items-center justify-center gap-2 border-b border-dashed border-black/20 py-1.5 text-xl font-extrabold uppercase text-[#7f1d1d] last:border-0">
                        <span className="text-[#dc2626]">✖</span>{w}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {iDescribe && (
                  <>
                    <ArcadeBtn tone="good" big onClick={() => send({ t: "ok" })}><Check size={20} className="mr-2 inline -mt-1" />Doğru</ArcadeBtn>
                    <ArcadeBtn tone="ghost" big disabled={view.passes <= 0} onClick={() => send({ t: "pass" })}><SkipForward size={20} className="mr-2 inline -mt-1" />Pas ({view.passes})</ArcadeBtn>
                  </>
                )}
                {judge && <ArcadeBtn tone="danger" big onClick={() => send({ t: "taboo" })}><Siren size={20} className="mr-2 inline -mt-1" />TABU!</ArcadeBtn>}
              </div>
            </div>
          ) : (
            <div className={`${panel} p-8 text-center animate-[gmPop_.2s_ease-out]`}>
              <div className="mb-3 flex justify-center"><Dot color={col} size="w-16 h-16 text-3xl">🎧</Dot></div>
              <div className="mb-1 text-2xl font-black text-white">Takımın tahmin ediyor</div>
              <p className="text-sm font-semibold text-white/70">Sesli sohbetten <b className="text-white">{nameOf(view.describer)}</b> kişisini dinle ve kelimeyi bulmaya çalış. Kart sana gösterilmez.</p>
            </div>
          )
        )}
      </div>

      {view.phase === "over" && (
        <EndCard
          win={view.winner === me}
          title={view.winner === -1 ? "Berabere!" : `${TEAM[view.winner].name} kazandı`}
          subtitle={`${view.score[0]} – ${view.score[1]}`}
          isHost={isHost}
          onRematch={onRematch}
          onLobby={onLobby}
          onLeave={onLeave}
          rkey={`${session.sid}-${session.round}`}
        >
          <div className="mt-2 text-xs font-bold text-white/60">Doğru {view.stats.ok} (+{view.okPts}) · Tabu {view.stats.taboo}{view.tabooPts ? ` (−${view.tabooPts})` : ""} · Pas {view.stats.pass}</div>
        </EndCard>
      )}
    </div>
  );
}
