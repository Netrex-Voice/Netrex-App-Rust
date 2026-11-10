/**
 * 🏙️ Emlak 3B sahnesi: ahşap masa üstünde basılı tahta (4K'ya kadar), torna piyonlar, ev/otel, Rapier fizikli zarlar.
 *
 * Zar: sonuç HOST'tan gelir. İstemci zarları gerçek fizikle (Rapier) yuvarlar; simülasyon önceden koşturulur, sonunda üstte
 * kalan yüz bulunur ve zarın yüz numaralandırması küpün 24 simetrisinden biriyle döndürülür → üst yüz host'un sayısını
 * gösterir. Görünen yuvarlanma gerçek, sayı garantili.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createRenderer, studioEnvironment, Governor, disposeScene, pickPlane, TIERS } from "./kit";
import { woodTexture, feltTexture, floorTexture, canvas, toTexture } from "./textures";
import { BOARD, GROUPS, N } from "../engines/emlak";
import { TOKEN_COUNT } from "../engines/emlakTokens";
import { Particles } from "./emlakFx";

const H = 0.76; // masa yüksekliği
const SIDE = 1.0; // tahta kenarı (m)
const C = 0.13; // köşe kare
const W = (SIDE - 2 * C) / 9; // kenar kare genişliği (kenar başına 9 kare + köşeler = 40)
const DIE = 0.026;
const TRAY_X = 0; // zar tepsisi merkezi (tahta ortasının alt yarısı)
const TRAY_Z = 0.12;
const DICE_RATE = 0.5; // zar yuvarlanma oynatma hızı (1 = gerçek zaman; küçük = yavaş çekim)

/** Kare i'nin tahta üzerindeki merkezi (x, z) ve kenarı (0 alt, 1 sol, 2 üst, 3 sağ) */
export function squareCenter(i) {
  const side = Math.floor(i / 10);
  const k = i % 10;
  const half = SIDE / 2;
  const off = k === 0 ? 0 : C + (k - 0.5) * W; // köşeden uzaklık
  const inner = k === 0 ? C / 2 : C / 2; // kenar şeridinin ortası
  // 0: sağ alt köşeden sola; 1: sol alttan yukarı; 2: sol üstten sağa; 3: sağ üstten aşağı
  const along = k === 0 ? C / 2 : off;
  if (side === 0) return { x: half - along, z: half - inner, side };
  if (side === 1) return { x: -half + inner, z: half - along, side };
  if (side === 2) return { x: -half + along, z: -half + inner, side };
  return { x: half - inner, z: -half + along, side };
}

function boardTexture(size, aniso) {
  const c = canvas(size, size);
  const g = c.getContext("2d");
  const ppm = size / SIDE;
  const FONT = "system-ui, 'Segoe UI', sans-serif";
  const GOLD = "#e2bd62";
  // Boğaz mavisi çerçeve + altın şerit
  g.fillStyle = "#123f7a";
  g.fillRect(0, 0, size, size);
  g.strokeStyle = GOLD;
  g.lineWidth = 0.0035 * ppm;
  g.strokeRect(0.007 * ppm, 0.007 * ppm, (SIDE - 0.014) * ppm, (SIDE - 0.014) * ppm);
  g.fillStyle = "#f3eedc";
  g.fillRect(0.012 * ppm, 0.012 * ppm, (SIDE - 0.024) * ppm, (SIDE - 0.024) * ppm);
  // merkez alan: yumuşak yeşil degrade + ince guilloche halkalar
  const inner = (SIDE - 2 * C) * ppm;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, inner * 0.72);
  grad.addColorStop(0, "#e6f3e3");
  grad.addColorStop(1, "#bcdcc4");
  g.fillStyle = grad;
  g.fillRect(C * ppm, C * ppm, inner, inner);
  g.save();
  g.beginPath();
  g.rect(C * ppm, C * ppm, inner, inner);
  g.clip();
  g.strokeStyle = "rgba(25,90,60,.07)";
  g.lineWidth = 0.0015 * ppm;
  for (let r = 0.06; r < 0.62; r += 0.018) {
    g.beginPath();
    for (let k = 0; k <= 180; k++) {
      const a = (k / 180) * Math.PI * 2;
      const rr = r + Math.sin(a * 12) * 0.006;
      const x = size / 2 + Math.cos(a) * rr * ppm;
      const y = size / 2 + Math.sin(a) * rr * ppm;
      k ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    g.stroke();
  }
  g.restore();
  g.strokeStyle = "#123f7a";
  g.lineWidth = 0.003 * ppm;
  g.strokeRect(C * ppm, C * ppm, inner, inner);
  g.strokeStyle = GOLD;
  g.lineWidth = 0.0018 * ppm;
  g.strokeRect((C + 0.008) * ppm, (C + 0.008) * ppm, inner - 0.016 * ppm, inner - 0.016 * ppm);

  // "EMLAK" şeridi (üst orta)
  g.save();
  g.translate(0.5 * ppm, 0.318 * ppm);
  g.rotate(-0.045);
  const bw = 0.5 * ppm;
  const bh = 0.115 * ppm;
  g.shadowColor = "rgba(0,0,0,.4)";
  g.shadowBlur = 0.014 * ppm;
  g.shadowOffsetY = 0.005 * ppm;
  const rg = g.createLinearGradient(0, -bh / 2, 0, bh / 2);
  rg.addColorStop(0, "#ea3a40");
  rg.addColorStop(1, "#b81d24");
  g.fillStyle = rg;
  g.fillRect(-bw / 2, -bh / 2, bw, bh);
  g.shadowColor = "transparent";
  g.strokeStyle = "#fff";
  g.lineWidth = 0.004 * ppm;
  g.strokeRect(-bw / 2 + 0.008 * ppm, -bh / 2 + 0.008 * ppm, bw - 0.016 * ppm, bh - 0.016 * ppm);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#fff";
  g.shadowColor = "rgba(0,0,0,.35)";
  g.shadowBlur = 0.004 * ppm;
  g.font = `900 ${0.088 * ppm}px ${FONT}`;
  g.fillText("EMLAK", 0, 0.004 * ppm);
  g.shadowColor = "transparent";
  g.fillStyle = "#123f7a";
  g.font = `800 ${0.0225 * ppm}px ${FONT}`;
  g.fillText("İSTANBUL EDİSYONU  ·  NETREX", 0, 0.092 * ppm);
  g.restore();

  // kareler
  for (let i = 0; i < N; i++) {
    const sq = BOARD[i];
    const { x, z, side } = squareCenter(i);
    const corner = i % 10 === 0;
    const w = corner ? C : W;
    const h = C;
    g.save();
    g.translate((x + SIDE / 2) * ppm, (z + SIDE / 2) * ppm);
    g.rotate([0, Math.PI / 2, Math.PI, -Math.PI / 2][side]);
    // yerel: genişlik w, yükseklik h; iç kenar yukarıda (-y), dış kenar aşağıda (+y)
    const L = -w / 2;
    const T = -h / 2;
    g.fillStyle = "#f6f1e0";
    g.fillRect(L * ppm, T * ppm, w * ppm, h * ppm);
    g.strokeStyle = "#2a2a22";
    g.lineWidth = 0.0018 * ppm;
    g.strokeRect(L * ppm, T * ppm, w * ppm, h * ppm);
    g.textAlign = "center";
    g.textBaseline = "middle";
    const text = (str, y, fs, col = "#111827", weight = 800) => {
      g.fillStyle = col;
      fs *= 0.96; // sığmazsa aşağıda otomatik küçülür
      g.font = `${weight} ${fs * ppm}px ${FONT}`;
      const maxW = (w - 0.008) * ppm;
      const mw = g.measureText(str).width;
      if (mw > maxW) g.font = `${weight} ${fs * ppm * (maxW / mw)}px ${FONT}`; // uzun isimler sığsın
      g.fillText(str, 0, y * ppm);
    };
    const lines = (name, y0, fs, col, max = 2) => {
      const words = name.split(" ");
      const rows = words.length > max ? [words.slice(0, words.length - 1).join(" "), words[words.length - 1]] : words;
      rows.forEach((wd, k) => text(wd.toLocaleUpperCase("tr-TR"), y0 + k * fs * 1.2, fs, col));
    };
    if (sq.kind === "prop") {
      const band = 0.04;
      g.fillStyle = GROUPS[sq.g].color;
      g.fillRect(L * ppm, T * ppm, w * ppm, band * ppm);
      g.strokeRect(L * ppm, T * ppm, w * ppm, band * ppm);
      lines(sq.name, T + band + 0.03, 0.0128, "#111827");
      text(`₺${sq.price}`, h / 2 - 0.016, 0.0125, "#374151", 700);
    } else if (sq.kind === "transit") {
      const icon = sq.name.includes("Vapur") ? "⛴" : sq.name.includes("Metro") ? "🚇" : sq.name.includes("Teleferik") ? "🚡" : "🚆";
      lines(sq.name, T + 0.02, 0.0115, "#111827");
      text(icon, 0.012, 0.042, "#111827", 400);
      text(`₺${sq.price}`, h / 2 - 0.016, 0.0125, "#374151", 700);
    } else if (sq.kind === "util") {
      lines(sq.name, T + 0.02, 0.0115, "#111827");
      text(sq.name.includes("Elektrik") ? "💡" : "💧", 0.012, 0.042, "#111827", 400);
      text(`₺${sq.price}`, h / 2 - 0.016, 0.0125, "#374151", 700);
    } else if (sq.kind === "card") {
      const chest = sq.deck === "chest";
      text(chest ? "HAZİNE" : "ŞANS", T + 0.026, 0.0135, chest ? "#1e40af" : "#c2410c", 900);
      text(chest ? "🧰" : "?", 0.012, chest ? 0.05 : 0.075, "#e8841a", 900);
    } else if (sq.kind === "tax") {
      const [w1, w2] = sq.name.toLocaleUpperCase("tr-TR").split(" ");
      text(w1, T + 0.024, 0.0135, "#111827", 900);
      text(w2, T + 0.04, 0.0135, "#111827", 900);
      text(sq.amount >= 200 ? "💰" : "💎", 0.012, 0.04, "#111827", 400);
      text(`₺${sq.amount} öde`, h / 2 - 0.016, 0.0125, "#374151", 700);
    } else if (sq.kind === "start") {
      g.fillStyle = "#d4252b";
      g.fillRect(L * ppm, T * ppm, w * ppm, 0.03 * ppm);
      text("BAŞLANGIÇ", T + 0.015, 0.0165, "#fff", 900);
      text("⬅", 0.004, 0.07, "#d4252b", 900);
      text("Geçerken ₺200 al", h / 2 - 0.016, 0.0115, "#111827", 800);
    } else if (sq.kind === "jail") {
      g.fillStyle = "#f59e0b";
      g.fillRect((L + 0.012) * ppm, (T + 0.012) * ppm, (w - 0.05) * ppm, (h - 0.05) * ppm);
      g.strokeStyle = "#1a1a1a";
      g.strokeRect((L + 0.012) * ppm, (T + 0.012) * ppm, (w - 0.05) * ppm, (h - 0.05) * ppm);
      text("GÖZALTI", T + 0.04, 0.0145, "#111827", 900);
      text("🔒", -0.002, 0.04, "#111827", 400);
      text("sadece ziyaret", h / 2 - 0.014, 0.0105, "#111827", 700);
    } else if (sq.kind === "park") {
      text("PARK", T + 0.02, 0.022, "#15803d", 900);
      text("🌳", 0.008, 0.06, "#111827", 400);
      text("Serbest durak", h / 2 - 0.016, 0.0115, "#111827", 700);
    } else if (sq.kind === "police") {
      g.fillStyle = "#2b6cb0";
      g.fillRect(L * ppm, T * ppm, w * ppm, 0.03 * ppm);
      text("POLİS", T + 0.015, 0.0165, "#fff", 900);
      text("🚓", 0.008, 0.06, "#111827", 400);
      text("Gözaltına git", h / 2 - 0.016, 0.0115, "#111827", 800);
    }
    g.restore();
  }
  const t = toTexture(c, { aniso });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function pipTexture(n, size = 256) {
  const c = canvas(size, size);
  const g = c.getContext("2d");
  g.fillStyle = "#f8f6f0";
  g.fillRect(0, 0, size, size);
  const p = { 1: [[0.5, 0.5]], 2: [[0.27, 0.27], [0.73, 0.73]], 3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]], 4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]], 5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]], 6: [[0.27, 0.23], [0.73, 0.23], [0.27, 0.5], [0.73, 0.5], [0.27, 0.77], [0.73, 0.77]] }[n];
  for (const [x, y] of p) {
    const gr = g.createRadialGradient(x * size, y * size, 0, x * size, y * size, size * 0.09);
    gr.addColorStop(0, n === 1 ? "#7f1d1d" : "#0b0b0b");
    gr.addColorStop(0.75, n === 1 ? "#b91c1c" : "#1f1f1f");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x * size, y * size, size * 0.085, 0, Math.PI * 2);
    g.fill();
  }
  return toTexture(c, { aniso: 4 });
}

// Standart zar: yüz indeksi (BoxGeometry: +x,−x,+y,−y,+z,−z) → sayı (karşıtlar toplamı 7)
const STD = [3, 4, 1, 6, 2, 5];
const FACE_N = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];
/** Küpün 24 dönüş simetrisi */
const ROTS = (() => {
  const out = [];
  const seen = new Set();
  const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const stack = [new THREE.Quaternion()];
  while (stack.length && out.length < 24) {
    const q = stack.pop();
    const key = FACE_N.map((n) => n.clone().applyQuaternion(q)).map((v) => `${Math.round(v.x)},${Math.round(v.y)},${Math.round(v.z)}`).join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
    for (const r of [qx, qy, qz]) stack.push(q.clone().multiply(r));
  }
  return out;
})();
const topFace = (q) => {
  let best = 0;
  let by = -2;
  FACE_N.forEach((n, i) => {
    const y = n.clone().applyQuaternion(q).y;
    if (y > by) (by = y), (best = i);
  });
  return best;
};
/** Sim sonunda yüz `face` üstte; görsel ön-dönüş R öyle seçilir ki o yüzde `want` görünsün */
function relabel(face, want) {
  for (const R of ROTS) {
    // mesh = sim · R: yerel yüz f'deki sayı = STD[R⁻¹ uygulanmış yüz]
    const nLocal = FACE_N[face].clone().applyQuaternion(R.clone().invert());
    const idx = FACE_N.findIndex((n) => n.distanceTo(nLocal) < 0.01);
    if (STD[idx] === want) return R;
  }
  return new THREE.Quaternion();
}

const flat = (g) => (g.index ? g.toNonIndexed() : g);
const lathe = (pts, seg = 36) => {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  g.computeVertexNormals();
  return g;
};
const moved = (g, x, y, z) => (g.translate(x, y, z), g);
/** ölçekle → döndür → taşı */
const xf = (g, { s = [1, 1, 1], rx = 0, rz = 0, p = [0, 0, 0] } = {}) => {
  g.scale(...s);
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  g.translate(...p);
  return g;
};

/** İstanbul temalı piyonlar (tek geometri → tek malzeme): çay bardağı, vapur, tramvay, fes, simit, Galata */
function tokenGeometry(kind) {
  const parts = [];
  switch (kind % TOKEN_COUNT) {
    case 0: // çay bardağı (ince belli) + tabak
      parts.push(lathe([[0, 0], [0.0125, 0], [0.0125, 0.0015], [0.0045, 0.0022], [0.0042, 0.006], [0.0048, 0.011], [0.0062, 0.019], [0.0074, 0.027], [0.0079, 0.031], [0.0072, 0.031], [0.0062, 0.0272], [0, 0.0262]]));
      break;
    case 1: {
      // vapur: gövde + kabin + baca
      const sh = new THREE.Shape();
      sh.moveTo(-0.017, 0);
      sh.lineTo(0.015, 0);
      sh.lineTo(0.0215, 0.0095);
      sh.lineTo(-0.0185, 0.0095);
      sh.closePath();
      parts.push(moved(new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false }), 0, 0.002, -0.006));
      parts.push(moved(new THREE.BoxGeometry(0.0145, 0.0075, 0.009), -0.002, 0.01525, 0));
      parts.push(moved(new THREE.CylinderGeometry(0.003, 0.0034, 0.011, 16), -0.0015, 0.0245, 0));
      break;
    }
    case 2: // tramvay
      parts.push(moved(new THREE.BoxGeometry(0.034, 0.003, 0.01), 0, 0.0015, 0));
      parts.push(moved(new RoundedBoxGeometry(0.032, 0.014, 0.0125, 2, 0.002), 0, 0.01, 0));
      parts.push(moved(new THREE.BoxGeometry(0.033, 0.002, 0.0135), 0, 0.018, 0));
      parts.push(moved(new THREE.BoxGeometry(0.002, 0.008, 0.002), 0.002, 0.023, 0));
      break;
    case 3: // fes + püskül
      parts.push(moved(new THREE.CylinderGeometry(0.0135, 0.0135, 0.0018, 32), 0, 0.0009, 0));
      parts.push(moved(new THREE.CylinderGeometry(0.0082, 0.0118, 0.019, 32), 0, 0.0113, 0));
      parts.push(moved(new THREE.CylinderGeometry(0.0008, 0.0008, 0.011, 8), 0.0105, 0.015, 0));
      parts.push(moved(new THREE.SphereGeometry(0.0022, 12, 8), 0.0105, 0.0085, 0));
      break;
    case 4: // simit
      parts.push(moved(new THREE.TorusGeometry(0.0095, 0.0042, 14, 32), 0, 0.0155, 0));
      parts.push(moved(new THREE.CylinderGeometry(0.0085, 0.0095, 0.0025, 24), 0, 0.00125, 0));
      break;
    case 5: // Galata Kulesi
      parts.push(moved(new THREE.CylinderGeometry(0.0072, 0.0082, 0.021, 24), 0, 0.0123, 0));
      parts.push(moved(new THREE.CylinderGeometry(0.0098, 0.0098, 0.0022, 24), 0, 0.0236, 0));
      parts.push(moved(new THREE.ConeGeometry(0.0088, 0.0135, 24), 0, 0.0314, 0));
      break;
    case 6: // sokak kedisi (oturan, kameraya bakar)
      parts.push(moved(new THREE.CylinderGeometry(0.0115, 0.0125, 0.0016, 24), 0, 0.0008, 0));
      parts.push(xf(new THREE.SphereGeometry(0.0095, 16, 12), { s: [1, 1.25, 0.95], p: [0, 0.0125, -0.001] }));
      parts.push(moved(new THREE.SphereGeometry(0.0072, 16, 12), 0, 0.0285, 0.003));
      for (const sx of [-1, 1]) parts.push(moved(new THREE.ConeGeometry(0.0029, 0.0065, 8), sx * 0.0042, 0.0358, 0.002));
      parts.push(xf(new THREE.TorusGeometry(0.0065, 0.0016, 8, 16, Math.PI * 1.2), { rz: -0.5, p: [0.0085, 0.011, -0.004] }));
      break;
    case 7: // martı
      parts.push(moved(new THREE.CylinderGeometry(0.011, 0.012, 0.0018, 24), 0, 0.0009, 0));
      parts.push(xf(new THREE.SphereGeometry(0.0085, 16, 12), { s: [1.7, 0.9, 0.95], p: [0, 0.0135, 0] }));
      parts.push(moved(new THREE.SphereGeometry(0.0052, 12, 10), 0.0125, 0.0205, 0));
      parts.push(xf(new THREE.ConeGeometry(0.0016, 0.0065, 8), { rz: -Math.PI / 2, p: [0.0182, 0.0202, 0] }));
      for (const sz of [-1, 1]) parts.push(xf(new THREE.SphereGeometry(0.0075, 12, 8), { s: [1.25, 0.13, 1.0], rx: sz * 0.8, p: [-0.002, 0.0148, sz * 0.0078] }));
      parts.push(xf(new THREE.ConeGeometry(0.0035, 0.011, 8), { rz: Math.PI / 2, p: [-0.0158, 0.0138, 0] }));
      for (const sz of [-1, 1]) parts.push(moved(new THREE.CylinderGeometry(0.0011, 0.0011, 0.007, 6), 0.0015, 0.005, sz * 0.0028));
      break;
    case 8: // nazar boncuğu
      parts.push(moved(new THREE.CylinderGeometry(0.0085, 0.0095, 0.0025, 24), 0, 0.00125, 0));
      parts.push(moved(new THREE.TorusGeometry(0.0105, 0.0034, 12, 32), 0, 0.0165, 0));
      parts.push(xf(new THREE.SphereGeometry(0.0075, 16, 12), { s: [1, 1, 0.35], p: [0, 0.0165, 0] }));
      parts.push(xf(new THREE.SphereGeometry(0.0038, 12, 10), { s: [1, 1, 0.6], p: [0, 0.0165, 0.0022] }));
      break;
    default: // lale
      parts.push(moved(new THREE.CylinderGeometry(0.0105, 0.0115, 0.002, 24), 0, 0.001, 0));
      parts.push(lathe([[0, 0.002], [0.0014, 0.0025], [0.0013, 0.0165], [0.003, 0.019], [0.0065, 0.0235], [0.0082, 0.0285], [0.0078, 0.034], [0.0052, 0.0375], [0.0035, 0.0345], [0.0018, 0.037], [0, 0.034]], 24));
      for (const sx of [-1, 1]) parts.push(xf(new THREE.SphereGeometry(0.0045, 10, 8), { s: [0.45, 2.2, 0.9], rz: -sx * 0.4, p: [sx * 0.0048, 0.0112, 0] }));
  }
  return mergeGeometries(parts.map(flat)); // parçaların kendi (yumuşak) normalleri korunur
}

/** Ev / otel dokuları: pencereli cephe (otelde pencereler yanar) */
function facadeTexture(kind) {
  const c = canvas(128, 128);
  const g = c.getContext("2d");
  if (kind === "house") {
    g.fillStyle = "#f4e9cf";
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#7db4de";
    for (const x of [22, 78]) {
      g.fillRect(x, 26, 28, 34);
      g.strokeStyle = "#8a5a2b";
      g.lineWidth = 4;
      g.strokeRect(x, 26, 28, 34);
      g.beginPath();
      g.moveTo(x + 14, 26);
      g.lineTo(x + 14, 60);
      g.stroke();
    }
    g.fillStyle = "#8a5a2b";
    g.fillRect(52, 76, 24, 52);
  } else {
    // kule: açık gövde (tint ile renklenir) + yanan/sönük pencere ızgarası
    g.fillStyle = "#f4f6fa";
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#dfe5ee";
    g.fillRect(0, 0, 128, 6);
    for (let r = 0; r < 5; r++)
      for (let k = 0; k < 3; k++) {
        const x = 14 + k * 36;
        const y = 12 + r * 23;
        g.fillStyle = (r * 3 + k) % 5 === 1 ? "#9fc4e8" : "#ffe9a8";
        g.fillRect(x, y, 24, 15);
        g.strokeStyle = "#8b97a8";
        g.lineWidth = 2;
        g.strokeRect(x, y, 24, 15);
      }
  }
  return toTexture(c, { aniso: 4 });
}

/** Kenarları ince çizgili destenin yan yüzü */
function deckSideTexture() {
  const c = canvas(64, 16);
  const g = c.getContext("2d");
  g.fillStyle = "#f3ecd8";
  g.fillRect(0, 0, 64, 16);
  g.fillStyle = "rgba(0,0,0,.18)";
  for (let y = 1; y < 16; y += 2) g.fillRect(0, y, 64, 1);
  return toTexture(c, { aniso: 2 });
}

function deckTopTexture(fill, label, mark) {
  const c = canvas(512, 330);
  const g = c.getContext("2d");
  g.fillStyle = fill;
  g.fillRect(0, 0, 512, 330);
  g.strokeStyle = "#fff";
  g.lineWidth = 10;
  g.strokeRect(22, 22, 468, 286);
  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = "900 150px system-ui, sans-serif";
  g.fillText(mark, 256, 140);
  g.font = "800 54px system-ui, sans-serif";
  g.fillText(label, 256, 250);
  return toTexture(c, { aniso: 4 });
}

/** Tahta üstü 3B İstanbul: Ayasofya, Galata Kulesi, Kız Kulesi, ağaçlar (her yapı kendi grubunda büyütülür) */
function buildCity() {
  const grp = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: "#eadbb2", roughness: 0.7 });
  const lead = new THREE.MeshStandardMaterial({ color: "#8aa7bb", roughness: 0.35, metalness: 0.35 });
  const prop = (x, z, k) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(k);
    grp.add(g);
    return (geo, mat, px, py, pz, sx = 1, sy = 1, sz = 1) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz);
      m.scale.set(sx, sy, sz);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
  };
  const Z = -0.295;
  // Ayasofya
  const ay = prop(-0.235, Z, 1.35);
  ay(new THREE.BoxGeometry(0.085, 0.028, 0.062), stone, 0, 0.014, 0);
  ay(new THREE.CylinderGeometry(0.025, 0.028, 0.012, 32), stone, 0, 0.034, 0);
  ay(new THREE.SphereGeometry(0.027, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), lead, 0, 0.04, 0, 1, 0.85, 1);
  for (const sx of [-1, 1]) ay(new THREE.SphereGeometry(0.02, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lead, sx * 0.04, 0.028, 0, 1, 0.8, 1);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    ay(new THREE.CylinderGeometry(0.0028, 0.0034, 0.07, 12), stone, sx * 0.047, 0.035, sz * 0.037);
    ay(new THREE.CylinderGeometry(0.0052, 0.0052, 0.0022, 12), stone, sx * 0.047, 0.05, sz * 0.037);
    ay(new THREE.ConeGeometry(0.0036, 0.014, 12), lead, sx * 0.047, 0.077, sz * 0.037);
  }
  // Galata Kulesi
  const ga = prop(0.235, Z, 1.35);
  ga(new THREE.CylinderGeometry(0.0125, 0.0145, 0.075, 32), stone, 0, 0.0375, 0);
  ga(new THREE.CylinderGeometry(0.0185, 0.0185, 0.004, 32), stone, 0, 0.074, 0);
  ga(new THREE.CylinderGeometry(0.0135, 0.0135, 0.012, 32), stone, 0, 0.082, 0);
  ga(new THREE.ConeGeometry(0.0155, 0.03, 32), lead, 0, 0.103, 0);
  // Kız Kulesi (deniz + ada + kule)
  const kz = prop(0, Z, 1.35);
  const sea = kz(new THREE.CircleGeometry(0.036, 40), new THREE.MeshStandardMaterial({ color: "#4a9bd8", roughness: 0.15, metalness: 0.1 }), 0, 0.0004, 0);
  sea.rotation.x = -Math.PI / 2;
  sea.castShadow = false;
  kz(new THREE.CylinderGeometry(0.016, 0.019, 0.006, 24), stone, 0, 0.003, 0);
  kz(new THREE.CylinderGeometry(0.0065, 0.0078, 0.022, 20), new THREE.MeshStandardMaterial({ color: "#f4efe3", roughness: 0.6 }), 0, 0.017, 0);
  kz(new THREE.ConeGeometry(0.0095, 0.012, 20), lead, 0, 0.034, 0);
  // ağaçlar
  const trunk = new THREE.MeshStandardMaterial({ color: "#6b4423", roughness: 0.9 });
  const leaf = new THREE.MeshStandardMaterial({ color: "#2f9a55", roughness: 0.7 });
  for (const [x, z, k] of [[-0.335, Z + 0.03, 1.2], [-0.12, Z + 0.06, 1], [0.12, Z + 0.06, 1.05], [0.335, Z + 0.03, 1.2], [0.3, Z + 0.07, 0.85], [-0.305, Z + 0.075, 0.85]]) {
    const tr = prop(x, z, k);
    tr(new THREE.CylinderGeometry(0.0015, 0.002, 0.008, 8), trunk, 0, 0.004, 0);
    tr(new THREE.ConeGeometry(0.008, 0.022, 10), leaf, 0, 0.017, 0);
    tr(new THREE.ConeGeometry(0.006, 0.016, 10), leaf, 0, 0.027, 0);
  }
  return grp;
}


const WHITE = new THREE.Color("#ffffff");
const WALL = GROUPS.map((g) => new THREE.Color(g.color).lerp(WHITE, 0.55));
const ROOF = GROUPS.map((g) => new THREE.Color(g.color).multiplyScalar(0.8));
const TOWER = GROUPS.map((g) => new THREE.Color(g.color).lerp(WHITE, 0.25));

/** Gökyüzü: dikey degrade (ekrana sabit arka plan) */
function skyTexture() {
  const c = canvas(8, 512);
  const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, "#3f8fe6");
  gr.addColorStop(0.5, "#8cc8f4");
  gr.addColorStop(0.82, "#d6ecfb");
  gr.addColorStop(1, "#f2f9ff");
  g.fillStyle = gr;
  g.fillRect(0, 0, 8, 512);
  return toTexture(c);
}

function cloudTexture() {
  const c = canvas(256, 128);
  const g = c.getContext("2d");
  for (const [x, y, r] of [[70, 80, 40], [110, 62, 50], [155, 70, 46], [195, 84, 34], [130, 88, 44]]) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(255,255,255,.95)");
    gr.addColorStop(0.6, "rgba(255,255,255,.75)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  return toTexture(c);
}

function roadTexture() {
  const c = canvas(256, 32);
  const g = c.getContext("2d");
  g.fillStyle = "#3b3f48";
  g.fillRect(0, 0, 256, 32);
  g.fillStyle = "#e9e4cf";
  for (let x = 8; x < 256; x += 64) g.fillRect(x, 14, 32, 4);
  const t = toTexture(c, { aniso: 4 });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Aydınlık "arcade" diorama: gökyüzü, bulutlar, deniz, yeşil ada, yol, ağaçlar, tepeler */
function buildWorld(scene, tex) {
  scene.background = skyTexture();
  scene.fog = new THREE.Fog("#cfe6f7", 3.2, 11);
  const world = new THREE.Group();
  // deniz
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: "#3b9ae1", roughness: 0.22, metalness: 0.15 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = H - 0.15;
  sea.receiveShadow = true;
  world.add(sea);
  // ada (çimen üstü + toprak kenar)
  const grass = feltTexture(Math.min(1024, tex), [78, 176, 84], 17);
  grass.map.wrapS = grass.map.wrapT = THREE.RepeatWrapping;
  grass.map.repeat.set(10, 10);
  const soil = new THREE.MeshStandardMaterial({ color: "#8a5a34", roughness: 0.95 });
  const top = new THREE.MeshStandardMaterial({ map: grass.map, roughness: 0.95 });
  const island = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.16, 1.5, 4, 0.07), [soil, soil, top, soil, soil, soil]);
  island.position.y = H - 0.012 - 0.08;
  island.receiveShadow = true;
  world.add(island);
  // tahtanın altındaki "kalın tabla"
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.012, 1.05), new THREE.MeshStandardMaterial({ color: "#f3eedc", roughness: 0.6 }));
  plinth.position.y = H - 0.006;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  world.add(plinth);
  // çevre yolu (kesik şeritli)
  const rt = roadTexture();
  const strips = [[0, 0.575, 1.2, 0.06, false], [0, -0.575, 1.2, 0.06, false], [0.575, 0, 0.06, 1.2, true], [-0.575, 0, 0.06, 1.2, true]];
  for (const [x, z, w, d, vertical] of strips) {
    const t = rt.clone();
    t.needsUpdate = true;
    t.repeat.set(5, 1);
    if (vertical) {
      t.center.set(0.5, 0.5);
      t.rotation = Math.PI / 2;
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, H - 0.0115, z);
    m.receiveShadow = true;
    world.add(m);
  }
  // ağaçlar (instanced)
  const trunkGeo = moved(new THREE.CylinderGeometry(0.004, 0.005, 0.03, 6), 0, 0.015, 0);
  const leafGeo = mergeGeometries([flat(moved(new THREE.ConeGeometry(0.022, 0.05, 8), 0, 0.045, 0)), flat(moved(new THREE.ConeGeometry(0.017, 0.04, 8), 0, 0.07, 0))]);
  const trees = [];
  let r = 5;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 44; i++) {
    const side = i % 4;
    const along = (rnd() - 0.5) * 1.35;
    const out = 0.64 + rnd() * 0.08;
    const [x, z] = side === 0 ? [along, out] : side === 1 ? [along, -out] : side === 2 ? [out, along] : [-out, along];
    if (Math.abs(x) > 0.7 && Math.abs(z) > 0.7) continue;
    trees.push([x, z, 0.65 + rnd() * 0.5]);
  }
  const trunkM = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: "#6b4423", roughness: 0.9 }), trees.length);
  const leafM = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.75 }), trees.length);
  const m4 = new THREE.Matrix4();
  const greens = ["#2f9a55", "#3aa65f", "#27894c", "#4bb36a"].map((c) => new THREE.Color(c));
  trees.forEach(([x, z, k], i) => {
    m4.compose(new THREE.Vector3(x, H - 0.0115, z), new THREE.Quaternion(), new THREE.Vector3(k, k, k));
    trunkM.setMatrixAt(i, m4);
    leafM.setMatrixAt(i, m4);
    leafM.setColorAt(i, greens[i % greens.length]);
  });
  for (const m of [trunkM, leafM]) {
    m.castShadow = true;
    m.receiveShadow = true;
    world.add(m);
  }
  // uzak tepeler
  const hillMat = [new THREE.MeshStandardMaterial({ color: "#58b25f", roughness: 0.95 }), new THREE.MeshStandardMaterial({ color: "#4ea856", roughness: 0.95 })];
  [[-2.6, -3.2, 1.3, 0.55], [-1.2, -3.8, 1.6, 0.7], [0.6, -4, 1.9, 0.6], [2.4, -3.5, 1.5, 0.75], [3.8, -2.6, 1.2, 0.5], [-3.9, -2.2, 1.1, 0.5]].forEach(([x, z, rad, hh], i) => {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(rad, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hillMat[i % 2]);
    hill.scale.y = hh / rad;
    hill.position.set(x, H - 0.15, z);
    world.add(hill);
  });
  scene.add(world);
  // bulutlar (kamera yönüne bakan yatık düzlemler, yavaşça kayar)
  const ct = cloudTexture();
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const w = 1.2 + rnd() * 1.4;
    const c = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.5), new THREE.MeshBasicMaterial({ map: ct, transparent: true, depthWrite: false, fog: false, opacity: 0.92 }));
    c.position.set(-5 + rnd() * 10, H + 0.6 + rnd() * 1.4, -3.5 - rnd() * 2.5);
    scene.add(c);
    clouds.push(c);
  }
  return clouds;
}

/** Merkez alanının kenarında renkli "şehir silüeti" (tek InstancedMesh) */
/** Saydam (hayalet) kopya malzemesi: oyuncuyu kapatan binalar için */
const ghostMat = (m) => {
  const g = m.clone();
  g.transparent = true;
  g.opacity = 0.2;
  g.depthWrite = false;
  return g;
};

function buildSkyline() {
  const tex = facadeTexture("hotel");
  const geo = moved(new THREE.BoxGeometry(1, 1, 1), 0, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: "#ffffff", emissiveIntensity: 0.25, roughness: 0.5 });
  const solid = new THREE.InstancedMesh(geo, mat, 64);
  const ghost = new THREE.InstancedMesh(geo, ghostMat(mat), 64);
  const pal = ["#f4b183", "#9dc3e6", "#a9d18e", "#ffd966", "#f8cbad", "#c9b1ff", "#8fd3c8", "#f6a5a5"].map((c) => new THREE.Color(c));
  let r = 11;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const items = [];
  const put = (x, z) => items.push({ x, z, w: 0.02 + rnd() * 0.014, d: 0.02 + rnd() * 0.012, h: 0.022 + rnd() * 0.036, color: pal[Math.floor(rnd() * pal.length)], ghost: false });
  for (let x = -0.355; x <= 0.356; x += 0.044) {
    if (Math.abs(x + 0.235) < 0.095 || Math.abs(x - 0.235) < 0.095 || Math.abs(x) < 0.065) continue;
    put(x, -0.352);
  }
  for (const sx of [-1, 1]) for (let z = -0.27; z <= 0.34; z += 0.052) if (z < -0.1 || z > 0.04) put(sx * 0.352, z);
  for (const m of [solid, ghost]) {
    m.castShadow = m === solid;
    m.receiveShadow = m === solid;
    m.position.y = H + 0.006;
  }
  return { items, solid, ghost };
}

const easeOutBack = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);

export class EmlakScene {
  constructor(canvasEl, o) {
    this.canvas = canvasEl;
    const { renderer, start, auto, maxTex } = createRenderer(canvasEl, o.gfx);
    this.renderer = renderer;
    renderer.toneMapping = THREE.NeutralToneMapping; // renkler soluklaşmasın
    renderer.toneMappingExposure = 0.95;
    const tex = Math.min(maxTex, TIERS[start].tex);
    const aniso = renderer.capabilities.getMaxAnisotropy();
    const scene = (this.scene = new THREE.Scene());
    studioEnvironment(renderer, scene, 0.04);
    scene.environmentIntensity = 0.45;
    scene.add(new THREE.HemisphereLight("#cfe9ff", "#7aa86a", 0.95));
    const key = new THREE.DirectionalLight("#fff1d6", 2.3); // güneş
    key.position.set(0.9, H + 1.6, 1.1);
    key.target.position.set(0, H, 0);
    key.castShadow = true;
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.004;
    key.shadow.radius = 3;
    Object.assign(key.shadow.camera, { left: -0.85, right: 0.85, top: 0.85, bottom: -0.85, near: 0.4, far: 4 });
    key.shadow.camera.updateProjectionMatrix();
    scene.add(key, key.target);
    this.clouds = buildWorld(scene, tex);
    const wood = woodTexture(Math.min(2048, tex), { base: [118, 74, 42], dark: [66, 38, 18], seed: 19, rings: 16 });
    // tahta (karton, hafif kalın)
    const boardMat = new THREE.MeshStandardMaterial({ map: boardTexture(tex, aniso), roughness: 0.5 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: "#123f7a", roughness: 0.5 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(SIDE, 0.006, SIDE), [edgeMat, edgeMat, boardMat, edgeMat, edgeMat, edgeMat]);
    board.position.y = H + 0.003;
    board.receiveShadow = true;
    board.castShadow = true;
    scene.add(board);
    this.sky = buildSkyline();
    scene.add(this.sky.solid, this.sky.ghost);
    this.layoutSky();
    this.ghostMap = new Map(); // bina anahtarı → saydam mı (setBoard yeniden kursa da titremesin)
    this.ghostT = 0;
    // 3B İstanbul (merkez, tahtanın arka yarısı)
    const city = buildCity();
    city.position.y = H + 0.006;
    scene.add(city);
    // 3B kart desteleri
    const sideTex = deckSideTexture();
    const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.7 });
    for (const [x, z, rot, fill, label, mark] of [[-0.265, -0.03, 0.2, "#e8841a", "ŞANS", "?"], [0.265, -0.03, -0.2, "#2b6cb0", "HAZİNE", "🧰"]]) {
      const topMat = new THREE.MeshStandardMaterial({ map: deckTopTexture(fill, label, mark), roughness: 0.5 });
      const deck = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.014, 0.09), [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
      deck.position.set(x, H + 0.006 + 0.007, z);
      deck.rotation.y = rot;
      deck.castShadow = true;
      deck.receiveShadow = true;
      scene.add(deck);
    }
    // zar tepsisi (keçe)
    const felt = feltTexture(Math.min(1024, tex), [96, 22, 28], 7);
    this.trayY = H + 0.006;
    const tray = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.15), new THREE.MeshStandardMaterial({ map: felt.map, normalMap: felt.normalMap, roughness: 0.95 }));
    tray.rotation.x = -Math.PI / 2;
    tray.position.set(TRAY_X, this.trayY + 0.0006, TRAY_Z);
    tray.receiveShadow = true;
    scene.add(tray);
    const rimMat = new THREE.MeshPhysicalMaterial({ map: wood.map, roughness: 0.35, clearcoat: 0.4 });
    for (const [x, z, w, d] of [[0, -0.077, 0.232, 0.012], [0, 0.077, 0.232, 0.012], [-0.116, 0, 0.012, 0.16], [0.116, 0, 0.012, 0.16]]) {
      const r = new THREE.Mesh(new RoundedBoxGeometry(w, 0.022, d, 3, 0.004), rimMat);
      r.position.set(TRAY_X + x, this.trayY + 0.011, TRAY_Z + z);
      r.castShadow = true;
      scene.add(r);
    }

    // piyonlar
    this.pawnGeos = [];
    this.pawns = [];
    this.turnRing = new THREE.Mesh(new THREE.RingGeometry(0.016, 0.0215, 40), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    this.turnRing.rotation.x = -Math.PI / 2;
    this.turnRing.visible = false;
    scene.add(this.turnRing);
    this.turn = -1;

    // ev/otel örnekleri (instanced): pencereli, kiremit çatılı evler; yanan pencereli oteller
    const wallGeo = moved(new THREE.BoxGeometry(0.0175, 0.0125, 0.0165), 0, 0.00625, 0);
    const sh = new THREE.Shape();
    sh.moveTo(-0.0108, 0);
    sh.lineTo(0.0108, 0);
    sh.lineTo(0, 0.0085);
    sh.closePath();
    const roofGeo = moved(new THREE.ExtrudeGeometry(sh, { depth: 0.0185, bevelEnabled: false }), 0, 0, -0.00925);
    const hotelGeo = moved(new THREE.BoxGeometry(0.0245, 0.032, 0.0205), 0, 0.016, 0);
    const hotelTopGeo = moved(new THREE.BoxGeometry(0.0268, 0.0025, 0.0228), 0, 0.00125, 0);
    const houseTex = facadeTexture("house");
    const hotelTex = facadeTexture("hotel");
    this.houseMesh = new THREE.InstancedMesh(wallGeo, new THREE.MeshStandardMaterial({ map: houseTex, roughness: 0.6 }), 32);
    this.roofMesh = new THREE.InstancedMesh(roofGeo, new THREE.MeshStandardMaterial({ color: "#c2410c", roughness: 0.55 }), 32);
    this.hotelMesh = new THREE.InstancedMesh(hotelGeo, new THREE.MeshStandardMaterial({ map: hotelTex, emissiveMap: hotelTex, emissive: "#ffffff", emissiveIntensity: 0.35, roughness: 0.45 }), 12);
    this.hotelTop = new THREE.InstancedMesh(hotelTopGeo, new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.5 }), 12);
    this.bMeshes = [this.houseMesh, this.roofMesh, this.hotelMesh, this.hotelTop];
    this.gHouse = new THREE.InstancedMesh(wallGeo, ghostMat(this.houseMesh.material), 32);
    this.gRoof = new THREE.InstancedMesh(roofGeo, ghostMat(this.roofMesh.material), 32);
    this.gHotel = new THREE.InstancedMesh(hotelGeo, ghostMat(this.hotelMesh.material), 12);
    this.gTop = new THREE.InstancedMesh(hotelTopGeo, ghostMat(this.hotelTop.material), 12);
    this.bGhosts = [this.gHouse, this.gRoof, this.gHotel, this.gTop];
    for (const m of this.bGhosts) {
      m.count = 0;
      m.renderOrder = 2;
      scene.add(m);
    }
    for (const m of this.bMeshes) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.count = 0;
      scene.add(m);
    }
    this.buildings = []; // { kind, x, z, rot, sq }
    this.birth = new Map(); // kare → yapım zamanı (pop animasyonu)
    this.prevHouses = new Array(N).fill(0);
    this.clock = 0;
    // sahiplik işaretleri: tahta kenarına takılı renkli sekmeler
    this.ownMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.35, metalness: 0.1 }), N);
    this.ownMesh.castShadow = true;
    this.ownMesh.count = 0;
    scene.add(this.ownMesh);
    // sahiplik: kare üstü renkli örtü + köşede bayrak; bir oyuncu seçilince mülkleri parlar
    const flatGeo = new THREE.PlaneGeometry(1, 1);
    flatGeo.rotateX(-Math.PI / 2);
    this.tintMesh = new THREE.InstancedMesh(flatGeo, new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.3, depthWrite: false }), N);
    this.focusMesh = new THREE.InstancedMesh(flatGeo, new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), N);
    const flagShape = new THREE.Shape();
    flagShape.moveTo(0, 0);
    flagShape.lineTo(0.022, 0.007);
    flagShape.lineTo(0, 0.014);
    flagShape.closePath();
    this.poleMesh = new THREE.InstancedMesh(moved(new THREE.CylinderGeometry(0.0012, 0.0012, 0.05, 6), 0, 0.025, 0), new THREE.MeshStandardMaterial({ color: "#f1f5f9", roughness: 0.5 }), N);
    this.flagMesh = new THREE.InstancedMesh(moved(new THREE.ShapeGeometry(flagShape), 0, 0.036, 0), new THREE.MeshStandardMaterial({ color: "#ffffff", side: THREE.DoubleSide, roughness: 0.6, emissive: "#ffffff", emissiveIntensity: 0.15 }), N);
    for (const m of [this.tintMesh, this.focusMesh, this.poleMesh, this.flagMesh]) {
      m.count = 0;
      scene.add(m);
    }
    this.tintMesh.renderOrder = this.focusMesh.renderOrder = 1;
    this.poleMesh.castShadow = this.flagMesh.castShadow = true;
    this.ownSquares = [];
    this.ownerFocus = -1;
    this.focusColor = "#ffffff";
    // seçili kare vurgusu
    this.hl = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.hl.rotation.x = -Math.PI / 2;
    this.hl.position.y = H + 0.0072;
    this.hl.visible = false;
    scene.add(this.hl);

    // zarlar
    const faces = [1, 2, 3, 4, 5, 6].map((n) => pipTexture(n, Math.min(512, tex / 4)));
    const dieMats = STD.map((n) => new THREE.MeshPhysicalMaterial({ map: faces[n - 1], roughness: 0.25, clearcoat: 0.8 }));
    this.dice = [0, 1].map(() => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(DIE, DIE, DIE, 4, DIE * 0.12), dieMats);
      m.castShadow = true;
      scene.add(m);
      return m;
    });
    this.dice.forEach((d, i) => d.position.set(TRAY_X - 0.03 + i * 0.04, this.trayY + DIE / 2, TRAY_Z));
    this.diceAnim = null;

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.02, 20);
    this.camera.position.set(0, H + 0.85, 1.0);
    this.home = new THREE.Vector3(0, H, 0.02);
    this.camera.lookAt(this.home);
    // kamera: sürükle = döndür, tekerlek = yakınlaş, çift tık = sıfırla (görünüm sınırlı kalır)
    const ctl = (this.controls = new OrbitControls(this.camera, canvasEl));
    ctl.target.copy(this.home);
    ctl.enablePan = false;
    ctl.enableDamping = true;
    ctl.dampingFactor = 0.09;
    ctl.minDistance = 0.3;
    ctl.maxDistance = 1.9;
    ctl.minPolarAngle = 0.25;
    ctl.maxPolarAngle = 1.25;
    ctl.minAzimuthAngle = -0.8;
    ctl.maxAzimuthAngle = 0.8;
    ctl.rotateSpeed = 0.6;
    ctl.saveState();
    // otomatik kamera: kullanıcı sürükleyince/yakınlaştırınca 6 sn boyunca karışılmaz
    this.userUntil = 0;
    this.focus = null;
    this.camMoved = false;
    this.follow = true; // otomatik kamera takibi (arayüzden açılıp kapatılır)
    this.homeDist = this.camera.position.distanceTo(this.home);
    this._v1 = new THREE.Vector3();
    this._qa = new THREE.Quaternion();
    this._qb = new THREE.Quaternion();
    this._v2 = new THREE.Vector3();
    this.idleWaiters = [];
    this.onStep = null;
    ctl.addEventListener("start", () => (this.userUntil = this.clock + 6));
    // efektler: parçacıklar + kare parlamaları
    this.fx = new Particles(scene, 240, 0.02);
    this.flashes = [0, 1, 2].map(() => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.y = H + 0.0075;
      m.visible = false;
      scene.add(m);
      return { m, t: 0, dur: 1 };
    });
    this._pd = null;
    this._down = (e) => (this._pd = { x: e.clientX, y: e.clientY });
    this._dbl = () => ctl.reset();
    canvasEl.addEventListener("pointerdown", this._down);
    canvasEl.addEventListener("dblclick", this._dbl);
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(H + 0.006));
    this.gov = new Governor({ renderer, tier: start, auto, lights: [key], onChange: () => this.renderer.render(this.scene, this.camera) });
    this.tokenPos = [];
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // tahtanın tamamı sığsın
    this.camera.fov = Math.min(70, Math.max(38, w / h < 1.2 ? 58 : 44));
    this.camera.updateProjectionMatrix();
    // setSize tuvali siler: bir sonraki kareyi beklemeden hemen çiz (aksi halde milisaniyelik siyah titreme)
    this.renderer.render(this.scene, this.camera);
  }

  /** Tıklama mı yoksa kamera sürüklemesi mi? */
  isClick(e) {
    return !this._pd || Math.hypot(e.clientX - this._pd.x, e.clientY - this._pd.y) < 6;
  }

  /** İşaretçiden kare indeksi */
  pickSquare(clientX, clientY) {
    const p = pickPlane(this.camera, this.canvas, clientX, clientY, this.plane);
    if (!p) return -1;
    let best = -1;
    let bd = 1;
    for (let i = 0; i < N; i++) {
      const c = squareCenter(i);
      const d = Math.max(Math.abs(p.x - c.x), Math.abs(p.z - c.z));
      if (d < bd) (bd = d), (best = i);
    }
    return bd < C * 0.55 ? best : -1;
  }

  /** Bir oyuncunun tüm mülklerini tahtada parlat (−1: kapat) */
  setOwnerFocus(k, color = "#ffffff") {
    this.ownerFocus = k;
    this.focusColor = color;
    this.rebuildFocus();
  }

  rebuildFocus() {
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const col = new THREE.Color(this.focusColor);
    let n = 0;
    if (this.ownerFocus >= 0)
      for (const o of this.ownSquares) {
        if (o.owner !== this.ownerFocus) continue;
        m4.compose(p.set(o.x, H + 0.0068, o.z), q, s.set(o.horiz ? W : C, 1, o.horiz ? C : W));
        this.focusMesh.setMatrixAt(n, m4);
        this.focusMesh.setColorAt(n, col);
        n++;
      }
    this.focusMesh.count = n;
    this.focusMesh.instanceMatrix.needsUpdate = true;
    if (this.focusMesh.instanceColor) this.focusMesh.instanceColor.needsUpdate = true;
  }

  /** Seçili kareyi parlat (−1: kapat) */
  setHighlight(i) {
    if (i < 0) {
      this.hl.visible = false;
      return;
    }
    const c = squareCenter(i);
    const corner = i % 10 === 0;
    const w = corner ? C : W;
    const horiz = c.side === 0 || c.side === 2;
    this.hl.scale.set(horiz ? w : C, horiz ? C : w, 1);
    this.hl.position.x = c.x;
    this.hl.position.z = c.z;
    this.hl.visible = true;
  }

  /** Sırası gelen oyuncunun piyonunun altında halka (−1: yok) */
  setTurn(i, color) {
    this.turn = i;
    if (i >= 0 && color) this.turnRing.material.color.set(color);
    this.turnRing.visible = i >= 0;
  }

  setPlayers(players) {
    while (this.pawns.length < players.length) {
      const k = this.pawns.length;
      this.pawnGeos[k] = tokenGeometry(players[k]?.token ?? k);
      const m = new THREE.Mesh(this.pawnGeos[k], new THREE.MeshPhysicalMaterial({ color: "#fff", roughness: 0.22, metalness: 0.15, clearcoat: 1, side: THREE.DoubleSide }));
      m.scale.setScalar(1.3);
      m.castShadow = true;
      this.scene.add(m);
      this.pawns.push(m);
    }
    players.forEach((p, i) => {
      this.pawns[i].material.color.set(p.color);
      this.pawns[i].visible = !p.out;
      if (this.tokenPos[i] == null) this.tokenPos[i] = { at: p.pos, path: [], t: 0 };
      const tp = this.tokenPos[i];
      const target = p.pos;
      const last = tp.path.length ? tp.path[tp.path.length - 1] : tp.at;
      if (target !== last) {
        // kare kare yürüyüş yolu (ileri; gözaltına ışınlanmada doğrudan)
        const steps = (target - last + N) % N;
        if (steps > 0 && steps <= 12) for (let k = 1; k <= steps; k++) tp.path.push((last + k) % N);
        else tp.path.push(target);
      }
    });
  }

  setBoard(own, houses, mort, players) {
    // sahiplik sekmeleri (tahta kenarına takılı)
    let k = 0;
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < N; i++) {
      if (own[i] == null) continue;
      const c = squareCenter(i);
      const horiz = c.side === 0 || c.side === 2;
      const out = c.side === 0 ? 1 : c.side === 2 ? -1 : 0;
      const outX = c.side === 1 ? -1 : c.side === 3 ? 1 : 0;
      const corner = i % 10 === 0;
      const len = (corner ? C : W) * 0.86;
      m4.compose(
        new THREE.Vector3(c.x + outX * (C / 2 + 0.006), H + 0.003, c.z + out * (C / 2 + 0.006)),
        new THREE.Quaternion(),
        new THREE.Vector3(horiz ? len : 0.012, 0.006, horiz ? 0.012 : len)
      );
      this.ownMesh.setMatrixAt(k, m4);
      this.ownMesh.setColorAt(k, new THREE.Color(mort[i] ? "#6b7280" : players[own[i]].color));
      k++;
    }
    this.ownMesh.count = k;
    this.ownMesh.instanceMatrix.needsUpdate = true;
    if (this.ownMesh.instanceColor) this.ownMesh.instanceColor.needsUpdate = true;

    // örtü + bayrak
    this.ownSquares = [];
    let tn = 0;
    const qI = new THREE.Quaternion();
    const qf = new THREE.Quaternion();
    const upV = new THREE.Vector3(0, 1, 0);
    const pp = new THREE.Vector3();
    const ss = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      if (own[i] == null) continue;
      const c = squareCenter(i);
      const horiz = c.side === 0 || c.side === 2;
      const col = new THREE.Color(mort[i] ? "#6b7280" : players[own[i]].color);
      m4.compose(pp.set(c.x, H + 0.0063, c.z), qI, ss.set(horiz ? W : C, 1, horiz ? C : W));
      this.tintMesh.setMatrixAt(tn, m4);
      this.tintMesh.setColorAt(tn, col);
      const out = [[0, 1], [-1, 0], [0, -1], [1, 0]][c.side];
      const al = horiz ? [1, 0] : [0, 1];
      qf.setFromAxisAngle(upV, [0, Math.PI / 2, Math.PI, -Math.PI / 2][c.side]);
      m4.compose(pp.set(c.x + out[0] * (C / 2 - 0.012) + al[0] * (W / 2 - 0.014), H + 0.006, c.z + out[1] * (C / 2 - 0.012) + al[1] * (W / 2 - 0.014)), qf, ss.set(1, 1, 1));
      this.poleMesh.setMatrixAt(tn, m4);
      this.flagMesh.setMatrixAt(tn, m4);
      this.flagMesh.setColorAt(tn, col);
      this.ownSquares.push({ i, owner: own[i], horiz, x: c.x, z: c.z });
      tn++;
    }
    this.tintMesh.count = this.poleMesh.count = this.flagMesh.count = tn;
    for (const m of [this.tintMesh, this.poleMesh, this.flagMesh]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    this.rebuildFocus();

    // evler / oteller: yerleşim + yeni yapılanlar için "pop" animasyonu
    this.buildings.length = 0;
    for (let i = 0; i < N; i++) {
      const n = houses[i];
      if (n > this.prevHouses[i]) this.birth.set(i, this.clock);
      this.prevHouses[i] = n;
      if (!n) continue;
      const c = squareCenter(i);
      const inward = [[0, -1], [1, 0], [0, 1], [-1, 0]][c.side];
      const bx = c.x + inward[0] * (C / 2 - 0.018);
      const bz = c.z + inward[1] * (C / 2 - 0.018);
      const along = c.side === 0 || c.side === 2 ? [1, 0] : [0, 1];
      const rot = c.side % 2 ? Math.PI / 2 : 0;
      if (n === 5) this.buildings.push({ kind: "hotel", x: bx, z: bz, rot, sq: i, g: BOARD[i].g, key: `k${i}`, ghost: !!this.ghostMap.get(`k${i}`)?.on });
      else
        for (let q = 0; q < n; q++) {
          const off = (q - (n - 1) / 2) * 0.0195;
          this.buildings.push({ kind: "house", x: bx + along[0] * off, z: bz + along[1] * off, rot, sq: i, g: BOARD[i].g, last: q === n - 1, key: `h${i}_${q}`, ghost: !!this.ghostMap.get(`h${i}_${q}`)?.on });
        }
    }
    this.layoutBuildings();
  }

  /** Bina matrislerini yaz (yeni yapılanlar yaylanarak büyür; renk mülk grubundan gelir; kapatanlar hayalet katmanda) */
  layoutBuildings() {
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const n = { h: 0, o: 0, gh: 0, go: 0 };
    let anim = false;
    for (const b of this.buildings) {
      let s = 1;
      const born = this.birth.get(b.sq);
      if (born != null && (b.kind === "hotel" || b.last)) {
        const t = (this.clock - born) / 0.45;
        if (t < 1) (s = Math.max(0.001, easeOutBack(Math.max(0, t)))), (anim = true);
      }
      q.setFromAxisAngle(up, b.rot);
      const y0 = H + 0.006;
      if (b.kind === "hotel") {
        const k = 1.45 * s;
        const [mb, mt] = b.ghost ? [this.gHotel, this.gTop] : [this.hotelMesh, this.hotelTop];
        const i = b.ghost ? n.go++ : n.o++;
        m4.compose(pos.set(b.x, y0, b.z), q, sc.set(k, k, k));
        mb.setMatrixAt(i, m4);
        mb.setColorAt(i, TOWER[b.g]);
        m4.compose(pos.set(b.x, y0 + 0.032 * k, b.z), q, sc.set(k, k, k));
        mt.setMatrixAt(i, m4);
      } else {
        const k = 1.25 * s;
        const [mw, mr] = b.ghost ? [this.gHouse, this.gRoof] : [this.houseMesh, this.roofMesh];
        const i = b.ghost ? n.gh++ : n.h++;
        m4.compose(pos.set(b.x, y0, b.z), q, sc.set(k, k, k));
        mw.setMatrixAt(i, m4);
        mw.setColorAt(i, WALL[b.g]);
        m4.compose(pos.set(b.x, y0 + 0.0125 * k, b.z), q, sc.set(k, k, k));
        mr.setMatrixAt(i, m4);
        mr.setColorAt(i, ROOF[b.g]);
      }
    }
    this.houseMesh.count = this.roofMesh.count = n.h;
    this.gHouse.count = this.gRoof.count = n.gh;
    this.hotelMesh.count = this.hotelTop.count = n.o;
    this.gHotel.count = this.gTop.count = n.go;
    for (const m of [...this.bMeshes, ...this.bGhosts]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    this.buildAnim = anim;
  }

  /** Silüet binalarının matrisleri (katı / hayalet) */
  layoutSky() {
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    let a = 0;
    let g = 0;
    for (const it of this.sky.items) {
      const m = it.ghost ? this.sky.ghost : this.sky.solid;
      const k = it.ghost ? g++ : a++;
      m4.compose(p.set(it.x, 0, it.z), q, sc.set(it.w, it.h, it.d));
      m.setMatrixAt(k, m4);
      m.setColorAt(k, it.color);
    }
    this.sky.solid.count = a;
    this.sky.ghost.count = g;
    for (const m of [this.sky.solid, this.sky.ghost]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Piyonu / odaktaki kareyi kapatan binaları saydamlaştır: bina ekranda hedefin önünde (kameraya daha yakın)
   * ve hedef noktası binanın ekran dikdörtgeninin içindeyse hayalet katmana geçer. Saniyede ~8 kez çalışır.
   */
  updateGhosting() {
    const cam = this.camera;
    cam.updateMatrixWorld();
    const e = cam.matrixWorld.elements;
    const targets = [];
    const add = (x, z) => {
      // gövde genişliği: ortası + kameraya göre iki yanı, iki yükseklikte
      for (const y of [H + 0.012, H + 0.036])
        for (const dx of [-0.013, 0, 0.013]) {
          const v = new THREE.Vector3(x + e[0] * dx, y, z + e[2] * dx);
          targets.push({ n: v.clone().project(cam), d: v.distanceTo(cam.position) });
        }
    };
    this.pawns.forEach((m) => m.visible && add(m.position.x, m.position.z));
    const f = this.focus && this.clock < this.focus.until ? this.focus : null;
    if (f && f.kind !== "pawn") add(f.x ?? 0, f.z ?? 0);
    if (this.hl.visible) add(this.hl.position.x, this.hl.position.z);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const s = new THREE.Vector3();
    const hides = (x, z, hw, hh) => {
      const y0 = H + 0.006;
      a.set(x, y0, z).project(cam);
      b.set(x, y0 + hh, z).project(cam);
      const dB = Math.hypot(x - cam.position.x, y0 + hh / 2 - cam.position.y, z - cam.position.z);
      s.set(x + e[0] * hw, y0 + hh / 2 + e[1] * hw, z + e[2] * hw).project(cam);
      const hwN = Math.abs(s.x - (a.x + b.x) / 2) + 0.004;
      const x0 = Math.min(a.x, b.x) - hwN;
      const x1 = Math.max(a.x, b.x) + hwN;
      const y1 = Math.min(a.y, b.y) - 0.015;
      const y2 = Math.max(a.y, b.y);
      for (const t of targets) if (t.d > dB + 0.012 && t.n.x > x0 && t.n.x < x1 && t.n.y > y1 && t.n.y < y2) return true;
      return false;
    };
    // gecikmeli geçiş: saydam olmak için 2, geri katılaşmak için 4 ardışık ölçüm gerekir (sınırda titreme olmasın)
    const settle = (st, g) => {
      if (g === st.on) {
        st.n = 0;
        return false;
      }
      if (++st.n < (g ? 2 : 4)) return false;
      st.on = g;
      st.n = 0;
      return true;
    };
    let changed = false;
    for (const bd of this.buildings) {
      const g = hides(bd.x, bd.z, bd.kind === "hotel" ? 0.02 : 0.014, bd.kind === "hotel" ? 0.05 : 0.027);
      let st = this.ghostMap.get(bd.key);
      if (!st) this.ghostMap.set(bd.key, (st = { on: false, n: 0 }));
      if (settle(st, g)) (bd.ghost = st.on), (changed = true);
    }
    let skyChanged = false;
    for (const it of this.sky.items) {
      if (!it.st) it.st = { on: false, n: 0 };
      if (settle(it.st, hides(it.x, it.z, Math.max(it.w, it.d) * 0.55, it.h))) (it.ghost = it.st.on), (skyChanged = true);
    }
    if (changed) this.layoutBuildings();
    if (skyChanged) this.layoutSky();
  }

  /**
   * Zar at: Rapier ile önceden simüle et, son yüzleri istenen sonuca göre yeniden etiketle, sonra oynat.
   * seed: aynı atış için tüm istemcilerde benzer görünüm (tohumlu başlangıç).
   */
  async roll(result, seed, onClack, opts = {}) {
    if (opts.instant) {
      this.diceAnim = null;
      this.dice.forEach((d, i) => {
        d.position.set(TRAY_X - 0.03 + i * 0.04, this.trayY + DIE / 2, TRAY_Z);
        d.quaternion.copy(relabel(2, result[i]));
      });
      return;
    }
    let RAPIER;
    try {
      RAPIER = (await import("@dimforge/rapier3d-compat")).default;
      await RAPIER.init();
    } catch (e) {
      // fizik yüklenemezse: zarları doğrudan sonuca koy
      this.dice.forEach((d, i) => d.quaternion.copy(relabel(2, result[i])));
      return;
    }
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = 1 / 240;
    const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(TRAY_X, this.trayY, TRAY_Z));
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.11, 0.001, 0.075).setTranslation(0, -0.001, 0).setFriction(0.45).setRestitution(0.45), ground);
    for (const [x, z, hx, hz] of [[-0.116, 0, 0.006, 0.081], [0.116, 0, 0.006, 0.081], [0, -0.077, 0.116, 0.006], [0, 0.077, 0.116, 0.006]])
      world.createCollider(RAPIER.ColliderDesc.cuboid(hx, 0.25, hz).setTranslation(x, 0.25, z).setRestitution(0.45).setFriction(0.2), ground);
    let r = seed >>> 0 || 1;
    const rnd = () => ((r = (Math.imul(r ^ (r >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0) / 4294967296);
    const bodies = [0, 1].map((i) => {
      const b = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(TRAY_X - 0.085 + i * 0.025, this.trayY + 0.14 + i * 0.012, TRAY_Z + 0.035 - i * 0.015)
          .setLinvel(0.7 + rnd() * 0.3, 0.3 + rnd() * 0.3, -0.28 - rnd() * 0.14)
          .setAngvel({ x: (rnd() - 0.5) * 56, y: (rnd() - 0.5) * 56, z: (rnd() - 0.5) * 56 })
          .setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6)))
          .setCcdEnabled(true)
      );
      world.createCollider(RAPIER.ColliderDesc.roundCuboid(DIE / 2 - 0.003, DIE / 2 - 0.003, DIE / 2 - 0.003, 0.003).setDensity(1200).setFriction(0.4).setRestitution(0.45), b);
      return b;
    });
    // önceden simüle et (en fazla 4 sn), kareleri kaydet
    const frames = [];
    let clacks = [];
    let lastV = [0, 0];
    for (let step = 0; step < 240 * 3; step++) {
      world.step();
      if (step === 380) bodies.forEach((b) => (b.setLinearDamping(3), b.setAngularDamping(3))); // geç evrede yumuşakça dur
      if (step % 4 === 0) {
        frames.push(bodies.map((b) => ({ p: { ...b.translation() }, q: { ...b.rotation() } })));
        bodies.forEach((b, i) => {
          const v = b.linvel();
          const sp = Math.hypot(v.x, v.y, v.z);
          if (lastV[i] - sp > 0.35) clacks.push({ f: frames.length - 1, k: Math.min(1, (lastV[i] - sp) / 1.5) });
          lastV[i] = sp;
        });
      }
      if (step > 300 && bodies.every((b) => b.isSleeping() || Math.hypot(b.linvel().x, b.linvel().y, b.linvel().z) < 0.002)) break;
    }
    const fixes = bodies.map((b, i) => {
      const q = new THREE.Quaternion(b.rotation().x, b.rotation().y, b.rotation().z, b.rotation().w);
      return relabel(topFace(q), result[i]);
    });
    world.free();
    // animasyon bitince çözülür (en geç 6,5 sn sonra: sekme arka plandaysa takılmasın)
    return new Promise((res) => {
      this.diceAnim = { frames, i: 0, acc: 0, fixes, clacks, onClack, onEnd: res };
      setTimeout(res, 9500);
    });
  }

  /** Her karede çağrılır */
  update(dt, ms) {
    this.clock += dt;
    for (const c of this.clouds) c.position.x = c.position.x > 5.5 ? -5.5 : c.position.x + dt * 0.03;
    if (this.buildAnim) this.layoutBuildings();
    this.camDirector(dt);
    this.controls.update();
    // zar animasyonu: 60 Hz kayıt, yavaş çekimde (DICE_RATE) ve kareler arası ara değerlemeyle oynar (takılmadan akıcı)
    const a = this.diceAnim;
    if (a) {
      const last = a.frames.length - 1;
      a.t = (a.t || 0) + dt * 60 * DICE_RATE;
      const ti = Math.min(last, a.t);
      const i0 = Math.floor(ti);
      const i1 = Math.min(last, i0 + 1);
      const fr = ti - i0;
      while (a.i < i0) {
        a.i++;
        for (const c of a.clacks) if (c.f === a.i) a.onClack?.(c.k);
      }
      for (let k = 0; k < this.dice.length; k++) {
        const A = a.frames[i0][k];
        const B = a.frames[i1][k];
        this.dice[k].position.set(A.p.x + (B.p.x - A.p.x) * fr, A.p.y + (B.p.y - A.p.y) * fr, A.p.z + (B.p.z - A.p.z) * fr);
        this._qa.set(A.q.x, A.q.y, A.q.z, A.q.w).slerp(this._qb.set(B.q.x, B.q.y, B.q.z, B.q.w), fr);
        this.dice[k].quaternion.copy(this._qa).multiply(a.fixes[k]);
      }
      if (ti >= last) {
        a.onEnd?.();
        this.diceAnim = null;
      }
    }
    // piyon yürüyüşü (kare başına 0,16 sn zıplama)
    let moving = -1;
    this.tokenPos.forEach((tp, i) => {
      const m = this.pawns[i];
      if (!m) return;
      if (tp.path.length) {
        moving = i;
        tp.t += dt / 0.26;
        if (tp.t >= 1) {
          tp.at = tp.path.shift();
          tp.t = 0;
          this.onStep?.(i);
        }
      }
      const from = squareCenter(tp.at);
      const to = tp.path.length ? squareCenter(tp.path[0]) : from;
      const t = tp.path.length ? tp.t : 0;
      const e = t * t * (3 - 2 * t);
      // aynı karedeki piyonlar yan yana
      const ox = ((i % 3) - 1) * 0.022;
      const oz = (Math.floor(i / 3) - 0.5) * 0.022;
      m.position.set(from.x + (to.x - from.x) * e + ox, H + 0.006 + Math.sin(Math.PI * t) * 0.03, from.z + (to.z - from.z) * e + oz);
    });
    if (moving >= 0) this.focus = { kind: "pawn", i: moving, until: this.clock + 1.2, dist: this.homeDist * 0.78 };
    else if (this.idleWaiters.length) this.idleWaiters.splice(0).forEach((f) => f());
    this.fx.update(dt);
    this.ghostT += dt;
    if (this.ghostT > 0.12) {
      this.ghostT = 0;
      this.updateGhosting();
    }
    for (const f of this.flashes) {
      if (!f.m.visible) continue;
      f.t += dt;
      const k = f.t / f.dur;
      if (k >= 1) f.m.visible = false;
      else f.m.material.opacity = 0.8 * Math.pow(1 - k, 1.3) * (0.75 + 0.25 * Math.sin(f.t * 22));
    }
    // sıradaki oyuncunun halkası
    const tp = this.turn >= 0 ? this.pawns[this.turn] : null;
    if (tp) {
      this.turnRing.position.set(tp.position.x, H + 0.0072, tp.position.z);
      this.turnRing.scale.setScalar(1 + 0.1 * Math.sin(this.clock * 4));
    }
    this.focusMesh.material.opacity = this.ownerFocus >= 0 ? 0.28 + 0.2 * Math.sin(this.clock * 5) : 0;
    if (this.hl.visible) this.hl.material.opacity = 0.3 + 0.15 * Math.sin(this.clock * 4);
    this.gov.frame(ms);
    this.renderer.render(this.scene, this.camera);
  }

  /** Otomatik kamera: odak noktasına yumuşakça yaklaş, süre bitince genel görünüme dön */
  camDirector(dt) {
    const ctl = this.controls;
    if (!this.follow || this.clock <= this.userUntil) return; // takip kapalı ya da kullanıcı kontrolü aldı
    const f = this.focus && this.clock < this.focus.until ? this.focus : null;
    if (!f) return; // hareket yoksa kamera olduğu yerde kalır (genel görünüme otomatik dönüş yok: ileri-geri titremesin)
    this.camMoved = true;
    const tgt = this._v2;
    let dist = this.homeDist;
    if (f) {
      // piyonu izle ama tahta merkezine doğru kaydır: köşedeki piyonda kadraj boş denize kalmasın
      if (f.kind === "pawn" && this.pawns[f.i]) tgt.set(this.pawns[f.i].position.x * 0.62 + this.home.x * 0.38, H, this.pawns[f.i].position.z * 0.62 + this.home.z * 0.38);
      else tgt.set(f.x ?? 0, H, f.z ?? 0);
      dist = f.dist;
    }
    const k = 1 - Math.exp(-dt * 1.5); // düşük hız = akıcı
    // hız sınırı: kamera hedefi ≤ 0,4 m/sn, yakınlaşma ≤ 0,25 m/sn (ani sıçrama olmasın)
    let dx = (tgt.x - ctl.target.x) * k;
    let dz = (tgt.z - ctl.target.z) * k;
    const len = Math.hypot(dx, dz);
    const cap = 0.4 * dt;
    if (len > cap) (dx *= cap / len), (dz *= cap / len);
    ctl.target.x += dx;
    ctl.target.z += dz;
    this.camera.position.x += dx;
    this.camera.position.z += dz;
    const off = this._v1.copy(this.camera.position).sub(ctl.target);
    const d = off.length() || 1;
    const dd = Math.max(-0.25 * dt, Math.min(0.25 * dt, (dist - d) * k));
    const nd = d + dd;
    this.camera.position.copy(ctl.target).add(off.multiplyScalar(nd / d));
  }

  /** Genel görünüm: kamerayı başlangıç konumuna döndür */
  resetCamera() {
    this.focus = null;
    this.userUntil = 0;
    this.controls.reset();
  }

  focusPawn(i, secs = 1.2, dist = 0.7) {
    this.focus = { kind: "pawn", i, until: this.clock + secs, dist };
  }

  focusSquare(sq, secs = 1.6, dist = 0.75) {
    const c = squareCenter(sq);
    this.focus = { kind: "pt", x: c.x, z: c.z, until: this.clock + secs, dist };
  }

  pawnPos(i) {
    const m = this.pawns[i];
    return m ? { x: m.position.x, z: m.position.z } : { x: 0, z: 0 };
  }

  /** Piyonlar yürümeyi bitirince çözülür (en geç max sn) */
  whenPawnsIdle(max = 8) {
    if (!this.tokenPos.some((tp) => tp.path.length)) return Promise.resolve();
    return new Promise((res) => {
      const t = setTimeout(res, max * 1000);
      this.idleWaiters.push(() => (clearTimeout(t), res()));
    });
  }

  /** Tahta düzlemindeki bir noktanın ekran konumu (canvas'a göre px) */
  toScreen(x, z, lift = 0.02) {
    const v = this._v2.set(x, H + 0.006 + lift, z).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.canvas.clientWidth, y: ((1 - v.y) / 2) * this.canvas.clientHeight };
  }

  /** Işıklı parçacık patlaması */
  burst(x, z, color = "#ffffff", n = 22, lift = 0) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.05 + Math.random() * 0.13;
      this.fx.emit(x + Math.cos(a) * 0.01, H + 0.014 + lift, z + Math.sin(a) * 0.01, Math.cos(a) * sp, 0.1 + Math.random() * 0.16, Math.sin(a) * sp, color, 0.7 + Math.random() * 0.5, -0.45);
    }
  }

  /** Altın para akışı: from → to (kira, takas) */
  coins(from, to, n = 9) {
    const g = -1.6;
    for (let k = 0; k < n; k++) {
      const T = 0.6 + k * 0.07;
      const jx = (Math.random() - 0.5) * 0.02;
      const jz = (Math.random() - 0.5) * 0.02;
      this.fx.emit(from.x + jx, H + 0.04, from.z + jz, (to.x - from.x) / T, 0.5 / T - 0.5 * g * T, (to.z - from.z) / T, "#ffd54a", T, g);
    }
  }

  /** Kareyi renkli parlat */
  flash(sq, color = "#ffffff") {
    const f = this.flashes.find((x) => !x.m.visible) || this.flashes[0];
    const c = squareCenter(sq);
    const w = sq % 10 === 0 ? C : W;
    const horiz = c.side === 0 || c.side === 2;
    f.m.scale.set(horiz ? w : C, horiz ? C : w, 1);
    f.m.position.x = c.x;
    f.m.position.z = c.z;
    f.m.material.color.set(color);
    f.t = 0;
    f.dur = 1.2;
    f.m.visible = true;
  }

  get stats() {
    return { fps: this.gov.fps, tier: TIERS[this.gov.tier].name, dpr: this.gov.dpr, calls: this.renderer.info.render.calls };
  }

  dispose() {
    this.canvas.removeEventListener("pointerdown", this._down);
    this.canvas.removeEventListener("dblclick", this._dbl);
    this.controls.dispose();
    this.scene.background?.dispose?.();
    disposeScene(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
  }
}
