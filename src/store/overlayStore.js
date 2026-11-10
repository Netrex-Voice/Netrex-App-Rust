import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * 🎮 Overlay Store — Netrex Oyun İçi Overlay Ayarları
 * 
 * Kullanıcının overlay tercihlerini yönetir.
 * Local persist (localStorage) + Firebase sync (kapanışta).
 */
export const useOverlayStore = create(
  persist(
    (set, get) => ({
      // ============================================
      // GENEL AYARLAR
      // ============================================
      overlayEnabled: false,           // Ana toggle
      overlayWarningShown: false,      // İlk uyarı gösterildi mi?

      // Görünürlük Tetikleyicisi
      // "always" → Her zaman göster
      // "speaking" → Sadece birisi konuşunca göster
      // "active" → Sadece sesli kanalda aktifken göster
      visibilityMode: "always",

      // ============================================
      // GÖRÜNÜM AYARLARI
      // ============================================
      // Pozisyon: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "custom"
      position: "top-right",
      customPosition: { x: 0, y: 0 },   // Kullanıcı sürüklerse

      // Boyut: "small" | "medium" | "large"
      size: "medium",

      // Opaklık (0.2 → 1.0)
      opacity: 0.85,
      fullOpacityOnHover: true,          // Hover'da tam opak olma

      // Maksimum gösterilecek kullanıcı sayısı (1-10)
      maxVisibleUsers: 5,

      // ============================================
      // İÇERİK AYARLARI
      // ============================================
      showChannelName: true,
      showServerName: true,
      showSilentUsers: true,             // Konuşmayan kullanıcıları göster
      showConnectionQuality: false,      // Bağlantı kalitesi ikonu
      showSelf: true,                    // Kendi kartın
      showOnlySpeaking: false,           // Sadece konuşanı göster modu

      // ============================================
      // KONTROL AYARLARI
      // ============================================
      controlMute: true,                 // Overlay üzerinden mute/unmute
      controlDeafen: true,               // Overlay üzerinden deafen/undeafen
      controlLeave: true,                // Overlay üzerinden kanaldan ayrıl
      controlVolume: false,              // Overlay üzerinden ses seviyesi

      // ============================================
      // GÜVENLİK AYARLARI
      // ============================================
      antiCheatProtection: true,         // Anti-cheat koruması

      // ============================================
      // ACTIONS
      // ============================================
      setOverlayEnabled: (enabled) => set({ overlayEnabled: enabled }),
      setOverlayWarningShown: (shown) => set({ overlayWarningShown: shown }),
      setVisibilityMode: (mode) => set({ visibilityMode: mode }),

      // Görünüm
      setPosition: (pos) => set({ position: pos }),
      setCustomPosition: (pos) => set({ customPosition: pos, position: "custom" }),
      setSize: (size) => set({ size }),
      setOpacity: (opacity) => set({ opacity: Math.max(0.2, Math.min(1.0, opacity)) }),
      setFullOpacityOnHover: (val) => set({ fullOpacityOnHover: val }),
      setMaxVisibleUsers: (count) => set({ maxVisibleUsers: Math.max(1, Math.min(10, count)) }),

      // İçerik
      setShowChannelName: (val) => set({ showChannelName: val }),
      setShowServerName: (val) => set({ showServerName: val }),
      setShowSilentUsers: (val) => set({ showSilentUsers: val }),
      setShowConnectionQuality: (val) => set({ showConnectionQuality: val }),
      setShowSelf: (val) => set({ showSelf: val }),
      setShowOnlySpeaking: (val) => set({ showOnlySpeaking: val }),

      // Kontrol
      setControlMute: (val) => set({ controlMute: val }),
      setControlDeafen: (val) => set({ controlDeafen: val }),
      setControlLeave: (val) => set({ controlLeave: val }),
      setControlVolume: (val) => set({ controlVolume: val }),

      // Güvenlik
      setAntiCheatProtection: (val) => set({ antiCheatProtection: val }),

      // Firebase diff sync helper
      getSettingsSnapshot: () => {
        const state = get();
        return {
          enabled: state.overlayEnabled,
          position: state.position === "custom" ? state.customPosition : state.position,
          size: state.size,
          opacity: state.opacity,
          showOnlySpeaking: state.showOnlySpeaking,
          antiCheatProtection: state.antiCheatProtection,
          controls: {
            mute: state.controlMute,
            deafen: state.controlDeafen,
            leave: state.controlLeave,
            volume: state.controlVolume,
          },
        };
      },
    }),
    {
      name: "netrex-overlay-settings",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Transient state'leri persist etme
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(
            ([key]) => typeof state[key] !== "function"
          )
        ),
    }
  )
);
