/**
 * 🏓 Masa tenisi 3B sahnesi. Motor koordinatı doğrudan three koordinatıdır (X yan, Y yukarı, Z masa boyu).
 * Salon: spor zemini + çevre panelleri; masa: ITTF ölçülü, mat mavi yüzey, beyaz çizgiler (yüksek çözünürlük dokusu),
 * alt şasi; file: ağ dokusu + bant + direkler; raketler: lastik yüzler + ahşap kenar + sap; top: baskılı (dönüş görünür).
 * Işık: tepeden arena spotu (topun masadaki gölgesi derinlik ipucu) + yumuşak dolgu + ortam yansıması.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createRenderer, studioEnvironment, Governor, disposeScene, TIERS, arcadeStage } from "./kit";
import { woodTexture, feltTexture, canvas, toTexture } from "./textures";
import { TABLE_Y, HALF_W, HALF_L, NET_H, NET_HALF, R_BALL } from "../engines/pingpong";

const TOP_T = 0.025;

function tableTopTexture(size, colors, aniso) {
  const w = size;
  const h = Math.round((size * (2 * HALF_W)) / (2 * HALF_L));
  const c = canvas(w, h);
  const g = c.getContext("2d");
  const ppm = w / (2 * HALF_L);
  g.fillStyle = colors.top;
  g.fillRect(0, 0, w, h);
  // ince mat doku (çok hafif)
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 6;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = "#f4f6f8";
  const edge = 0.02 * ppm;
  g.fillRect(0, 0, w, edge);
  g.fillRect(0, h - edge, w, edge);
  g.fillRect(0, 0, edge, h);
  g.fillRect(w - edge, 0, edge, h);
  g.fillRect(0, h / 2 - 0.0015 * ppm, w, 0.003 * ppm); // orta çizgi (çiftler)
  const t = toTexture(c, { aniso });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function netTexture(aniso) {
  const c = canvas(1024, 96);
  const g = c.getContext("2d");
  g.clearRect(0, 0, 1024, 96);
  g.strokeStyle = "rgba(20,24,34,0.92)";
  g.lineWidth = 1.4;
  for (let x = 0; x <= 1024; x += 9) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 96);
    g.stroke();
  }
  for (let y = 0; y <= 96; y += 9) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(1024, y);
    g.stroke();
  }
  const t = toTexture(c, { aniso });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function ballTexture() {
  const c = canvas(512, 256);
  const g = c.getContext("2d");
  g.fillStyle = "#f7f3ea";
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = "rgba(255,120,30,0.9)";
  g.font = "700 40px system-ui, sans-serif";
  g.textAlign = "center";
  g.fillText("★★★", 128, 140);
  g.fillStyle = "rgba(40,40,40,0.55)";
  g.font = "600 26px system-ui, sans-serif";
  g.fillText("NETREX 40+", 384, 138);
  g.fillStyle = "rgba(0,0,0,0.08)";
  g.fillRect(0, 126, 512, 3); // dikiş
  return toTexture(c, { aniso: 4 });
}

/** Raket: elips blade + iki lastik yüz + kenar + sap. Yüz normali +Z (local), sap −Y. */
function makePaddle(rubberFront, woodMat, rubberBack = "#16171a") {
  const grp = new THREE.Group();
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, 0.075, 0.079, 0, Math.PI * 2, false, 0);
  const bladeGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.001, bevelSegments: 3, curveSegments: 64 });
  bladeGeo.translate(0, 0.079 + 0.015, -0.003);
  const blade = new THREE.Mesh(bladeGeo, woodMat);
  grp.add(blade);
  const rubGeo = new THREE.ShapeGeometry(shape, 64);
  rubGeo.translate(0, 0.079 + 0.015, 0);
  const front = new THREE.Mesh(rubGeo, new THREE.MeshStandardMaterial({ color: rubberFront, roughness: 0.78 }));
  front.position.z = 0.0043;
  const back = new THREE.Mesh(rubGeo, new THREE.MeshStandardMaterial({ color: rubberBack, roughness: 0.8 }));
  back.position.z = -0.0043;
  back.rotation.y = Math.PI;
  grp.add(front, back);
  // sap: hafif genişleyen torna profili
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector2(0.0125 + 0.004 * Math.sin(t * Math.PI) + 0.002 * t, -0.1 * t));
  }
  pts.push(new THREE.Vector2(0.0001, -0.1));
  const handle = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), woodMat);
  handle.scale.set(1, 1, 0.75);
  handle.position.y = 0.02;
  grp.add(handle);
  grp.traverse((o) => (o.castShadow = !!o.isMesh));
  return grp;
}

function drawBoard(ctx, w, h, a, b, cA, cB) {
  ctx.fillStyle = "#0b0c0e";
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${h * 0.66}px system-ui, sans-serif`;
  ctx.fillStyle = cA;
  ctx.fillText(String(a), w * 0.25, h * 0.54);
  ctx.fillStyle = cB;
  ctx.fillText(String(b), w * 0.75, h * 0.54);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(w / 2 - 2, h * 0.15, 4, h * 0.7);
}

export class PongScene {
  /** o: { seat, gfx, colors:[c0,c1], tableColor, netColor } */
  constructor(canvasEl, o) {
    this.canvas = canvasEl;
    this.seat = o.seat;
    this.colors = o.colors;
    const { renderer, start, auto, maxTex } = createRenderer(canvasEl, o.gfx);
    this.renderer = renderer;
    const tex = Math.min(maxTex, TIERS[start].tex);
    const aniso = renderer.capabilities.getMaxAnisotropy();
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color("#0d0f14");
    scene.fog = new THREE.Fog("#0d0f14", 7, 16);
    studioEnvironment(renderer, scene, 0.035);
    scene.environmentIntensity = 0.4; // salon: yansıma ölçülü, masa koyu mavi kalsın

    scene.add(new THREE.HemisphereLight("#e6ecff", "#6d4bd0", 0.75));
    const key = new THREE.SpotLight("#fffaf0", 26, 9, Math.PI / 5, 0.55, 1.4);
    key.position.set(0.0, 4.4, 0.2);
    key.target.position.set(0, TABLE_Y, 0);
    key.castShadow = true;
    key.shadow.bias = -0.0002;
    key.shadow.normalBias = 0.01;
    key.shadow.radius = 2.5;
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 6;
    scene.add(key, key.target);
    const fill = new THREE.DirectionalLight("#cfd8ff", 0.35);
    fill.position.set(-3, 3, -2);
    scene.add(fill);

    // Zemin: spor salonu kauçuk zemin
    const fl = feltTexture(Math.min(1024, tex), [58, 26, 30], 33);
    fl.map.repeat.set(8, 8);
    fl.normalMap.repeat.set(8, 8);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshStandardMaterial({ map: fl.map, normalMap: fl.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.visible = false;
    scene.add(floor);
    arcadeStage(scene, { y: 0, rings: [2.5, 3.4], ringColor: "#fbbf24", sky: ["#12214d", "#2f55c7", "#ff9d6e"], grid: "#7aa2ff" });
    // Çevre panelleri (ITTF bariyer)
    const panelMat = new THREE.MeshStandardMaterial({ color: "#3b4fd0", roughness: 0.5, emissive: "#1d2a8c", emissiveIntensity: 0.4 });
    const panelGeo = new RoundedBoxGeometry(2, 0.72, 0.04, 3, 0.01);
    for (const [x, z, ry] of [[-3, -6, 0], [-1, -6, 0], [1, -6, 0], [3, -6, 0], [-3, 6, 0], [-1, 6, 0], [1, 6, 0], [3, 6, 0], [-4, -4, Math.PI / 2], [-4, -2, Math.PI / 2], [-4, 0, Math.PI / 2], [-4, 2, Math.PI / 2], [-4, 4, Math.PI / 2], [4, -4, Math.PI / 2], [4, -2, Math.PI / 2], [4, 0, Math.PI / 2], [4, 2, Math.PI / 2], [4, 4, Math.PI / 2]]) {
      const p = new THREE.Mesh(panelGeo, panelMat);
      p.position.set(x, 0.36, z);
      p.rotation.y = ry;
      scene.add(p);
    }

    // Masa üstü
    const topMat = new THREE.MeshStandardMaterial({ map: tableTopTexture(tex, { top: o.tableColor }, aniso), roughness: 0.7, metalness: 0, envMapIntensity: 0.5 });
    const sideMat = new THREE.MeshStandardMaterial({ color: o.tableColor, roughness: 0.6 });
    const topGeo = new RoundedBoxGeometry(2 * HALF_W, TOP_T, 2 * HALF_L, 3, 0.004);
    // üst yüz dokulu: RoundedBox malzeme grupları yok → iki katman: kenarlar tek renk, üst ince dokulu düzlem
    const body = new THREE.Mesh(topGeo, sideMat);
    body.position.y = TABLE_Y - TOP_T / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    scene.add(body);
    const topGeo2 = new THREE.PlaneGeometry(2 * HALF_L, 2 * HALF_W); // doku: u = masa boyu
    topGeo2.rotateX(-Math.PI / 2);
    topGeo2.rotateY(Math.PI / 2); // boy Z ekseni boyunca
    const top = new THREE.Mesh(topGeo2, topMat);
    top.position.y = TABLE_Y + 0.0004;
    top.receiveShadow = true;
    scene.add(top);
    // alt şasi
    const steel = new THREE.MeshStandardMaterial({ color: "#2b2e35", metalness: 0.7, roughness: 0.4 });
    const apron = new RoundedBoxGeometry(2 * HALF_W - 0.1, 0.06, 0.04, 2, 0.008);
    for (const z of [-HALF_L + 0.08, -0.1, 0.1, HALF_L - 0.08]) {
      const a = new THREE.Mesh(apron, steel);
      a.position.set(0, TABLE_Y - TOP_T - 0.03, z);
      scene.add(a);
    }
    const legGeo = new THREE.CylinderGeometry(0.022, 0.022, TABLE_Y - TOP_T - 0.06, 24);
    for (const x of [-HALF_W + 0.12, HALF_W - 0.12])
      for (const z of [-HALF_L + 0.25, -0.35, 0.35, HALF_L - 0.25]) {
        const l = new THREE.Mesh(legGeo, steel);
        l.position.set(x, (TABLE_Y - TOP_T - 0.06) / 2, z);
        l.castShadow = true;
        scene.add(l);
      }

    // File + direkler + bant
    const netMat = new THREE.MeshStandardMaterial({ map: netTexture(aniso), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.9 });
    const net = new THREE.Mesh(new THREE.PlaneGeometry(2 * NET_HALF, NET_H), netMat);
    net.position.set(0, TABLE_Y + NET_H / 2, 0);
    scene.add(net);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(2 * NET_HALF, 0.015, 0.004), new THREE.MeshStandardMaterial({ color: "#f4f6f8", roughness: 0.7 }));
    tape.position.set(0, TABLE_Y + NET_H - 0.0075, 0);
    tape.castShadow = true;
    scene.add(tape);
    for (const x of [-NET_HALF, NET_HALF]) {
      const post = new THREE.Mesh(new RoundedBoxGeometry(0.018, NET_H + 0.02, 0.03, 2, 0.004), steel);
      post.position.set(x, TABLE_Y + NET_H / 2 - 0.01, 0);
      post.castShadow = true;
      scene.add(post);
      const clamp = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.03, 0.05, 2, 0.006), steel);
      clamp.position.set(x - Math.sign(x) * 0.12, TABLE_Y - 0.005, 0);
      scene.add(clamp);
    }

    // Skor tabelası (hakem masası)
    const lc = canvas(512, 200);
    this.board = lc;
    this.boardTex = toTexture(lc, { aniso });
    this.boardTex.wrapS = this.boardTex.wrapT = THREE.ClampToEdgeWrapping;
    const bd = new THREE.Group();
    const bodyB = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.22, 0.08, 3, 0.012), new THREE.MeshStandardMaterial({ color: "#111216", roughness: 0.5 }));
    bd.add(bodyB);
    for (const sx of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.18), new THREE.MeshBasicMaterial({ map: this.boardTex, toneMapped: false }));
      f.position.z = sx * 0.041;
      if (sx < 0) f.rotation.y = Math.PI;
      bd.add(f);
    }
    bd.position.set(HALF_W + 2.1, 0.86, 0);
    bd.rotation.y = Math.PI / 2;
    scene.add(bd);
    const stand = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.74, 0.7, 3, 0.02), new THREE.MeshStandardMaterial({ color: "#1b2a4a", roughness: 0.6 }));
    stand.position.set(HALF_W + 2.1, 0.37, 0);
    scene.add(stand);

    // Raketler + top
    const wood = new THREE.MeshStandardMaterial({ ...woodTexture(Math.min(512, tex), { base: [196, 154, 108], dark: [150, 108, 70], seed: 4, rings: 30 }), roughness: 0.55 });
    this.paddles = [0, 1].map((i) => {
      const p = makePaddle(this.colors[i], wood, this.colors[i]);
      if (i === this.seat) {
        // kendi raketim kameraya yakın: yarı saydam, topu ve masayı kapatmasın
        p.traverse((o) => {
          if (!o.isMesh) return;
          o.material = o.material.clone();
          o.material.transparent = true;
          o.material.opacity = 0.5;
          o.material.depthWrite = false;
          o.castShadow = false;
        });
      }
      scene.add(p);
      return p;
    });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(R_BALL, 48, 32), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.42 }));
    this.ball.castShadow = true;
    scene.add(this.ball);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 40);
    this.placeCamera();
    this.gov = new Governor({ renderer, tier: start, auto, lights: [key] });
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this.setScore(0, 0);
    this.resize();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
  }

  placeCamera() {
    const c = this.camera;
    if (this.seat === 0 || this.seat === 1) {
      const sz = this.seat === 0 ? -1 : 1;
      c.position.set(0, TABLE_Y + 0.85, sz * (HALF_L + 1.75));
      c.lookAt(0, TABLE_Y - 0.05, -sz * 0.45);
    } else {
      c.position.set(3.4, TABLE_Y + 1.4, 0.4);
      c.lookAt(0, TABLE_Y, 0);
    }
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // masanın genişliği (≈1,9 m oyun alanı) dar ekranda da sığsın
    const dist = 2.2;
    const hfovNeed = 2 * Math.atan(1.25 / dist);
    const vfovFromW = 2 * Math.atan(Math.tan(hfovNeed / 2) / aspect);
    this.camera.fov = Math.min(80, Math.max(48, (vfovFromW * 180) / Math.PI));
    this.camera.updateProjectionMatrix();
  }

  setScore(a, b) {
    drawBoard(this.board.getContext("2d"), this.board.width, this.board.height, a, b, this.colors[0], this.colors[1]);
    this.boardTex.needsUpdate = true;
  }

  /** İşaretçi → raket düzlemi (z = raketin anlık derinliği) */
  pick(clientX, clientY, padZ) {
    const r = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(v, this.camera);
    this.plane.constant = -padZ;
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(this.plane, hit) ? { x: hit.x, y: hit.y } : null;
  }

  /** r: { ball:[x,y,z], pads:[[x,y,z],..], padVel:[[vx,vy],..], spin:[wx,wy,wz] } */
  update(r, dt, ms) {
    for (let i = 0; i < 2; i++) {
      const p = this.paddles[i];
      const [x, y, z] = r.pads[i];
      p.position.set(x, y - 0.094, z); // blade merkezi = temas noktası
      const toward = i === 0 ? 1 : -1; // yüz rakibe
      const [vx, vy] = r.padVel[i];
      // açı: yukarı vuruşta yüz kapanır (topspin), aşağı vuruşta açılır (kesme); yana vuruşta döner
      this._e.set(-toward * Math.max(-0.7, Math.min(0.7, vy * 0.12)) + 0.15 * toward, (i === 0 ? 0 : Math.PI) + Math.max(-0.6, Math.min(0.6, -vx * 0.08)), Math.max(-0.5, Math.min(0.5, x * 0.35)) * toward);
      this._q.setFromEuler(this._e);
      p.quaternion.slerp(this._q, 1 - Math.exp(-dt / 0.04));
    }
    const [bx, by, bz] = r.ball;
    this.ball.position.set(bx, by, bz);
    if (r.spin) {
      const [wx, wy, wz] = r.spin;
      const w = Math.hypot(wx, wy, wz);
      if (w > 0.1) this.ball.rotateOnWorldAxis(new THREE.Vector3(wx / w, wy / w, wz / w), w * dt);
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
