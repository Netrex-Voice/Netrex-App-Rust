"use client";

import { useEffect, useRef, useState } from "react";
import * as pool from "../engines/pool";
import { EndCard, PlayerPlate, HintPill } from "../ui";
import { useGamesPrefs } from "../store";
import { PoolScene, BALL_COLORS } from "../three/poolScene";
import { sfx } from "../three/sound";

const CLOTHS = { green: "#1d6b3f", blue: "#1f4f8a", red: "#7a1f2b", grey: "#4a4f57" };

/** Nişan yardımcısı: beyazın gideceği yönde ilk temas (hayalet top) */
function ghostOf(balls, cue, dx, dz) {
  let best = null;
  for (const b of balls) {
    if (!b.on || b.n === 0) continue;
    const ox = b.x - cue.x;
    const oz = b.z - cue.z;
    const t = ox * dx + oz * dz;
    if (t <= 0) continue;
    const d2 = ox * ox + oz * oz - t * t;
    const rr = 4 * pool.R * pool.R;
    if (d2 > rr) continue;
    const back = Math.sqrt(rr - d2);
    const tt = t - back;
    if (!best || tt < best.t) best = { t: tt, n: b.n };
  }
  if (!best) return null;
  return { x: cue.x + dx * best.t, z: cue.z + dz * best.t, n: best.n };
}

export default function PoolView({ view, session, myId, send, isHost, onRematch, onLobby, onLeave }) {
  const canvasRef = useRef(null);
  const gfx = useGamesPrefs((s) => s.gfx);
  const showFps = useGamesPrefs((s) => s.showFps);
  const clothKey = useGamesPrefs((s) => s.pool?.cloth || "green");
  const me = view.me;
  const myTurn = me >= 0 && view.turn === me && !view.bots[me];
  const nameOf = (i) => session.players.find((p) => p.id === view.seats[i])?.name || "Oyuncu";
  const [spin, setSpin] = useState({ a: 0, b: 0 });
  const [power, setPower] = useState(0);
  const [hud, setHud] = useState(null);
  const [failed, setFailed] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const spinRef = useRef(spin);
  spinRef.current = spin;

  useEffect(() => {
    const cv = canvasRef.current;
    let scene;
    try {
      scene = new PoolScene(cv, { seat: me, gfx, cloth: CLOTHS[clothKey] || CLOTHS.green });
    } catch (e) {
      console.error("[pool] WebGL başlatılamadı", e);
      setFailed(true);
      return;
    }
    // durum
    const st = { aim: { dx: me === 1 ? -1 : 1, dz: 0 }, fine: false, pulling: false, pullY: 0, pull: 0, place: null, run: null, lastAimSend: 0 };
    const pointerPlane = (e) => scene.pick(e.clientX, e.clientY);
    const cueOf = (balls) => balls.find((b) => b.n === 0);

    // Nişan: kamera nişan yönünü izlediği için mutlak fare konumundan yön hesaplamak geri besleme döngüsü
    // (kamera döner → fare başka noktayı gösterir → yön değişir…) yaratır. Bu yüzden yatay fare HAREKETİ yönü çevirir.
    const rotAim = (ang) => {
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      st.aim = { dx: st.aim.dx * c - st.aim.dz * s, dz: st.aim.dx * s + st.aim.dz * c };
    };
    const onMove = (e) => {
      const v = viewRef.current;
      if (st.pulling) {
        st.pull = Math.max(0, Math.min(1, (e.clientY - st.pullY) / 220));
        setPower(st.pull);
        return;
      }
      if (!(v.turn === me && !v.bots[me])) return;
      if (v.phase === "place") {
        const p = pointerPlane(e);
        if (p) st.place = p;
        return;
      }
      if (v.phase !== "aim") return;
      const dxm = e.movementX || 0;
      if (dxm) rotAim(dxm * (e.shiftKey ? 0.0008 : 0.0045));
    };
    const onDown = (e) => {
      const v = viewRef.current;
      if (!(v.turn === me && !v.bots[me])) return;
      if (v.phase === "place") {
        const p = pointerPlane(e);
        if (p && pool.canPlace(v, p.x, p.z)) send({ t: "place", x: p.x, z: p.z });
        return;
      }
      if (v.phase !== "aim" || e.button === 2) return;
      cv.setPointerCapture?.(e.pointerId);
      st.pulling = true;
      st.pullY = e.clientY;
      st.pull = 0;
    };
    const onUp = () => {
      if (!st.pulling) return;
      st.pulling = false;
      setPower(0);
      if (st.pull < 0.03) return; // çekmeden bıraktı: vuruş yok
      sfx("cue", st.pull, 0);
      send({ t: "shoot", dx: st.aim.dx, dz: st.aim.dz, power: st.pull, a: spinRef.current.a, b: spinRef.current.b });
      st.pull = 0;
    };
    const onKey = (e) => {
      const v = viewRef.current;
      if (!(v.turn === me && v.phase === "aim")) return;
      const k = e.shiftKey ? 0.0015 : 0.012;
      const rot = rotAim;
      if (e.code === "ArrowLeft") (rot(-k), e.preventDefault());
      if (e.code === "ArrowRight") (rot(k), e.preventDefault());
      if (e.code === "Escape") (st.pulling = false), setPower(0);
    };
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
    const ctxMenu = (e) => e.preventDefault();
    cv.addEventListener("contextmenu", ctxMenu);
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
      const v = viewRef.current;
      let balls = pool.ballsFromView(v);
      let mode = "aim";
      // vuruş: aynı fizikle yerelde oynat (ping'den bağımsız); geç katılan kadar ileri sar
      if (v.shot) {
        if (!st.run || st.run.id !== v.shot.id) {
          const bs = pool.ballsFromView(v);
          pool.strike(bs.find((b) => b.n === 0), v.shot.dx, v.shot.dz, v.shot.power, v.shot.a, v.shot.b);
          st.run = { id: v.shot.id, balls: bs, acc: 0, t: 0 };
          if (v.shot.t > 0.05) st.run.acc = v.shot.t;
          else if (v.turn !== me) sfx("cue", v.shot.power, 0);
        }
        const run = st.run;
        run.acc += dt;
        const ev = [];
        while (run.acc >= 1 / 960) {
          run.acc -= 1 / 960;
          pool.stepBalls(run.balls, 1 / 960, ev);
        }
        for (const e of ev.slice(0, 6)) {
          if (e.e === "ball") sfx("ballclick", Math.min(1, e.v / 3), 0);
          else if (e.e === "cushion") sfx("cushion", Math.min(1, e.v / 3), 0);
          else if (e.e === "pocket") sfx("pocket", 1, 0);
        }
        balls = run.balls;
        mode = "move";
      } else st.run = null;
      const cue = cueOf(balls);
      let aim = null;
      let ghost = null;
      if (v.phase === "aim" && !v.shot) {
        if (v.turn === me && !v.bots[me]) {
          aim = { ...st.aim, pull: st.pull, show: true };
          ghost = ghostOf(balls, cue, st.aim.dx, st.aim.dz);
          if (t - st.lastAimSend > 100) {
            st.lastAimSend = t;
            send({ t: "aim", dx: Math.round(st.aim.dx * 1e4) / 1e4, dz: Math.round(st.aim.dz * 1e4) / 1e4, power: Math.round(st.pull * 100) / 100 });
          }
        } else if (v.aim) {
          aim = { dx: v.aim.dx, dz: v.aim.dz, pull: v.aim.power, show: true };
          mode = "watch";
        } else mode = "watch";
      }
      if (v.phase === "place") {
        mode = "place";
        if (v.turn === me && st.place && pool.canPlace(v, st.place.x, st.place.z)) balls = balls.map((b) => (b.n === 0 ? { ...b, x: st.place.x, z: st.place.z, on: true } : b));
      }
      scene.update({ balls: balls.map((b) => [b.n, b.x, b.z, b.on]), cue, aim, ghost, mode }, dt, ms);
      hudT += dt;
      if (hudT > 0.5) {
        hudT = 0;
        setHud(scene.stats);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("contextmenu", ctxMenu);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
      scene.dispose();
    };
  }, [me, gfx, clothKey]); // eslint-disable-line

  const groupLabel = (g) => (g === "solid" ? "Düz (1–7)" : g === "stripe" ? "Çizgili (9–15)" : "Açık masa");
  const remaining = (i) => {
    const g = view.groups[i];
    if (!g) return [];
    const list = g === "solid" ? pool.SOLIDS : pool.STRIPES;
    const on = new Set(view.balls.filter((b) => b[3]).map((b) => b[0]));
    return list.filter((n) => on.has(n));
  };
  const win = view.winner === me;

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block touch-none" aria-label="Bilardo masası. Fareyle nişan al, basılı tutup geri çekerek vur." />
      {failed && <div className="absolute inset-0 flex items-center justify-center text-sm text-[#b5bac1]">Bu cihazda 3B grafik (WebGL) başlatılamadı.</div>}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-between gap-3">
        {[0, 1].map((i) => (
          <PlayerPlate key={i} name={nameOf(i) + (i === me ? " (sen)" : "")} sub={groupLabel(view.groups[i])} color={["#6366f1", "#f59e0b"][i]} active={view.turn === i && view.phase !== "over"} className="min-w-[210px]">
            {remaining(i).length > 0 && (
              <div className="flex flex-wrap gap-1 rounded-lg bg-black/25 px-1.5 py-1">
                {remaining(i).map((n) => (
                  <span key={n} className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-black/30 text-[9px] font-black" style={{ background: n >= 9 ? `linear-gradient(#f5f1e6 25%, ${BALL_COLORS[n]} 25% 75%, #f5f1e6 75%)` : BALL_COLORS[n], color: n === 8 || n === 2 || n === 4 || n === 7 ? "#fff" : "#000" }}>{n}</span>
                ))}
              </div>
            )}
          </PlayerPlate>
        ))}
      </div>
      {showFps && hud && <div className="absolute top-24 right-3 text-[11px] tabular-nums text-[#b5bac1] bg-black/45 rounded px-2 py-1 pointer-events-none">{hud.fps} fps · {hud.tier} · {hud.calls} çizim</div>}
      <HintPill sub={myTurn ? (view.phase === "place" ? (view.kitchenOnly ? "Beyazı baş çizgisinin gerisine yerleştir (tıkla)" : "Beyazı istediğin yere yerleştir (tıkla)") : "Fareyle nişan al (← → ince ayar, Shift çok ince) · basılı tut, aşağı çek, bırak = vuruş") : undefined}>
        {view.msg ? `${view.msg} · ` : ""}{myTurn ? (view.phase === "place" ? "🎱 Elde top" : "🎱 Sıra sende") : view.phase === "moving" ? "…" : `${nameOf(view.turn)} oynuyor`}{view.turnTime > 0 && view.phase !== "over" && view.phase !== "moving" ? ` · ${view.turnLeft} sn` : ""}
      </HintPill>
      {/* Güç çubuğu */}
      {power > 0 && (
        <div className="pointer-events-none absolute left-5 top-1/2 h-56 w-6 -translate-y-1/2 overflow-hidden rounded-full border-[3px] border-white/40 bg-black/55 p-[3px]" aria-label="Vuruş gücü">
          <div className="relative h-full w-full overflow-hidden rounded-full">
            <div className="absolute inset-x-0 bottom-0 rounded-full" style={{ height: `${power * 100}%`, background: power > 0.8 ? "linear-gradient(180deg,#fb8a8a,#dc2626)" : power > 0.5 ? "linear-gradient(180deg,#ffc04d,#f97316)" : "linear-gradient(180deg,#5eea8f,#16a34a)" }} />
          </div>
        </div>
      )}
      {/* Falso seçici */}
      {myTurn && view.phase === "aim" && (
        <div className="absolute bottom-5 right-5 z-10 flex flex-col items-center gap-1.5">
          <button
            type="button"
            aria-label="Falso noktası seç"
            className="relative h-24 w-24 rounded-full bg-[#f5f1e6] shadow-[0_6px_0_rgba(0,0,0,.35),0_12px_20px_rgba(0,0,0,.4)] ring-4 ring-white/80"
            style={{ backgroundImage: "radial-gradient(circle at 32% 28%, #ffffff, #f5f1e6 45%, #d9d3c0)" }}
            onPointerDown={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const a = ((e.clientX - r.left) / r.width - 0.5) * 2 * 0.5;
              const b = -((e.clientY - r.top) / r.height - 0.5) * 2 * 0.5;
              const l = Math.hypot(a, b);
              setSpin(l > 0.5 ? { a: (a / l) * 0.5, b: (b / l) * 0.5 } : { a, b });
            }}
          >
            <span className="absolute h-3.5 w-3.5 rounded-full bg-[#c81e1e] shadow-[0_2px_3px_rgba(0,0,0,.5)]" style={{ left: `${50 + spin.a * 100 - 7}%`, top: `${50 - spin.b * 100 - 7}%` }} />
          </button>
          <span className="rounded-full bg-black/65 px-3 py-0.5 text-[11px] font-extrabold text-white">{spin.b > 0.15 ? "Takip" : spin.b < -0.15 ? "Geri çekme" : "Orta"}{Math.abs(spin.a) > 0.15 ? (spin.a > 0 ? " · sağ" : " · sol") : ""}</span>
        </div>
      )}
      {view.phase === "over" && (
        <EndCard
          win={win}
          title={me < 0 ? `${nameOf(view.winner)} kazandı` : win ? "Kazandın!" : "Kaybettin"}
          subtitle={view.msg}
          isHost={isHost}
          onRematch={onRematch}
          onLobby={onLobby}
          onLeave={onLeave}
          rkey={`${session.sid}-${session.round}`}
        >
          <div className="mt-2 text-xs text-[#949ba4]">Faul: {view.fouls[0]} – {view.fouls[1]}</div>
        </EndCard>
      )}
    </div>
  );
}
