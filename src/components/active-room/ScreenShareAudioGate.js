import { useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent, Track } from "livekit-client";

/**
 * Yayının SESİNİ yalnızca yayını izleyenlere indirir.
 *
 * Neden: oda `autoSubscribe: true` ile açılır; yayın sesi (ScreenShareAudio) yayını izlemeyen herkesin istemcisine de sunucudan
 * akıyordu (çalınmıyordu ama bant genişliği/LiveKit kotası harcanıyordu ve yayıncı için "dinleyen var" gibi görünüyordu).
 * Burada, bir yayının sesi yalnızca o yayın izleme listesindeyse (`kimlik:screen`) abone olunur; izlemeyi bırakınca abonelik
 * kapanır. Yayın VİDEOSU kasıtlı olarak bu kapıdan geçmez: kişi kartlarındaki bulanık önizleme ona bağlı ve adaptiveStream
 * zaten görünmeyen videoyu durdurur.
 */
export default function ScreenShareAudioGate({ pinnedStreamIds }) {
  const room = useRoomContext();

  useEffect(() => {
    if (!room) return;
    const wanted = new Set(pinnedStreamIds || []);

    const apply = () => {
      room.remoteParticipants.forEach((p) => {
        const want = wanted.has(`${p.identity}:screen`) || wanted.has(p.identity);
        p.trackPublications.forEach((pub) => {
          if (pub.source !== Track.Source.ScreenShareAudio) return;
          if (pub.isSubscribed !== want) {
            try { pub.setSubscribed(want); } catch { /* bağlantı kapanıyor olabilir */ }
          }
        });
      });
    };

    apply();
    // Yeni yayın açılınca / ses aboneliği kurulunca (autoSubscribe ile gelir) tekrar uygula
    room.on(RoomEvent.TrackPublished, apply);
    room.on(RoomEvent.TrackSubscribed, apply);
    room.on(RoomEvent.ParticipantConnected, apply);
    return () => {
      room.off(RoomEvent.TrackPublished, apply);
      room.off(RoomEvent.TrackSubscribed, apply);
      room.off(RoomEvent.ParticipantConnected, apply);
    };
  }, [room, pinnedStreamIds]);

  return null;
}
