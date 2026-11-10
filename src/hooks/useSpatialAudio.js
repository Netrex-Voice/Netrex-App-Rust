import { useEffect, useMemo, useRef } from "react";
import { useParticipants, useRoomContext } from "@livekit/components-react";
import { RoomEvent, Track } from "livekit-client";
import { useSpatialAudioStore } from "@/src/store/spatialAudioStore";
import { useParticipantVolumeStore } from "@/src/store/participantVolumeStore";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useGroupAdjustedVolumes } from "@/src/hooks/useGroupAdjustedVolumes";
import { SpatialEngine } from "@/src/audio/spatialEngine";
import { resolveLayout } from "@/src/utils/spatialMath";
import { loadSpatialFromFirebase, saveSpatialToFirebase } from "@/src/services/spatialAudioService";

/**
 * 🎧 Uzamsal ses (spatial audio) — React katmanı
 *
 * Asıl iş src/audio/spatialEngine.js'te. Bu hook:
 *  1. Mod açıkken motoru kurar, kapanınca/odadan çıkınca tamamen söker (AudioContext dahil)
 *  2. Odadaki mikrofon track'lerini olaylarla (abone olma, ayrılma...) motorla uzlaştırır
 *  3. Yerleşimi (kayıtlı konum yoksa varsayılan çember), kişi başı ses seviyesini, sağırlaştırmayı
 *     ve seçili hoparlörü motora iletir
 *  4. Pozisyonları odadan çıkarken Firebase'e yedekler, yeni cihazda yükler
 *
 * Yerleşim ve matematik: src/utils/spatialMath.js (canvas ile ortak)
 */

/** Odadaki tüm uzak katılımcıların abone olunmuş mikrofon track'leri: identity → track */
function collectMicTracks(room) {
  const tracks = new Map();
  room.remoteParticipants.forEach((participant) => {
    const track = participant.getTrackPublication(Track.Source.Microphone)?.track;
    if (track && track.kind === Track.Kind.Audio) tracks.set(participant.identity, track);
  });
  return tracks;
}

export function useSpatialAudio({ channelId = null, userId = null, deafened = false } = {}) {
  const room = useRoomContext();
  const participants = useParticipants();
  const enabled = useSpatialAudioStore((s) => s.enabled);
  const positions = useSpatialAudioStore((s) => s.positions);
  const baseVolumes = useParticipantVolumeStore((s) => s.volumes);
  const identityList = useMemo(() => participants.map((p) => p.identity).sort(), [participants]);
  const volumes = useGroupAdjustedVolumes(baseVolumes, identityList);
  const audioOutputId = useSettingsStore((s) => s.audioOutputId);

  const engineRef = useRef(null);
  const localId = room?.localParticipant?.identity || userId;

  // Her konuşma değişiminde yeni `participants` dizisi gelir; yerleşim yalnızca kimlikler değişince hesaplansın
  const identitiesKey = useMemo(
    () => participants.map((p) => p.identity).sort().join("|"),
    [participants],
  );

  // 1) Motor yaşam döngüsü
  useEffect(() => {
    if (!enabled) return;
    const engine = new SpatialEngine();
    engineRef.current = engine;
    return () => {
      engine.dispose();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [enabled]);

  // 2) Ses akışlarını odayla uzlaştır (geç abone olunan/yeniden yayınlanan mikrofonlar dahil)
  useEffect(() => {
    if (!enabled || !room) return;

    let raf = 0;
    const sync = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => engineRef.current?.sync(collectMicTracks(room)));
    };

    const events = [
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackPublished,
      RoomEvent.TrackUnpublished,
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.Reconnected,
    ];
    events.forEach((e) => room.on(e, sync));
    sync();

    return () => {
      events.forEach((e) => room.off(e, sync));
      cancelAnimationFrame(raf);
    };
  }, [enabled, room]);

  // 3) Yerleşim + ses seviyeleri + sağırlaştırma
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const identities = identitiesKey ? identitiesKey.split("|") : [];
    engine.setState({
      layout: resolveLayout(positions?.[channelId], identities, localId),
      volumes,
      deafened,
    });
  }, [enabled, positions, channelId, volumes, deafened, identitiesKey, localId]);

  // 4) Seçili hoparlör (eskiden uzamsal modda yok sayılıyordu)
  useEffect(() => {
    engineRef.current?.setSink(audioOutputId);
  }, [enabled, audioOutputId]);

  // 5) Pozisyon yedeği: bu kanal için yerelde yoksa Firebase'den al; odadan çıkarken değişiklik varsa yaz
  useEffect(() => {
    if (!enabled || !channelId || !userId) return;
    loadSpatialFromFirebase(userId, channelId);
    return () => {
      saveSpatialToFirebase(userId, channelId);
    };
  }, [enabled, channelId, userId]);

  return { isActive: enabled };
}

// Geriye dönük uyumluluk: eski içe aktarmalar bozulmasın
export { calculateAudioFromPosition, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/src/utils/spatialMath";
