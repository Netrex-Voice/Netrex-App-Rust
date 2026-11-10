/**
 * ✨ Emlak parçacık efektleri: tek Points nesnesi (tek çizim), önceden ayrılmış havuz.
 * Parçacıklar balistik hareket eder (yerçekimi), ömrü boyunca sönerek kaybolur (toplamalı karışım).
 * Boştayken çizilmez → boşta maliyeti sıfır.
 */
import * as THREE from "three";
import { canvas, toTexture } from "./textures";

function dotTexture() {
  const c = canvas(64, 64);
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.35, "rgba(255,255,255,.85)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return toTexture(c);
}

export class Particles {
  constructor(scene, cap = 240, size = 0.02) {
    this.cap = cap;
    this.next = 0;
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3);
    this.base = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.max = new Float32Array(cap);
    this.g = new Float32Array(cap);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: dotTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);
    this.tmp = new THREE.Color();
  }

  /** Tek parçacık: konum, hız, renk, ömür (sn), yerçekimi (m/sn², negatif = aşağı) */
  emit(x, y, z, vx, vy, vz, color, life, g = -0.4) {
    const i = this.next;
    this.next = (this.next + 1) % this.cap;
    const k = i * 3;
    this.pos[k] = x;
    this.pos[k + 1] = y;
    this.pos[k + 2] = z;
    this.vel[k] = vx;
    this.vel[k + 1] = vy;
    this.vel[k + 2] = vz;
    this.tmp.set(color);
    this.base[k] = this.tmp.r;
    this.base[k + 1] = this.tmp.g;
    this.base[k + 2] = this.tmp.b;
    this.life[i] = this.max[i] = life;
    this.g[i] = g;
    this.points.visible = true;
  }

  update(dt) {
    if (!this.points.visible) return;
    let alive = 0;
    for (let i = 0; i < this.cap; i++) {
      const k = i * 3;
      if (this.life[i] > 0) {
        this.life[i] -= dt;
        this.vel[k + 1] += this.g[i] * dt;
        this.pos[k] += this.vel[k] * dt;
        this.pos[k + 1] += this.vel[k + 1] * dt;
        this.pos[k + 2] += this.vel[k + 2] * dt;
        const f = Math.max(0, this.life[i] / this.max[i]);
        this.col[k] = this.base[k] * f;
        this.col[k + 1] = this.base[k + 1] * f;
        this.col[k + 2] = this.base[k + 2] * f;
        alive++;
      } else if (this.col[k] || this.col[k + 1] || this.col[k + 2]) {
        this.col[k] = this.col[k + 1] = this.col[k + 2] = 0;
      }
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = true;
    a.color.needsUpdate = true;
    if (!alive) this.points.visible = false;
  }
}
