import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * 🎧 Spatial Audio Store
 * 
 * Spatial Audio sistemi için tüm ayarları ve pozisyonları yönetir.
 * LocalStorage'da kalıcı olarak saklanır.
 * Firebase sadece yedek olarak kullanılır (minimum yazma).
 * 
 * Veri hiyerarşisi:
 *   Local Storage → Primary (hızlı okuma, her zaman güncel)
 *   Firebase → Backup (uygulama kapanırken diff sync)
 */
export const useSpatialAudioStore = create(
  persist(
    (set, get) => ({
      // ──────────────────────────────────────
      // Core State
      // ──────────────────────────────────────
      
      /** Spatial mod açık/kapalı */
      enabled: false,
      
      /** Arayüz penceresi görünür/gizli */
      showWindow: false,
      
      /** Snap to grid aktif mi */
      snapToGrid: false,
      
      /** Snap grid aralığı (piksel) */
      gridSize: 20,

      // ──────────────────────────────────────
      // Pozisyonlar
      // Per-channel pozisyonlar: { channelId: { userId: { x, y } } }
      // ──────────────────────────────────────
      
      /** 
       * Kanal bazlı kullanıcı pozisyonları
       * { [channelId]: { [userId]: { x: number, y: number } } }
       */
      positions: {},

      // ──────────────────────────────────────
      // Custom Presets
      // ──────────────────────────────────────
      
      /**
       * Kullanıcının kaydettiği özel düzenler
       * { name: string, channelId: string, positions: { [userId]: { x, y } } }[]
       */
      customPresets: [],
      
      /** Maksimum custom preset sayısı */
      maxPresets: 10,

      // ──────────────────────────────────────
      // Firebase Sync Tracking
      // ──────────────────────────────────────
      
      /** Açılışta Firebase'den çekilen snapshot (diff için) */
      _firebaseSnapshot: null,
      
      /** Firebase sync gerekli mi? */
      _isDirty: false,

      // ──────────────────────────────────────
      // Actions
      // ──────────────────────────────────────

      /** Spatial modu aç/kapat */
      toggleEnabled: () => set(state => ({ enabled: !state.enabled, showWindow: !state.enabled })),
      
      /** Spatial modu doğrudan ayarla */
      setEnabled: (enabled) => set({ enabled }),

      /** Arayüz penceresini göster/gizle */
      setShowWindow: (showWindow) => set({ showWindow }),

      /** Snap to grid aç/kapat */
      toggleSnapToGrid: () => set(state => ({ snapToGrid: !state.snapToGrid })),

      /** Grid boyutunu ayarla */
      setGridSize: (size) => set({ gridSize: Math.max(10, Math.min(50, size)) }),

      /**
       * Bir kullanıcının pozisyonunu güncelle
       * Drag sırasında çağrılır — sadece local güncelleme, Firebase'e yazılmaz
       */
      setPosition: (channelId, userId, x, y) => {
        set(state => ({
          positions: {
            ...state.positions,
            [channelId]: {
              ...(state.positions[channelId] || {}),
              [userId]: { x, y }
            }
          },
          _isDirty: true
        }));
      },

      /**
       * Birden fazla kullanıcının pozisyonunu güncelle (preset uygulamada kullanılır)
       */
      setPositions: (channelId, positionsMap) => {
        set(state => ({
          positions: {
            ...state.positions,
            [channelId]: {
              ...(state.positions[channelId] || {}),
              ...positionsMap
            }
          },
          _isDirty: true
        }));
      },

      /**
       * Bir kanal için tüm pozisyonları al
       */
      getChannelPositions: (channelId) => {
        return get().positions[channelId] || {};
      },

      /**
       * Belirli bir kullanıcının pozisyonunu al
       */
      getPosition: (channelId, userId) => {
        return get().positions[channelId]?.[userId] || null;
      },

      /**
       * Bir kanal için pozisyonları sıfırla (herkes merkeze)
       */
      resetPositions: (channelId) => {
        set(state => {
          const newPositions = { ...state.positions };
          delete newPositions[channelId];
          return { positions: newPositions, _isDirty: true };
        });
      },

      // ──────────────────────────────────────
      // Preset Actions
      // ──────────────────────────────────────

      /**
       * Mevcut düzeni custom preset olarak kaydet
       */
      savePreset: (name, channelId) => {
        const state = get();
        const currentPositions = state.positions[channelId] || {};
        
        if (state.customPresets.length >= state.maxPresets) {
          console.warn('🎧 Maksimum preset sayısına ulaşıldı');
          return false;
        }

        set(state => ({
          customPresets: [
            ...state.customPresets,
            {
              id: `preset_${Date.now()}`,
              name,
              channelId,
              positions: { ...currentPositions },
              createdAt: Date.now()
            }
          ]
        }));
        return true;
      },

      /**
       * Custom preset'i uygula
       */
      applyPreset: (presetId, channelId) => {
        const state = get();
        const preset = state.customPresets.find(p => p.id === presetId);
        if (!preset) return;

        set(state => ({
          positions: {
            ...state.positions,
            [channelId]: { ...preset.positions }
          },
          _isDirty: true
        }));
      },

      /**
       * Custom preset sil
       */
      deletePreset: (presetId) => {
        set(state => ({
          customPresets: state.customPresets.filter(p => p.id !== presetId)
        }));
      },

      /**
       * Custom preset'i yeniden adlandır
       */
      renamePreset: (presetId, newName) => {
        set(state => ({
          customPresets: state.customPresets.map(p => 
            p.id === presetId ? { ...p, name: newName } : p
          )
        }));
      },

      // ──────────────────────────────────────
      // Firebase Sync Actions
      // ──────────────────────────────────────

      /** Firebase'den çekilen snapshot'ı sakla */
      setFirebaseSnapshot: (snapshot) => set({ _firebaseSnapshot: snapshot }),

      /** Dirty flag'ı sıfırla (sync tamamlandığında) */
      clearDirty: () => set({ _isDirty: false }),

      /**
       * Firebase'den pozisyonları yükle (ilk açılışta)
       * Sadece local'de yoksa çağrılır
       */
      loadFromFirebase: (channelId, firebasePositions) => {
        const state = get();
        // Local'de bu kanal için pozisyon varsa Firebase'e bakma
        if (state.positions[channelId] && Object.keys(state.positions[channelId]).length > 0) {
          return;
        }
        
        set(state => ({
          positions: {
            ...state.positions,
            [channelId]: firebasePositions
          },
          _firebaseSnapshot: firebasePositions,
          _isDirty: false
        }));
      },

      /**
       * Firebase'e yazılması gereken diff'i döndür
       * Açılıştaki snapshot ile mevcut state karşılaştırılır
       */
      getFirebaseDiff: (channelId) => {
        const state = get();
        const current = state.positions[channelId] || {};
        const snapshot = state._firebaseSnapshot || {};
        
        const diff = {};
        let hasDiff = false;

        // Değişen veya yeni eklenen pozisyonlar
        for (const [userId, pos] of Object.entries(current)) {
          if (!snapshot[userId] || 
              snapshot[userId].x !== pos.x || 
              snapshot[userId].y !== pos.y) {
            diff[userId] = pos;
            hasDiff = true;
          }
        }

        return hasDiff ? diff : null;
      }
    }),
    {
      name: 'netrex-spatial-audio',
      version: 2,
      // v2: eski sürümün herkesi merkeze kaydettiği kayıtları temizle (varsayılan çember geçerli olsun)
      migrate: (persisted, version) => {
        if (version < 2 && persisted?.positions) {
          const cleaned = {};
          Object.entries(persisted.positions).forEach(([channelId, map]) => {
            const kept = {};
            Object.entries(map || {}).forEach(([userId, p]) => {
              if (p && Math.hypot(p.x - 300, p.y - 300) > 8) kept[userId] = p;
            });
            if (Object.keys(kept).length > 0) cleaned[channelId] = kept;
          });
          persisted.positions = cleaned;
        }
        return persisted;
      },
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        enabled: state.enabled,
        showWindow: state.showWindow,
        snapToGrid: state.snapToGrid,
        gridSize: state.gridSize,
        positions: state.positions,
        customPresets: state.customPresets
      })
    }
  )
);
