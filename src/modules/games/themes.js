/** Görünüm ön ayarları (oyun içi tema, renkler). Saf veri: arayüz ve Görünüm paneli aynı kaynaktan okur. */

export const PLAYER_COLORS = {
  indigo: { lvl: 1, label: "İndigo", c: "#6366f1" },
  green: { lvl: 1, label: "Yeşil", c: "#23a559" },
  amber: { lvl: 2, label: "Turuncu", c: "#faa61a" },
  pink: { lvl: 4, label: "Pembe", c: "#ec4899" },
  cyan: { lvl: 5, label: "Turkuaz", c: "#22d3ee" },
  red: { lvl: 7, label: "Kırmızı", c: "#ef4444" },
};
/** Rakip rengi: benimkiyle çakışmayan sabit eşleme */
export const oppColor = (mine) => (mine === "pink" ? PLAYER_COLORS.cyan.c : mine === "cyan" ? PLAYER_COLORS.pink.c : mine === "amber" ? PLAYER_COLORS.cyan.c : PLAYER_COLORS.amber.c);

export const HOCKEY_TABLES = {
  ice: { lvl: 1, label: "Klasik", a: "#e9edf2", surface: "#f2f5f8", lines: ["#d11f2f", "#1f5fd1"], rail: "#15171a", cabinet: "laminate", led: true },
  midnight: { lvl: 1, label: "Gece", a: "#1b1d22", surface: "#1a1c21", lines: ["#ff4d6d", "#4dc3ff"], rail: "#0c0d0f", cabinet: "black", led: true },
  felt: { lvl: 3, label: "Turnuva", a: "#cfd8e3", surface: "#eef2f6", lines: ["#c81e1e", "#1e40af"], rail: "#b91c1c", cabinet: "black", led: false },
  clay: { lvl: 6, label: "Ceviz", a: "#7a5236", surface: "#f4f1ea", lines: ["#9f1239", "#1e3a8a"], rail: "#2b1a10", cabinet: "wood", led: false },
};
export const PUCK_COLORS = { black: { lvl: 1, label: "Siyah", c: "#16181c" }, white: { lvl: 1, label: "Beyaz", c: "#f8fafc" }, amber: { lvl: 3, label: "Sarı", c: "#fde047" }, red: { lvl: 8, label: "Kırmızı", c: "#f87171" } };

export const PONG_TABLES = {
  blue: { lvl: 1, label: "Turnuva mavisi", top: "#1f4e8c", edge: "#163a69" },
  green: { lvl: 1, label: "Klasik yeşil", top: "#1e6b46", edge: "#14513a" },
  black: { lvl: 4, label: "Siyah", top: "#1b1c20", edge: "#111216" },
  grey: { lvl: 2, label: "Gri", top: "#4b5563", edge: "#374151" },
};

export const OKEY_CLOTH = {
  green: { lvl: 1, label: "Yeşil", a: "#14532d", b: "#0b2b1b" },
  blue: { lvl: 2, label: "Mavi", a: "#1e3a5f", b: "#0e1e33" },
  burgundy: { lvl: 4, label: "Bordo", a: "#5b1a2a", b: "#2d0d15" },
  graphite: { lvl: 6, label: "Grafit", a: "#2b2d31", b: "#17181b" },
};
export const OKEY_TILES = {
  cream: { lvl: 1, label: "Krem", bg: "#f4ecd8", edge: "#b9ad8c", ink: ["#b07d00", "#2563eb", "#1f2937", "#dc2626"] },
  white: { lvl: 3, label: "Beyaz", bg: "#fafafa", edge: "#a1a1aa", ink: ["#a16207", "#1d4ed8", "#111827", "#b91c1c"] },
  dark: { lvl: 9, label: "Koyu", bg: "#2b2d31", edge: "#111214", ink: ["#facc15", "#60a5fa", "#e5e7eb", "#f87171"] },
};

/** Disk/top izi (seviyeyle açılır) */
export const TRAILS = {
  none: { lvl: 1, label: "Yok", c: "#3f3f46" },
  line: { lvl: 1, label: "Çizgi", c: "#a1a1aa" },
  spark: { lvl: 5, label: "Kıvılcım", c: "#faa61a" },
  comet: { lvl: 10, label: "Kuyruklu yıldız", c: "#6366f1" },
};

/** Seviye aralığında açılan kozmetikler (maç sonu ekranı) */
export function unlocksBetween(from, to) {
  const out = [];
  const groups = [
    ["Raket rengi", PLAYER_COLORS],
    ["Hockey masası", HOCKEY_TABLES],
    ["Disk rengi", PUCK_COLORS],
    ["Pong masası", PONG_TABLES],
    ["Okey örtüsü", OKEY_CLOTH],
    ["Okey taşı", OKEY_TILES],
    ["İz efekti", TRAILS],
  ];
  for (const [g, set] of groups) for (const o of Object.values(set)) if (o.lvl > from && o.lvl <= to) out.push(`${g}: ${o.label}`);
  return out;
}
