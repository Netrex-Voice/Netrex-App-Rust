// src/hooks/useWatchPartySync.js
import { useCallback, useRef } from 'react';
import { useWatchPartyStore } from '@/src/store/watchPartyStore';
import {
  setCurrentTrackInDb,
  updatePlaybackInDb,
  clearCurrentTrackInDb,
} from '@/src/services/watchPartyService';
import { WP_MSG } from '@/src/constants/watchPartyConstants';
import { DataPacket_Kind } from 'livekit-client';

// DataChannel üzerinden anlık mesaj gönder (Firebase'e ek olarak)
function sendRoomMessage(room, type, payload) {
  if (!room) return;
  try {
    const msg = JSON.stringify({ type, payload, ts: Date.now() });
    const encoded = new TextEncoder().encode(msg);
    room.localParticipant?.publishData(encoded, {
      kind: DataPacket_Kind.RELIABLE,
    });
  } catch (e) {
    console.warn('[WatchPartySync] DataChannel send failed:', e);
  }
}

export function useWatchPartySync(room, playerRef, serverId, channelId) {

  // ─── Host: Oynat ───
  const hostPlay = useCallback(async (track, fromPosition = 0) => {
    if (!track) return;
    const now = Date.now();
    // startedAt = şu an - pozisyon (saniye → ms)
    // Böylece herkes (Date.now() - startedAt) / 1000 ile pozisyonu bulur
    const startedAt = now - Math.floor(fromPosition * 1000);

    const playbackState = {
      isPlaying: true,
      startedAt,
      seekPosition: fromPosition,
      lastUpdated: now,
    };

    // Firebase'e yaz (geç gelen kullanıcılar için kalıcı)
    await updatePlaybackInDb(serverId, channelId, playbackState);

    // DataChannel ile anlık bildir (düşük gecikme)
    sendRoomMessage(room, WP_MSG.PLAY, { startedAt, fromPosition });
  }, [room, serverId, channelId]);

  // ─── Host: Duraklat ───
  const hostPause = useCallback(async () => {
    const currentPos = playerRef.current?.getCurrentTime?.() || 0;
    const now = Date.now();

    const playbackState = {
      isPlaying: false,
      startedAt: null,
      seekPosition: currentPos,
      lastUpdated: now,
    };

    await updatePlaybackInDb(serverId, channelId, playbackState);
    sendRoomMessage(room, WP_MSG.PAUSE, { seekPosition: currentPos });
  }, [room, serverId, channelId, playerRef]);

  // ─── Host: Seek ───
  const hostSeek = useCallback(async (seconds) => {
    const { playbackState } = useWatchPartyStore.getState();
    const now = Date.now();

    let newState;
    if (playbackState.isPlaying) {
      const startedAt = now - Math.floor(seconds * 1000);
      newState = {
        isPlaying: true,
        startedAt,
        seekPosition: seconds,
        lastUpdated: now,
      };
    } else {
      newState = {
        isPlaying: false,
        startedAt: null,
        seekPosition: seconds,
        lastUpdated: now,
      };
    }

    await updatePlaybackInDb(serverId, channelId, newState);
    sendRoomMessage(room, WP_MSG.SEEK, { seconds, isPlaying: playbackState.isPlaying });

    // Local seek (anında)
    try { playerRef.current?.seekTo?.(seconds, 'seconds'); } catch {}
  }, [room, serverId, channelId, playerRef]);

  // ─── Host: Parça atla ───
  const hostSkip = useCallback(async (track) => {
    if (!track) return;
    await setCurrentTrackInDb(serverId, channelId, track);
    sendRoomMessage(room, WP_MSG.SKIP, { track });
  }, [room, serverId, channelId]);

  // ─── Auto advance ───
  const autoAdvance = useCallback(async () => {
    const state = useWatchPartyStore.getState();
    const sorted = state.getSortedPlaylist();
    const currentTrack = state.currentTrack;

    // Aktif track'i listeden çıkar
    if (currentTrack) {
        import('@/src/services/watchPartyService').then(({ removeTrackFromPlaylist }) => {
            removeTrackFromPlaylist(serverId, channelId, currentTrack);
        });
    }

    // Sıradaki parçayı bul (mevcut parça buysa atla)
    const next = sorted.find(t => t.id !== currentTrack?.id);

    if (next) {
      await setCurrentTrackInDb(serverId, channelId, next);
      sendRoomMessage(room, WP_MSG.SKIP, { track: next });
    } else {
      await clearCurrentTrackInDb(serverId, channelId);
    }
  }, [room, serverId, channelId]);

  return { hostPlay, hostPause, hostSeek, hostSkip, autoAdvance };
}