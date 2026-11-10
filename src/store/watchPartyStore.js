// src/store/watchPartyStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useWatchPartyStore = create(
  persist(
    (set, get) => ({

      // ══════════════════════════════════════
      // UZAK STATE
      // ══════════════════════════════════════
      isActive: false,
      hostId: null,
      coHosts: [],
      coHostPermissions: {},
      currentTrack: null,
      playbackState: {
        isPlaying: false,
        startedAt: null,
        seekPosition: 0,
        lastUpdated: null,
        receivedAt: null,
      },
      playlist: [],
      votes: {},

      // ══════════════════════════════════════
      // YEREL STATE
      // ══════════════════════════════════════
      localPreferences: {
        isListening: true,
        volume: 15,
        isMuted: false,
        videoMode: false,
        videoFullscreen: false,
        videoQuality: 'auto',
        showPlayer: true,
        showPlaylist: false,
      },

      // ══════════════════════════════════════
      // ✅ FIX: SHALLOW COMPARE ile setRemoteState
      //
      // Firebase listener her tetiklendiğinde yeni obje
      // oluşturuyordu → Zustand yeni referans görüyordu →
      // TÜM subscriber'lar re-render oluyordu →
      // debounce effect tekrar çalışıyordu →
      // stablePlaying flip-flop → AbortError
      //
      // Artık değerler GERÇEKTEN değişmediyse set() çağrılmaz.
      // ══════════════════════════════════════
      setRemoteState: (data) => {
        const current = get();
        const now = Date.now();

        const newIsActive     = data.isActive ?? false;
        const newHostId       = data.hostId ?? null;
        const newCoHosts      = data.coHosts ?? [];
        const newCurrentTrack = data.currentTrack ?? null;
        const newPlaylist     = data.playlist ?? [];
        const newVotes        = data.votes ?? {};
        const newCoHostPerms  = data.coHostPermissions ?? {};

        const newPB = data.playbackState ?? current.playbackState;
        const newIsPlaying    = newPB.isPlaying ?? false;

        // ─── Track değişti mi? ───
        const trackChanged =
          current.currentTrack?.id  !== newCurrentTrack?.id ||
          current.currentTrack?.url !== newCurrentTrack?.url;

        // ─── Playback state isPlaying veya startedAt veya seekPosition veya lastUpdated değişti mi? ───
        const isPlayingChanged    = current.playbackState.isPlaying !== newIsPlaying;
        const startedAtChanged    = current.playbackState.startedAt !== newPB.startedAt;
        const seekPositionChanged = current.playbackState.seekPosition !== (newPB.seekPosition ?? 0);
        const lastUpdatedChanged  = current.playbackState.lastUpdated !== (newPB.lastUpdated ?? null);
        
        let effectivePlaybackState = current.playbackState;
        let pbChanged = false;
        
        // Eğer herhangibir playback alanı değiştiyse, 'receivedAt' olarak 'şu anı' işaretle
        if (isPlayingChanged || startedAtChanged || trackChanged || seekPositionChanged || lastUpdatedChanged) {
          effectivePlaybackState = {
            isPlaying: newIsPlaying,
            startedAt: newPB.startedAt ?? null,
            seekPosition: newPB.seekPosition ?? 0,
            lastUpdated: newPB.lastUpdated ?? null,
            receivedAt: now,
          };
          pbChanged = true;
        }

        // ─── Playlist değişti mi? (length + son eleman id) ───
        const playlistChanged =
          current.playlist.length !== newPlaylist.length ||
          current.playlist[current.playlist.length - 1]?.id !==
            newPlaylist[newPlaylist.length - 1]?.id;

        // ─── Diğerleri ───
        const otherChanged =
          current.isActive !== newIsActive ||
          current.hostId   !== newHostId ||
          current.coHosts.length !== newCoHosts.length;

        // ─── Co-Host izinleri değişti mi? (shallow compare) ───
        const currentCoHostKeys = Object.keys(current.coHostPermissions || {});
        const newCoHostKeys = Object.keys(newCoHostPerms || {});
        let coHostPermsChanged = currentCoHostKeys.length !== newCoHostKeys.length;
        if (!coHostPermsChanged) {
           for (const key of currentCoHostKeys) {
             if (current.coHostPermissions[key]?.canManageTracks !== newCoHostPerms[key]?.canManageTracks ||
                 current.coHostPermissions[key]?.canControlPlayback !== newCoHostPerms[key]?.canControlPlayback) {
               coHostPermsChanged = true;
               break;
             }
           }
        }

        // ─── Votes değişti mi? (deep counts) ───
        const currentVoteKeys = Object.keys(current.votes || {});
        const newVoteKeys = Object.keys(newVotes || {});
        let votesChanged = currentVoteKeys.length !== newVoteKeys.length;
        if (!votesChanged) {
           for (const tId of currentVoteKeys) {
             const userKeys1 = Object.keys(current.votes[tId] || {});
             const userKeys2 = Object.keys(newVotes[tId] || {});
             if (userKeys1.length !== userKeys2.length) {
                votesChanged = true; break;
             }
             for (const uId of userKeys1) {
                if (current.votes[tId][uId] !== newVotes[tId][uId]) {
                   votesChanged = true; break;
                }
             }
             if (votesChanged) break;
           }
        }

        // Hiçbir şey değişmediyse → SET ÇAĞIRMA → re-render YOK
        if (!pbChanged && !trackChanged && !playlistChanged &&
            !otherChanged && !votesChanged && !coHostPermsChanged) {
          return;
        }

        set({
           isActive: newIsActive,
           hostId: newHostId,
           coHosts: newCoHosts,
           currentTrack: trackChanged ? newCurrentTrack : current.currentTrack,
           playbackState: effectivePlaybackState,
           playlist: playlistChanged ? newPlaylist : current.playlist,
           votes: votesChanged ? newVotes : current.votes,
           coHostPermissions: coHostPermsChanged ? newCoHostPerms : current.coHostPermissions,
        });
      },

      setPlaybackState: (patch) => set((s) => {
        const newPB = { ...s.playbackState, ...patch, receivedAt: Date.now() };
        // Değişim yoksa skip
        if (
          s.playbackState.isPlaying    === newPB.isPlaying &&
          s.playbackState.startedAt    === newPB.startedAt &&
          s.playbackState.seekPosition === newPB.seekPosition
        ) {
          return s; // Değişiklik yok
        }
        return { playbackState: newPB };
      }),

      setCurrentTrack: (track) => set((s) => {
        if (s.currentTrack?.id === track?.id &&
            s.currentTrack?.url === track?.url) {
          return s;
        }
        return { currentTrack: track };
      }),

      setPlaylist:     (list)  => set({ playlist: list }),
      setVotes:        (votes) => set({ votes }),
      setCoHosts:      (arr)   => set({ coHosts: arr }),

      // ══════════════════════════════════════
      // YEREL TERCİH YAZICILARI
      // ══════════════════════════════════════
      setLocalPref: (key, value) => set((s) => ({
        localPreferences: { ...s.localPreferences, [key]: value },
      })),

      toggleListening: () => set((s) => ({
        localPreferences: {
          ...s.localPreferences,
          isListening: !s.localPreferences.isListening,
        },
      })),

      toggleMute: () => set((s) => ({
        localPreferences: {
          ...s.localPreferences,
          isMuted: !s.localPreferences.isMuted,
        },
      })),

      toggleVideoMode: () => set((s) => ({
        localPreferences: {
          ...s.localPreferences,
          videoMode: !s.localPreferences.videoMode,
        },
      })),

      toggleFullscreen: () => set((s) => ({
        localPreferences: {
          ...s.localPreferences,
          videoFullscreen: !s.localPreferences.videoFullscreen,
        },
      })),

      togglePlayer: () => set((s) => ({
        localPreferences: {
          ...s.localPreferences,
          showPlayer: !s.localPreferences.showPlayer,
        },
      })),

      togglePlaylist: () => set((s) => ({
        localPreferences: {
          ...s.localPreferences,
          showPlaylist: !s.localPreferences.showPlaylist,
        },
      })),

      // ══════════════════════════════════════
      // HESAPLANAN DEĞERLER
      // ══════════════════════════════════════
      getEffectiveVolume: () => {
        const { localPreferences } = get();
        if (!localPreferences.isListening) return 0;
        if (localPreferences.isMuted) return 0;
        return (localPreferences.volume / 100) * 0.5;
      },

      getTrackVoteScore: (trackId) => {
        const trackVotes = get().votes[trackId];
        if (!trackVotes) return 0;
        return Object.values(trackVotes).reduce((sum, v) => sum + v, 0);
      },

      getUserVote: (trackId, userId) => {
        return get().votes[trackId]?.[userId] ?? 0;
      },

      getSortedPlaylist: () => {
        const { playlist, votes } = get();
        return [...playlist].sort((a, b) => {
          const scoreA = Object.values(votes[a.id] || {}).reduce((s, v) => s + v, 0);
          const scoreB = Object.values(votes[b.id] || {}).reduce((s, v) => s + v, 0);
          if (scoreA !== scoreB) {
            return scoreB - scoreA;
          }
          // Oylar eşitse, listeye eklenme sırasına (orijinal index) göre ilk gelene öncelik ver
          const idxA = playlist.findIndex(t => t.id === a.id);
          const idxB = playlist.findIndex(t => t.id === b.id);
          return idxA - idxB;
        });
      },

      // ══════════════════════════════════════
      // SIFIRLAMA
      // ══════════════════════════════════════
      resetWatchParty: () => set({
        isActive: false,
        hostId: null,
        coHosts: [],
        coHostPermissions: {},
        currentTrack: null,
        playbackState: {
          isPlaying: false,
          startedAt: null,
          seekPosition: 0,
          lastUpdated: null,
        },
        playlist: [],
        votes: {},
      }),
    }),
    {
      name: 'netrex-watchparty-local',
      partialize: (state) => ({
        localPreferences: state.localPreferences,
      }),
    }
  )
);