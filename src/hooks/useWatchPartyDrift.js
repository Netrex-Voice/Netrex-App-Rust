// src/hooks/useWatchPartyDrift.js
import { useEffect, useRef } from 'react';
import { useWatchPartyStore } from '@/src/store/watchPartyStore';
import {
  DRIFT_THRESHOLD_SEC,
  DRIFT_CHECK_INTERVAL_MS,
} from '@/src/constants/watchPartyConstants';

export function useWatchPartyDrift(playerRef) {
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const { playbackState } = useWatchPartyStore.getState();

      // Oynatılmıyor ya da receivedAt yoksa kontrol etme
      if (!playbackState.isPlaying || !playbackState.receivedAt) return;
      if (!playerRef.current?.getCurrentTime) return;

      // Beklenen pozisyon: (şu an - verinin elimize ulaştığı an) + sinyaldeki konum
      const elapsedSinceSync = (Date.now() - playbackState.receivedAt) / 1000;
      const expectedSec = (playbackState.seekPosition || 0) + elapsedSinceSync;
      const actualSec   = playerRef.current.getCurrentTime();

      const drift = Math.abs(expectedSec - actualSec);

      if (drift > DRIFT_THRESHOLD_SEC) {
        console.log(`[WatchPartyDrift] ${drift.toFixed(1)}s kayma tespit edildi, düzeltiliyor...`);
        try {
          // YouTube için seekTo(seconds, true), diğerleri için seekTo(seconds, 'seconds')
          const seekFn = playerRef.current.seekTo;
          if (seekFn) seekFn.call(playerRef.current, expectedSec, 'seconds');
        } catch {}
      }
    }, DRIFT_CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [playerRef]);
}