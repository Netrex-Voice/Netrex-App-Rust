"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, Flag, Hand, Layers, Timer } from "lucide-react";
import { canWin, tileColor, tileNum } from "../engines/okey";
import { EndCard, beep, ArcadeBtn, PlayerPlate } from "../ui";
import { useGamesPrefs } from "../store";
import { OKEY_CLOTH, OKEY_TILES } from "../themes";

const COLOR_NAMES = ["Sarı", "Mavi", "Siyah", "Kırmızı"];
const SEAT_COLORS = ["#6366f1", "#f59e0b", "#ec4899", "#14b8a6"];

function Tile({ id, okey, ts, selected, onClick, draggable, onDragStart, onDragOver, onDrop, small }) {
  const fake = id >= 104;
  const wild = !fake && tileColor(id) === okey.c && tileNum(id) === okey.n;
  const c = fake ? okey.c : tileColor(id);
  const n = fake ? okey.n : tileNum(id);
  return (
    <button
      type="button"
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      aria-label={fake ? "Sahte okey" : `${COLOR_NAMES[c]} ${n}${wild ? " (okey)" : ""}`}
      aria-pressed={!!selected}
      className={`relative shrink-0 select-none rounded-md flex flex-col items-center justify-center font-extrabold transition ${
        small ? "w-7 h-10 text-sm" : "w-[clamp(34px,5vw,50px)] h-[clamp(50px,7.4vw,72px)] text-[clamp(16px,2.4vw,26px)]"
      } ${selected ? "-translate-y-2 ring-2 ring-[#6366f1]" : onClick ? "hover:-translate-y-0.5" : ""}`}
      style={{ color: ts.ink[c], background: ts.bg, boxShadow: `0 3px 0 ${ts.edge}` }}
    >
      {fake ? <span className="text-[1.15em]">★</span> : <span>{n}</span>}
      <span className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: ts.ink[c] }} />
      {wild && <span className="absolute -top-1 -right-1 text-[9px] bg-[#faa61a] text-black rounded px-1 font-extrabold">OK</span>}
    </button>
  );
}

const Back = ({ ts, small = true }) => <span className={`${small ? "w-4 h-6" : "w-6 h-9"} rounded-sm shrink-0`} style={{ background: ts.edge, boxShadow: `0 1px 0 rgba(0,0,0,.4)` }} />;

const sortHand = (hand, mode) =>
  hand.slice().sort((a, b) => {
    const fa = a >= 104 ? 1 : 0;
    const fb = b >= 104 ? 1 : 0;
    if (fa !== fb) return fa - fb;
    const [ca, na, cb, nb] = [tileColor(a), tileNum(a), tileColor(b), tileNum(b)];
    return mode === "num" ? na - nb || ca - cb : ca - cb || na - nb;
  });

export default function OkeyView({ view, session, myId, send, isHost, onRematch, onLobby, onLeave }) {
  const prefs = useGamesPrefs((s) => s.okey);
  const cloth = OKEY_CLOTH[prefs.cloth] || OKEY_CLOTH.green;
  const ts = OKEY_TILES[prefs.tile] || OKEY_TILES.cream;
  const [order, setOrder] = useState(view.hand);
  const [sel, setSel] = useState(null);
  const [overDrop, setOverDrop] = useState(false);
  const dragFrom = useRef(null);
  const sentOrder = useRef("");
  const me = view.me;
  const myTurn = me >= 0 && view.turn === me;

  useEffect(() => {
    setOrder((prev) => {
      const set = new Set(view.hand);
      const kept = prev.filter((id) => set.has(id));
      return [...kept, ...view.hand.filter((id) => !kept.includes(id))];
    });
    setSel((s) => (s != null && view.hand.includes(s) ? s : null));
  }, [view.hand]);

  useEffect(() => {
    const key = order.join(",");
    if (me < 0 || key === sentOrder.current || order.length !== view.hand.length) return;
    const t = setTimeout(() => {
      sentOrder.current = key;
      send({ t: "arrange", order });
    }, 600);
    return () => clearTimeout(t);
  }, [order, me, send, view.hand.length]);

  useEffect(() => {
    if (myTurn) beep(520, 0.08, "triangle", 0.05);
  }, [myTurn, view.phase]);

  const winTile = useMemo(
    () => (myTurn && view.phase === "discard" && order.length === 15 ? order.find((t) => canWin(order.filter((x) => x !== t), view.okey)) ?? null : null),
    [myTurn, view.phase, order, view.okey]
  );
  const canFinish = winTile != null;

  const name = (i) => view.names[i];
  const rel = (k) => (me < 0 ? k : (me + k) % 4);
  const leftSeat = (me < 0 ? 0 : (me + 3) % 4);
  const leftPile = view.discards[leftSeat] || [];

  const move = (from, to) =>
    setOrder((o) => {
      const a = o.slice();
      const [x] = a.splice(from, 1);
      a.splice(to, 0, x);
      return a;
    });
  const doDiscard = (tile) => myTurn && view.phase === "discard" && tile != null && (send({ t: "discard", tile }), setSel(null));
  const finish = () => {
    // ipucu açıkken hazır taşı kullanır; kapalıyken seçili taşla dener (geçersizse sunucu reddeder)
    const t = view.hints ? (sel != null && canWin(order.filter((x) => x !== sel), view.okey) ? sel : winTile) : sel;
    if (t != null) send({ t: "finish", tile: t });
  };

  const status = !myTurn
    ? `${name(view.turn)} oynuyor`
    : view.phase === "draw"
      ? "Sıra sende: yığından ya da soldaki atıktan çek"
      : "Bir taş seç ve at" + (view.hints && canFinish ? " — elin hazır, bitirebilirsin!" : "");

  const Opp = ({ seat, vertical }) => (
    <div className={`flex ${vertical ? "flex-col" : "flex-row"} items-center gap-2.5`}>
      <PlayerPlate name={name(seat)} sub={`${view.bots[seat] ? "bot · " : ""}${view.counts[seat]} taş`} color={SEAT_COLORS[seat]} active={view.turn === seat} className="min-w-[132px]" />
      {prefs.showOpp && (
        <div className={`flex ${vertical ? "flex-col" : "flex-row"}`} aria-hidden>
          {Array.from({ length: view.counts[seat] }, (_, i) => (
            <span key={i} className={`shrink-0 rounded-[3px] ${vertical ? "-mt-[5px] h-[11px] w-7 first:mt-0" : "-ml-[5px] h-7 w-[12px] first:ml-0"}`} style={{ background: `linear-gradient(135deg, ${ts.bg}, ${ts.edge})`, border: `1px solid ${ts.edge}`, boxShadow: "0 1px 0 rgba(0,0,0,.45)" }} />
          ))}
        </div>
      )}
      <div className={`flex ${vertical ? "flex-col" : "flex-row"} gap-0.5`} aria-label={`${name(seat)} attığı taşlar`}>
        {view.discards[seat].slice(-3).map((t) => <Tile key={t} id={t} okey={view.okey} ts={ts} small />)}
      </div>
    </div>
  );

  return (
    <div className="relative flex h-full w-full flex-col" style={{ background: "linear-gradient(180deg, #1b1040, #2d1a66)" }}>
      <div className="pointer-events-none absolute inset-3 rounded-[2.5rem]" style={{ background: `radial-gradient(ellipse at center, ${cloth.a} 0%, ${cloth.b} 78%)`, border: "10px solid #7a4a22", boxShadow: "inset 0 0 0 3px #b9803f, inset 0 0 60px rgba(0,0,0,.55), 0 10px 0 rgba(0,0,0,.3), 0 22px 40px rgba(0,0,0,.5)" }} />
      <div className="relative z-10 grid min-h-0 flex-1 grid-rows-[auto_1fr_auto] gap-2 p-7">
        <div className="flex justify-center"><Opp seat={rel(2)} /></div>
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <Opp seat={rel(3)} vertical />
          <div className="flex items-center justify-center gap-6">
            <button type="button" disabled={!(myTurn && view.phase === "draw" && view.stock > 0)} onClick={() => send({ t: "draw", from: "stock" })}
              className="relative w-16 h-24 rounded-lg flex flex-col items-center justify-center font-bold enabled:hover:-translate-y-1 enabled:cursor-pointer disabled:opacity-60 transition"
              style={{ background: ts.edge, color: ts.bg, boxShadow: "0 5px 0 rgba(0,0,0,.35)" }} aria-label={`Yığından çek (${view.stock} taş)`}>
              <Layers size={22} /><span className="text-sm">{view.stock}</span>
            </button>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-white/60">Gösterge</span>
              <Tile id={view.indicator} okey={view.okey} ts={ts} small />
              <span className="text-[10px] text-white/60">Okey: {COLOR_NAMES[view.okey.c]} {view.okey.n}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-white/60">Soldan çek</span>
              {leftPile.length ? (
                <div className={myTurn && view.phase === "draw" ? "ring-2 ring-[#6366f1] rounded-md" : ""}>
                  <Tile id={leftPile[leftPile.length - 1]} okey={view.okey} ts={ts} onClick={() => myTurn && view.phase === "draw" && send({ t: "draw", from: "discard" })} />
                </div>
              ) : <div className="w-10 h-14 rounded-md border border-dashed border-white/25" />}
            </div>
          </div>
          <Opp seat={rel(1)} vertical />
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-3" aria-live="polite">
            <span className={`rounded-2xl border-b-[3px] border-black/40 px-4 py-1.5 text-[13px] font-extrabold ${myTurn ? "bg-amber-400 text-amber-950" : "bg-black/55 text-white/85"}`}>{status}</span>
            {view.turnTime > 0 && view.phase !== "over" && !view.bots[view.turn] && <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-3 py-1 text-sm font-black tabular-nums text-amber-300"><Timer size={13} />{view.turnLeft} sn</span>}
          </div>
          {me >= 0 && (
            <>
              <div className="flex items-stretch gap-2 max-w-[min(100%,980px)]">
                <div className="flex flex-wrap justify-center gap-1.5 rounded-2xl border-b-[4px] border-[#4b2a12] bg-[#7a4a22] p-2.5 shadow-[0_8px_0_rgba(0,0,0,.3),inset_0_2px_0_rgba(255,255,255,.2)]" onDragOver={(e) => e.preventDefault()} aria-label="Istaka">
                  {order.map((id, i) => (
                    <Tile key={id} id={id} okey={view.okey} ts={ts} selected={sel === id} onClick={() => setSel((s) => (s === id ? null : id))} draggable
                      onDragStart={() => (dragFrom.current = i)} onDragOver={(e) => e.preventDefault()}
                      onDrop={() => dragFrom.current != null && (move(dragFrom.current, i), (dragFrom.current = null))} />
                  ))}
                </div>
                <div
                  onDragOver={(e) => { e.preventDefault(); setOverDrop(true); }}
                  onDragLeave={() => setOverDrop(false)}
                  onDrop={() => { setOverDrop(false); if (dragFrom.current != null) { doDiscard(order[dragFrom.current]); dragFrom.current = null; } }}
                  className={`w-24 shrink-0 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${overDrop ? "border-[#6366f1] bg-[#6366f1]/20 text-white" : "border-white/25 text-white/60"}`}
                  aria-label="Taş atma alanı"
                >
                  <ArrowDownToLine size={16} />Taşı buraya sürükle
                  <div className="flex gap-0.5 mt-1">{view.discards[me].slice(-2).map((t) => <Tile key={t} id={t} okey={view.okey} ts={ts} small />)}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <ArcadeBtn tone="ghost" xs onClick={() => setOrder((o) => sortHand(o, "color"))}>Renge diz</ArcadeBtn>
                <ArcadeBtn tone="ghost" xs onClick={() => setOrder((o) => sortHand(o, "num"))}>Sayıya diz</ArcadeBtn>
                <ArcadeBtn tone="roll" disabled={!(myTurn && view.phase === "discard" && sel != null)} onClick={() => doDiscard(sel)}><ArrowDownToLine size={15} className="mr-1.5 inline -mt-0.5" />At</ArcadeBtn>
                <ArcadeBtn tone="good" disabled={!(myTurn && view.phase === "discard" && (view.hints ? canFinish : sel != null))} onClick={finish}><Flag size={15} className="mr-1.5 inline -mt-0.5" />Bitir</ArcadeBtn>
              </div>
            </>
          )}
          {me < 0 && <div className="text-xs text-white/70 flex items-center gap-1.5"><Hand size={13} />İzliyorsun</div>}
        </div>
      </div>

      {view.phase === "over" && (
        <EndCard
          win={view.winner === me}
          title={view.reason === "draw" ? "Yığın bitti — berabere" : view.winner === me ? "Okey! Kazandın" : `${name(view.winner)} kazandı`}
          subtitle={view.reason === "draw" ? "Kimse bitiremedi" : "14 taşın tamamı geçerli perlerde"}
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
