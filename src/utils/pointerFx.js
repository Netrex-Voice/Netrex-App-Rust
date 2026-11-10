// Ekran paylaşımı işaretçi efektleri: tıklama dalgaları ve çizimler.
//
// Çok hızlı değişen ve kısa ömürlü veri olduğu için zustand'a konmaz (her nokta tüm abonelerin
// yeniden hesaplanmasına yol açardı). Canvas katmanı kendi rAF döngüsünde bu depoyu okur.

export const RIPPLE_MS = 700;
export const STROKE_HOLD_MS = 4000;
export const STROKE_FADE_MS = 1000;

const MAX_CLICKS = 30;
const MAX_STROKES = 60;
const MAX_POINTS_PER_STROKE = 800;

const clicks = []; // { targetId, x, y, color, t }
const strokes = new Map(); // strokeId -> { pid, targetId, color, pts: [[x,y]], t }
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => {
    try { fn(); } catch (e) {}
  });
}

const clamp01 = (v) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : null;
};
const safeColor = (c) => (typeof c === "string" && /^#[0-9a-f]{3,8}$/i.test(c) ? c : "#6366f1");

// Tıklama dalgası rengi fare tuşuna göre belirlenir (kim tıkladığından bağımsız, hemen ayırt edilsin diye).
// İndeks = MouseEvent.button: 0 sol, 1 orta, 2 sağ
export const CLICK_BUTTON_COLORS = ["#3b82f6", "#22c55e", "#ef4444"]; // mavi, yeşil, kırmızı

export function addClick({ targetId, x, y, color, button }) {
  const nx = clamp01(x);
  const ny = clamp01(y);
  if (nx == null || ny == null) return;
  const b = Number(button);
  const rippleColor = b === 0 || b === 1 || b === 2 ? CLICK_BUTTON_COLORS[b] : safeColor(color);
  clicks.push({ targetId, x: nx, y: ny, color: rippleColor, t: Date.now() });
  if (clicks.length > MAX_CLICKS) clicks.shift();
  notify();
}

export function addStrokePoints({ strokeId, pid, targetId, color, points }) {
  if (!strokeId || !Array.isArray(points)) return;
  let s = strokes.get(strokeId);
  if (!s) {
    if (strokes.size >= MAX_STROKES) strokes.delete(strokes.keys().next().value);
    s = { pid, targetId, color: safeColor(color), pts: [], t: Date.now() };
    strokes.set(strokeId, s);
  }
  for (const p of points.slice(0, 60)) {
    const px = clamp01(p?.[0]);
    const py = clamp01(p?.[1]);
    if (px != null && py != null && s.pts.length < MAX_POINTS_PER_STROKE) s.pts.push([px, py]);
  }
  s.t = Date.now();
  notify();
}

export function clearStrokesOf(pid, targetId) {
  strokes.forEach((s, id) => {
    if (s.pid === pid && (!targetId || s.targetId === targetId)) strokes.delete(id);
  });
  notify();
}

/** Bir yayıncıya ait her şeyi temizle (yayın bitti / izin geri alındı) */
export function clearFxForTarget(targetId) {
  for (let i = clicks.length - 1; i >= 0; i--) if (clicks[i].targetId === targetId) clicks.splice(i, 1);
  strokes.forEach((s, id) => { if (s.targetId === targetId) strokes.delete(id); });
  notify();
}

export function clearAllFx() {
  clicks.length = 0;
  strokes.clear();
  notify();
}

/** Süresi dolanları ayıklar ve güncel durumu döndürür (çizim döngüsü çağırır) */
export function pruneAndGetFx(now = Date.now()) {
  for (let i = clicks.length - 1; i >= 0; i--) if (now - clicks[i].t > RIPPLE_MS) clicks.splice(i, 1);
  strokes.forEach((s, id) => { if (now - s.t > STROKE_HOLD_MS + STROKE_FADE_MS) strokes.delete(id); });
  return { clicks, strokes };
}

export function subscribeFx(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
