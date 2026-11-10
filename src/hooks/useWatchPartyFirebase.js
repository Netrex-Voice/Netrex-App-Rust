// src/hooks/useWatchPartyFirebase.js
import { useEffect, useRef } from 'react';
import { useWatchPartyStore } from '@/src/store/watchPartyStore';
import { subscribeToWatchParty } from '@/src/services/watchPartyService';

export function useWatchPartyFirebase(serverId, channelId) {
  const setRemoteState  = useWatchPartyStore((s) => s.setRemoteState);
  const resetWatchParty = useWatchPartyStore((s) => s.resetWatchParty);
  const unsubRef = useRef(null);

  useEffect(() => {
    if (!serverId || !channelId) return;

    // Önceki listener'ı temizle
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    unsubRef.current = subscribeToWatchParty(serverId, channelId, (data) => {
      if (!data) {
        // Döküman silinmiş → party bitti
        resetWatchParty();
        return;
      }
      // Store'daki setRemoteState shallow compare yapıyor,
      // gerçekten değişen alanlar varsa set() çağrılır
      setRemoteState(data);
    });

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [serverId, channelId, setRemoteState, resetWatchParty]);
}