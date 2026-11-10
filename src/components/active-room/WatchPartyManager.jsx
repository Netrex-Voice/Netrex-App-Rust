// src/components/active-room/WatchPartyManager.jsx
import React from 'react';
import { WatchPartyPlayer } from '../watch-party/WatchPartyPlayer';
import { WatchPartyMiniBadge } from '../watch-party/WatchPartyMiniBadge';
import { useWatchPartyFirebase } from '../../hooks/useWatchPartyFirebase';
import { useWatchPartyStore } from '../../store/watchPartyStore';
import { useSettingsStore } from '../../store/settingsStore';

function WatchPartyInner({ serverId, channelId }) {
  // Firebase dinleyicileri başlat
  useWatchPartyFirebase(serverId, channelId);

  const isActive      = useWatchPartyStore((s) => s.isActive);
  const isInVoiceRoom = useSettingsStore((s) => s.isInVoiceRoom);

  const hasAppliedPrefs = React.useRef(false);

  React.useEffect(() => {
    // Watch party active olduğunda tercihleri uygula
    if (isActive && isInVoiceRoom && !hasAppliedPrefs.current) {
      hasAppliedPrefs.current = true;
      const { wpAutoMute, wpAutoJoin, wpDefaultVolume, wpVideoQuality, wpVideoMode, isMuted } = useSettingsStore.getState();
      
      // Auto-join
      if (wpAutoJoin) {
         useWatchPartyStore.getState().setLocalPref('videoMode', wpVideoMode === 'player'); 
         useWatchPartyStore.getState().setLocalPref('showPlayer', wpVideoMode === 'player');
      }
      
      // Auto-mute
      if (wpAutoMute && !isMuted) {
         useSettingsStore.getState().toggleMute();
      }
      
      // Varsayılan ses ve kaliteyi player'a gönder
      useWatchPartyStore.getState().setLocalPref('volume', wpDefaultVolume || 20);
      useWatchPartyStore.getState().setLocalPref('videoQuality', wpVideoQuality || 'auto');
    } else if (!isActive) {
      hasAppliedPrefs.current = false;
    }
  }, [isActive, isInVoiceRoom]);

  // Mini badge: Eğer player gizliyse VEYA videoMode=false (yanlış adlandırılmış videoMode aslında mini player mı diye ayarlanmış. videoMode=true = Player, videoMode=false = Mini)
  // Store'daki videoMode false ise mini mode demek. WP Player ise videoFullscreen ve showPlayer üzerinden çalışır.
  const wpLocalPrefs = useWatchPartyStore((s) => s.localPreferences);
  const showPlayer = wpLocalPrefs.showPlayer;
  const isMiniMode = !wpLocalPrefs.videoMode && showPlayer;
  // -> WatchPartyPlayer z-index ile alta atılıyor vs biz onu ellemedik. 

  return (
    <>
      {/* Player: sadece party aktif ve ses odasındayken */}
      {isActive && isInVoiceRoom && (
        <WatchPartyPlayer serverId={serverId} channelId={channelId} />
      )}
      {/* Mini rozet: party aktif ama player gizliyken */}
      {isActive && (!showPlayer || isMiniMode) && <WatchPartyMiniBadge />}
    </>
  );
}

export default function WatchPartyManager({ serverId, channelId }) {
  const enabled = useSettingsStore((s) => s.watchPartyEnabled);
  if (!enabled) return null;
  return <WatchPartyInner serverId={serverId} channelId={channelId} />;
}