/**
 * 🛰️ İstemci tahmini + uzlaştırma (gerçek zamanlı oyunlar için; saf JS, Node'da test edilir)
 *
 * Neden: host-otoriteli modelde misafir, host'tan dönen durumu RTT kadar geç görür. Burada:
 *  1) Kendi raketin işaretçiyi ANINDA izler (yerel).
 *  2) Disk/top aynı motorla (`engine.simulate`) yerelde ilerler; kendi raketinle vuruşun anında görünür ve host'a
 *     `hit` iddiası olarak gider (host doğrular).
 *  3) Sunucu anlık görüntüsü gelince tek yönlü gecikme kadar ileri sarılır ve yerel durumla farkı alınır; fark fiziğe
 *     hemen uygulanır ama ekrana yumuşak (üstel sönümlenen ofset) yansır → zıplama yok.
 *  4) Kendi vuruşundan sonra host bunu onaylayana kadar (RTT + pay) disk düzeltmesi beklemeye alınır.
 *  5) Rakip raketi, son konum + hız × gecikme ile ileri tahmin edilir.
 */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const q = (v) => Math.round(v * 10000) / 10000; // birimden bağımsız yuvarlama (m ya da px)

export class Predictor {
  /**
   * @param engine  airhockey | pingpong modülü (simulate, fromView, bounds, PAD_SPEED)
   * @param mySeat  0 | 1 | -1 (izleyici)
   */
  constructor(engine, mySeat, firstView, { claims = true } = {}) {
    this.claims = claims; // host kendi vuruşunu iddia etmez (zaten otorite)
    this.e = engine;
    this.seat = mySeat;
    this.rtt = 0.08; // sn, ölçüldükçe güncellenir
    this.sim = engine.fromView(firstView);
    this.ball = firstView.t === "pingpong" ? "ball" : "puck";
    this.off = { x: 0, y: 0, z: 0 };
    this.grace = -1; // bu zamana kadar disk düzeltmesi yok (kendi vuruşum onay bekliyor)
    this.claimHits = 0;
    this.snap = { v: firstView, at: 0 };
    this.pointer = null;
    this.lastMove = 0;
    this.lastClaimAt = -1;
    this.events = [];
    this.stats = { snaps: 0, corrections: 0, bigFixes: 0, claims: 0 };
  }

  setRtt(sec) {
    this.rtt = clamp(sec, 0.005, 0.4);
  }

  get oneWay() {
    return this.rtt / 2;
  }

  /** Sunucudan anlık görüntü geldi (now: sn) */
  snapshot(v, now) {
    this.stats.snaps++;
    const prev = this.snap.v;
    this.snap = { v, at: now };
    const live = v.phase === "play" || v.phase === "rally";
    // Faz değişimi/oyun dışı: doğrudan sunucu durumu (tahmin yok). Kendi raketim HER fazda yereldir:
    // geri sayımda da işaretçiyi izlediği için host'un RTT kadar eski kopyasına geri atarsak raket titrer.
    if (!live || prev.phase !== v.phase) {
      const keepMine = this.seat >= 0 && this.pointer ? this.sim.pads[this.seat] : null;
      this.sim = this.e.fromView(v);
      if (keepMine) Object.assign(this.sim.pads[this.seat], { x: keepMine.x, y: keepMine.y, vx: keepMine.vx, vy: keepMine.vy });
      this.off = { x: 0, y: 0, z: 0 };
      return;
    }
    if (this.e.syncMeta && now >= this.grace) this.e.syncMeta(this.sim, v);
    // Kendi vuruşum henüz sunucuda görünmüyorsa yerel diske dokunma
    if (now < this.grace && v.hits <= this.claimHits) return;
    this.grace = -1;

    // Sunucu durumunu tek yönlü gecikme kadar ileri sar (raket teması yok, yalnızca duvar/masa)
    const est = this.e.fromView(v);
    est.noHit = [Infinity, Infinity];
    if (est.phase === "rally" || est.phase === "play") this.e.simulate(est, this.oneWay, { movePads: false });
    const b = this.sim[this.ball];
    const t = est[this.ball];
    const ex = t.x - b.x;
    const ey = t.y - b.y;
    const ez = (t.z ?? 0) - (b.z ?? 0);
    const err = Math.hypot(ex, ey, ez);
    if (err < (this.e.NET_EPS ?? 0.5)) return;
    this.stats.corrections++;
    if (err > (this.e.NET_BIG ?? 220)) {
      this.stats.bigFixes++;
      this.off = { x: 0, y: 0, z: 0 }; // ışınlanma (sıfırlama vb.): yumuşatma anlamsız
    } else {
      this.off.x -= ex;
      this.off.y -= ey;
      this.off.z = (this.off.z || 0) - ez;
    }
    Object.assign(b, t); // tüm durum (spin dahil)
  }

  /** İşaretçi (mantıksal koordinat) */
  aim(x, y) {
    this.pointer = { x, y };
  }

  /**
   * Bir kare ilerlet. send(m, reliable) ile hareket ve vuruş iddiası yollar.
   * @returns { ball:[x,y], pads:[[x,y],[x,y]] } — çizilecek konumlar
   */
  frame(now, dt, send) {
    const s = this.sim;
    dt = Math.min(dt, 0.05);
    const live = s.phase === "play" || s.phase === "rally";
    // 1) Kendi raketim: işaretçiye hız sınırıyla (motorla aynı kural)
    if (this.seat >= 0 && this.pointer) {
      const p = s.pads[this.seat];
      const bd = this.e.bounds(s, this.seat);
      const tx = clamp(this.pointer.x, bd.x0, bd.x1);
      const ty = clamp(this.pointer.y, bd.y0, bd.y1);
      if (this.e.movePad) {
        // motorla birebir aynı el modeli (hız + ivme sınırı), alt adımlarla
        p.tx = tx;
        p.ty = ty;
        let left = dt;
        while (left > 1e-9) {
          const h = Math.min(1 / 480, left);
          this.e.movePad(s, this.seat, h);
          left -= h;
        }
      } else {
        const dx = tx - p.x;
        const dy = ty - p.y;
        const d = Math.hypot(dx, dy);
        const step = Math.min(d, this.e.PAD_SPEED * dt);
        const ox = p.x;
        const oy = p.y;
        if (d > 1e-9) {
          p.x += (dx / d) * step;
          p.y += (dy / d) * step;
        }
        p.vx = dt > 0 ? (p.x - ox) / dt : 0;
        p.vy = dt > 0 ? (p.y - oy) / dt : 0;
      }
      // Host'a ~60 Hz
      if (now - this.lastMove >= 1 / 60 - 0.002) {
        this.lastMove = now;
        // gerçek konum + hız (vuruş iddiasıyla tutarlı); ileri tahmini karşı tarafın görüntüsü yapar
        send({ t: "move", x: q(p.x), y: q(p.y), vx: q(p.vx), vy: q(p.vy) }, false);
      }
    }
    // 2) Rakip raket: son görüntü + hız × (yaş + tek yön gecikme), yumuşak takip
    const sv = this.snap.v;
    for (let i = 0; i < 2; i++) {
      if (i === this.seat) continue;
      const p = s.pads[i];
      const sp = sv.pads[i];
      const lead = Math.min(now - this.snap.at + this.oneWay, 0.12);
      const bd = this.e.bounds(s, i);
      const tx = clamp(sp[0] + (sp[2] || 0) * lead, bd.x0, bd.x1);
      const ty = clamp(sp[1] + (sp[3] || 0) * lead, bd.y0, bd.y1);
      const k = 1 - Math.exp(-dt / 0.035);
      const ox = p.x;
      const oy = p.y;
      p.x += (tx - p.x) * k;
      p.y += (ty - p.y) * k;
      p.vx = dt > 0 ? (p.x - ox) / dt : 0;
      p.vy = dt > 0 ? (p.y - oy) / dt : 0;
    }
    // 3) Disk/top: yerel fizik; kendi vuruşum → iddia
    if (live) {
      this.e.simulate(s, dt, {
        movePads: false,
        onHit: (i) => {
          const b = s[this.ball];
          const speed = Math.hypot(b.vx, b.vy);
          this.events.push({ type: "hit", seat: i, x: b.x, y: b.y, speed });
          if (i !== this.seat || !this.claims || now - this.lastClaimAt < 0.1) return;
          const p = s.pads[i];
          // motor kendi iddia yükünü üretebilir (3B masa tenisi: temas anı top + raket); yoksa genel yük
          const payload = this.e.claimPayload
            ? this.e.claimPayload(s, i)
            : { t: "hit", px: q(b.x), py: q(b.y), vx: q(b.vx), vy: q(b.vy), w: q(b.w || 0), ax: q(p.x), ay: q(p.y), avx: q(p.vx), avy: q(p.vy) };
          if (!payload) return;
          this.lastClaimAt = now;
          this.stats.claims++;
          this.claimHits = this.snap.v.hits;
          this.grace = now + this.rtt + 0.12;
          send(payload, true);
        },
      });
    }
    // 4) Görsel ofset sönümü (~60 ms zaman sabiti)
    const decay = Math.exp(-dt / 0.06);
    this.off.x *= decay;
    this.off.y *= decay;
    this.off.z = (this.off.z || 0) * decay;
    const b = s[this.ball];
    return {
      ball: [b.x + this.off.x, b.y + this.off.y, (b.z ?? 0) + this.off.z],
      pads: s.pads.map((p) => [p.x, p.y, p.z ?? 0]),
      vel: [b.vx, b.vy, b.vz ?? 0],
    };
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
