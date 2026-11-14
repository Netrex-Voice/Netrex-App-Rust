"use client";

import { memo, useEffect, useMemo } from "react";
import { useParticipants, useParticipantInfo } from "@livekit/components-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useSpeakingStore } from "@/src/store/speakingStore";
import { useRemoteSpeaking } from "@/src/hooks/useRemoteSpeaking";

/**
 * 🎙️ "Kim konuşuyor?" bilgisinin TEK kaynağı (LiveKitRoom İÇİNDE çalışır, görünmez).
 *
 * Eskiden bu ölçümü katılımcı kartları (UserCard) yapıp `speakingStore`'a yazıyordu. Yayın izlenirken kartlar
 * ekrandan kaldırıldığı için ölçen kimse kalmıyor ve konuşma animasyonu HER YERDE (kenar çubuğu, küçük oda kutusu,
 * oyun içi overlay, uzamsal ses tuvali) duruyordu. Artık ölçüm, ekranda ne gösterildiğinden bağımsız olarak oda
 * boyunca sürer; kartlar da dahil herkes sonucu `speakingStore`'dan okur.
 */
const SpeakingProbe = memo(function SpeakingProbe({ participant }) {
  const { identity, metadata } = useParticipantInfo({ participant });
  const remoteSpeaking = useRemoteSpeaking(participant, participant.isLocal);
  const localIsSpeaking = useSettingsStore((s) => s.localIsSpeaking);
  const localMuted = useSettingsStore((s) => s.isMuted);
  const localDeafened = useSettingsStore((s) => s.isDeafened);
  const setSpeaking = useSpeakingStore((s) => s.setSpeaking);

  const remoteState = useMemo(() => {
    try {
      return metadata ? JSON.parse(metadata) : {};
    } catch {
      return {};
    }
  }, [metadata]);

  const isMuted = participant.isLocal ? localMuted : !!remoteState.isMuted;
  const isDeafened = participant.isLocal ? localDeafened : !!remoteState.isDeafened;
  const speaking = (participant.isLocal ? localIsSpeaking : remoteSpeaking) && !isMuted && !isDeafened;

  useEffect(() => {
    if (!identity) return;
    setSpeaking(identity, !!speaking);
  }, [identity, speaking, setSpeaking]);

  // Katılımcı odadan çıkınca "konuşuyor" takılı kalmasın
  useEffect(() => {
    if (!identity) return;
    return () => setSpeaking(identity, false);
  }, [identity, setSpeaking]);

  return null;
});

export default function SpeakingPublisher() {
  const participants = useParticipants();

  // Odadan çıkınca tüm kayıtları temizle
  useEffect(() => () => useSpeakingStore.getState().clearSpeaking(), []);

  return participants.map((p) => <SpeakingProbe key={p.sid || p.identity} participant={p} />);
}
