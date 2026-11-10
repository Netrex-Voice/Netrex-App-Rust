/**
 * 🎧 Uzamsal ses (spatial audio) — ortak matematik ve yerleşim
 *
 * Hem ses motoru (src/audio/spatialEngine.js) hem de yerleşim penceresi (SpatialCanvas) BURADAN okur;
 * böylece ekranda gördüğün yerleşim ile kulağına gelen ses her zaman aynıdır.
 *
 * Koordinat sistemi (canvas → ses):
 *   Canvas merkezi = DİNLEYİCİ (sen). Canvas'ın ÜSTÜ = senin ÖNÜN, altı = arkan, sol/sağ = sol/sağ.
 *   Ses uzayında dinleyici -Z yönüne bakar; yani canvas'ta yukarı gitmek (y azalması) = -Z (ön).
 */

export const CANVAS_WIDTH = 600;
export const CANVAS_HEIGHT = 600;

// 600px canvas → 10 birimlik oda (±5 birim)
const ROOM_SCALE = 60; // canvas_px / ROOM_SCALE = ses birimi

// Varsayılan çember: canvas'ın %30'u yarıçap (avatarlar çarpışmaz, hepsi canvas içinde kalır)
const DEFAULT_RING_RADIUS = Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.3;

export const CANVAS_CENTER = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };

/** Canvas pozisyonu → 3D ses koordinatı + normalize mesafe (0..1) */
export function canvasTo3D(x, y) {
  const dx = x - CANVAS_CENTER.x;
  const dy = y - CANVAS_CENTER.y;

  const audioX = dx / ROOM_SCALE; // sol(-) / sağ(+)
  const audioY = 0; // aynı yükseklik
  const audioZ = dy / ROOM_SCALE; // üst (dy<0) = ön (-Z), alt = arka (+Z)

  const distance = Math.sqrt(dx * dx + dy * dy);
  const maxDistance = Math.sqrt(Math.pow(CANVAS_WIDTH / 2, 2) + Math.pow(CANVAS_HEIGHT / 2, 2));
  const normalized = Math.min(distance / maxDistance, 1);

  return { audioX, audioY, audioZ, distance, normalized };
}

/** Normalize mesafe → ek ses kısma ve matlık (HRTF yön bilgisini zaten verir; bu yalnızca mesafe hissidir) */
export function distanceToAudio(normalized) {
  // 1.0 → 0.30: yumuşak eğri, uzaktaki biri tamamen sessize düşmez
  const spatialGain = Math.max(0.3, 1.0 - Math.pow(normalized, 1.5) * 0.7);

  // %60'ın altında filtre yok (20kHz); çok uzakta 12kHz'e kadar hafif sıcaklık
  const filterFrequency = normalized > 0.6 ? 12000 + ((1 - normalized) / 0.4) * 8000 : 20000;

  return { spatialGain, filterFrequency };
}

/** Arayüzdeki rozetler için yaklaşık değerler */
export function calculateAudioFromPosition(x, y) {
  const { normalized } = canvasTo3D(x, y);
  const { spatialGain, filterFrequency } = distanceToAudio(normalized);
  const rawPan = ((x - CANVAS_CENTER.x) / (CANVAS_WIDTH / 2)) * 1.3;
  const pan = Math.max(-1, Math.min(1, rawPan));
  return { pan, spatialGain, filterFrequency };
}

// ──────────────────────────────────────────────────
// YERLEŞİM
// ──────────────────────────────────────────────────

// Merkez, DİNLEYİCİNİN yeridir; başka biri orada olamaz. Eski sürüm herkesi merkeze KALICI kaydediyordu;
// bu kayıtlar "yerleştirilmemiş" sayılır ve varsayılan çember geçerli olur.
const CENTER_TOLERANCE = 8;
const isValidPos = (p) =>
  p &&
  Number.isFinite(p.x) &&
  Number.isFinite(p.y) &&
  Math.hypot(p.x - CANVAS_WIDTH / 2, p.y - CANVAS_HEIGHT / 2) > CENTER_TOLERANCE;

/**
 * Kaydedilmiş konumu olmayan kullanıcılar için varsayılan yerleşim: kimlik sırasına göre çember.
 * Böylece herkes dinleyicinin üstünde (merkezde) toplanmaz; uzamsal ses kutudan çıkar çıkmaz çalışır.
 * Aynı kimlik kümesi her zaman aynı yerleşimi verir (cihazlar/oturumlar arası tutarlı).
 */
export function defaultLayout(identities, localId) {
  const others = [...new Set(identities)].filter((id) => id !== localId).sort();
  const layout = {};
  const n = others.length;
  others.forEach((id, i) => {
    // İlk kişi tam önde (üstte), saat yönünde eşit aralıklı
    const angle = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2;
    layout[id] = {
      x: CANVAS_CENTER.x + Math.cos(angle) * DEFAULT_RING_RADIUS,
      y: CANVAS_CENTER.y + Math.sin(angle) * DEFAULT_RING_RADIUS,
    };
  });
  return layout;
}

/**
 * Bir kanaldaki geçerli yerleşim: kullanıcının kaydettiği konum varsa o, yoksa varsayılan çember.
 * Yerel kullanıcı HER ZAMAN merkezdedir (dinleyici bu noktadadır).
 *
 * @param {Object} saved   store.positions[channelId] — { [identity]: {x,y} } (yalnızca elle taşınanlar)
 * @param {string[]} identities  odadaki herkes
 * @param {string} localId
 */
export function resolveLayout(saved, identities, localId) {
  const defaults = defaultLayout(identities, localId);
  const layout = {};
  identities.forEach((id) => {
    if (id === localId) layout[id] = { ...CANVAS_CENTER };
    else layout[id] = isValidPos(saved?.[id]) ? { x: saved[id].x, y: saved[id].y } : defaults[id];
  });
  return layout;
}
