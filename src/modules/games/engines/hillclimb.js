/**
 * 🏔️ Tepe Tırmanışı — 2B araç fiziği (saf JS; React/ağ yok, Node'da başsız test edilir)
 *
 * Birim: metre, saniye, kg. x ileri, y yukarı; açı saat yönünün tersi (burun yukarı = +).
 * Model: sert gövde (kütle, atalet) + iki tekerlek. Her tekerlek gövdeye süspansiyon ekseni boyunca bağlı:
 *  • eksen üzerinde zemine ışın yürütülür → temas varsa yay-sönümleyici kuvveti gövdeye uygulanır (tümsek durdurucu dahil)
 *  • tekerlek ayrı bir dönen kütledir (ω): motor/fren torku ω'yı, zemin kayma (slip) kuvveti hem ω'yı hem gövdeyi etkiler
 *  • temas noktasında uygulanan boyuna kuvvet gövdede doğal olarak "wheelie" torku üretir; havada motor/fren tepkisi
 *    gövdeyi döndürür (HCR'deki hava kontrolü)
 *  • sürücünün kafası zemine değerse oyun biter; benzin biterse araç durunca biter
 * Arazi, tohumdan deterministik ve x'in saf fonksiyonudur; altın ve benzin bidonları parça (chunk) başına üretilir.
 */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const SUB_DT = 1 / 240;
export const MAX_FUEL = 100;

export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ───────── Bölümler ─────────
export const STAGES = {
  countryside: { id: "countryside", name: "Kır", unlock: null, g: 9.81, mu: 1.0, amp: 3.0, ramp: 1800, wave: 1, sky: ["#4ab8f0", "#bfe9fb"], ground: "#6bbf3a", dirt: "#8a5a2b", dirt2: "#6e4520", far: "#7dc4a0", far2: "#98d1b0", fx: "leaf" },
  desert: { id: "desert", name: "Çöl", unlock: { stage: "countryside", m: 500 }, g: 9.81, mu: 0.85, amp: 4.2, ramp: 1600, wave: 0.8, sky: ["#f7b267", "#fde7b3"], ground: "#f0c36a", dirt: "#d89a45", dirt2: "#b97b2e", far: "#e5a560", far2: "#efbe7e", fx: "dust" },
  arctic: { id: "arctic", name: "Kutup", unlock: { stage: "desert", m: 700 }, g: 9.81, mu: 0.42, amp: 3.6, ramp: 1700, wave: 1.05, sky: ["#8ecdf0", "#e6f6ff"], ground: "#f4fbff", dirt: "#9ec7e0", dirt2: "#7fb0cf", far: "#b8d8ea", far2: "#d2e8f4", fx: "snow" },
  moon: { id: "moon", name: "Ay", unlock: { stage: "arctic", m: 900 }, g: 1.62, mu: 0.9, amp: 4.0, ramp: 1500, wave: 0.7, sky: ["#05060f", "#1b1f3b"], ground: "#b9bcc7", dirt: "#7e808c", dirt2: "#5f616d", far: "#2a2e4f", far2: "#3a3f66", fx: "none" },
};
export const STAGE_ORDER = ["countryside", "desert", "arctic", "moon"];

// ───────── Araçlar ─────────
export const VEHICLES = {
  jeep: { id: "jeep", name: "Kır Cipi", price: 0, mass: 900, wheelbase: 2.6, R: 0.46, ax: 0.2, torque: 1500, wMax: 42, brake: 1700, k: 36000, c: 3600, e0: 0.56, eMax: 0.72, hw: 1.35, hh: 0.42, head: [0.1, 0.98], awdAble: true, color: "#e11d48", color2: "#fb7185", wheelMass: 55 },
  moto: { id: "moto", name: "Motokros", price: 1800, mass: 260, wheelbase: 1.75, R: 0.4, ax: 0.1, torque: 620, wMax: 52, brake: 650, k: 14000, c: 1200, e0: 0.46, eMax: 0.6, hw: 0.95, hh: 0.3, head: [-0.05, 1.12], awdAble: false, color: "#2563eb", color2: "#60a5fa", wheelMass: 22 },
  monster: { id: "monster", name: "Canavar Kamyon", price: 6000, mass: 2100, wheelbase: 3.1, R: 0.86, ax: 0.2, torque: 5200, wMax: 25, brake: 4800, k: 70000, c: 7500, e0: 0.8, eMax: 1.0, hw: 1.7, hh: 0.55, head: [0.15, 1.22], awdAble: true, color: "#16a34a", color2: "#4ade80", wheelMass: 140 },
};
export const VEHICLE_ORDER = ["jeep", "moto", "monster"];

export const UPGRADES = {
  engine: { name: "Motor", max: 5, desc: "Daha çok tork" },
  susp: { name: "Süspansiyon", max: 5, desc: "Daha sert yay, daha iyi sönüm" },
  tires: { name: "Lastikler", max: 5, desc: "Daha çok tutuş" },
  awd: { name: "4x4", max: 1, desc: "Önden de çekiş" },
};
export const upgradeCost = (kind, level) => (kind === "awd" ? 1500 : Math.round((120 * Math.pow(level + 1, 1.7)) / 10) * 10);

// ───────── Arazi ─────────
export function makeTerrain(stage, seed = 1) {
  const r = makeRng(seed * 7919 + 13);
  const p1 = r() * 6.283, p2 = r() * 6.283, p3 = r() * 6.283;
  const f1 = 0.1 * stage.wave, f2 = 0.23 * stage.wave, f3 = 0.55;
  const h = (x) => {
    if (x < -6) return (-6 - x) * 4 + h(-6); // geri duvar
    const fade = clamp((x - 10) / 70, 0, 1);
    const prog = clamp(x / stage.ramp, 0, 1); // 0 → 1: zorluk artar (genlik büyür, sık tümsekler karışır)
    const grow = stage.amp * (0.55 + 0.9 * prog);
    return fade * grow * ((0.62 - 0.12 * prog) * Math.sin(x * f1 + p1) + (0.28 + 0.27 * prog) * Math.sin(x * f2 + p2) + (0.08 + 0.1 * prog) * Math.sin(x * f3 + p3));
  };
  const STEP = 0.25;
  /** (px,py) noktasının araziye en yakın uzaklığı ve normali (R yarıçaplı bir taşıma için ±2R taranır) */
  const probe = (px, py, R) => {
    const x0 = Math.floor((px - R * 1.6) / STEP) * STEP;
    const x1 = px + R * 1.6;
    let best = Infinity, bx = 0, by = 0;
    let ax = x0, ay = h(ax);
    for (let x = x0 + STEP; x <= x1 + STEP; x += STEP) {
      const bxx = x, byy = h(x);
      // noktanın segmente izdüşümü
      const dx = bxx - ax, dy = byy - ay;
      const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
      const cx = ax + dx * t, cy = ay + dy * t;
      const d2 = (px - cx) * (px - cx) + (py - cy) * (py - cy);
      if (d2 < best) { best = d2; bx = cx; by = cy; }
      ax = bxx; ay = byy;
    }
    const d = Math.sqrt(best);
    // işaretli uzaklık: arazinin altındaysa negatif
    const hy = h(px);
    const sd = py < hy ? -d : d;
    let nx = px - bx, ny = py - by;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl; ny /= nl;
    if (py < hy) { nx = -nx; ny = -ny; }
    return { sd, nx, ny, cx: bx, cy: by };
  };
  return { h, probe, stage, seed };
}

// ───────── Toplanabilirler (parça başına deterministik) ─────────
const CHUNK = 40;
export function pickupsIn(terrain, x0, x1) {
  const out = [];
  const c0 = Math.max(0, Math.floor(x0 / CHUNK)), c1 = Math.floor(x1 / CHUNK);
  for (let c = c0; c <= c1; c++) {
    const r = makeRng(terrain.seed * 104729 + c * 31 + 7);
    const base = c * CHUNK;
    if (base < 14) continue; // başlangıç düzlüğünde yok
    // yakıt bidonu: ~her 5 parçada bir (200 m), mesafeyle seyrekleşir
    const canEvery = 7;
    if (c % canEvery === 2) {
      const x = base + 8 + r() * 24;
      out.push({ id: `f${c}`, kind: "fuel", x, y: terrain.h(x) + 0.7, v: 0 });
    }
    // altın grubu: yay şeklinde dizilmiş
    if (r() < 0.8) {
      const n = 3 + Math.floor(r() * 4);
      const gx = base + 4 + r() * 18;
      const big = r() < 0.12 ? 100 : r() < 0.4 ? 50 : 10;
      for (let i = 0; i < n; i++) {
        const x = gx + i * 1.6;
        out.push({ id: `c${c}.${i}`, kind: "coin", x, y: terrain.h(x) + 0.9 + Math.sin((i / Math.max(1, n - 1)) * Math.PI) * (r() < 0.5 ? 0.8 : 0.2), v: big });
      }
    }
  }
  return out;
}

// ───────── Dünya ─────────
export function levelOf(u, k) {
  return u?.[k] || 0;
}

export function createRun({ stageId = "countryside", vehicleId = "jeep", upgrades = {}, seed = 1 } = {}) {
  const stage = STAGES[stageId] || STAGES.countryside;
  const v = VEHICLES[vehicleId] || VEHICLES.jeep;
  const terrain = makeTerrain(stage, seed);
  const eng = levelOf(upgrades, "engine"), sus = levelOf(upgrades, "susp"), tir = levelOf(upgrades, "tires");
  const awd = v.awdAble && levelOf(upgrades, "awd") > 0;
  const params = {
    ...v, stage, awd,
    torque: v.torque * (1 + 0.17 * eng) * Math.pow(stage.g / 9.81, 0.4), // düşük yerçekiminde motor da kısılır (aracı uçurmasın)
    k: v.k * (1 + 0.1 * sus), c: v.c * (1 + 0.14 * sus),
    mu: stage.mu * (1 + 0.11 * tir) * Math.sqrt(9.81 / stage.g), // yük ∝ g olduğundan düşük yerçekiminde tutuş sınırı yükseltilir
    stab: 1 - stage.g / 9.81, // düşük yerçekiminde yerdeyken gövde zemin eğimine hizalanır (hop/takla azalır)
    I: (v.mass * ((v.hw * 2) ** 2 + (v.hh * 2) ** 2)) / 12,
    wheelI: 0.5 * v.wheelMass * v.R * v.R,
  };
  // Başlangıç: ağırlık altında oturmuş yükseklik (tekerlek zeminde)
  const x0 = 2;
  const run = {
    t: 0, terrain, params,
    x: x0, y: terrain.h(x0) + v.R + 0.35 + v.e0 * 0.7 + 0.15, a: 0, vx: 0, vy: 0, w: 0,
    wheels: [0, 1].map(() => ({ e: v.e0, prevE: v.e0, omega: 0, ground: false, nx: 0, ny: 1, load: 0, cx: 0, cy: 0 })),
    fuel: MAX_FUEL, coins: 0, best: 0, dist: 0,
    over: null, taken: new Set(), events: [],
    air: { t: 0, rot: 0, last: 0 }, flips: 0, stuckT: 0, wasGround: true, maxSpeed: 0, throttle: 0,
  };
  return run;
}

const rot = (a, x, y) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

/** Tekerleğin ışını: yüzey noktasından aşağı doğru ilk temas */
function wheelProbe(run, i) {
  const P = run.params, T = run.terrain;
  const sx = i === 0 ? -P.wheelbase / 2 : P.wheelbase / 2;
  const ca = Math.cos(run.a), sa = Math.sin(run.a);
  const ay = -P.ax; // bağlantı noktasının gövde içi dikey konumu (negatif: aşağıda)
  const axw = run.x + ca * sx - sa * ay;
  const ayw = run.y + sa * sx + ca * ay;
  const dx = sa, dy = -ca; // gövde "aşağı" birim vektörü
  const step = 0.06;
  let prevE = 0, hit = null;
  for (let e = 0; e <= P.eMax + 1e-6; e += step) {
    const p = T.probe(axw + dx * e, ayw + dy * e, P.R);
    if (p.sd <= P.R) { hit = { e, p }; break; }
    prevE = e;
  }
  if (!hit) return { axw, ayw, dx, dy, hit: null };
  // ikili aramayla incelt
  let lo = prevE, hi = hit.e, pr = hit.p;
  for (let k = 0; k < 6; k++) {
    const mid = (lo + hi) / 2;
    const p = T.probe(axw + dx * mid, ayw + dy * mid, P.R);
    if (p.sd <= P.R) { hi = mid; pr = p; } else lo = mid;
  }
  return { axw, ayw, dx, dy, hit: { e: hi, p: pr } };
}

/**
 * Tek alt adım.
 * input: { gas: 0..1, brake: 0..1 }
 */
function sub(run, input, dt) {
  const P = run.params, g = P.stage.g;
  const gas = clamp(input.gas || 0, 0, 1), brake = clamp(input.brake || 0, 0, 1);
  const hasFuel = run.fuel > 0;
  let Fx = 0, Fy = -P.mass * g, torque = 0;
  const ca = Math.cos(run.a), sa = Math.sin(run.a);
  let grounded = 0;

  for (let i = 0; i < 2; i++) {
    const W = run.wheels[i];
    const pr = wheelProbe(run, i);
    const drives = i === 0 || P.awd; // i=0 arka tekerlek (hep sürer); 4x4'te ikisi

    // motor / fren torku (tekerlek dönüşüne)
    let tau = 0;
    if (gas > 0.02 && hasFuel && drives) tau += P.torque * gas * clamp(1 - W.omega / P.wMax, 0, 1) * (P.awd ? 0.62 : 1);
    if (brake > 0.02) {
      if (W.omega > 1.5) tau -= Math.min(P.brake * brake, (W.omega / dt) * P.wheelI * 0.9 + 1e-6);
      else if (hasFuel && drives) tau -= P.torque * 0.5 * brake * clamp(1 + W.omega / 28, 0, 1) * (P.awd ? 0.62 : 1); // geri vites
      else if (W.omega < -1.5) tau += Math.min(P.brake * brake, (-W.omega / dt) * P.wheelI * 0.9);
    }

    if (!pr.hit) {
      // Havada: tekerlek serbest döner (motor/fren tepkisi gövdeye geçer); süspansiyon aşağı sarkar
      W.ground = false;
      W.load = 0;
      W.e = Math.min(P.eMax, W.e + 2.5 * dt);
      const dOm = (tau / P.wheelI) * dt;
      W.omega += dOm;
      W.omega *= 1 - 0.15 * dt;
      W.prevE = W.e;
      continue;
    }
    // Temas
    const { e, p } = pr.hit;
    grounded++;
    W.ground = true;
    const eEff = Math.max(e, 0);
    const comp = P.e0 - eEff;
    const rate = (W.prevE - eEff) / dt; // sıkışma hızı (+: sıkışıyor)
    W.prevE = eEff;
    let Fs = 0;
    if (comp > 0 || eEff < P.e0 + 0.05) Fs = Math.max(0, P.k * comp + P.c * rate);
    if (eEff < 0.12) Fs += 5 * P.k * (0.12 - eEff); // tümsek durdurucu
    Fs = Math.min(Fs, P.mass * g * 6 + 20000);
    W.e = Math.max(eEff, 0.05);
    W.load = Fs;
    W.nx = p.nx; W.ny = p.ny;
    // süspansiyon kuvveti gövde "yukarı" ekseninde (bağlantı noktasından)
    const ux = -sa, uy = ca;
    const fx = ux * Fs, fy = uy * Fs;
    Fx += fx; Fy += fy;
    const rx = pr.axw - run.x, ry = pr.ayw - run.y;
    torque += rx * fy - ry * fx;

    // temas noktası, zemin teğeti
    const tx = p.ny, ty = -p.nx; // +x yönlü teğet
    const cxp = pr.axw + pr.dx * e - p.nx * P.R, cyp = pr.ayw + pr.dy * e - p.ny * P.R;
    const crx = cxp - run.x, cry = cyp - run.y;
    const vcx = run.vx - run.w * cry, vcy = run.vy + run.w * crx;
    const vt = vcx * tx + vcy * ty;
    const Ks = (0.5 * P.wheelI) / (P.R * P.R * dt);
    const lim = P.mu * Fs;
    const slip = W.omega * P.R - vt;
    let Ft = clamp(Ks * slip, -lim, lim);
    // yuvarlanma direnci
    Ft -= clamp(vt, -1, 1) * 0.012 * Fs;
    Fx += Ft * tx; Fy += Ft * ty;
    torque += crx * Ft * ty - cry * Ft * tx;
    W.omega += ((tau - Ft * P.R) / P.wheelI) * dt;
    W.omega = clamp(W.omega, -P.wMax * 1.3, P.wMax * 1.3);
  }

  // Düşük yerçekimi: yerdeyken zemin eğimine yumuşak hizalama
  if (grounded > 0 && P.stab > 0.05) {
    let nx = 0, ny = 0;
    for (const W of run.wheels) if (W.ground) { nx += W.nx; ny += W.ny; }
    let err = Math.atan2(-nx, ny) - run.a;
    err = Math.atan2(Math.sin(err), Math.cos(err));
    torque += err * P.mass * 16 * P.stab;
  }

  // Havada kontrol: gaz burnu yukarı (geriye takla), fren aşağı çevirir (HCR gibi; tekerlek tepkisinin oyun ayarlı hâli)
  if (grounded === 0) torque += ((hasFuel ? gas : 0) - brake) * P.torque * 0.3 * (P.awd ? 1.3 : 1);

  // Gövde köşe noktaları (alt/üst): araziye girerse itme (sürtünmeli)
  const pts = [[-P.hw, -P.hh], [P.hw, -P.hh], [-P.hw, P.hh], [P.hw, P.hh], [0, -P.hh]];
  for (const [lx, ly] of pts) {
    const [wx, wy] = rot(run.a, lx, ly);
    const px = run.x + wx, py = run.y + wy;
    const hy = run.terrain.h(px);
    const pen = hy - py;
    if (pen > 0) {
      const eps = 0.05;
      const sl = (run.terrain.h(px + eps) - run.terrain.h(px - eps)) / (2 * eps);
      const nl = Math.hypot(sl, 1);
      const nx = -sl / nl, ny = 1 / nl;
      const vpx = run.vx - run.w * wy, vpy = run.vy + run.w * wx;
      const vn = vpx * nx + vpy * ny;
      const fn = Math.max(0, 60000 * pen - 3000 * vn);
      const vt = vpx * ny + vpy * -nx;
      const ft = clamp(-vt * 800, -0.8 * fn, 0.8 * fn);
      const fx = fn * nx + ft * ny, fy = fn * ny - ft * nx;
      Fx += fx; Fy += fy;
      torque += wx * fy - wy * fx;
    }
  }

  // Hava direnci ve açısal sönüm
  Fx -= 0.9 * run.vx * Math.abs(run.vx) * 0.05;
  Fy -= 0.9 * run.vy * Math.abs(run.vy) * 0.05;
  torque -= run.w * (grounded ? 600 : 260) * (P.mass / 900);

  run.vx += (Fx / P.mass) * dt;
  run.vy += (Fy / P.mass) * dt;
  run.w += (torque / P.I) * dt;
  run.w = clamp(run.w, -9, 9);
  run.x += run.vx * dt;
  run.y += run.vy * dt;
  run.a += run.w * dt;
  return grounded;
}

/** Oyun mantığı: benzin, toplama, takla, kafa çarpması, bitiş */
export function step(run, input, dt) {
  if (run.over) return run;
  dt = Math.min(dt, 1 / 20);
  let left = dt;
  const P = run.params;
  while (left > 1e-9) {
    const h = Math.min(SUB_DT, left);
    const grounded = sub(run, input, h);
    left -= h;
    run.t += h;

    // takla / havada kalma sayacı
    if (grounded === 0) {
      run.air.t += h;
      run.air.rot += run.w * h;
    } else if (run.air.t > 0) {
      const turns = Math.abs(run.air.rot) / (2 * Math.PI);
      if (run.air.t > 0.5 && turns >= 0.85) {
        const n = Math.max(1, Math.round(turns));
        const kind = run.air.rot > 0 ? "back" : "front";
        run.flips += n;
        run.coins += 250 * n;
        run.events.push({ type: "flip", kind, n, bonus: 250 * n });
      } else if (run.air.t > 1.4) {
        const bonus = Math.round(run.air.t * 15) * 2;
        run.coins += bonus;
        run.events.push({ type: "air", sec: run.air.t, bonus });
      }
      run.air.t = 0;
      run.air.rot = 0;
    }

    // kafa zemine değdi mi
    const [hx, hy] = rot(run.a, P.head[0], P.head[1]);
    const hp = run.terrain.probe(run.x + hx, run.y + hy, 0.3);
    if (hp.sd < 0.3) { run.over = { reason: "head" }; run.events.push({ type: "crash" }); break; }

    if (!isFinite(run.x + run.y + run.a)) { run.over = { reason: "numeric" }; break; }
  }

  // benzin
  const drain = (input.gas > 0.02 ? 1.5 : 0.28) * dt;
  run.fuel = Math.max(0, run.fuel - drain);
  run.dist = Math.max(run.dist, run.x - 2);
  run.maxSpeed = Math.max(run.maxSpeed, Math.abs(run.vx));

  // toplama
  for (const p of pickupsIn(run.terrain, run.x - 3, run.x + 3)) {
    if (run.taken.has(p.id)) continue;
    if (Math.hypot(p.x - run.x, p.y - run.y) < (p.kind === "fuel" ? 1.8 : 1.5)) {
      run.taken.add(p.id);
      if (p.kind === "fuel") { run.fuel = MAX_FUEL; run.events.push({ type: "fuel" }); }
      else { run.coins += p.v; run.events.push({ type: "coin", v: p.v, x: p.x, y: p.y }); }
    }
  }

  // yakıt bitti ve durdu → bitti
  if (!run.over && run.fuel <= 0) {
    if (Math.hypot(run.vx, run.vy) < 0.4) run.stuckT += dt;
    else run.stuckT = 0;
    if (run.stuckT > 1.5) run.over = { reason: "fuel" };
  }
  return run;
}

/** Çizim için: tekerlek merkezleri ve açıları */
export function wheelPose(run, i) {
  const P = run.params;
  const sx = i === 0 ? -P.wheelbase / 2 : P.wheelbase / 2;
  const ca = Math.cos(run.a), sa = Math.sin(run.a);
  const ay = -P.ax - run.wheels[i].e;
  return { x: run.x + ca * sx - sa * ay, y: run.y + sa * sx + ca * ay };
}
