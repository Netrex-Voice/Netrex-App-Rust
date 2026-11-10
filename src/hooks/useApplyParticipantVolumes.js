import { useEffect, useMemo, useRef } from 'react';
import { useGroupAdjustedVolumes } from '@/src/hooks/useGroupAdjustedVolumes';
import { useParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useParticipantVolumeStore } from '@/src/store/participantVolumeStore';
import { useSpatialAudioStore } from '@/src/store/spatialAudioStore';
import { useSettingsStore } from '@/src/store/settingsStore';
import { useServerStore } from '@/src/store/serverStore';

/**
 * 🔊 Apply Participant Volumes Hook v2.2
 *
 * - Volume 0–1.0  → LiveKit native setVolume() (HTML element, no extra overhead)
 * - Volume >1.0   → GainNode boost (AudioContext MediaElementSource → GainNode → destination)
 * - Deafened      → Volume 0 & muted (Sağırlaştırma desteği)
 * - Spatial mode  → Skip (useSpatialAudio hook manages pipeline)
 */
export function useApplyParticipantVolumes() {
  const participants = useParticipants();
  const baseVolumes = useParticipantVolumeStore(s => s.volumes);
  const identities = useMemo(() => (participants || []).map(p => p.identity).sort(), [participants]);
  const volumes = useGroupAdjustedVolumes(baseVolumes, identities);
  const spatialEnabled = useSpatialAudioStore(s => s.enabled);
  const isDeafened = useSettingsStore(s => s.isDeafened);
  const serverDeafened = useServerStore(s => s.serverDeafened || false);
  const shouldMuteAll = isDeafened || serverDeafened;

  // Gain boost için AudioContext (sadece boost gerektiğinde yaratılır)
  const gainContextRef = useRef(null);
  // identity → { source: MediaElementSourceNode, gainNode: GainNode, audioEl: HTMLElement }
  const gainNodesRef = useRef({});

  // ✅ Önceki volume değerlerini cache'le (gereksiz setVolume çağrılarını önle)
  const appliedVolumesRef = useRef({});

  useEffect(() => {
    if (!participants || participants.length === 0) return;

    // 🎧 Spatial mod aktifse bu hook devre dışı — useSpatialAudio yönetir.
    // Ses >%100 olanlar için kurulmuş yükseltme düğümleri kapatılır: kalırsa aynı kişi hem buradan hem
    // uzamsal boru hattından çalıp çift ses verir. Önbellek de sıfırlanır; mod kapanınca ses seviyeleri yeniden uygulanır.
    if (spatialEnabled) {
      Object.values(gainNodesRef.current).forEach(({ source, gainNode }) => {
        try { source.disconnect(); } catch (e) {}
        try { gainNode.disconnect(); } catch (e) {}
      });
      gainNodesRef.current = {};
      appliedVolumesRef.current = {};
      return;
    }

    participants.forEach(participant => {
      if (participant.isLocal) return;

      try {
        const micPub = participant.getTrackPublication(Track.Source.Microphone);
        if (!micPub?.track || micPub.track.kind !== 'audio') return;

        const baseVolume = volumes[participant.identity] ?? 1.0;
        const volume = shouldMuteAll ? 0 : baseVolume;
        const identity = participant.identity;

        // ✅ Volume değişmediyse hiçbir şey yapma!
        if (appliedVolumesRef.current[identity] === volume) {
          if (volume <= 1.0) return;
          if (gainNodesRef.current[identity]) return;
        }

        appliedVolumesRef.current[identity] = volume;

        if (volume <= 1.0) {
          // ─── Standart mod: LiveKit native API (0–1) ───
          if (typeof micPub.track.setVolume === 'function') {
            micPub.track.setVolume(volume);
          }

          // Daha önce GainNode varsa temizle
          if (gainNodesRef.current[identity]) {
            const { source, gainNode, audioEl } = gainNodesRef.current[identity];
            try { audioEl.muted = shouldMuteAll; } catch(e) {}
            try { source.disconnect(); } catch(e) {}
            try { gainNode.disconnect(); } catch(e) {}
            delete gainNodesRef.current[identity];
          }

        } else {
          // ─── Boost mod: GainNode ile 100%+ ses (createMediaStreamSource kullanarak) ───
          const currentAudioEl = micPub.track.attachedElements?.[0];
          if (!currentAudioEl) return;

          // AudioContext yarat
          if (!gainContextRef.current || gainContextRef.current.state === 'closed') {
            gainContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          }
          const ctx = gainContextRef.current;
          if (ctx.state === 'suspended') ctx.resume().catch(() => {});

          if (!gainNodesRef.current[identity]) {
            try {
              // Mute original HTML audio element so we don't have double audio
              currentAudioEl.muted = true;

              const mediaStream = micPub.track.mediaStream || new MediaStream([micPub.track.mediaStreamTrack]);
              const source = ctx.createMediaStreamSource(mediaStream);
              const gainNode = ctx.createGain();
              gainNode.gain.setValueAtTime(volume, ctx.currentTime);
              source.connect(gainNode);
              gainNode.connect(ctx.destination);
              
              gainNodesRef.current[identity] = { source, gainNode, audioEl: currentAudioEl };
            } catch(e) {
              if (process.env.NODE_ENV === 'development') {
                console.warn(`⚠️ GainNode kurulumu başarısız ${identity}:`, e);
              }
            }
          } else {
            const nodeInfo = gainNodesRef.current[identity];
            // If audio element changed, unmute old one and mute new one
            if (nodeInfo.audioEl !== currentAudioEl) {
              try { nodeInfo.audioEl.muted = false; } catch(e) {}
              nodeInfo.audioEl = currentAudioEl;
            }
            try { currentAudioEl.muted = true; } catch(e) {}
            nodeInfo.gainNode.gain.setValueAtTime(volume, ctx.currentTime);
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`⚠️ Volume uygulanamadı ${participant.identity}:`, error);
        }
      }
    });
  }, [participants, volumes, spatialEnabled]);

  // ✅ Katılımcı ayrıldığında cache'den sil
  useEffect(() => {
    const identities = new Set(participants.map(p => p.identity));
    Object.keys(appliedVolumesRef.current).forEach(identity => {
      if (!identities.has(identity)) {
        delete appliedVolumesRef.current[identity];
      }
    });
  }, [participants]);

  // Cleanup
  useEffect(() => {
    return () => {
      Object.values(gainNodesRef.current).forEach(({ gainNode, source, audioEl }) => {
        try { gainNode.disconnect(); } catch(e) {}
        try { source.disconnect(); } catch(e) {}
        try { audioEl.muted = false; } catch(e) {}
      });
      gainNodesRef.current = {};

      if (gainContextRef.current && gainContextRef.current.state !== 'closed') {
        gainContextRef.current.close().catch(() => {});
      }
      gainContextRef.current = null;
    };
  }, []);
}
