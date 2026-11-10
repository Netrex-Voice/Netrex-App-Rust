import { create } from 'zustand';

/**
 * ✅ OPTIMIZED SoundManagerStore v2.0
 * - AudioContext leak fix
 * - Source node cleanup
 * - Retry logic
 * - Volume clamping
 */
const lastPlayedTimes = {};

export const useSoundManagerStore = create((set, get) => ({
  audioContext: null,
  cachedBuffers: {},
  isLoaded: false,
  _isInitializing: false,
  _pendingQueue: [],

  init: async () => {
    const state = get();
    if (state.isLoaded || state.audioContext || state._isInitializing) return;
    
    set({ _isInitializing: true, _pendingQueue: [] });
    
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const sounds = ['mute', 'unmute', 'deafen', 'undeafen', 'join', 'left', 'someone-left', 'message', 'friend-notificaiton', 'discord-ping'];
      const cache = {};

      const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
      const baseUrl = isFileProtocol ? '.' : '';

      const fetchWithRetry = async (url, retries = 2) => {
        for (let i = 0; i <= retries; i++) {
          try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.arrayBuffer();
          } catch (err) {
            if (i === retries) throw err;
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      };

      const loadPromises = sounds.map(async (name) => {
        try {
          const arrayBuffer = await fetchWithRetry(`${baseUrl}/sounds/${name}.mp3`);
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          cache[name] = audioBuffer;
        } catch (err) {
          console.warn(`🔊 Ses yüklenemedi: ${name}`, err);
        }
      });

      await Promise.all(loadPromises);
      
      const loadedCount = Object.keys(cache).length;
      if (loadedCount > 0) {
        set({ audioContext: ctx, cachedBuffers: cache, isLoaded: true, _isInitializing: false });
        console.log(`✅ ${loadedCount}/${sounds.length} sistem sesi RAM'e yüklendi`);
        
        // ✅ Init tamamlandıktan sonra bekleyen sesleri çal (Aynı anda aynı ses birden fazla kez binişmesini engelle)
        const pending = get()._pendingQueue;
        if (pending.length > 0) {
          set({ _pendingQueue: [] });
          const uniquePending = pending.filter((item, index, self) => 
            index === self.findIndex((t) => t.name === item.name)
          );
          uniquePending.forEach(({ name, volume }) => get().play(name, volume));
        }
      } else {
        throw new Error('No sounds loaded');
      }
    } catch (e) {
      console.error("❌ SoundManager başlatılamadı:", e);
      set({ _isInitializing: false, _pendingQueue: [] });
    }
  },

  play: (name, volume = 0.5) => {
    const safeVolume = Math.max(0, Math.min(1, volume));
    const { audioContext, cachedBuffers, _isInitializing, isLoaded, _pendingQueue } = get();
    
    // ✅ FIX: "İlk girişte mükerrer çalma"
    // HTML5 <audio> (fallback) ile WebAudio API (AudioContext) çakışmasını engellemek için
    // fallback'i sildik. Artık eğer RAM'e yüklenmemişse KESİNLİKLE kuyruğa alır ve init'i zorlar.
    // Init bitince deduplicate ederek çalar.
    if (!isLoaded) {
      set({ _pendingQueue: [..._pendingQueue, { name, volume: safeVolume }] });
      if (!_isInitializing) {
        get().init();
      }
      return;
    }

    const now = Date.now();
    // ✅ FIX: "Cızırtı" - 250ms içinde aynı sesin mükemmel saniye sekansında çağrılmasını engelle
    if (lastPlayedTimes[name] && now - lastPlayedTimes[name] < 250) {
      return; 
    }
    lastPlayedTimes[name] = now;
    
    if (!audioContext || !cachedBuffers[name]) {
      console.warn(`Ses bulunamadı: ${name}`);
      return;
    }

    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const source = audioContext.createBufferSource();
    source.buffer = cachedBuffers[name];
    
    const gainNode = audioContext.createGain();
    gainNode.gain.value = safeVolume;
    
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    source.onended = () => {
      source.disconnect();
      gainNode.disconnect();
    };
    
    source.start(0);
  },
  
  cleanup: () => {
    const { audioContext } = get();
    if (audioContext) {
      audioContext.close();
      set({ audioContext: null, cachedBuffers: {}, isLoaded: false });
    }
  }
}));
