import { useEffect, useRef } from "react";
import { useRoomContext } from "@livekit/components-react";
import { ConnectionState, RoomEvent, Track } from "livekit-client";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useToastStore } from "@/src/store/toastStore";

// ============================================
// 🎧 AUDIO DEVICE SYNC — giriş/çıkış cihazı tek yetkili
// ============================================
// Cihaz seçimini odaya uygulayan TEK yer burasıdır (ayarlar menüsü yalnızca store'u günceller):
//  - Seçim değişince canlı olarak odaya uygulanır (mikrofon + hoparlör)
//  - Çıkış cihazı odaya girerken ve yeni bir ses akışı geldiğinde (geç katılan kişi) yeniden uygulanır
//  - Seçili cihaz sistemden çıkarılırsa (kulaklık söküldü) varsayılana dönülür ve kullanıcı bilgilendirilir

const TOAST_ID = "audio-device-sync";

export function supportsOutputSelection() {
  return typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
}

function notify(type, title, message) {
  try {
    const store = useToastStore.getState();
    store.dismiss(TOAST_ID);
    store.addToast({ id: TOAST_ID, type, title, message, duration: 6000 });
  } catch (e) {}
}

export function useAudioDeviceSync() {
  const room = useRoomContext();
  const audioInputId = useSettingsStore((s) => s.audioInputId);
  const audioOutputId = useSettingsStore((s) => s.audioOutputId);

  // İşlemler sıraya girer: peş peşe seçim yapılırsa yarış olmaz
  const queueRef = useRef(Promise.resolve());
  const enqueue = (fn) => {
    queueRef.current = queueRef.current.then(fn).catch(() => {});
    return queueRef.current;
  };

  // Mikrofon odaya girerken zaten seçili cihazla açılır (RoomEventsHandler), bu yüzden başlangıç değeri
  // "uygulanmış" sayılır; yalnızca sonradan değişiklik uygulanır.
  const appliedInput = useRef(audioInputId);

  const applyOutput = (id) =>
    enqueue(async () => {
      if (!room || room.state !== ConnectionState.Connected) return;
      if (id === "default" && !appliedOutputRef.current) return; // dokunulmamış varsayılan
      if (!supportsOutputSelection()) return;
      try {
        await room.switchActiveDevice("audiooutput", id, id !== "default");
        appliedOutputRef.current = id;
      } catch (err) {
        console.warn("Çıkış cihazı uygulanamadı:", err);
        useSettingsStore.getState().setAudioOutput("default");
        try { await room.switchActiveDevice("audiooutput", "default"); } catch (e) {}
        appliedOutputRef.current = "default";
        notify("warning", "Hoparlör değiştirilemedi", "Seçilen çıkış cihazı kullanılamıyor, varsayılana dönüldü.");
      }
    });
  const appliedOutputRef = useRef(null);

  // Seçim değişince mikrofonu canlı uygula
  useEffect(() => {
    if (!room || appliedInput.current === audioInputId) return;
    appliedInput.current = audioInputId;
    enqueue(async () => {
      if (room.state !== ConnectionState.Connected) return;
      try {
        await room.switchActiveDevice("audioinput", audioInputId, audioInputId !== "default");
      } catch (err) {
        console.warn("Mikrofon cihazı uygulanamadı:", err);
        appliedInput.current = "default";
        useSettingsStore.getState().setAudioInput("default");
        try { await room.switchActiveDevice("audioinput", "default"); } catch (e) {}
        notify("warning", "Mikrofon değiştirilemedi", "Seçilen mikrofon kullanılamıyor, varsayılana dönüldü.");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, audioInputId]);

  // Seçim değişince hoparlörü canlı uygula
  useEffect(() => {
    if (!room) return;
    applyOutput(audioOutputId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, audioOutputId]);

  // Odaya girişte ve yeni ses akışı geldiğinde hoparlörü yeniden uygula
  useEffect(() => {
    if (!room) return;
    const reapply = () => {
      const id = useSettingsStore.getState().audioOutputId;
      if (id !== "default") applyOutput(id);
    };
    const onSubscribed = (track) => {
      if (track?.kind === Track.Kind.Audio) reapply();
    };
    if (room.state === ConnectionState.Connected) reapply();
    room.on(RoomEvent.Connected, reapply);
    room.on(RoomEvent.Reconnected, reapply);
    room.on(RoomEvent.TrackSubscribed, onSubscribed);
    return () => {
      room.off(RoomEvent.Connected, reapply);
      room.off(RoomEvent.Reconnected, reapply);
      room.off(RoomEvent.TrackSubscribed, onSubscribed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  // Seçili cihaz sistemden çıkarıldıysa varsayılana dön
  useEffect(() => {
    if (!room || typeof navigator === "undefined" || !navigator.mediaDevices) return;
    let timer = null;

    const check = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const { audioInputId: inId, audioOutputId: outId, setAudioInput, setAudioOutput } =
          useSettingsStore.getState();
        const inputs = devices.filter((d) => d.kind === "audioinput");
        const outputs = devices.filter((d) => d.kind === "audiooutput");

        if (inId !== "default" && inputs.length && !inputs.some((d) => d.deviceId === inId)) {
          setAudioInput("default"); // yukarıdaki effect odaya uygular
          notify("warning", "Mikrofon çıkarıldı", "Seçili mikrofon bulunamadı, varsayılan mikrofona geçildi.");
        }
        if (outId !== "default" && outputs.length && !outputs.some((d) => d.deviceId === outId)) {
          setAudioOutput("default");
          notify("warning", "Hoparlör çıkarıldı", "Seçili hoparlör bulunamadı, varsayılan hoparlöre geçildi.");
        }
      } catch (e) {}
    };

    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(check, 500); // arka arkaya gelen olayları birleştir
    };
    navigator.mediaDevices.addEventListener("devicechange", onChange);
    return () => {
      clearTimeout(timer);
      navigator.mediaDevices.removeEventListener("devicechange", onChange);
    };
  }, [room]);
}
