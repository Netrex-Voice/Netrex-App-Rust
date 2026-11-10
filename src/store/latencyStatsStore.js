import { create } from "zustand";

// Ses gecikmesi ölçümleri (geçici, kalıcı değil). useLatencyOptimizer yazar, ConnectionStatusIndicator okur.
export const useLatencyStatsStore = create((set) => ({
  rttMs: null, // sunucuyla gidiş-dönüş süresi
  jitterBufferMs: null, // alıcı tamponunda ortalama bekleme
  concealPct: null, // takılma/boşluk doldurma oranı (%)
  targetMs: null, // uygulanan hedef tampon (null = tarayıcı varsayılanı)
  setStats: (stats) => set(stats),
  reset: () => set({ rttMs: null, jitterBufferMs: null, concealPct: null, targetMs: null }),
}));
