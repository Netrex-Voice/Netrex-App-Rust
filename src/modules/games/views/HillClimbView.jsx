"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, Play, RotateCcw, Home, Pause, Coins, Fuel, Check } from "lucide-react";
import { useHillStore, isStageUnlocked } from "../hillStore";
import { createRun, step, wheelPose, STAGES, STAGE_ORDER, VEHICLES, VEHICLE_ORDER, UPGRADES, upgradeCost, MAX_FUEL } from "../engines/hillclimb";
import { drawScene, drawVehicle, world } from "../three/hillDraw";
import { useGamesPrefs } from "../store";
import { beep } from "../ui";

const card = "rounded-2xl border border-white/10 bg-[#1b1d22]/90";
const REASON = { head: "Kafan yere çarptı!", fuel: "Benzin bitti!", numeric: "Fizik hatası" };

// ───────────────────────────── Motor sesi ─────────────────────────────
function useEngineSound() {
  const ref = useRef(null);
  const start = useCallback(() => {
    if (ref.current) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = "sawtooth"; o2.type = "square"; f.type = "lowpass"; f.frequency.value = 500;
      g.gain.value = 0;
      o.connect(f); o2.connect(f); f.connect(g).connect(ctx.destination);
      o.start(); o2.start();
      ref.current = { ctx, o, o2, g, f };
    } catch (e) {}
  }, []);
  const update = useCallback((speed, gas, on) => {
    const e = ref.current;
    if (!e) return;
    const { muted, vol } = useGamesPrefs.getState();
    const f = 48 + Math.min(30, Math.abs(speed)) * 3.2 + gas * 26;
    e.o.frequency.setTargetAtTime(f, e.ctx.currentTime, 0.05);
    e.o2.frequency.setTargetAtTime(f * 0.5, e.ctx.currentTime, 0.05);
    e.f.frequency.setTargetAtTime(380 + gas * 520, e.ctx.currentTime, 0.08);
    e.g.gain.setTargetAtTime(muted || !on ? 0 : (vol / 100) * (0.025 + gas * 0.03), e.ctx.currentTime, 0.08);
  }, []);
  const stop = useCallback(() => {
    const e = ref.current;
    if (!e) return;
    try { e.g.gain.value = 0; e.o.stop(); e.o2.stop(); e.ctx.close(); } catch (err) {}
    ref.current = null;
  }, []);
  useEffect(() => stop, [stop]);
  return { start, update, stop };
}

// ───────────────────────────── Garaj önizleme ─────────────────────────────
function VehiclePreview({ id, color }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    ctx.clearRect(0, 0, c.width, c.height);
    const P = { ...VEHICLES[id] };
    const k = Math.min(w / (P.wheelbase + P.R * 3.2), h / (P.R * 2 + 2.3));
    world(ctx, w, h, dpr, { x: 0, y: 0.3 }, k);
    const wheels = [0, 1].map((i) => ({ x: (i === 0 ? -1 : 1) * P.wheelbase / 2, y: -P.ax - P.e0 * 0.8 - 0.1, rot: i * 0.6 }));
    drawVehicle(ctx, P, { x: 0, y: 0, a: 0.04, wheels });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [id, color]);
  return <canvas ref={ref} className="h-24 w-full" aria-hidden />;
}

// ───────────────────────────── Ana ─────────────────────────────
export default function HillClimbView() {
  const [screen, setScreen] = useState("menu"); // menu | play
  const [result, setResult] = useState(null);
  if (screen === "play") return <Game key={result?.n || 0} onExit={(r) => { setResult(r); setScreen("menu"); }} onAgain={() => setResult((r) => ({ ...(r || {}), n: (r?.n || 0) + 1 }))} />;
  return <Garage last={result} onStart={() => { setResult(null); setScreen("play"); }} />;
}

// ───────────────────────────── Garaj ─────────────────────────────
function Garage({ onStart, last }) {
  const s = useHillStore();
  const veh = VEHICLES[s.vehicle];
  const stageUnlocked = (id) => isStageUnlocked(s.best, id);
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-white">🏔️ Tepe Tırmanışı</h1>
          <p className="text-sm font-medium text-white/60">Benzinin bitmeden en uzağa git. Altınlarla aracını geliştir.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-amber-400/15 px-4 py-2 text-lg font-black tabular-nums text-amber-300"><Coins size={18} />{s.coins.toLocaleString("tr-TR")}</div>
      </div>

      {last?.over && (
        <div className={`${card} flex flex-wrap items-center gap-4 p-4`}>
          <div className="text-3xl">{last.record ? "🏅" : "🏁"}</div>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-black text-white">{last.dist} m {last.record && <span className="ml-1 rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-300">Yeni rekor</span>}</div>
            <div className="text-sm font-semibold text-white/60">{REASON[last.reason]} · +{last.coins} altın{last.flips ? ` · ${last.flips} takla` : ""}{last.unlocked?.length ? ` · 🔓 ${last.unlocked.map((id) => STAGES[id].name).join(", ")} açıldı` : ""}</div>
          </div>
        </div>
      )}

      <section>
        <h2 className="mb-2 text-xs font-black uppercase tracking-wider text-white/70">Bölüm</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {STAGE_ORDER.map((id) => {
            const st = STAGES[id], un = stageUnlocked(id), on = s.stage === id;
            return (
              <button key={id} type="button" disabled={!un} onClick={() => s.select("stage", id)} aria-pressed={on}
                className={`relative overflow-hidden rounded-2xl border-2 p-0 text-left transition ${on ? "border-amber-400" : "border-white/10"} ${un ? "hover:-translate-y-0.5" : "opacity-60"}`}>
                <span className="block h-20" style={{ background: `linear-gradient(180deg, ${st.sky[0]}, ${st.sky[1]} 60%, ${st.ground} 60%, ${st.dirt} 75%)` }} />
                <span className="block bg-[#1b1d22] px-3 py-2">
                  <span className="block text-sm font-black text-white">{st.name}</span>
                  <span className="block text-[11px] font-semibold text-white/55">{un ? (s.best[id] ? `Rekor ${s.best[id]} m` : st.g < 5 ? "Düşük yerçekimi" : "Henüz denenmedi") : <><Lock size={10} className="mr-1 inline -mt-0.5" />{STAGES[st.unlock.stage].name}'de {st.unlock.m} m</>}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-black uppercase tracking-wider text-white/70">Araç</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {VEHICLE_ORDER.map((id) => {
            const v = VEHICLES[id], own = s.owned.includes(id), on = s.vehicle === id;
            return (
              <div key={id} className={`${card} p-3 ${on ? "ring-2 ring-amber-400" : ""}`}>
                <VehiclePreview id={id} color={v.color} />
                <div className="mt-1 flex items-center justify-between">
                  <div><div className="text-sm font-black text-white">{v.name}</div><div className="text-[11px] font-semibold text-white/50">{v.mass} kg · {v.awdAble ? "4x4 olabilir" : "tek tekerlek çeker"}</div></div>
                  {own
                    ? <button type="button" onClick={() => s.select("vehicle", id)} disabled={on} className={`rounded-lg px-3 py-1.5 text-xs font-black ${on ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white hover:bg-white/15"}`}>{on ? <><Check size={12} className="mr-1 inline" />Seçili</> : "Seç"}</button>
                    : <button type="button" onClick={() => s.buyVehicle(id)} disabled={s.coins < v.price} className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-black text-[#3b2a00] transition hover:brightness-110 disabled:opacity-40">{v.price.toLocaleString("tr-TR")} 🪙</button>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-black uppercase tracking-wider text-white/70">Yükseltmeler · {veh.name}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(UPGRADES).filter(([k]) => k !== "awd" || veh.awdAble).map(([k, u]) => {
            const lv = s.upg[s.vehicle]?.[k] || 0, maxed = lv >= u.max, cost = upgradeCost(k, lv);
            return (
              <div key={k} className={`${card} flex items-center gap-3 p-3`}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-white">{u.name}</div>
                  <div className="text-[11px] font-semibold text-white/50">{u.desc}</div>
                  <div className="mt-1.5 flex gap-1">{Array.from({ length: u.max }, (_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < lv ? "bg-amber-400" : "bg-white/10"}`} />)}</div>
                </div>
                <button type="button" disabled={maxed || s.coins < cost} onClick={() => s.buyUpgrade(k)} className="min-w-[88px] rounded-lg bg-amber-400 px-3 py-2 text-xs font-black text-[#3b2a00] transition hover:brightness-110 disabled:bg-white/10 disabled:text-white/40">{maxed ? "Tam" : `${cost.toLocaleString("tr-TR")} 🪙`}</button>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex items-center gap-4">
        <button type="button" onClick={onStart} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 py-4 text-xl font-black text-[#3b2a00] shadow-[0_5px_0_#92600b] transition hover:brightness-110 active:translate-y-[3px] active:shadow-[0_2px_0_#92600b]"><Play size={22} className="fill-current" />BAŞLA</button>
        <div className="hidden text-right text-xs font-semibold text-white/45 sm:block">{s.stats.runs} koşu · {s.stats.dist.toLocaleString("tr-TR")} m toplam · {s.stats.flips} takla</div>
      </div>
    </div>
  );
}

// ───────────────────────────── Oyun ─────────────────────────────
function Game({ onExit, onAgain }) {
  const canvasRef = useRef(null);
  const boxRef = useRef(null);
  const sound = useEngineSound();
  const { stage, vehicle, upg } = useHillStore.getState();
  const [hud, setHud] = useState({ dist: 0, coins: 0, fuel: MAX_FUEL, speed: 0 });
  const [over, setOver] = useState(null);
  const [paused, setPaused] = useState(false);
  const [banner, setBanner] = useState(null);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const input = useRef({ gas: 0, brake: 0, keyGas: 0, keyBrake: 0, padGas: 0, padBrake: 0 });
  const reported = useRef(false);
  const bankRef = useRef(null);

  useEffect(() => {
    const st = STAGES[stage];
    const seed = (Math.random() * 1e6) | 0;
    const run = createRun({ stageId: stage, vehicleId: vehicle, upgrades: upg[vehicle] || {}, seed });
    const cv = canvasRef.current, box = boxRef.current;
    const ctx = cv.getContext("2d");
    let w = 0, h = 0, dpr = 1;
    const fit = () => {
      const r = box.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(320, r.width); h = Math.max(240, r.height);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.width = w + "px"; cv.style.height = h + "px";
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);

    // Koşuyu bir kez cüzdana işle (bitişte, garaja dönüşte ya da panel kapanınca): altın kaybolmaz
    bankRef.current = () => {
      if (reported.current) return null;
      reported.current = true;
      if (run.dist < 1 && run.coins === 0) return null;
      const res = useHillStore.getState().finishRun({ stageId: stage, dist: run.dist, coins: run.coins, flips: run.flips });
      return { reason: run.over?.reason || "quit", dist: Math.floor(run.dist), coins: Math.floor(run.coins), flips: run.flips, ...res };
    };
    const cam = { x: run.x + 3, y: run.y + 1 };
    const wheelRot = [0, 0];
    const parts = [];
    let shake = 0, last = performance.now(), hudT = 0, raf, bannerT;
    const say = (text, color) => {
      setBanner({ text, color, n: Math.random() });
      clearTimeout(bannerT);
      bannerT = setTimeout(() => setBanner(null), 1400);
    };

    // Klavye: capture aşamasında, hem fiziksel tuş (code) hem harf (key) ile; odak kaybında tuşlar bırakılır
    const GAS = new Set(["ArrowRight", "KeyD", "ArrowUp", "KeyW", "Space", "d", "D", "w", "W", " "]);
    const BRAKE = new Set(["ArrowLeft", "KeyA", "ArrowDown", "KeyS", "a", "A", "s", "S"]);
    const onKey = (e, down) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const hitGas = GAS.has(e.code) || GAS.has(e.key), hitBrake = BRAKE.has(e.code) || BRAKE.has(e.key);
      if (hitGas) { input.current.keyGas = down ? 1 : 0; e.preventDefault(); sound.start(); }
      else if (hitBrake) { input.current.keyBrake = down ? 1 : 0; e.preventDefault(); sound.start(); }
      else if (down && !e.repeat && (e.code === "KeyP" || e.code === "Escape")) { setPaused((p) => !p); e.preventDefault(); }
    };
    const kd = (e) => onKey(e, true), ku = (e) => onKey(e, false);
    const blur = () => { input.current.keyGas = 0; input.current.keyBrake = 0; };
    window.addEventListener("keydown", kd, true);
    window.addEventListener("keyup", ku, true);
    window.addEventListener("blur", blur);

    const spawn = (x, y, color, n = 1, spd = 2, up = 1.5, r = 0.07) => {
      for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * spd - run.vx * 0.15, vy: Math.random() * up + 0.2, r: r * (0.6 + Math.random()), life: 0.7, max: 0.7, color });
    };
    const fxColor = st.fx === "snow" ? "#ffffff" : st.fx === "dust" ? "#e8c07a" : st.fx === "leaf" ? "#7bbf4a" : "#c9ccd6";

    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const I = input.current;
      I.gas = Math.max(I.keyGas, I.padGas);
      I.brake = Math.max(I.keyBrake, I.padBrake);
      if (!pausedRef.current && !run.over) {
        step(run, { gas: I.gas, brake: I.brake }, dt);
        for (const i of [0, 1]) wheelRot[i] -= run.wheels[i].omega * dt;
        // olaylar
        for (const ev of run.events.splice(0)) {
          if (ev.type === "coin") { beep(ev.v >= 50 ? 1180 : 880, 0.07, "triangle", 0.06); spawn(ev.x, ev.y, "#fde047", 6, 3, 2.5, 0.06); }
          else if (ev.type === "fuel") { beep(520, 0.14, "square", 0.05); say("Benzin doldu!", "#86efac"); }
          else if (ev.type === "flip") { beep(660, 0.2, "triangle", 0.07); say(`${ev.kind === "back" ? "ARKA" : "ÖN"} TAKLA${ev.n > 1 ? " x" + ev.n : ""}  +${ev.bonus}`, "#fde047"); }
          else if (ev.type === "air") { say(`HAVADA ${ev.sec.toFixed(1)} sn  +${ev.bonus}`, "#7dd3fc"); }
          else if (ev.type === "crash") { shake = 0.6; beep(90, 0.4, "sawtooth", 0.1); }
        }
        // iz parçacıkları
        for (const i of [0, 1]) {
          const W = run.wheels[i];
          if (W.ground && Math.abs(run.vx) > 2 && Math.random() < 0.5) {
            const p = wheelPose(run, i);
            spawn(p.x - 0.1, p.y - run.params.R * 0.9, fxColor, 1, 1.5, 1.2, 0.08);
          }
        }
        sound.update(run.vx, I.gas, !run.over);
      } else sound.update(0, 0, false);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 4 * dt;
      }
      // kamera
      const k = Math.max(26, Math.min(70, h / 13));
      const tx = run.x + 3.2 + Math.max(-3, Math.min(6, run.vx * 0.3)), ty = run.y + 1.2;
      cam.x += (tx - cam.x) * Math.min(1, dt * 4);
      cam.y += (ty - cam.y) * Math.min(1, dt * 3);
      shake = Math.max(0, shake - dt);
      const sx = shake ? (Math.random() - 0.5) * shake * 0.5 : 0, sy = shake ? (Math.random() - 0.5) * shake * 0.5 : 0;
      drawScene(ctx, run, st, { x: cam.x + sx, y: cam.y + sy }, w, h, dpr, k, t / 1000, parts, wheelRot);

      hudT += dt;
      if (hudT > 0.1) {
        hudT = 0;
        setHud({ dist: run.dist, coins: run.coins, fuel: run.fuel, speed: Math.abs(run.vx), gas: I.gas > 0, brake: I.brake > 0 });
      }
      if (run.over && !reported.current) {
        setOver(bankRef.current());
        sound.update(0, 0, false);
      }
    };
    raf = requestAnimationFrame(loop);
    const onVis = () => document.hidden && setPaused(true);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(bannerT);
      ro.disconnect();
      window.removeEventListener("keydown", kd, true);
      window.removeEventListener("keyup", ku, true);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", onVis);
      bankRef.current?.();
      sound.stop();
    };
  }, []); // eslint-disable-line

  const pedal = (key) => ({
    onPointerDown: (e) => { e.currentTarget.setPointerCapture?.(e.pointerId); input.current[key] = 1; sound.start(); },
    onPointerUp: () => { input.current[key] = 0; },
    onPointerCancel: () => { input.current[key] = 0; },
    onLostPointerCapture: () => { input.current[key] = 0; },
    onContextMenu: (e) => e.preventDefault(),
  });
  const pct = Math.round((hud.fuel / MAX_FUEL) * 100);
  const best = useHillStore.getState().best[stage] || 0;

  return (
    <div ref={boxRef} className="relative h-[calc(100vh-110px)] min-h-[420px] w-full select-none overflow-hidden bg-black touch-none">
      <canvas ref={canvasRef} className="absolute inset-0 block" aria-label="Tepe Tırmanışı oyun alanı" />
      {/* HUD */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-2">
        <div className="rounded-xl bg-black/55 px-3 py-1.5 text-white backdrop-blur"><span className="text-2xl font-black tabular-nums">{Math.floor(hud.dist)}</span><span className="ml-1 text-sm font-bold text-white/60">m</span><span className="ml-3 text-[11px] font-bold text-white/45">Rekor {Math.max(best, Math.floor(hud.dist))} m</span></div>
        <div className="flex items-center gap-2 rounded-xl bg-black/55 px-3 py-1.5 text-amber-300 backdrop-blur"><Coins size={16} /><span className="text-lg font-black tabular-nums">{Math.floor(hud.coins)}</span></div>
      </div>
      <div className="pointer-events-none absolute right-3 top-3 w-44 rounded-xl bg-black/55 px-3 py-2 backdrop-blur">
        <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-white/70"><span className="flex items-center gap-1"><Fuel size={12} />Benzin</span><span className="tabular-nums">{Math.round(hud.speed * 3.6)} km/sa</span></div>
        <div className="h-2.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full transition-[width] duration-100" style={{ width: pct + "%", background: pct < 20 ? "#ef4444" : pct < 45 ? "#f59e0b" : "#22c55e" }} /></div>
      </div>
      <button type="button" onClick={() => setPaused((p) => !p)} className="absolute right-3 top-[68px] flex h-9 w-9 items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur hover:bg-black/70" aria-label="Duraklat (P)"><Pause size={16} /></button>
      {banner && <div key={banner.n} className="pointer-events-none absolute left-1/2 top-[22%] -translate-x-1/2 animate-bounce text-center text-3xl font-black" style={{ color: banner.color, textShadow: "0 3px 0 rgba(0,0,0,.55)" }}>{banner.text}</div>}
      {pct < 22 && !over && <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 animate-pulse rounded-full bg-red-600/90 px-4 py-1 text-xs font-black text-white">BENZİN AZ — kırmızı bidonu topla!</div>}

      {/* Pedallar */}
      <button type="button" aria-label="Fren / geri" {...pedal("padBrake")} className={`absolute bottom-4 left-4 flex h-24 w-24 flex-col items-center justify-center rounded-2xl border-2 text-sm font-black text-white/85 backdrop-blur transition active:scale-95 ${hud.brake ? "border-rose-300 bg-rose-500/60 scale-95" : "border-white/25 bg-black/45"}`}>FREN<span className="text-[10px] font-bold opacity-60">A / ←</span></button>
      <button type="button" aria-label="Gaz" {...pedal("padGas")} className={`absolute bottom-4 right-4 flex h-28 w-24 flex-col items-center justify-center rounded-2xl border-2 text-sm font-black text-white backdrop-blur transition active:scale-95 ${hud.gas ? "border-emerald-200 bg-emerald-500/70 scale-95" : "border-emerald-300/40 bg-emerald-500/30"}`}>GAZ<span className="text-[10px] font-bold opacity-60">D / →</span></button>
      <div className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[11px] font-semibold text-white/60 sm:block">→ / D gaz · ← / A fren · havada gaz/fren aracı döndürür · P duraklat</div>

      {paused && !over && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className={`${card} flex w-72 flex-col gap-2 p-5 text-center`}>
            <div className="mb-1 text-xl font-black text-white">Duraklatıldı</div>
            <button type="button" onClick={() => setPaused(false)} className="rounded-xl bg-amber-400 py-2.5 text-sm font-black text-[#3b2a00]">Devam et</button>
            <button type="button" onClick={onAgain} className="rounded-xl bg-white/10 py-2.5 text-sm font-black text-white hover:bg-white/15">Baştan başla</button>
            <button type="button" onClick={() => onExit({ over: true, ...(bankRef.current() || {}) })} className="rounded-xl bg-white/10 py-2.5 text-sm font-black text-white hover:bg-white/15">Koşuyu bitir ve garaja dön</button>
          </div>
        </div>
      )}

      {over && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className={`${card} w-full max-w-sm overflow-hidden text-center`}>
            <div className="bg-gradient-to-b from-red-900/60 to-transparent px-5 pb-3 pt-6">
              <div className="text-4xl">{over.record ? "🏅" : over.reason === "fuel" ? "⛽" : "💥"}</div>
              <h2 className="mt-1 text-2xl font-black text-white">{REASON[over.reason]}</h2>
              {over.record && <div className="mt-1 inline-block rounded-full bg-amber-400/20 px-3 py-0.5 text-xs font-black uppercase text-amber-300">Yeni rekor</div>}
            </div>
            <div className="grid grid-cols-3 gap-2 px-5 pb-2 text-white">
              <div className="rounded-xl bg-black/30 p-2"><div className="text-2xl font-black tabular-nums">{over.dist}</div><div className="text-[10px] font-bold uppercase text-white/50">metre</div></div>
              <div className="rounded-xl bg-black/30 p-2"><div className="text-2xl font-black tabular-nums text-amber-300">+{over.coins}</div><div className="text-[10px] font-bold uppercase text-white/50">altın</div></div>
              <div className="rounded-xl bg-black/30 p-2"><div className="text-2xl font-black tabular-nums">{over.flips}</div><div className="text-[10px] font-bold uppercase text-white/50">takla</div></div>
            </div>
            {over.unlocked?.length > 0 && <div className="mx-5 mb-2 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300">🔓 Yeni bölüm: {over.unlocked.map((id) => STAGES[id].name).join(", ")}</div>}
            <div className="grid grid-cols-2 gap-2 p-5 pt-3">
              <button type="button" onClick={onAgain} className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 py-3 text-sm font-black text-[#3b2a00]"><RotateCcw size={15} />Tekrar</button>
              <button type="button" onClick={() => onExit({ over: true, ...over })} className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-3 text-sm font-black text-white hover:bg-white/15"><Home size={15} />Garaj</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
