"use client";

import { useEffect, useRef, useState } from "react";
import * as pong from "../engines/pingpong";
import { Predictor } from "../netcode";
import { EndCard, ScoreBanner, HintPill, BigCall } from "../ui";
import { useGamesPrefs, live } from "../store";
import { PONG_TABLES, PLAYER_COLORS, oppColor } from "../themes";
import { PongScene } from "../three/pongScene";
import { sfx } from "../three/sound";

const KEY_SPEED = 1.4; // m/s

export default function PingPongView({ view, session, myId, send, isHost, onRematch, onLobby, onLeave }) {
  const canvasRef = useRef(null);
  const mySeat = view.seats.indexOf(myId);
  const prefs = useGamesPrefs((s) => s.pong);
  const gfx = useGamesPrefs((s) => s.gfx);
  const showFps = useGamesPrefs((s) => s.showFps);
  const mine = (PLAYER_COLORS[prefs.mine] || PLAYER_COLORS.indigo).c;
  const colors = mySeat === 1 ? [oppColor(prefs.mine), mine] : mySeat === 0 ? [mine, oppColor(prefs.mine)] : ["#d61f2c", "#16171a"];
  const nameOf = (id) => session.players.find((p) => p.id === id)?.name || "Oyuncu";
  const [ping, setPing] = useState(0);
  const [hud, setHud] = useState(null);
  const [failed, setFailed] = useState(false);
  const [hintOn, setHintOn] = useState(true); // kontrol ipucu ilk saniyelerde görünür
  useEffect(() => {
    const t = setTimeout(() => setHintOn(false), 9000);
    return () => clearTimeout(t);
  }, []);
  const sceneRef = useRef(null);
  const lastScore = useRef(view.score.join("-"));

  useEffect(() => {
    const cv = canvasRef.current;
    let scene;
    try {
      scene = new PongScene(cv, { seat: mySeat, gfx, colors, tableColor: (PONG_TABLES[prefs.table] || PONG_TABLES.blue)?.top || "#1d4ed8" });
    } catch (e) {
      console.error("[pong] WebGL başlatılamadı", e);
      setFailed(true);
      return;
    }
    sceneRef.current = scene;
    scene.setScore(view.score[0], view.score[1]);
    const first = live.v?.t === "pingpong" ? live.v : view;
    const pred = new Predictor(pong, mySeat, first, { claims: !isHost });
    const panOf = (x) => (mySeat === 1 ? -x : x) / 1.2;
    let lastB = first.bounces || 0;
    let lastN = first.nets || 0;
    let lastHits = first.hits || 0;
    const unsub = live.sub((v, now) => {
      pred.setRtt(isHost ? 0 : live.rtt);
      pred.snapshot(v, now);
      // tahmin dışı olaylar (servis, rakip vuruşu, sayı sonrası sekmeler) için sunucu sayaçları
      if ((v.hits || 0) > lastHits && v.lastHit !== mySeat) sfx("paddle", 0.6, panOf(v.ball[0]));
      lastHits = v.hits || 0;
    });
    const keys = new Set();
    const aim = { x: null, y: null };
    const map = { ArrowLeft: "l", KeyA: "l", ArrowRight: "r", KeyD: "r", ArrowUp: "u", KeyW: "u", ArrowDown: "d", KeyS: "d" };
    const kd = (e) => {
      if (e.code === "Space" && !e.repeat) (e.preventDefault(), send({ t: "serve" }, true));
      if (map[e.code] && mySeat >= 0) (keys.add(map[e.code]), e.preventDefault());
    };
    const ku = (e) => map[e.code] && keys.delete(map[e.code]);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    const onPointer = (e) => {
      if (mySeat < 0) return;
      const p = scene.pick(e.clientX, e.clientY, pred.sim.pads[mySeat].z);
      if (!p) return;
      aim.x = p.x;
      aim.y = p.y;
      pred.aim(p.x, p.y);
    };
    const onDown = (e) => {
      cv.setPointerCapture?.(e.pointerId);
      onPointer(e);
      const v = live.v || view;
      if (v.phase === "serve" && v.server === mySeat) send({ t: "serve" }, true);
    };
    cv.addEventListener("pointermove", onPointer);
    cv.addEventListener("pointerdown", onDown);
    const ro = new ResizeObserver(() => scene.resize());
    ro.observe(cv);

    let raf;
    let last = performance.now();
    let hudT = 0;
    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      const ms = t - last;
      const dt = Math.min(0.05, ms / 1000);
      last = t;
      if (keys.size && mySeat >= 0) {
        const me = pred.sim.pads[mySeat];
        const side = mySeat === 0 ? 1 : -1;
        if (aim.x == null) (aim.x = me.x), (aim.y = me.y);
        aim.x += ((keys.has("r") ? 1 : 0) - (keys.has("l") ? 1 : 0)) * side * KEY_SPEED * dt;
        aim.y += ((keys.has("u") ? 1 : 0) - (keys.has("d") ? 1 : 0)) * KEY_SPEED * dt;
        const b = pong.bounds(pred.sim, mySeat);
        aim.x = Math.max(b.x0, Math.min(b.x1, aim.x));
        aim.y = Math.max(b.y0, Math.min(b.y1, aim.y));
        pred.aim(aim.x, aim.y);
      }
      const r = pred.frame(t / 1000, dt, send);
      const v = live.v?.t === "pingpong" ? live.v : view;
      for (const ev of pred.drainEvents()) if (ev.type === "hit") sfx("paddle", ev.speed / 12, panOf(ev.x));
      const sim = pred.sim;
      if ((sim.bounces || 0) > lastB) sfx("table", Math.min(1, Math.abs(sim.ball.vy) / 4 + 0.2), panOf(sim.ball.x));
      if ((sim.nets || 0) > lastN) sfx("net", 0.6, panOf(sim.ball.x));
      lastB = sim.bounces || 0;
      lastN = sim.nets || 0;
      const rally = v.phase === "rally";
      const ball = rally ? r.ball : [v.ball[0], v.ball[1], v.ball[2]];
      const spin = rally ? [sim.ball.wx, sim.ball.wy, sim.ball.wz] : [v.ball[6], v.ball[7], v.ball[8]];
      scene.update({ ball, pads: r.pads.map((p, i) => [p[0], p[1], sim.pads[i].z]), padVel: sim.pads.map((p) => [p.vx || 0, p.vy || 0]), spin }, dt, ms);
      hudT += dt;
      if (hudT > 0.5) {
        hudT = 0;
        setHud(scene.stats);
        setPing(isHost ? 0 : Math.round(live.rtt * 1000));
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      unsub();
      ro.disconnect();
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      cv.removeEventListener("pointermove", onPointer);
      cv.removeEventListener("pointerdown", onDown);
      scene.dispose();
      sceneRef.current = null;
    };
  }, [mySeat, isHost, gfx, prefs.table, prefs.mine]); // eslint-disable-line

  useEffect(() => {
    const sc = view.score.join("-");
    if (sc === lastScore.current) return;
    lastScore.current = sc;
    sceneRef.current?.setScore(view.score[0], view.score[1]);
  }, [view.score]);

  const win = view.winner != null && view.winner === mySeat;
  const v = live.v?.t === "pingpong" ? live.v : view;
  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block touch-none cursor-none" aria-label="Masa tenisi. Fare, dokunma ya da ok tuşlarıyla raketi sür, tıkla ya da Boşluk ile servis at." />
      {failed && <div className="absolute inset-0 flex items-center justify-center text-sm text-[#b5bac1]">Bu cihazda 3B grafik (WebGL) başlatılamadı.</div>}
      <ScoreBanner
        left={{ name: nameOf(view.seats[0]) + (mySeat === 0 ? " (sen)" : ""), sub: view.server === 0 && view.phase !== "over" ? "🏓 servis" : undefined, color: colors[0] === "#16171a" ? "#475569" : colors[0], score: view.score[0], active: view.server === 0 && view.phase !== "over" }}
        right={{ name: nameOf(view.seats[1]) + (mySeat === 1 ? " (sen)" : ""), sub: view.server === 1 && view.phase !== "over" ? "🏓 servis" : undefined, color: colors[1] === "#16171a" ? "#475569" : colors[1], score: view.score[1], active: view.server === 1 && view.phase !== "over" }}
        center={<><div>{view.target} sayıya</div>{view.winBy2 && <div className="text-white/70">2 fark</div>}{!isHost && mySeat >= 0 && <div className={ping > 150 ? "text-amber-300" : "text-white/70"}>{ping} ms{live.route === "p2p" ? " · P2P" : ""}</div>}</>}
      />
      {showFps && hud && <div className="absolute top-3 right-3 text-[11px] tabular-nums text-[#b5bac1] bg-black/45 rounded px-2 py-1 pointer-events-none">{hud.fps} fps · {hud.tier} · {hud.dpr}x · {hud.calls} çizim</div>}
      {view.phase === "serve" && (
        <HintPill sub={v.server === mySeat ? "Raketi yukarı/aşağı hareket ettirerek falso ver" : undefined} className="!bottom-24">
          {v.server === mySeat ? "🏓 Servis: tıkla ya da Boşluk" : `${nameOf(view.seats[view.server])} servis atıyor`}
        </HintPill>
      )}
      {view.phase === "point" && view.msg && <BigCall size="text-6xl">{view.msg}</BigCall>}
      {(hintOn || mySeat < 0) && <HintPill sub={mySeat < 0 ? undefined : "yukarı vuruş = topspin · aşağı = kesme · hızlı = smaç"}>{mySeat < 0 ? "İzliyorsun" : "🖱️ Raketi yana/yukarı sür (ileri-geri otomatik)"}</HintPill>}
      {view.phase === "over" && (
        <EndCard
          win={win}
          title={mySeat < 0 ? `${nameOf(view.seats[view.winner])} kazandı` : win ? "Kazandın!" : "Kaybettin"}
          subtitle={`${view.score[0]} – ${view.score[1]}${view.reason === "forfeit" ? " · rakip ayrıldı" : ""}`}
          isHost={isHost}
          onRematch={onRematch}
          onLobby={onLobby}
          onLeave={onLeave}
          rkey={`${session.sid}-${session.round}`}
        >
          <div className="mt-2 text-xs text-[#949ba4]">En uzun rali: {view.longest || 0} vuruş</div>
        </EndCard>
      )}
    </div>
  );
}
