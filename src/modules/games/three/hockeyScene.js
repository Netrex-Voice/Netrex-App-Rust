/**
 * 🏒 Air Hockey 3B sahnesi (three.js). Fizik motoru dünya koordinatı: motor (x, y) → three (X = x, Z = y), Y yukarı.
 * Tüm modeller prosedürel ve yüksek detaylıdır (pahlı ekstrüzyon, 64 segment torna); dokular kalite kademesine göre
 * 1024–4096 px üretilir. Tek gölgeli spot ışık + ortam yansıması → düşük donanımda da 60 fps hedefi.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createRenderer, studioEnvironment, Governor, disposeScene, pickPlane, TIERS, arcadeStage } from "./kit";
import { woodTexture, brushedTexture, feltTexture, canvas, toTexture } from "./textures";
import { L, WD, CORNER, R_PUCK } from "../engines/airhockey";

const S = 0.8; // oyun yüzeyi yüksekliği (gerçek masa ~80 cm)
const RAIL_W = 0.075;
const RAIL_H = 0.05;
const PUCK_T = 0.0063;

function roundedRectPath(path, w, h, r, ccw = false) {
  const x0 = -w / 2;
  const y0 = -h / 2;
  if (!ccw) {
    path.moveTo(x0 + r, y0);
    path.lineTo(x0 + w - r, y0);
    path.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0, false);
    path.lineTo(x0 + w, y0 + h - r);
    path.absarc(x0 + w - r, y0 + h - r, r, 0, Math.PI / 2, false);
    path.lineTo(x0 + r, y0 + h);
    path.absarc(x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI, false);
    path.lineTo(x0, y0 + r);
    path.absarc(x0 + r, y0 + r, r, Math.PI, 1.5 * Math.PI, false);
  }
  return path;
}

/** Bir uzun kenar rayı (kale ağızlarında kesik). side: -1 (z<0) | +1 (z>0) */
function railPiece(goal, side) {
  const s = new THREE.Shape();
  const bev = 0.005; // pah payı: görünen iç yüz fizik duvarıyla (L/2, WD/2) tam çakışsın
  const ix = L / 2 + bev;
  const iz = WD / 2 + bev;
  const ox = L / 2 + RAIL_W - bev;
  const oz = WD / 2 + RAIL_W - bev;
  const ri = CORNER + bev;
  const ro = CORNER + RAIL_W - bev;
  const g = goal / 2 + bev;
  // shape düzlemi (u, v) = (x, |z|): iç sınırdan başlayıp dış sınırdan dönülür
  s.moveTo(-ix, g);
  s.lineTo(-ix, iz - ri);
  s.absarc(-ix + ri, iz - ri, ri, Math.PI, Math.PI / 2, true);
  s.lineTo(ix - ri, iz);
  s.absarc(ix - ri, iz - ri, ri, Math.PI / 2, 0, true);
  s.lineTo(ix, g);
  s.lineTo(ox, g);
  s.lineTo(ox, oz - ro);
  s.absarc(ox - ro, oz - ro, ro, 0, Math.PI / 2, false);
  s.lineTo(-ox + ro, oz);
  s.absarc(-ox + ro, oz - ro, ro, Math.PI / 2, Math.PI, false);
  s.lineTo(-ox, g);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: RAIL_H - 2 * 0.006, bevelEnabled: true, bevelThickness: 0.006, bevelSize: bev, bevelSegments: 6, curveSegments: 64 });
  geo.translate(0, 0, 0.006);
  // rotateX(-90°): (u, v, d) → (u, d, -v) → parça z<0 tarafında; z>0 için Y'de 180° (ayna yerine dönüş: yüzler bozulmaz)
  geo.rotateX(-Math.PI / 2);
  if (side > 0) geo.rotateY(Math.PI);
  geo.computeVertexNormals();
  return geo;
}

function lathe(points, segs = 64) {
  const g = new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segs);
  g.computeVertexNormals();
  return g;
}

/** Raket profili (taban → gövde → boyun → tutamak topuzu), gerçek oranlar */
function malletGeometry(r) {
  const p = [[0, 0]];
  p.push([r * 0.97, 0], [r, 0.002], [r, 0.008], [r * 0.98, 0.011]);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    p.push([r * (0.98 - 0.42 * Math.pow(t, 0.8)), 0.011 + 0.024 * t]);
  }
  p.push([r * 0.36, 0.04], [r * 0.33, 0.048]);
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2);
    p.push([r * 0.45 * Math.cos(a) + 0.0001, 0.052 + r * 0.45 * 0.9 * Math.sin(a)]);
  }
  return lathe(p, 72);
}

function puckGeometry() {
  const r = R_PUCK;
  const e = 0.0016;
  const p = [[0, 0], [r - e, 0]];
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * Math.PI;
    p.push([r - e + e * Math.cos(a), PUCK_T / 2 + (PUCK_T / 2) * Math.sin(a)]);
  }
  p.push([r - e, PUCK_T], [r * 0.62, PUCK_T], [r * 0.6, PUCK_T - 0.0009], [0, PUCK_T - 0.0009]);
  return lathe(p, 64);
}

/** Oyun yüzeyi dokusu: gerçek ölçekte hava delikleri (2,5 cm aralık) + baskı çizgileri */
function surfaceTexture(size, goal, theme, maxAniso) {
  const w = size;
  const h = size / 2;
  const c = canvas(w, h);
  const g = c.getContext("2d");
  const ppm = w / L; // piksel / metre
  g.fillStyle = theme.surface;
  g.fillRect(0, 0, w, h);
  const X = (x) => (x + L / 2) * ppm;
  const Y = (y) => (y + WD / 2) * ppm;
  // çizgiler
  g.lineCap = "round";
  g.strokeStyle = theme.lines[0];
  g.lineWidth = 0.012 * ppm;
  g.beginPath();
  g.moveTo(X(0), Y(-WD / 2));
  g.lineTo(X(0), Y(WD / 2));
  g.stroke();
  g.beginPath();
  g.arc(X(0), Y(0), 0.12 * ppm, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = theme.lines[1];
  for (const sx of [-1, 1]) {
    g.lineWidth = 0.01 * ppm;
    g.beginPath();
    g.arc(X(sx * L / 2), Y(0), (goal / 2 + 0.07) * ppm, sx < 0 ? -Math.PI / 2 : Math.PI / 2, sx < 0 ? Math.PI / 2 : Math.PI * 1.5);
    g.stroke();
    g.beginPath();
    g.moveTo(X(sx * 0.5), Y(-WD / 2));
    g.lineTo(X(sx * 0.5), Y(WD / 2));
    g.globalAlpha = 0.35;
    g.stroke();
    g.globalAlpha = 1;
  }
  // logo
  g.save();
  g.translate(X(0), Y(0));
  g.globalAlpha = 0.08;
  g.fillStyle = theme.lines[1];
  g.font = `800 ${0.05 * ppm}px system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("NETREX", 0, 0);
  g.restore();
  // hava delikleri (Ø 1,6 mm) — kenardan 2,5 cm içeride
  const hr = Math.max(0.75, 0.0008 * ppm);
  const dark = theme.surface === "#1a1c21" ? "rgba(255,255,255,0.18)" : "rgba(40,48,60,0.55)";
  g.fillStyle = dark;
  for (let x = -L / 2 + 0.025; x < L / 2 - 0.02; x += 0.025)
    for (let y = -WD / 2 + 0.025; y < WD / 2 - 0.02; y += 0.025) {
      g.beginPath();
      g.arc(X(x), Y(y), hr, 0, Math.PI * 2);
      g.fill();
    }
  const t = toTexture(c, { aniso: maxAniso });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** 7 segment LED skor paneli */
function drawLed(ctx, w, h, a, b, colA, colB) {
  ctx.fillStyle = "#050607";
  ctx.fillRect(0, 0, w, h);
  const seg = {
    0: "abcdef", 1: "bc", 2: "abdeg", 3: "abcdg", 4: "bcfg", 5: "acdfg", 6: "acdefg", 7: "abc", 8: "abcdefg", 9: "abcdfg",
  };
  const digit = (n, x, col) => {
    const dw = h * 0.42;
    const dh = h * 0.78;
    const th = h * 0.085;
    const y = (h - dh) / 2;
    const on = new Set(seg[n] || "");
    const bars = {
      a: [x + th, y, dw - 2 * th, th], d: [x + th, y + dh - th, dw - 2 * th, th], g: [x + th, y + dh / 2 - th / 2, dw - 2 * th, th],
      f: [x, y + th, th, dh / 2 - th], b: [x + dw - th, y + th, th, dh / 2 - th], e: [x, y + dh / 2, th, dh / 2 - th], c: [x + dw - th, y + dh / 2, th, dh / 2 - th],
    };
    for (const k of "abcdefg") {
      ctx.fillStyle = on.has(k) ? col : "rgba(255,255,255,0.05)";
      ctx.shadowColor = on.has(k) ? col : "transparent";
      ctx.shadowBlur = on.has(k) ? h * 0.08 : 0;
      ctx.fillRect(...bars[k]);
    }
    ctx.shadowBlur = 0;
  };
  const two = (n, x, col) => {
    const s = String(Math.min(99, n)).padStart(2, " ");
    if (s[0] !== " ") digit(Number(s[0]), x, col);
    digit(Number(s[1]), x + h * 0.5, col);
  };
  two(a, w * 0.06, colA);
  two(b, w * 0.56, colB);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(w / 2 - 2, h * 0.2, 4, h * 0.6);
}

export class HockeyScene {
  /**
   * @param canvas HTMLCanvasElement
   * @param o { seat, gfx: "auto"|0..3, colors:[c0,c1], theme, puckColor, goal, padR }
   */
  constructor(canvasEl, o) {
    this.canvas = canvasEl;
    this.seat = o.seat;
    const { renderer, start, auto, maxTex } = createRenderer(canvasEl, o.gfx);
    this.renderer = renderer;
    const tier = TIERS[start];
    const tex = Math.min(maxTex, tier.tex);
    const aniso = renderer.capabilities.getMaxAnisotropy();

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color("#101114");
    scene.fog = new THREE.Fog("#101114", 3.5, 9);
    studioEnvironment(renderer, scene, 0.04);
    scene.environmentIntensity = 0.6;

    // Işıklar: tavan lambası (gölgeli spot) + yumuşak dolgu
    const hemi = new THREE.HemisphereLight("#e6e9ff", "#6d4bd0", 0.8);
    scene.add(hemi);
    const key = new THREE.SpotLight("#fff6ea", 26, 6, Math.PI / 4.2, 0.55, 1.6);
    key.position.set(0.15, S + 2.2, 0.1);
    key.target.position.set(0, S, 0);
    key.castShadow = true;
    key.shadow.bias = -0.00015;
    key.shadow.radius = 3;
    key.shadow.normalBias = 0.01;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 4;
    scene.add(key, key.target);
    this.key = key;

    this.theme = o.theme;
    this.colors = o.colors;
    this.goal = o.goal;
    this.padR = o.padR;
    this.build(tex, aniso, o);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 30);
    this.placeCamera();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(S + 0.02));
    this.gov = new Governor({ renderer, tier: start, auto, lights: [key] });
    this.flash = 0;
    this.flashCol = new THREE.Color("#ffffff");
    this.resize();
  }

  build(tex, aniso, o) {
    const scene = this.scene;
    const th = this.theme;
    // Zemin
    const fl = feltTexture(Math.min(1024, tex), [30, 31, 36], 41);
    fl.map.repeat.set(10, 10);
    fl.normalMap.repeat.set(10, 10);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ map: fl.map, normalMap: fl.normalMap, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.95, metalness: 0 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.visible = false; // yerine arcade zemin
    scene.add(floor);
    arcadeStage(scene, { y: 0, rings: [1.7, 2.45], ringColor: "#7dd3fc" });

    // Oyun yüzeyi
    const surf = new THREE.Mesh(
      new THREE.PlaneGeometry(L, WD),
      new THREE.MeshPhysicalMaterial({ map: surfaceTexture(tex, this.goal, th, aniso), roughness: 0.22, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.12 })
    );
    surf.rotation.x = -Math.PI / 2;
    surf.position.y = S;
    surf.receiveShadow = true;
    scene.add(surf);

    // Raylar (iki C parça; ağızlarda kesik)
    // ABS plastik ray: koyu ve hafif parlak (yansıma ölçülü; gümüş gibi görünmesin)
    const railMat = new THREE.MeshPhysicalMaterial({ color: th.rail, roughness: 0.5, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.35, envMapIntensity: 0.2 });
    for (const side of [-1, 1]) {
      const r = new THREE.Mesh(railPiece(this.goal, side), railMat);
      r.position.y = S;
      r.castShadow = true;
      r.receiveShadow = true;
      scene.add(r);
    }

    // Gövde (kabin) + LED şerit
    const cabMat =
      th.cabinet === "wood"
        ? new THREE.MeshStandardMaterial({ ...woodTexture(Math.min(1024, tex), { base: [120, 78, 46], dark: [70, 42, 22], seed: 9 }), roughness: 0.45 })
        : th.cabinet === "black"
          ? new THREE.MeshPhysicalMaterial({ color: "#121316", roughness: 0.35, clearcoat: 0.6 })
          : new THREE.MeshPhysicalMaterial({ color: "#1e2533", roughness: 0.4, clearcoat: 0.5 });
    const cab = new THREE.Mesh(new RoundedBoxGeometry(L + 2 * RAIL_W + 0.02, 0.24, WD + 2 * RAIL_W + 0.02, 6, 0.025), cabMat);
    cab.position.y = S - 0.12 - 0.002;
    cab.castShadow = true;
    cab.receiveShadow = true;
    scene.add(cab);
    this.leds = [];
    if (th.led) {
      for (const side of [-1, 1])
        for (const half of [0, 1]) {
          const m = new THREE.MeshStandardMaterial({ color: "#000", emissive: this.colors[half], emissiveIntensity: 1.6 });
          const led = new THREE.Mesh(new THREE.BoxGeometry(L / 2 - 0.04, 0.012, 0.004), m);
          led.position.set((half === 0 ? -1 : 1) * (L / 4), S - 0.05, side * (WD / 2 + RAIL_W + 0.012));
          scene.add(led);
          this.leds.push(m);
        }
    }

    // Kale boğazları (disk düşen yuva) + disk iade tepsisi
    const dark = new THREE.MeshStandardMaterial({ color: "#060708", roughness: 0.9 });
    for (const sx of [-1, 1]) {
      const throat = new THREE.Mesh(new THREE.BoxGeometry(RAIL_W + 0.002, 0.05, this.goal), dark);
      throat.position.set(sx * (L / 2 + RAIL_W / 2), S - 0.026, 0);
      scene.add(throat);
      const tray = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.05, 0.22, 4, 0.012), cabMat);
      tray.position.set(sx * (L / 2 + RAIL_W + 0.05), S - 0.19, 0);
      tray.castShadow = true;
      scene.add(tray);
    }

    // Ayaklar (fırçalanmış metal)
    const legMat = new THREE.MeshStandardMaterial({ color: "#8d939c", metalness: 0.9, roughness: 0.35, ...brushedTexture(512, 3) });
    const legGeo = new RoundedBoxGeometry(0.09, S - 0.24, 0.09, 4, 0.01);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(sx * (L / 2 - 0.05), (S - 0.24) / 2, sz * (WD / 2 - 0.02));
        leg.castShadow = true;
        scene.add(leg);
      }
    const bar = new THREE.Mesh(new RoundedBoxGeometry(L - 0.1, 0.05, 0.05, 3, 0.008), legMat);
    bar.position.set(0, 0.18, 0);
    scene.add(bar);

    // Skor paneli (orta uzun kenarda, iki yüzlü LED)
    const lc = canvas(512, 160);
    this.ledCanvas = lc;
    this.ledTex = toTexture(lc, { aniso });
    this.ledTex.wrapS = this.ledTex.wrapT = THREE.ClampToEdgeWrapping;
    const panel = new THREE.Group();
    const box = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.16, 0.06, 4, 0.012), new THREE.MeshPhysicalMaterial({ color: "#0f1012", roughness: 0.3, clearcoat: 0.7 }));
    box.castShadow = true;
    panel.add(box);
    for (const sz of [-1, 1]) {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.12), new THREE.MeshBasicMaterial({ map: this.ledTex, toneMapped: false }));
      face.position.z = sz * 0.0305;
      if (sz < 0) face.rotation.y = Math.PI;
      panel.add(face);
    }
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 24), legMat);
    post.position.y = -0.15;
    panel.add(post);
    panel.position.set(0, S + 0.2, -(WD / 2 + RAIL_W + 0.04));
    scene.add(panel);
    this.setScore(0, 0);

    // Raketler ve disk
    this.mallets = [0, 1].map((i) => {
      const m = new THREE.Mesh(malletGeometry(this.padR), new THREE.MeshPhysicalMaterial({ color: this.colors[i], roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 }));
      m.castShadow = true;
      m.position.y = S;
      scene.add(m);
      return m;
    });
    this.puck = new THREE.Mesh(puckGeometry(), new THREE.MeshPhysicalMaterial({ color: o.puckColor, roughness: 0.3, clearcoat: 0.8 }));
    this.puck.castShadow = true;
    this.puck.position.y = S;
    scene.add(this.puck);
  }

  placeCamera() {
    const c = this.camera;
    if (this.seat === 0 || this.seat === 1) {
      // masanın ucundan ~60 cm geride, oyun yüzeyinin ~95 cm üstünde (ayakta oyuncu gözü)
      const sx = this.seat === 0 ? -1 : 1;
      c.position.set(sx * (L / 2 + 0.62), S + 0.95, 0);
      c.lookAt(-sx * 0.05, S - 0.06, 0);
    } else {
      c.position.set(0, S + 1.75, 1.55);
      c.lookAt(0, S, 0);
    }
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // dikey açı en az 56° (kendi kalen + rakip kalesi görünür); dar ekranda yakın uç genişliği (1,3 m) sığsın
    const nearDist = this.seat >= 0 ? 1.15 : 2.0;
    const hfovNeed = 2 * Math.atan(0.68 / nearDist);
    const vfovFromW = 2 * Math.atan(Math.tan(hfovNeed / 2) / aspect);
    this.camera.fov = Math.min(80, Math.max(56, (vfovFromW * 180) / Math.PI));
    this.camera.updateProjectionMatrix();
  }

  setScore(a, b) {
    drawLed(this.ledCanvas.getContext("2d"), this.ledCanvas.width, this.ledCanvas.height, a, b, this.colors[0], this.colors[1]);
    this.ledTex.needsUpdate = true;
  }

  goalFlash(seat) {
    this.flash = 1;
    this.flashCol.set(this.colors[seat] || "#ffffff");
  }

  /** İşaretçiden motor koordinatı (raket yüksekliğindeki düzlem) */
  pick(clientX, clientY) {
    const p = pickPlane(this.camera, this.canvas, clientX, clientY, this.plane);
    return p ? { x: p.x, y: p.z } : null;
  }

  /** r: { ball:[x,y], pads:[[x,y],[x,y]], spin } */
  update(r, dt, ms) {
    this.mallets.forEach((m, i) => m.position.set(r.pads[i][0], S, r.pads[i][1]));
    this.puck.position.set(r.ball[0], S, r.ball[1]);
    this.puck.rotation.y += (r.spin || 0) * dt;
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 1.4);
      const pulse = 1.6 + 6 * this.flash * (0.5 + 0.5 * Math.sin(this.flash * 40));
      this.leds.forEach((m) => (m.emissiveIntensity = pulse));
    }
    this.gov.frame(ms);
    this.renderer.render(this.scene, this.camera);
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
