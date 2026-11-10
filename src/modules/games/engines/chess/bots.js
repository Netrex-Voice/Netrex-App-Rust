/**
 * Bot merdiveni. `rating` TAHMİNİDİR: seviyeler (derinlik/süre/hata payı) birbirine karşı ölçülerek sıralandı
 * (bkz. __tests__/chess.test.js) ama gerçek bir Elo havuzuyla kalibre edilmedi. Oyuncu puanı bu etiketlere göre hesaplanır.
 */
export const BOTS = [
  { id: "b250", name: "Çaylak Cemre", rating: 250, emoji: "🐣", blurb: "Taşların nasıl gittiğini yeni öğreniyor.", depth: 1, timeMs: 150, errorCp: 500, blunder: 0.4 },
  { id: "b400", name: "Meraklı Mert", rating: 400, emoji: "🐥", blurb: "Hamleleri çoğu zaman rastgele.", depth: 1, timeMs: 150, errorCp: 350, blunder: 0.25 },
  { id: "b550", name: "Köşe Kahvecisi", rating: 550, emoji: "☕", blurb: "Taş yer ama arkasını düşünmez.", depth: 1, timeMs: 200, errorCp: 250, blunder: 0.14 },
  { id: "b700", name: "Hafta Sonu Hakan", rating: 700, emoji: "🎲", blurb: "Tek hamlelik tehditleri görür.", depth: 2, timeMs: 250, errorCp: 200, blunder: 0.1 },
  { id: "b850", name: "Okul Şampiyonu", rating: 850, emoji: "🎒", blurb: "Temel taktikleri bilir, hata yapar.", depth: 2, timeMs: 300, errorCp: 140, blunder: 0.05 },
  { id: "b1000", name: "Kulüp Oyuncusu", rating: 1000, emoji: "♟️", blurb: "İki hamle ileri görür.", depth: 3, timeMs: 400, errorCp: 110, blunder: 0.03 },
  { id: "b1200", name: "Turnuva Tuğba", rating: 1200, emoji: "🏅", blurb: "Çatal ve açmazları görür.", depth: 3, timeMs: 500, errorCp: 70, blunder: 0.01 },
  { id: "b1400", name: "Usta Adayı Ufuk", rating: 1400, emoji: "🧠", blurb: "Sağlam, nadiren çuvallar.", depth: 4, timeMs: 700, errorCp: 45, blunder: 0 },
  { id: "b1600", name: "Bölge Şampiyonu", rating: 1600, emoji: "🥈", blurb: "Taktik ve oyun sonu bilgisi iyi.", depth: 5, timeMs: 900, errorCp: 25, blunder: 0 },
  { id: "b1800", name: "Uzman Ece", rating: 1800, emoji: "🥇", blurb: "Çok az hata yapar.", depth: 6, timeMs: 1200, errorCp: 0, blunder: 0 },
  { id: "b2000", name: "Aday Usta Alp", rating: 2000, emoji: "🎖️", blurb: "Derin hesaplar, sıkı savunur.", depth: 9, timeMs: 3200, errorCp: 0, blunder: 0 },
  { id: "b2200", name: "Usta Deniz", rating: 2200, emoji: "👑", blurb: "Neredeyse hatasız.", depth: 11, timeMs: 4800, errorCp: 0, blunder: 0 },
  { id: "b2400", name: "Büyük Usta Bora", rating: 2400, emoji: "🏆", blurb: "Elinden gelenin en iyisi.", depth: 14, timeMs: 7000, errorCp: 0, blunder: 0 },
];
export const getBot = (id) => BOTS.find((b) => b.id === id) || BOTS[3];

/** Oyuncuya en yakın (≤ puanı geçmeyen) rakip */
export const suggestedBot = (rating) => BOTS.reduce((best, b) => (Math.abs(b.rating - rating) < Math.abs(best.rating - rating) ? b : best), BOTS[0]);
