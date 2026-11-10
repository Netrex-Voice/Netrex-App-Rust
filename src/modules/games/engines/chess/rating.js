/**
 * Elo puanı: oyuncunun rakip bot puanına karşı beklenen skoru ile gerçek sonuç arasındaki fark.
 * K katsayısı FIDE benzeri: ilk 30 oyunda 40 (hızlı yakınsama), sonra 20, 2400 üstünde 10. Alt sınır 100.
 */
export const START_RATINGS = { beginner: 400, intermediate: 800, advanced: 1200, expert: 1600 };
export const MIN_RATING = 100;
export const PROVISIONAL_GAMES = 30;

export const expectedScore = (mine, theirs) => 1 / (1 + Math.pow(10, (theirs - mine) / 400));

export function kFactor(rating, games) {
  if (games < PROVISIONAL_GAMES) return 40;
  return rating >= 2400 ? 10 : 20;
}

/** @param score 1 galibiyet, 0.5 beraberlik, 0 mağlubiyet → { delta, next } */
export function eloChange(mine, theirs, score, games) {
  const k = kFactor(mine, games);
  const raw = k * (score - expectedScore(mine, theirs));
  const next = Math.max(MIN_RATING, Math.round(mine + raw));
  return { delta: next - mine, next, k, expected: expectedScore(mine, theirs) };
}

/** Süre kontrolü kategorisi (dakika + artış sn → tahmini süre = dk*60 + inc*40) */
export function categoryOf(minutes, inc) {
  const est = minutes * 60 + inc * 40;
  return est < 180 ? "bullet" : est < 600 ? "blitz" : "rapid";
}
export const CATEGORY_LABEL = { bullet: "Bullet", blitz: "Blitz", rapid: "Rapid" };

/** Puana göre ünvan (görsel; chess.com'daki "lig" mantığı) */
export function leagueOf(r) {
  if (r < 400) return { name: "Çaylak", color: "#94a3b8" };
  if (r < 800) return { name: "Acemi", color: "#a3a3a3" };
  if (r < 1200) return { name: "Orta", color: "#22c55e" };
  if (r < 1600) return { name: "İleri", color: "#3b82f6" };
  if (r < 2000) return { name: "Uzman", color: "#a855f7" };
  if (r < 2400) return { name: "Usta", color: "#f59e0b" };
  return { name: "Büyük Usta", color: "#ef4444" };
}
