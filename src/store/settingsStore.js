import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      // Ses Cihazları
      audioInputId: "default",
      audioOutputId: "default",
      // 💬 Kayan mesajlar (izleyiciden gelen kısa yazılar)
      tickerMessagesEnabled: true,
      tickerOpacity: 0.8,
      videoId: "default",

      // Global Voice State
      isMuted: false,
      isDeafened: false,
      
      // Global Modal State
      showSettingsModal: false,
      settingsScrollToSection: null, // "profileInfo" etc. - Settings modal açıldığında bu bölüme scroll edilir

      // YENİ: KAMERA İZNİ (Varsayılan Açık)
      enableCamera: true,

      // Watch Party
      watchPartyEnabled: false,
      gamesEnabled: true, // 🎮 Netrex Games — kapalıyken hiçbir şey yüklenmez ve düğme görünmez
      wpAutoMute: false, // Odaya katılınca veya Watch Party başlayınca otomatik mikrofonu kapat
      wpAutoJoin: true,  // Biri Watch Party açtığında otomatik olarak Player'ı (veya mini player'ı) göster
      wpDefaultVolume: 20, // Watch Party açıldığında varsayılan ses seviyesi (yüksek ses koruması)
      wpVideoQuality: "auto", // "auto" | "hd1080" | "hd720" | "large" (480p) | "medium" (360p) | "small" (240p)
      wpVideoMode: "player", // "player" | "mini" - Ana ekranda mı yoksa sağ altta küçük mü gösterilecek?

      // Ses İşleme
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
      // Veri Tasarrufu: bağlantı iyi olsa bile gönderilen veriyi (özellikle yayın/kamera) kısar
      dataSaver: false,
      // Konuşma gecikmesi: "normal" (tarayıcı varsayılanı) | "low" (varsayılan) | "ultra"
      latencyMode: "low",
      rawAudioMode: false,

      // Gelişmiş Ses İşleme (Krisp/Discord benzeri)
      // Ses İşleme Modu: "none" | "standard" | "krisp"
      noiseSuppressionMode: "krisp", // Discord benzeri mod seçimi - Varsayılan: Krisp (AI)
      advancedNoiseReduction: false, // Krisp modunda RNNoise kendi yapıyor
      adaptiveThreshold: false, // Krisp modunda gerekli değil
      noiseProfiling: false, // Krisp modunda gerekli değil
      spectralFiltering: false, // Krisp modunda gerekli değil
      windNoiseReduction: true, // Rüzgar gürültüsü azaltma
      noiseReductionLevel: 70, // 0-100 arası gürültü azaltma seviyesi
      aiNoiseSuppression: true, // AI tabanlı gürültü bastırma (RNNoise) - Krisp varsayılan açık

      // Seviyeler
      voiceThreshold: 5, // %5 varsayılan hassasiyet
      sfxVolume: 30, // %30 varsayılan uygulama sesleri
      profileColor: "#6366f1",
      autoThemeFromImage: false,
      useProfileColorForSpeaking: true, // Profil rengine göre border parlama efekti

      // Kullanıcı sesleri
      userVolumes: {},

      // Tray
      closeToTray: true,
      checkUpdatesOnStartup: true, // Açılışta güncelleme kontrolü

      // Bildirimler
      desktopNotifications: true,
      notificationSound: true,
      notifyOnMessage: true,
      notifyOnJoin: false,
      notifyOnLeave: false,
      notificationSoundType: "default", // "default" | "custom"
      ttsEnabled: false, // Text-to-Speech
      ttsVolume: 80, // TTS Volume (0-100)
      ttsVoiceURI: "auto", // Specific Voice Engine URI or 'auto' for dynamic distribution
      ttsOnlyUnfocused: true, // Sadece arka plandayken çalışsın (varsayılan: evet)
      micGuardEnabled: true, // "Sesiniz karşıya gitmiyor" uyarı sistemi (görsel bildirim)
      micGuardVoice: true, // Uyarıyı ayrıca sesli (TTS) söyle
      micGuardDelaySec: 15, // Mikrofon kapatıldıktan kaç saniye sonra (konuşursa) uyarılsın
      groupListenVolumes: {}, // Başka konuşma gruplarını dinleme seviyesi (0–100): { [groupId]: seviye }, yoksa 0 = duyulmaz
      whisperAutoReply: true, // Bana fısıldayana yanıtım otomatik olarak sadece ona gitsin (konuşma grupları)
      mutedTtsChannels: [], // Sesi kapatılan kanalların ID'leri
      mutedTtsUsers: [], // Sesi kapatılan kullanıcıların ID'leri

      // Görünüm
      uiScale: 100, // 75, 100, 125, 150
      fontSize: "medium", // "small" | "medium" | "large"
      fontFamily: "system", // Sistem fontları veya web fontları

      // Performans
      hardwareAcceleration: true, // Animasyonlar için GPU zorlama
      graphicsQuality: "low", // "high" | "low" | "potato" - Varsayılan: Düşük
      disableAnimations: false, // Animasyonları tamamen kapat
      disableBackgroundEffects: false, // Arka plan efektlerini kapat
      videoCodec: "vp8", // "vp8" | "h264" | "av1"

      // Kamera
      cameraMirrorEffect: true, // Ayna efekti
      videoResolution: "720p", // "240p" | "360p" | "480p" | "720p"
      videoFrameRate: 24, // 15 | 18 | 24

      // Kontrol Çubuğu Ayarları
      controlBarHidden: false, // Kontrol çubuğu gizli mi?

      // Hızlı Durum (Quick Status)
      quickStatus: null, // { icon: string, label: string } | null
      quickStatusPresets: [
        { id: "p1", icon: "🚽", label: "Lavabodayım!" },
        { id: "p2", icon: "⏰", label: "5dk'ya geliyorum!" },
        { id: "p3", icon: "🚨", label: "Baskındayım!" },
        { id: "p4", icon: "💬", label: "Durumum..." }
      ], // Hazır mesajlar (3 sabit + 1 özelleştirilebilir)
      lastQuickStatus: null, // Hotkey ile tetiklenecek son mesaj objesi

      // Online/Offline durumu
      userStatus: "online", // "online" | "idle" | "offline" | "invisible"
      isAutoIdle: false, // Otomatik idle modu mu (pencere arka planda veya inaktivite)?
      idleTimeout: 5 * 60 * 1000, // 5 dakika inaktivite sonrası idle (ms)
      
      // 🚀 v5.2: Ses odasında olma durumu (idle detection için kullanılır)
      isInVoiceRoom: false, // Kullanıcı bir ses odasında mı?
      
      // 🚀 v5.3: Local participant speaking durumu (useVoiceProcessor'dan gelir)
      // Bu sayede useAudioActivity hook'u local için gerekli değil - sıfır ek CPU maliyeti
      localIsSpeaking: false,

      // Actions
      setAudioInput: (deviceId) => set({ audioInputId: deviceId }),
      setAudioOutput: (deviceId) => set({ audioOutputId: deviceId }),
      setTickerMessagesEnabled: (v) => set({ tickerMessagesEnabled: !!v }),
      setTickerOpacity: (v) => set({ tickerOpacity: Math.max(0.3, Math.min(1, Number(v) || 0.8)) }),
      setVideoInput: (deviceId) => set({ videoId: deviceId }),

      // Quick Status Actions
      setQuickStatus: (status) => set({ quickStatus: status }),
      setLastQuickStatus: (status) => set({ lastQuickStatus: status }),
      addQuickStatusPreset: () => set((state) => {
        if (state.quickStatusPresets.length >= 6) return {}; // Max 6 limit
        return { 
            quickStatusPresets: [...state.quickStatusPresets, { id: Date.now().toString(), icon: "💬", label: "" }] 
        };
      }),
      updateQuickStatusPreset: (id, updates) => set((state) => ({
        quickStatusPresets: state.quickStatusPresets.map(p => p.id === id ? { ...p, ...updates } : p)
      })),
      removeQuickStatusPreset: (id) => set((state) => ({ 
        quickStatusPresets: state.quickStatusPresets.filter(p => p.id !== id) 
      })),
      toggleLastQuickStatus: () => set((state) => {
        // Eğer zaten bir quick status varsa, kapat. Yoksa son kullanılanı (veya varsayılanı) aç.
        if (state.quickStatus) {
            return { quickStatus: null };
        }
        // Son kullanılan yoksa ilk preseti al
        const target = state.lastQuickStatus || state.quickStatusPresets[0];
        return target ? { quickStatus: target, lastQuickStatus: target } : {};
      }),

      // ✅ Per-slot hotkey ile tetikleme - index'e göre doğrudan slot aç/kapa
      setQuickStatusByIndex: (index) => set((state) => {
        const preset = state.quickStatusPresets[index];
        if (!preset) return {};
        // Aynı preset zaten aktifse kapat (toggle davranışı)
        if (state.quickStatus?.id === preset.id) {
          return { quickStatus: null };
        }
        return { quickStatus: preset, lastQuickStatus: preset };
      }),

      setUseProfileColorForSpeaking: (val) => set({ useProfileColorForSpeaking: val }),

      // Voice State Toggles
      toggleMute: () => set((state) => {
        const nextMuted = !state.isMuted;
        const updates = { isMuted: nextMuted };
        if (!nextMuted && !state.isDeafened && state.quickStatus) {
          updates.quickStatus = null;
        }
        return updates;
      }),
      toggleDeaf: () => set((state) => {
        const nextDeafened = !state.isDeafened;
        const updates = { isDeafened: nextDeafened };
        // Deafen kapatılıyorsa ve Mute da kapalıysa durumu sıfırla
        if (!nextDeafened && !state.isMuted && state.quickStatus) {
          updates.quickStatus = null;
        }
        return updates;
      }),
      setSettingsOpen: (isOpen) => set({ showSettingsModal: isOpen }),
      setSettingsScrollToSection: (section) => set({ settingsScrollToSection: section }),
      // Settings modal'ı belirli bir bölüme scroll ederek aç
      openSettingsToSection: (section) => set({ showSettingsModal: true, settingsScrollToSection: section }),

      // YENİ: KAMERA İZNİ TOGGLE
      toggleEnableCamera: () =>
        set((state) => ({ enableCamera: !state.enableCamera })),
        
      toggleGamesEnabled: () =>
        set((state) => ({ gamesEnabled: !state.gamesEnabled })),
      toggleWatchPartyEnabled: () =>
        set((state) => ({ watchPartyEnabled: !state.watchPartyEnabled })),
      
      // YENİ: Watch Party Ayarları Actions
      setWpAutoMute: (val) => set({ wpAutoMute: val }),
      setWpAutoJoin: (val) => set({ wpAutoJoin: val }),
      setWpDefaultVolume: (vol) => set({ wpDefaultVolume: vol }),
      setWpVideoQuality: (quality) => set({ wpVideoQuality: quality }),
      setWpVideoMode: (mode) => set({ wpVideoMode: mode }),

      toggleNoiseSuppression: () =>
        set((state) => ({ noiseSuppression: !state.noiseSuppression })),
      toggleEchoCancellation: () =>
        set((state) => ({ echoCancellation: !state.echoCancellation })),
      toggleAutoGainControl: () =>
        set((state) => ({ autoGainControl: !state.autoGainControl })),
      toggleDataSaver: () => set((state) => ({ dataSaver: !state.dataSaver })),
      setLatencyMode: (mode) =>
        set({ latencyMode: ["normal", "low", "ultra"].includes(mode) ? mode : "low" }),
      toggleRawAudioMode: () =>
        set((state) => ({ rawAudioMode: !state.rawAudioMode })),

      // Gelişmiş Ses İşleme Toggle'ları
      toggleAdvancedNoiseReduction: () =>
        set((state) => ({
          advancedNoiseReduction: !state.advancedNoiseReduction,
        })),
      toggleAdaptiveThreshold: () =>
        set((state) => ({ adaptiveThreshold: !state.adaptiveThreshold })),
      toggleNoiseProfiling: () =>
        set((state) => ({ noiseProfiling: !state.noiseProfiling })),
      toggleSpectralFiltering: () =>
        set((state) => ({ spectralFiltering: !state.spectralFiltering })),
      toggleWindNoiseReduction: () =>
        set((state) => ({ windNoiseReduction: !state.windNoiseReduction })),
      toggleAiNoiseSuppression: () =>
        set((state) => ({ aiNoiseSuppression: !state.aiNoiseSuppression })),
      
      // Ses İşleme Modu Ayarlama (Discord benzeri)
      setNoiseSuppressionMode: (mode) => {
        set((state) => {
          const newState = { noiseSuppressionMode: mode };
          
          // Mode'a göre otomatik ayarları yap
          if (mode === "none") {
            // Hiçbir işleme yok
            newState.advancedNoiseReduction = false;
            newState.adaptiveThreshold = false;
            newState.noiseProfiling = false;
            newState.spectralFiltering = false;
            newState.aiNoiseSuppression = false;
          } else if (mode === "standard") {
            // Standart işleme (mevcut sistemimiz)
            newState.advancedNoiseReduction = true;
            newState.adaptiveThreshold = true;
            newState.noiseProfiling = true;
            newState.spectralFiltering = true;
            newState.aiNoiseSuppression = false;
          } else if (mode === "krisp") {
            // Krisp benzeri AI işleme (RNNoise)
            newState.advancedNoiseReduction = false; // RNNoise kendi işlemesini yapıyor
            newState.adaptiveThreshold = false;
            newState.noiseProfiling = false;
            newState.spectralFiltering = false;
            newState.aiNoiseSuppression = true; // RNNoise aktif
          }
          
          return newState;
        });
      },

      setNoiseReductionLevel: (level) =>
        set({ noiseReductionLevel: Math.max(0, Math.min(100, level)) }),

      setVoiceThreshold: (threshold) => set({ voiceThreshold: threshold }),
      setSfxVolume: (volume) => set({ sfxVolume: volume }),
      setProfileColor: (color) => set({ profileColor: color }),
      setAutoThemeFromImage: (enabled) => set({ autoThemeFromImage: enabled }),

      setUserVolume: (identity, volume) =>
        set((state) => ({
          userVolumes: { ...state.userVolumes, [identity]: volume },
        })),

      setCloseToTray: async (enabled) => {
        set({ closeToTray: enabled });
        if (window.netrex) {
          await window.netrex.setSetting("closeToTray", enabled);
        }
      },
      setCheckUpdatesOnStartup: async (enabled) => {
        set({ checkUpdatesOnStartup: enabled });
        if (window.netrex) {
          await window.netrex.setSetting("checkUpdatesOnStartup", enabled);
        }
      },

      // Bildirim ayarları
      setDesktopNotifications: (enabled) => set({ desktopNotifications: enabled }),
      setNotificationSound: (enabled) => set({ notificationSound: enabled }),
      setNotifyOnMessage: (enabled) => set({ notifyOnMessage: enabled }),
      setNotifyOnJoin: (enabled) => set({ notifyOnJoin: enabled }),
      setNotifyOnLeave: (enabled) => set({ notifyOnLeave: enabled }),
      setNotificationSoundType: (type) => set({ notificationSoundType: type }),
      setTtsEnabled: (enabled) => set({ ttsEnabled: enabled }),
      setTtsVolume: (volume) => set({ ttsVolume: Math.max(0, Math.min(100, volume)) }),
      setTtsVoiceURI: (uri) => set({ ttsVoiceURI: uri }),
      setTtsOnlyUnfocused: (enabled) => set({ ttsOnlyUnfocused: enabled }),
      setWhisperAutoReply: (enabled) => set({ whisperAutoReply: !!enabled }),
      setGroupListenVolume: (groupId, volume) =>
        set((state) => ({
          groupListenVolumes: {
            ...state.groupListenVolumes,
            [groupId]: Math.max(0, Math.min(100, Math.round(Number(volume) || 0))),
          },
        })),
      setMicGuardEnabled: (enabled) => set({ micGuardEnabled: enabled }),
      setMicGuardVoice: (enabled) => set({ micGuardVoice: enabled }),
      setMicGuardDelaySec: (sec) => set({ micGuardDelaySec: Math.max(0, Math.min(300, Math.round(Number(sec) || 0))) }),
      toggleMutedTtsChannel: (channelId) => set((state) => ({
        mutedTtsChannels: state.mutedTtsChannels.includes(channelId) 
          ? state.mutedTtsChannels.filter(id => id !== channelId) 
          : [...state.mutedTtsChannels, channelId]
      })),
      toggleMutedTtsUser: (userId) => set((state) => ({
        mutedTtsUsers: state.mutedTtsUsers.includes(userId) 
          ? state.mutedTtsUsers.filter(id => id !== userId) 
          : [...state.mutedTtsUsers, userId]
      })),

      setUIScale: (scale) => set({ uiScale: scale }),
      setFontSize: (size) => set({ fontSize: size }),
      setFontFamily: (font) => set({ fontFamily: font }),

      // Performans ayarları
      setHardwareAcceleration: (enabled) => set({ hardwareAcceleration: enabled }),
      
      // Grafik Kalitesi Presetleri
      setGraphicsQuality: (quality) => set((state) => {
        const newState = { graphicsQuality: quality };
        
        switch (quality) {
          case "ultra":  // ✅ YENİ MOD
            newState.disableAnimations = false;
            newState.disableBackgroundEffects = false;
            newState.hardwareAcceleration = true;
            break;
          case "high":
            newState.disableAnimations = false;
            newState.disableBackgroundEffects = false;
            newState.hardwareAcceleration = true;
            break;
          case "medium":  // ✅ YENİ MOD
            newState.disableAnimations = false;
            newState.disableBackgroundEffects = true;
            newState.hardwareAcceleration = true;
            break;
          case "low":
            newState.disableAnimations = false;  // ✅ Animasyon AÇIK
            newState.disableBackgroundEffects = true;
            newState.hardwareAcceleration = true;
            break;
          case "potato":
            newState.disableAnimations = true;
            newState.disableBackgroundEffects = true;
            newState.hardwareAcceleration = false;
            break;
        }
        return newState;
      }),
      
      toggleDisableAnimations: () => set((state) => ({ disableAnimations: !state.disableAnimations })),
      toggleDisableBackgroundEffects: () => set((state) => ({ disableBackgroundEffects: !state.disableBackgroundEffects })),
      setVideoCodec: (codec) => set({ videoCodec: codec }),

      // Kamera ayarları
      setCameraMirrorEffect: (enabled) => set({ cameraMirrorEffect: enabled }),
      setVideoResolution: (resolution) => set({ videoResolution: resolution }),
      setVideoFrameRate: (fps) => set({ videoFrameRate: fps }),

      // Kontrol Çubuğu Ayarları
      toggleControlBarHidden: () => set((state) => ({ controlBarHidden: !state.controlBarHidden })),

      // Online/Offline ayarları
      setUserStatus: (status) => set({ userStatus: status, isAutoIdle: false }), // Manuel statüs değişimi otomatik modu kapatır
      setIsAutoIdle: (isIdle) => set((state) => {
        // IDLE OLMA DURUMU:
        if (isIdle) {
            // Sadece 'online' isek otomatik idle olabiliriz. 
            // 'invisible' veya 'offline' isek dokunma.
            if (state.userStatus === 'online') {
                return { userStatus: 'idle', isAutoIdle: true };
            }
        } 
        // AKTİF OLMA DURUMU:
        else {
            // Sadece otomatik olarak idle olduysak geri 'online' yaparız.
            if (state.userStatus === 'idle' && state.isAutoIdle) {
                return { userStatus: 'online', isAutoIdle: false };
            }
        }
        return {};
      }),
      
      // 🚀 v5.2: Ses odasında olma durumunu ayarla
      setInVoiceRoom: (inRoom) => set({ isInVoiceRoom: inRoom }),
      
      // 🚀 v5.3: Local speaking durumunu ayarla (useVoiceProcessor tarafından çağrılır)
      setLocalIsSpeaking: (speaking) => set({ localIsSpeaking: speaking }),

      syncWithElectron: async () => {
        if (window.netrex) {
          const closeToTrayVal = await window.netrex.getSetting("closeToTray");
          if (closeToTrayVal !== undefined) {
            set({ closeToTray: closeToTrayVal });
          }
          const checkUpdatesVal = await window.netrex.getSetting("checkUpdatesOnStartup");
          if (checkUpdatesVal !== undefined) {
            set({ checkUpdatesOnStartup: checkUpdatesVal });
          }
        }
      },
    }),
    {
      name: "netrex-user-settings",
      version: 4,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => Object.fromEntries(
        Object.entries(state).filter(
          ([key]) => !['localIsSpeaking', 'isInVoiceRoom', 'showSettingsModal', 'isAutoIdle'].includes(key)
        )
      ),
      migrate: (persistedState, version) => {
        // v3: ses işlemcisi yeniden yazıldı; herkes noise gate'i %5 ile başlasın (sonra istediği değere çekebilir)
        if (version < 3) {
          persistedState = { ...persistedState, voiceThreshold: 5 };
        }
        // v4: masa oyunları artık varsayılan açık (arkadaşların ayrıca ayar açması gerekmesin)
        if (version === 0 || version === 1) {
          // Reset Quick Status to healthy defaults
          return {
            ...persistedState,
            quickStatus: null,
            quickStatusPresets: [
                { id: "p1", icon: "🚽", label: "Lavabodayım!" },
                { id: "p2", icon: "⏰", label: "5dk'ya geliyorum!" },
                { id: "p3", icon: "🚨", label: "Baskındayım!" },
                { id: "p4", icon: "💬", label: "Durumum..." }
            ],
            lastQuickStatus: null
          };
        }
        return persistedState;
      },
      onRehydrateStorage: () => (state) => {
        state?.syncWithElectron();
      },
    }
  )
);
