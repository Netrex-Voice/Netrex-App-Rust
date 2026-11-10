import { useEffect, useRef, useCallback } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { Track, ParticipantEvent, ConnectionState } from "livekit-client";
import { useSettingsStore } from "@/src/store/settingsStore";
import { NetrexVoiceProcessor } from "@/src/audio/voiceProcessor";
import { sliderToRms } from "@/src/utils/voiceThreshold";
import { useMicStatusStore } from "@/src/store/micStatusStore";
import {
  initResourcesPath,
  getResourcePath,
  getSharedAudioContext,
  closeSharedAudioContext,
  prewarmVoiceAudio,
} from "@/src/audio/sharedAudioContext";

// Ses zinciri (RNNoise, filtreler, gate, VAD) src/audio/voiceProcessor.js içinde; LiveKit'in
// track.setProcessor() API'siyle mikrofona bağlanır. Bu hook yalnızca:
//  - mikrofon track'i ne zaman değişirse işlemciyi ona bağlar,
//  - VAD metriklerinden "konuşuyor" kararını verip UI'ya (setLocalIsSpeaking) yansıtır,
//  - ayar değişince işlemciyi yeniden oluşturmadan günceller.

const CONFIG = {
  UI_RELEASE_TIME: 60, // Krisp uzatma kuyruğunu hissiyat olarak yok et
  // Gate: açıkken eşiğin bu oranının altına düşmeden kapanmaz (histerezis) ve konuşma bittikten sonra
  // bu kadar ms açık kalır (hold); kelime arası / hece sonları kırpılmasın
  GATE_CLOSE_RATIO: 0.7,
  GATE_HOLD_MS: 300,
};

export function useVoiceProcessor() {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const room = useRoomContext();

  const noiseSuppressionMode = useSettingsStore((s) => s.noiseSuppressionMode);
  const advancedNoiseReduction = useSettingsStore((s) => s.advancedNoiseReduction);
  const spectralFiltering = useSettingsStore((s) => s.spectralFiltering);
  const aiNoiseSuppression = useSettingsStore((s) => s.aiNoiseSuppression);
  const voiceThreshold = useSettingsStore((s) => s.voiceThreshold);
  const setLocalIsSpeaking = useSettingsStore((s) => s.setLocalIsSpeaking);

  // Krisp modu senkronizasyonu
  useEffect(() => {
    if (noiseSuppressionMode === "krisp" && !aiNoiseSuppression) {
      // Sadece aiNoiseSuppression'ı düzelt, modu tekrar set etme (sonsuz döngü riski)
      useSettingsStore.getState().toggleAiNoiseSuppression();
    }
  }, [noiseSuppressionMode, aiNoiseSuppression]);

  // Mic enabled ref (message handler'da stale closure olmasın)
  const isMicEnabledRef = useRef(isMicrophoneEnabled);
  useEffect(() => {
    isMicEnabledRef.current = isMicrophoneEnabled;
  }, [isMicrophoneEnabled]);

  const cachedThresholdRef = useRef(sliderToRms(voiceThreshold));
  useEffect(() => {
    cachedThresholdRef.current = sliderToRms(voiceThreshold);
  }, [voiceThreshold]);

  // Ayarlar ref'te: değişince ses grafiği baştan kurulmasın, işlemci kendini günceller
  const noiseSettingsRef = useRef({});
  noiseSettingsRef.current = {
    mode: noiseSuppressionMode,
    advancedNoiseReduction,
    spectralFiltering,
  };

  // Odaya girerken (LiveKit bağlantısı sürerken) worklet dosyalarını arka planda yükle: mikrofon yayını
  // başlayınca işlemci hemen kurulur. Odadan çıkınca context kapatılır (boştayken RAM tutulmaz).
  useEffect(() => {
    prewarmVoiceAudio();
    return () => closeSharedAudioContext();
  }, []);

  // UI konuşma durumu
  const lastUISpeakingTimeRef = useRef(0);
  const currentUISpeakingRef = useRef(false);
  const gateOpenRef = useRef(false);
  const lastAboveTimeRef = useRef(0);

  const handleMetrics = useCallback(
    (data) => {
      const { rms, rawRms, isTransient, isSustainedVoice, hasPotentialVoice } = data;
      const nsMode = noiseSettingsRef.current.mode;

      // Seviye: anlık değer (worklet artık rms'i de anlık gönderiyor). Eskiden yumuşatılmış değer kullanılıyordu;
      // sönmesi saniyeler sürdüğü için konuşma animasyonu ve kapı gereksiz uzun açık kalıyordu.
      // Konuşma arası boşlukları GATE_HOLD_MS köprüler.
      const level = rawRms ?? rms;
      // Histerezis: kapı açıkken eşiğin bir kısmının altına inmeden kapanmaz
      const threshold = cachedThresholdRef.current * (gateOpenRef.current ? CONFIG.GATE_CLOSE_RATIO : 1);

      let isSpeaking;
      if (nsMode === "krisp") {
        isSpeaking = level > threshold && !isTransient;
      } else if (nsMode === "standard") {
        isSpeaking = level > threshold && (isSustainedVoice || hasPotentialVoice);
      } else {
        isSpeaking = level > threshold;
      }

      const now = Date.now();
      if (isSpeaking) lastAboveTimeRef.current = now;
      // Hold: konuşma bittikten sonra kısa süre açık kal
      const gateOpen = isSpeaking || now - lastAboveTimeRef.current < CONFIG.GATE_HOLD_MS;
      gateOpenRef.current = gateOpen;

      if (isSpeaking && isMicEnabledRef.current) {
        lastUISpeakingTimeRef.current = now;
        if (!currentUISpeakingRef.current && room?.state === ConnectionState.Connected) {
          currentUISpeakingRef.current = true;
          setLocalIsSpeaking(true);
        }
      } else if (
        currentUISpeakingRef.current &&
        now - lastUISpeakingTimeRef.current > CONFIG.UI_RELEASE_TIME
      ) {
        currentUISpeakingRef.current = false;
        setLocalIsSpeaking(false);
      }
      return gateOpen; // işlemci gate'i bununla sürer (hold + histerezis dahil; UI animasyonu yalnızca isSpeaking'e bakar)
    },
    [room, setLocalIsSpeaking]
  );
  const handleMetricsRef = useRef(handleMetrics);
  handleMetricsRef.current = handleMetrics;

  const attachedRef = useRef(null); // { track, processor }

  // ========== ANA EFFECT: mikrofon track'ine işlemciyi bağla ==========
  useEffect(() => {
    if (!localParticipant || !room) return;

    let disposed = false;
    let attaching = false;

    const detach = async () => {
      const cur = attachedRef.current;
      attachedRef.current = null;
      if (cur) {
        try {
          await cur.track.stopProcessor();
        } catch (e) {}
      }
      if (currentUISpeakingRef.current) {
        currentUISpeakingRef.current = false;
        setLocalIsSpeaking(false);
      }
    };

    const attach = async () => {
      if (disposed || attaching || room.state !== ConnectionState.Connected) return;
      const track = localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
      if (!track || track.kind !== Track.Kind.Audio) return;

      const cur = attachedRef.current;
      // Aynı track'e zaten bağlıyız (cihaz değişimini LiveKit processor.restart ile kendisi halleder)
      if (cur && cur.track === track && track.getProcessor?.() === cur.processor) return;

      attaching = true;
      try {
        await initResourcesPath();
        const ctx = await getSharedAudioContext();
        if (disposed) return;

        if (cur) await detach();

        const processor = new NetrexVoiceProcessor({
          getSettings: () => noiseSettingsRef.current,
          resolveWorkletUrl: getResourcePath,
          onMetrics: (m) => handleMetricsRef.current(m),
        });
        track.setAudioContext(ctx); // webAudioMix açmadan, processor kendi 48 kHz context'ini kullansın
        await track.setProcessor(processor);
        if (disposed) {
          await track.stopProcessor().catch(() => {});
          return;
        }
        attachedRef.current = { track, processor };
        useMicStatusStore.getState().setProcessed();
        console.log("✅ Netrex ses işlemcisi mikrofona bağlandı");
      } catch (e) {
        console.error("❌ Ses işlemcisi bağlanamadı (ham mikrofonla devam):", e);
        // Ham mikrofon zaten gidiyor; "Bağlanıyor" göstergesi takılı kalmasın
        useMicStatusStore.getState().setProcessed();
      } finally {
        attaching = false;
      }
    };

    attach();
    localParticipant.on(ParticipantEvent.LocalTrackPublished, attach);
    // Track yeniden publish edildiyse (ayar değişimi, yeniden bağlanma) yeni track'e bağla.
    // Ucuz bir referans karşılaştırması; asıl işi LocalTrackPublished yapar.
    const interval = setInterval(attach, 3000);

    return () => {
      disposed = true;
      clearInterval(interval);
      localParticipant.off(ParticipantEvent.LocalTrackPublished, attach);
      detach();
    };
  }, [localParticipant, room, setLocalIsSpeaking]);

  // ========== Ayar değişimi: işlemciyi yeniden oluşturmadan güncelle ==========
  useEffect(() => {
    attachedRef.current?.processor.applySettings().catch((e) => {
      console.warn("Ses işlemcisi ayarı uygulanamadı:", e);
    });
  }, [noiseSuppressionMode, advancedNoiseReduction, spectralFiltering]);
}
