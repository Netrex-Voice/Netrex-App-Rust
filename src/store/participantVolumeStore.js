import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 🔊 Participant Volume Store
 * 
 * Her participant için ayrı ses seviyesi kontrolü.
 * LocalStorage'da kalıcı olarak saklanır.
 * 
 * Kullanım:
 * const { setVolume, getVolume } = useParticipantVolumeStore();
 * setVolume('user123', 0.75); // %75
 */
export const useParticipantVolumeStore = create(
  persist(
    (set, get) => ({
      // { participantIdentity: volume (0.0 - 1.0) }
      volumes: {},
      
      /**
       * Bir participant'ın ses seviyesini ayarla
       * @param {string} participantIdentity - Participant identity
       * @param {number} volume - Ses seviyesi (0.0 - 1.0)
       */
      setVolume: (participantIdentity, volume) => {
        if (!participantIdentity) return;
        
        // Clamp to 0.0 - 2.0 range
        const clampedVolume = Math.max(0, Math.min(2.0, volume));
        
        set(state => ({
          volumes: {
            ...state.volumes,
            [participantIdentity]: clampedVolume
          }
        }));
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔊 Volume set for ${participantIdentity}: ${Math.round(clampedVolume * 100)}%`);
        }
      },
      
      /**
       * Bir participant'ın ses seviyesini al
       * @param {string} participantIdentity - Participant identity
       * @returns {number} Ses seviyesi (0.0 - 1.0), default 1.0
       */
      getVolume: (participantIdentity) => {
        if (!participantIdentity) return 1.0;
        return get().volumes[participantIdentity] ?? 1.0; // Default 100%
      },
      
      /**
       * Bir participant'ın ses ayarını sıfırla (default'a döndür)
       * @param {string} participantIdentity - Participant identity
       */
      resetVolume: (participantIdentity) => {
        if (!participantIdentity) return;
        
        set(state => {
          const newVolumes = { ...state.volumes };
          delete newVolumes[participantIdentity];
          return { volumes: newVolumes };
        });
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔊 Volume reset for ${participantIdentity}`);
        }
      },
      
      /**
       * Tüm ses ayarlarını sıfırla
       */
      resetAll: () => {
        set({ volumes: {} });
        
        if (process.env.NODE_ENV === 'development') {
          console.log('🔊 All volumes reset');
        }
      }
    }),
    {
      name: 'netrex-participant-volumes', // LocalStorage key
      partialize: (state) => ({ volumes: state.volumes })
    }
  )
);
