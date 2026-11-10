/**
 * 🎨 Prosedürel yüksek çözünürlüklü dokular (dış dosya yok; boyut kalite kademesine göre 1024–4096).
 * Üretilen dokular modül içinde önbelleğe alınır (rövanşta yeniden üretilmez).
 */
import * as THREE from "three";

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Tekrarlanabilir değer gürültüsü (tohumlu) */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function valueNoise(w, h, cell, seed) {
  const r = rng(seed);
  const gw = Math.ceil(w / cell) + 2;
  const gh = Math.ceil(h / cell) + 2;
  const g = new Float32Array(gw * gh).map(() => r());
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = y / cell;
    const y0 = fy | 0;
    const ty = fy - y0;
    const sy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < w; x++) {
      const fx = x / cell;
      const x0 = fx | 0;
      const tx = fx - x0;
      const sx = tx * tx * (3 - 2 * tx);
      const a = g[y0 * gw + x0];
      const b = g[y0 * gw + x0 + 1];
      const c = g[(y0 + 1) * gw + x0];
      const d = g[(y0 + 1) * gw + x0 + 1];
      out[y * w + x] = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    }
  }
  return out;
}

function toTexture(c, { srgb = true, repeat = [1, 1], aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/** Yükseklik alanından normal haritası (Sobel) */
function normalFromHeight(hgt, w, h, strength = 2) {
  const c = canvas(w, h);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(w, h);
  const at = (x, y) => hgt[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len) * 255;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Ahşap (damarlı): renk + pürüzlülük; size kare */
export function woodTexture(size, { base = [104, 66, 38], dark = [62, 36, 18], seed = 7, rings = 22 } = {}) {
  const key = `wood:${size}:${base}:${seed}`;
  if (cache.has(key)) return cache.get(key);
  const n1 = valueNoise(size, size, size / 3, seed); // geniş, hafif bükme
  const n2 = valueNoise(size, size, size / 48, seed + 1);
  // lif: yalnızca damar yönünde (x) değişen ince gürültü — gerçek ahşap gibi uzun çizgiler
  const r1 = rng(seed + 7);
  const fiberCol = new Float32Array(size).map(() => r1());
  const c = canvas(size, size);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      // damarlar: dikey yönde uzanan halkalar + gürültü bükmesi
      const v = (x / size) * rings + n1[i] * 0.85 + n2[i] * 0.12;
      const ring = Math.pow(Math.abs(Math.sin(v * Math.PI)), 0.5);
      const fiber = 0.88 + 0.08 * fiberCol[x] + 0.04 * n2[i];
      const k = (1 - ring * 0.65) * fiber;
      const o = i * 4;
      img.data[o] = dark[0] + (base[0] - dark[0]) * k;
      img.data[o + 1] = dark[1] + (base[1] - dark[1]) * k;
      img.data[o + 2] = dark[2] + (base[2] - dark[2]) * k;
      img.data[o + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const res = { map: toTexture(c) };
  cache.set(key, res);
  return res;
}

/** Fırçalanmış metal pürüzlülük haritası (yatay çizgiler) */
export function brushedTexture(size, seed = 3) {
  const key = `brushed:${size}:${seed}`;
  if (cache.has(key)) return cache.get(key);
  const r = rng(seed);
  const c = canvas(size, size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgb(110,110,110)";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 3; i++) {
    const y = r() * size;
    const g = 80 + r() * 90;
    ctx.strokeStyle = `rgba(${g},${g},${g},0.35)`;
    ctx.lineWidth = 0.5 + r();
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (r() - 0.5) * 2);
    ctx.stroke();
  }
  const res = { roughnessMap: toTexture(c, { srgb: false }) };
  cache.set(key, res);
  return res;
}

/** Çuha / keçe: renk + ince lif normal haritası */
export function feltTexture(size, rgb = [22, 110, 64], seed = 11) {
  const key = `felt:${size}:${rgb}:${seed}`;
  if (cache.has(key)) return cache.get(key);
  const fine = valueNoise(size, size, 1.6, seed);
  const mid = valueNoise(size, size, 22, seed + 2);
  const c = canvas(size, size);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  const hgt = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const k = 0.9 + fine[i] * 0.12 + (mid[i] - 0.5) * 0.06;
    hgt[i] = fine[i];
    img.data[i * 4] = rgb[0] * k;
    img.data[i * 4 + 1] = rgb[1] * k;
    img.data[i * 4 + 2] = rgb[2] * k;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const res = { map: toTexture(c), normalMap: toTexture(normalFromHeight(hgt, size, size, 0.9), { srgb: false }) };
  cache.set(key, res);
  return res;
}

/** Ahşap parke zemin (tahtalar arası derz) */
export function floorTexture(size, seed = 21) {
  const key = `floor:${size}:${seed}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(size, size);
  const ctx = c.getContext("2d");
  const r = rng(seed);
  const planks = 8;
  const pw = size / planks;
  const wood = woodTexture(Math.min(1024, size), { base: [86, 60, 40], dark: [52, 34, 22], seed: seed + 3, rings: 14 }).map.image;
  for (let i = 0; i < planks; i++) {
    let y = -r() * size;
    while (y < size) {
      const len = size * (0.35 + r() * 0.5);
      ctx.save();
      ctx.beginPath();
      ctx.rect(i * pw, y, pw - 2, len - 2);
      ctx.clip();
      ctx.globalAlpha = 1;
      ctx.drawImage(wood, r() * 400, r() * 400, 200, 600, i * pw, y, pw, len);
      ctx.fillStyle = `rgba(0,0,0,${r() * 0.18})`;
      ctx.fillRect(i * pw, y, pw, len);
      ctx.restore();
      y += len;
    }
  }
  const res = { map: toTexture(c, { repeat: [3, 3] }) };
  cache.set(key, res);
  return res;
}

/** Kauçuk/pürüzlü plastik normal haritası */
export function grainNormal(size, seed = 5, cell = 1.3, strength = 0.6) {
  const key = `grain:${size}:${seed}:${cell}`;
  if (cache.has(key)) return cache.get(key);
  const n = valueNoise(size, size, cell, seed);
  const res = { normalMap: toTexture(normalFromHeight(n, size, size, strength), { srgb: false }) };
  cache.set(key, res);
  return res;
}

export { canvas, toTexture };
