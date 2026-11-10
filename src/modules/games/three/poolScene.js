/**
 * 🎱 Bilardo 3B sahnesi. Motor koordinatı: (x, z) masa düzlemi → three (X = x, Z = z), Y yukarı; çuha yüzeyi Y = S.
 * Modeller: ahşap gövde + raylar (elmas işaretler), kauçuk bantlar (çuha kaplı), deri cep torbaları, torna ayaklar,
 * bilardo lambası (gölgeli), numaralı toplar (düz/çizgili dokular), ıstaka (uç + yüksük + gövde + sargı + sap).
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createRenderer, studioEnvironment, Governor, disposeScene, pickPlane, TIERS, arcadeStage } from "./kit";
import { woodTexture, feltTexture, canvas, toTexture } from "./textures";
import { A, B, R, TABLE, HEAD_X } from "../engines/pool";

const S = 0.8; // çuha yüksekliği
const RAIL_W = 0.13;
const CUSH_H = 0.04;

export const BALL_COLORS = { 1: "#f2c200", 2: "#1f4fbf", 3: "#d0261f", 4: "#5b2a86", 5: "#f07d1a", 6: "#167a3d", 7: "#7a1f1f", 8: "#121212", 9: "#f2c200", 10: "#1f4fbf", 11: "#d0261f", 12: "#5b2a86", 13: "#f07d1a", 14: "#167a3d", 15: "#7a1f1f" };

function ballTexture(n, size) {
  const c = canvas(size, size / 2);
  const g = c.getContext("2d");
  const w = size;
  const h = size / 2;
  const ivory = "#f5f1e6";
  if (n === 0) {
    g.fillStyle = ivory;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#c81e1e";
    for (const x of [w * 0.25, w * 0.75]) {
      g.beginPath();
      g.arc(x, h / 2, h * 0.035, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    const col = BALL_COLORS[n];
    const stripe = n >= 9;
    g.fillStyle = stripe ? ivory : col;
    g.fillRect(0, 0, w, h);
    if (stripe) {
      g.fillStyle = col;
      g.fillRect(0, h * 0.28, w, h * 0.44);
    }
    // numara dairesi (iki yanda)
    for (const x of [w * 0.25, w * 0.75]) {
      g.fillStyle = ivory;
      g.beginPath();
      g.ellipse(x, h / 2, h * 0.17, h * 0.15, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#111";
      g.font = `700 ${h * 0.2}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(String(n), x, h / 2 + h * 0.01);
    }
  }
  return toTexture(c, { aniso: 4 });
}

/** Bant profili: yamuk kesit (bant burnu top merkezinin üstünde), segment boyunca ekstrüzyon */
function cushionMesh(seg, mat) {
  const sh = new THREE.Shape();
  // kesit (u = içe doğru mesafe, v = yükseklik); burun ~ %63 top çapı yükseklikte
  sh.moveTo(0, 0);
  sh.lineTo(-0.045, 0);
  sh.lineTo(-0.045, CUSH_H + 0.006);
  sh.lineTo(-0.008, CUSH_H + 0.006);
  sh.quadraticCurveTo(0.003, CUSH_H, 0.002, 0.024);
  sh.lineTo(0, 0.006);
  sh.closePath();
  const len = seg.l;
  const geo = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false, curveSegments: 8 });
  // kesit düzlemi XY, ekstrüzyon +Z → segment yönüne çevir
  const m = new THREE.Mesh(geo, mat);
  const nx = seg.tz; // içe normal (masa merkezine doğru) — segment yönüne dik
  const nz = -seg.tx;
  // içe bakan normal masanın merkezine doğru olmalı
  const mx = (seg.x1 + seg.x2) / 2;
  const mz = (seg.z1 + seg.z2) / 2;
  const inward = nx * -mx + nz * -mz > 0 ? 1 : -1;
  const ang = Math.atan2(seg.tx, seg.tz);
  m.rotation.y = ang;
  m.position.set(seg.x1, S - 0.004, seg.z1);
  if (inward < 0) m.scale.x = -1;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cueMesh(tex) {
  const L = 1.47;
  const pts = [];
  const prof = [
    [0, 0.0062], [0.004, 0.0065], [0.012, 0.0066], [0.026, 0.0068], [0.6, 0.0085], [0.9, 0.0105], [1.0, 0.0115], [1.27, 0.0135], [1.45, 0.0148], [L, 0.0145],
  ];
  for (const [y, r] of prof) pts.push(new THREE.Vector2(r, y));
  pts.push(new THREE.Vector2(0.0001, L));
  const g = new THREE.LatheGeometry(pts, 32);
  g.rotateX(Math.PI / 2); // uç +Z yönünde 0'da, sap +Z boyunca
  // vertex renkleri yerine malzeme grupları: uç (mavi), yüksük (beyaz), gövde (akçaağaç), sargı (siyah), sap (koyu ahşap)
  const grp = new THREE.Group();
  const mk = (from, to, mat) => {
    const seg = new THREE.Mesh(g, mat);
    seg.material = mat;
    return seg;
  };
  const shaft = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ ...tex.maple, roughness: 0.35 }));
  grp.add(shaft);
  // uç ve yüksük, sargı: ince silindir kaplamaları
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0063, 0.0062, 0.005, 24), new THREE.MeshStandardMaterial({ color: "#2f5f9e", roughness: 0.9 }));
  tip.rotation.x = Math.PI / 2;
  tip.position.z = 0.0025;
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.0067, 0.0066, 0.02, 24), new THREE.MeshStandardMaterial({ color: "#f4f1ea", roughness: 0.3 }));
  ferrule.rotation.x = Math.PI / 2;
  ferrule.position.z = 0.016;
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.0137, 0.0127, 0.26, 32), new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.85 }));
  wrap.rotation.x = Math.PI / 2;
  wrap.position.z = 1.15;
  const butt = new THREE.Mesh(new THREE.CylinderGeometry(0.0149, 0.0139, 0.17, 32), new THREE.MeshStandardMaterial({ ...tex.dark, roughness: 0.3 }));
  butt.rotation.x = Math.PI / 2;
  butt.position.z = 1.37;
  grp.add(tip, ferrule, wrap, butt);
  grp.traverse((o) => (o.castShadow = !!o.isMesh));
  void mk;
  return grp;
}

/** Statik meshleri malzemeye göre tek meshe birleştirir (çizim çağrısını azaltır) */
function mergeStatic(scene, list, mat, { cast = true, receive = true } = {}) {
  const geos = list.map((m) => {
    m.updateMatrixWorld(true);
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    return g.index ? g.toNonIndexed() : g;
  });
  for (const g of geos) for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
  const merged = new THREE.Mesh(mergeGeometries(geos, false), mat);
  merged.castShadow = cast;
  merged.receiveShadow = receive;
  scene.add(merged);
  return merged;
}

export class PoolScene {
  /** o: { seat, gfx, cloth: "#rrggbb" } */
  constructor(canvasEl, o) {
    this.canvas = canvasEl;
    this.seat = o.seat;
    const { renderer, start, auto, maxTex } = createRenderer(canvasEl, o.gfx);
    this.renderer = renderer;
    const tex = Math.min(maxTex, TIERS[start].tex);
    const aniso = renderer.capabilities.getMaxAnisotropy();
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color("#0c0b0a");
    scene.fog = new THREE.Fog("#0c0b0a", 4, 11);
    studioEnvironment(renderer, scene, 0.04);
    scene.environmentIntensity = 0.45;
    scene.add(new THREE.HemisphereLight("#fff0e0", "#6d4bd0", 0.85));

    // Bilardo lambası: tek gölgeli geniş spot (merkez) + gölgesiz yumuşak dolgu (performans: tek gölge geçişi)
    this.lights = [];
    const key = new THREE.SpotLight("#fff2dc", 9, 3.4, Math.PI / 2.6, 0.7, 1.4);
    key.position.set(0, S + 1.05, 0);
    key.target.position.set(0, S, 0);
    key.castShadow = true;
    key.shadow.bias = -0.0002;
    key.shadow.normalBias = 0.008;
    key.shadow.radius = 3;
    key.shadow.camera.near = 0.3;
    key.shadow.camera.far = 2;
    scene.add(key, key.target);
    this.lights.push(key);
    const lampMat = new THREE.MeshStandardMaterial({ color: "#0f3b24", roughness: 0.4, metalness: 0.3 });
    const lamp = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.12, 0.34, 4, 0.03), lampMat);
    lamp.position.set(0, S + 1.12, 0);
    scene.add(lamp);
    this.lampParts = [lamp];
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 0.28), new THREE.MeshBasicMaterial({ color: "#fff4dd" }));
    glow.rotation.x = Math.PI / 2;
    glow.position.set(0, S + 1.059, 0);
    scene.add(glow);
    this.lampParts.push(glow);
    for (const x of [-0.6, 0.6]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.2, 8), new THREE.MeshStandardMaterial({ color: "#222", metalness: 0.8, roughness: 0.4 }));
      rod.position.set(x, S + 1.78, 0);
      scene.add(rod);
      this.lampParts.push(rod);
    }

    // Zemin (koyu ahşap parke hissi: düz koyu) + halı
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ color: "#1a1410", roughness: 0.8 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.visible = false;
    scene.add(floor);
    arcadeStage(scene, { y: 0, rings: [2.1, 2.95], ringColor: "#34d399", sky: ["#10282f", "#1f7a63", "#ffd27a"], grid: "#5eead4" });

    // Çuha
    const cloth = feltTexture(Math.min(2048, tex), hexRgb(o.cloth || "#1d6b3f"), 17);
    cloth.map.repeat.set(4, 2);
    cloth.normalMap.repeat.set(4, 2);
    const clothMat = new THREE.MeshStandardMaterial({ map: cloth.map, normalMap: cloth.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.95, envMapIntensity: 0.3 });
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(2 * A + 0.2, 2 * B + 0.2), clothMat);
    bed.rotation.x = -Math.PI / 2;
    bed.position.y = S;
    bed.receiveShadow = true;
    scene.add(bed);
    // baş çizgisi + ayak noktası
    const mark = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.25 });
    const head = new THREE.Mesh(new THREE.PlaneGeometry(0.003, 2 * B), mark);
    head.rotation.x = -Math.PI / 2;
    head.position.set(HEAD_X, S + 0.0005, 0);
    scene.add(head);

    // Bantlar (çuha kaplı kauçuk)
    const cushMat = new THREE.MeshStandardMaterial({ map: cloth.map, normalMap: cloth.normalMap, color: "#d9d9d9", roughness: 0.9 });
    mergeStatic(scene, TABLE.segs.filter((seg) => seg.l > 0.08).map((seg) => cushionMesh(seg, cushMat)), cushMat);

    // Ahşap gövde + raylar
    const wood = woodTexture(Math.min(2048, tex), { base: [96, 52, 26], dark: [52, 26, 12], seed: 13, rings: 18 });
    // cila (clearcoat) yalnızca yüksek kademede: düşük donanımda piksel maliyeti yarıya iner
    const woodMat = start >= 2 ? new THREE.MeshPhysicalMaterial({ map: wood.map, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.25, envMapIntensity: 0.5 }) : new THREE.MeshStandardMaterial({ map: wood.map, roughness: 0.4, envMapIntensity: 0.5 });
    const woodParts = [];
    // Raylar cep ağızlarında kesilir; köşelerde delikli bloklar durur (cep gerçekten açık görünür)
    const railBox = (x, z, w, d) => {
      const r = new THREE.Mesh(new RoundedBoxGeometry(w, 0.05, d, 4, 0.012));
      r.position.set(x, S + CUSH_H - 0.015, z);
      woodParts.push(r);
    };
    const GAP_SIDE = 0.075;
    const GAP_CORNER = 0.05;
    const longW = A - GAP_CORNER - GAP_SIDE;
    for (const sz of [-1, 1])
      for (const sx of [-1, 1]) railBox(sx * (GAP_SIDE + longW / 2), sz * (B + RAIL_W / 2 + 0.03), longW, RAIL_W);
    for (const sx of [-1, 1]) railBox(sx * (A + RAIL_W / 2 + 0.03), 0, RAIL_W, 2 * (B - GAP_CORNER));
    const block = (shape) => {
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false, curveSegments: 24 });
      g.rotateX(Math.PI / 2); // şekil XY → dünya XZ, derinlik aşağı
      const m = new THREE.Mesh(g);
      m.position.y = S + 0.05;
      woodParts.push(m);
    };
    const pc = TABLE.pockets.find((p) => p.kind === "corner");
    const ps = TABLE.pockets.find((p) => p.kind === "side");
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const x0 = A - GAP_CORNER;
        const x1 = A + RAIL_W + 0.03;
        const z0 = B - GAP_CORNER;
        const z1 = B + RAIL_W + 0.03;
        const sh = new THREE.Shape([new THREE.Vector2(sx * x0, sz * z0), new THREE.Vector2(sx * x1, sz * z0), new THREE.Vector2(sx * x1, sz * z1), new THREE.Vector2(sx * x0, sz * z1)]);
        const hole = new THREE.Path();
        hole.absarc(sx * (A + 0.02), sz * (B + 0.02), pc.r * 1.05, 0, Math.PI * 2, false);
        sh.holes.push(hole);
        block(sh);
      }
    for (const sz of [-1, 1]) {
      const zc = ps.z * sz * (ps.z < 0 ? -1 : 1); // yan cep merkezi z (işaretli)
      const rr = ps.r * 1.05;
      const sh = new THREE.Shape();
      sh.moveTo(-GAP_SIDE, sz * (Math.abs(zc) + RAIL_W - 0.005));
      sh.lineTo(GAP_SIDE, sz * (Math.abs(zc) + RAIL_W - 0.005));
      sh.lineTo(GAP_SIDE, sz * Math.abs(zc));
      sh.lineTo(rr, sz * Math.abs(zc));
      sh.absarc(0, sz * Math.abs(zc), rr, 0, Math.PI, sz < 0);
      sh.lineTo(-GAP_SIDE, sz * Math.abs(zc));
      sh.closePath();
      block(sh);
    }
    const apron = new THREE.Mesh(new RoundedBoxGeometry(2 * A + 2 * RAIL_W + 0.1, 0.22, 2 * B + 2 * RAIL_W + 0.1, 5, 0.03));
    apron.position.y = S - 0.12;
    woodParts.push(apron);
    // elmas işaretleri (sedef)
    const pearl = new THREE.MeshPhysicalMaterial({ color: "#f3efe6", roughness: 0.2, clearcoat: 1 });
    const diamond = new THREE.CylinderGeometry(0.008, 0.008, 0.002, 4);
    const dm = [];
    for (let i = 1; i < 8; i++) {
      if (i === 4) continue;
      const x = -A + (i * 2 * A) / 8;
      for (const sz of [-1, 1]) {
        const d = new THREE.Mesh(diamond);
        d.position.set(x, S + CUSH_H + 0.011, sz * (B + RAIL_W / 2 + 0.03));
        dm.push(d);
      }
    }
    for (let i = 1; i < 4; i++) {
      const z = -B + (i * 2 * B) / 4;
      for (const sx of [-1, 1]) {
        const d = new THREE.Mesh(diamond);
        d.position.set(sx * (A + RAIL_W / 2 + 0.03), S + CUSH_H + 0.011, z);
        dm.push(d);
      }
    }
    mergeStatic(scene, dm, pearl, { cast: false });
    // cepler: koyu boşluk + deri torba
    const holeMat = new THREE.MeshStandardMaterial({ color: "#050505", roughness: 1 });
    const leather = new THREE.MeshStandardMaterial({ color: "#3a2216", roughness: 0.55 });
    const holes = [];
    const rims = [];
    for (const p of TABLE.pockets) {
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 1.05, p.r * 0.9, 0.06, 40));
      hole.position.set(p.x, S - 0.028, p.z);
      holes.push(hole);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(p.r * 1.08, 0.012, 12, 48));
      rim.rotation.x = Math.PI / 2;
      rim.position.set(p.x, S + 0.034, p.z);
      rims.push(rim);
    }
    mergeStatic(scene, holes, holeMat, { cast: false });
    mergeStatic(scene, rims, leather);
    // torna ayaklar
    const legPts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const r = 0.06 + 0.025 * Math.sin(t * Math.PI * 3) * (1 - t) + (t > 0.85 ? 0.02 : 0);
      legPts.push(new THREE.Vector2(r, (S - 0.23) * t));
    }
    const legGeo = new THREE.LatheGeometry(legPts, 40);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const l = new THREE.Mesh(legGeo);
        l.position.set(sx * (A - 0.08), 0, sz * (B - 0.02));
        woodParts.push(l);
      }
    mergeStatic(scene, woodParts, woodMat);

    // Toplar
    const bt = Math.min(1024, tex / 2);
    const ballGeo = new THREE.SphereGeometry(R, 48, 32);
    this.balls = new Map();
    for (let n = 0; n <= 15; n++) {
      const m = new THREE.Mesh(ballGeo, start >= 1 ? new THREE.MeshPhysicalMaterial({ map: ballTexture(n, bt), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }) : new THREE.MeshStandardMaterial({ map: ballTexture(n, bt), roughness: 0.15 }));
      m.castShadow = true;
      scene.add(m);
      this.balls.set(n, m);
    }
    // Istaka
    const maple = woodTexture(512, { base: [222, 196, 150], dark: [196, 166, 120], seed: 2, rings: 40 });
    const dark = woodTexture(512, { base: [70, 30, 16], dark: [30, 12, 6], seed: 5, rings: 26 });
    this.cue = cueMesh({ maple: { map: maple.map }, dark: { map: dark.map } });
    scene.add(this.cue);
    // nişan yardımcıları
    this.aimLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: "#ffffff", dashSize: 0.02, gapSize: 0.015, transparent: true, opacity: 0.55 }));
    scene.add(this.aimLine);
    this.ghost = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 16), new THREE.MeshBasicMaterial({ color: "#ffffff", wireframe: true, transparent: true, opacity: 0.35 }));
    scene.add(this.ghost);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.03, 30);
    this.camState = { yaw: this.seat === 1 ? Math.PI : 0, yawS: this.seat === 1 ? Math.PI : 0, pitch: 0.48, dist: 1.6, target: new THREE.Vector3(0, S, 0), overview: 0 };
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(S + R));
    this.gov = new Governor({ renderer, tier: start, auto, lights: this.lights });
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  pick(clientX, clientY) {
    const p = pickPlane(this.camera, this.canvas, clientX, clientY, this.plane);
    return p ? { x: p.x, z: p.z } : null;
  }

  /**
   * r: { balls:[[n,x,z,on,rot?]], cue:{x,z}, aim:{dx,dz,pull, show}, ghost:{x,z}|null, mode:"aim"|"move"|"place" }
   */
  update(r, dt, ms) {
    for (const [n, x, z, on] of r.balls) {
      const m = this.balls.get(n);
      if (!m) continue;
      m.visible = !!on;
      if (!on) continue;
      // yuvarlanma görseli: konum farkından dönüş
      const px = m.userData.px ?? x;
      const pz = m.userData.pz ?? z;
      const dx = x - px;
      const dz = z - pz;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > 1e-6 && d < 0.2) m.rotateOnWorldAxis(new THREE.Vector3(dz / d, 0, -dx / d), d / R);
      m.userData.px = x;
      m.userData.pz = z;
      m.position.set(x, S + R, z);
    }
    // ıstaka ve nişan çizgisi
    const show = r.aim?.show;
    this.cue.visible = !!show;
    this.aimLine.visible = !!show;
    this.ghost.visible = !!(show && r.ghost);
    if (show) {
      const { dx, dz, pull } = r.aim;
      const back = 0.012 + pull * 0.28;
      const cx = r.cue.x - dx * (R + back);
      const cz = r.cue.z - dz * (R + back);
      this.cue.position.set(cx, S + R + 0.004, cz);
      this.cue.lookAt(cx - dx, S + R + 0.004 + 0.12, cz - dz); // hafif yükseltilmiş sap
      const pts = [new THREE.Vector3(r.cue.x, S + 0.002, r.cue.z), new THREE.Vector3(r.ghost ? r.ghost.x : r.cue.x + dx * 2.4, S + 0.002, r.ghost ? r.ghost.z : r.cue.z + dz * 2.4)];
      this.aimLine.geometry.setFromPoints(pts);
      this.aimLine.computeLineDistances();
      if (r.ghost) this.ghost.position.set(r.ghost.x, S + R, r.ghost.z);
    }
    // kamera: nişanda beyazın arkasından; hareket sırasında masaya genel bakış
    const cs = this.camState;
    const wantOver = r.mode === "move" || r.mode === "place" || r.mode === "watch" ? 1 : 0;
    cs.overview += (wantOver - cs.overview) * (1 - Math.exp(-dt / 0.35));
    if (show) cs.yaw = Math.atan2(-r.aim.dx, -r.aim.dz);
    const tgt = new THREE.Vector3(r.cue.x, S, r.cue.z).lerp(new THREE.Vector3(0, S, 0), cs.overview);
    cs.target.lerp(tgt, 1 - Math.exp(-dt / 0.15));
    const dist = cs.dist * (1 - cs.overview) + 2.25 * cs.overview;
    const pitch = cs.pitch * (1 - cs.overview) + 1.05 * cs.overview;
    // yön açısı en kısa yoldan ve sürekli harmanlanır (ani sıçrama ve masanın içinden geçen kamera yok)
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const overYaw = (this.seat === 1 ? Math.PI : 0) + Math.PI / 2;
    const goalYaw = cs.yaw + wrap(overYaw - cs.yaw) * cs.overview;
    cs.yawS += wrap(goalYaw - cs.yawS) * (1 - Math.exp(-dt / 0.1));
    const yaw = cs.yawS;
    const cam = this.camera;
    cam.position.set(cs.target.x + Math.sin(yaw) * Math.cos(pitch) * dist, cs.target.y + Math.sin(pitch) * dist, cs.target.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    cam.lookAt(cs.target);
    // genel bakışta kamera lambanın üstüne çıkar: lamba masayı örtmesin
    const lampVisible = cam.position.y < S + 0.95;
    for (const p of this.lampParts) p.visible = lampVisible;
    this.gov.frame(ms);
    this.renderer.render(this.scene, cam);
  }

  get stats() {
    return { fps: this.gov.fps, tier: TIERS[this.gov.tier].name, dpr: this.gov.dpr, calls: this.renderer.info.render.calls, tris: this.renderer.info.render.triangles };
  }

  dispose() {
    disposeScene(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
  }
}

function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
