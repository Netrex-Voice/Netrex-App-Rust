import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * 🖱️ Cursor Sharing Store
 * 
 * Ekran paylaşımı sırasında cursor pozisyonlarını yönetir.
 * - Yayıncı: Kendi mouse pozisyonunu broadcast eder
 * - İzleyici: Gelen cursor'ları ekranda gösterir
 */
export const useCursorShareStore = create(
  persist(
    (set, get) => ({
      // ──────────────────────────────────────
      // Settings (kalıcı)
      // ──────────────────────────────────────
      
      /** Yayıncı olarak cursor'umu paylaş */
      shareMyCursor: true,
      
      /** İzleyici olarak başkalarının cursor'ını göster */
      showRemoteCursors: true,
      
      /** Cursor opaklığı: 0.1 → 1.0 */
      cursorOpacity: 0.5,
      
      /** Cursor boyutu: 'sm' | 'md' | 'lg' */
      cursorSize: 'md',

      /** Cursor stili: 'default' | 'dot' | 'crosshair' */
      cursorStyle: 'default',

      /** Kullanıcı adını göster */
      showCursorLabel: true,

      // ──────────────────────────────────────
      // Runtime State (kalıcı değil)
      // ──────────────────────────────────────
      
      /**
       * Aktif remote cursor'lar
       * { [participantId]: { x, y, screenWidth, screenHeight, displayName, color, lastUpdate } }
       */
      remoteCursors: {},
      
      /** Ben şu an cursor broadcast ediyorum (yayıncıyım) */
      isBroadcasting: false,
      
      /** 
       * 🤝 Collaborative Pointing: Ekranımı paylaştığımda, başkalarının bana bir şeyi göstermesi için izinleri
       * { [participantId]: boolean } 
       */
      allowedPointers: {},
      
      /**
       * 🤝 My Permissions: Başkalarının ekranında işaretleme yapma izinlerim
       * { [sharerParticipantId]: boolean }
       */
      myPermissions: {},

      /**
       * 🤝 Pending Requests: Başkalarından istediğim işaretleme izni taleplerim (Viewer tarafı)
       * { [sharerParticipantId]: boolean }
       */
      pendingRequests: {},
      
      /** 
       * Bana gelen işaretleme talepleri (Sharer tarafı)
       * { [participantId]: { displayName, timestamp } }
       */
      pointingRequests: {},

      // ──────────────────────────────────────
      // Actions
      // ──────────────────────────────────────
      
      setShareMyCursor: (v) => set({ shareMyCursor: v }),
      setShowRemoteCursors: (v) => set({ showRemoteCursors: v }),
      setCursorOpacity: (v) => set({ cursorOpacity: Math.max(0.1, Math.min(1.0, v)) }),
      setCursorSize: (v) => set({ cursorSize: v }),
      setCursorStyle: (v) => set({ cursorStyle: v }),
      setShowCursorLabel: (v) => set({ showCursorLabel: v }),
      setIsBroadcasting: (v) => set({ isBroadcasting: v }),

      /**
       * Remote cursor pozisyonunu güncelle (gelen data'dan)
       */
      updateRemoteCursor: (participantId, data) => {
        set(state => ({
          remoteCursors: {
            ...state.remoteCursors,
            [participantId]: {
              ...data,
              lastUpdate: Date.now()
            }
          }
        }));
      },

      /**
       * Remote cursor kaldır (katılımcı ayrıldı veya paylaşımı kapattı)
       */
      removeRemoteCursor: (participantId) => {
        set(state => {
          const newCursors = { ...state.remoteCursors };
          delete newCursors[participantId];
          return { remoteCursors: newCursors };
        });
      },

      /**
       * Tüm remote cursor'ları temizle
       */
      clearRemoteCursors: () => set({ 
        remoteCursors: {}, 
        isBroadcasting: false, 
        allowedPointers: {}, 
        pointingRequests: {},
        myPermissions: {},
        pendingRequests: {}
      }),

      addPendingRequest: (sharerId) => {
        set(state => ({
          pendingRequests: {
            ...state.pendingRequests,
            [sharerId]: true
          }
        }));
      },

      removePendingRequest: (sharerId) => {
        set(state => {
          const reqs = { ...state.pendingRequests };
          delete reqs[sharerId];
          return { pendingRequests: reqs };
        });
      },

      // ──────────────────────────────────────
      // Collaborative Pointing Actions
      // ──────────────────────────────────────
      
      setMyPermission: (sharerId, value) => {
        set(state => ({
          myPermissions: {
            ...state.myPermissions,
            [sharerId]: value
          }
        }));
      },

      // ──────────────────────────────────────
      // Collaborative Pointing Actions
      // ──────────────────────────────────────
      
      addPointingRequest: (participantId, displayName) => {
        set(state => ({
          pointingRequests: {
            ...state.pointingRequests,
            [participantId]: { displayName, timestamp: Date.now() }
          }
        }));
      },

      removePointingRequest: (participantId) => {
        set(state => {
          const newRequests = { ...state.pointingRequests };
          delete newRequests[participantId];
          return { pointingRequests: newRequests };
        });
      },

      grantPointingPermission: (participantId, displayName) => {
        set(state => ({
          allowedPointers: {
            ...state.allowedPointers,
            [participantId]: { displayName, timestamp: Date.now() }
          },
          // Talebi kaldır
          pointingRequests: (() => {
            const reqs = { ...state.pointingRequests };
            delete reqs[participantId];
            return reqs;
          })()
        }));
      },

      revokePointingPermission: (participantId) => {
        set(state => {
          const newAllowed = { ...state.allowedPointers };
          delete newAllowed[participantId];
          return { allowedPointers: newAllowed };
        });
      },
    }),
    {
      name: 'netrex-cursor-share',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        shareMyCursor: state.shareMyCursor,
        showRemoteCursors: state.showRemoteCursors,
        cursorOpacity: state.cursorOpacity,
        cursorSize: state.cursorSize,
        cursorStyle: state.cursorStyle,
        showCursorLabel: state.showCursorLabel,
      })
    }
  )
);
