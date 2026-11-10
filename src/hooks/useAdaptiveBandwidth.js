import { useEffect, useRef } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { Track, RoomEvent, ParticipantEvent, ConnectionQuality } from "livekit-client";
import { useSettingsStore } from "@/src/store/settingsStore";
import { toast } from "@/src/utils/toast";

// Zayıf internette hem yayın hem konuşma mümkün olsun diye gönderilen veriyi kademeli azaltır.
//
// İlke: konuşma her zaman öncelikli ve ucuz kalır (Opus zaten ~48 kbps); asıl veri tüketimi ekran paylaşımı
// ve kamera. Bağlantı kalitesi düştükçe önce görüntünün bit hızı/FPS'si kısılır, ses paketlerine ağ önceliği
// verilir. Ses bit hızına yalnızca çok kötü durumda dokunulur ve konuşma anlaşılırlığını bozmayacak seviyede tutulur.
//
// Ayrıca Performans ayarlarındaki "Veri Tasarrufu" açıksa bağlantı iyi olsa bile en az 1. kademe uygulanır.

// factor: gönderilen bit hızı çarpanı, fps: üst sınır (null = dokunma), scale: ek çözünürlük küçültme
const TIERS = [
  { name: "normal", video: { factor: 1, fps: null, scale: 1 }, audio: null },
  { name: "zayıf", video: { factor: 0.5, fps: 20, scale: 1 }, audio: 32000 },
  { name: "kötü", video: { factor: 0.25, fps: 10, scale: 1.5 }, audio: 24000 },
];

const RECOVER_MS = 15000; // iyileşme bu kadar sürerse bir kademe geri çık (titreşimi önler)
const DEFAULT_VIDEO_BITRATE = 2_500_000; // base bilinmiyorsa varsayım

function qualityToTier(q) {
  if (q === ConnectionQuality.Lost) return 2;
  if (q === ConnectionQuality.Poor) return 1;
  return 0; // Excellent / Good / Unknown
}

// Sender'ın ilk (kullanıcının seçtiği) ayarlarını sakla: kademe 0'da bunlara dönülür
const baseParams = new WeakMap();

function roleOf(source) {
  if (source === Track.Source.Microphone) return "mic";
  if (source === Track.Source.ScreenShare) return "screen";
  if (source === Track.Source.Camera) return "camera";
  if (source === Track.Source.ScreenShareAudio) return "screenAudio";
  return null;
}

const PRIORITY = {
  mic: "high",
  screenAudio: "medium",
  camera: "medium",
  screen: "low",
};

async function applyToSender(sender, role, tier) {
  if (!sender?.getParameters) return;
  const params = sender.getParameters();
  const encodings = params.encodings;
  if (!encodings || encodings.length === 0) return;

  const isAudio = role === "mic" || role === "screenAudio";
  const t = TIERS[tier];

  encodings.forEach((enc, i) => {
    const key = `${i}`;
    let bases = baseParams.get(sender);
    if (!bases) {
      bases = {};
      baseParams.set(sender, bases);
    }
    if (!bases[key]) {
      bases[key] = {
        maxBitrate: enc.maxBitrate,
        maxFramerate: enc.maxFramerate,
        scale: enc.scaleResolutionDownBy,
      };
    }
    const base = bases[key];

    if (isAudio) {
      if (t.audio == null) {
        if (base.maxBitrate == null) delete enc.maxBitrate;
        else enc.maxBitrate = base.maxBitrate;
      } else {
        // Ses hiçbir zaman 24 kbps'in altına inmez; ekran paylaşımı sesi için 32 kbps tabanı
        const floor = role === "screenAudio" ? 32000 : 24000;
        const cap = Math.max(floor, t.audio);
        enc.maxBitrate = base.maxBitrate != null ? Math.min(base.maxBitrate, cap) : cap;
      }
    } else if (t.video.factor === 1) {
      // Normal: kullanıcının seçtiği değerlere dön
      if (base.maxBitrate == null) delete enc.maxBitrate;
      else enc.maxBitrate = base.maxBitrate;
      if (base.maxFramerate == null) delete enc.maxFramerate;
      else enc.maxFramerate = base.maxFramerate;
      if (base.scale == null) delete enc.scaleResolutionDownBy;
      else enc.scaleResolutionDownBy = base.scale;
    } else {
      enc.maxBitrate = Math.round((base.maxBitrate ?? DEFAULT_VIDEO_BITRATE) * t.video.factor);
      if (t.video.fps != null) {
        enc.maxFramerate = Math.min(base.maxFramerate ?? 30, t.video.fps);
      }
      if (t.video.scale > 1) {
        enc.scaleResolutionDownBy = (base.scale ?? 1) * t.video.scale;
      }
    }

    enc.priority = PRIORITY[role];
    enc.networkPriority = PRIORITY[role];
  });

  try {
    await sender.setParameters(params);
  } catch (e) {
    // networkPriority/priority bazı ortamlarda desteklenmez; yalnızca bit hızı/FPS ile tekrar dene
    encodings.forEach((enc) => {
      delete enc.priority;
      delete enc.networkPriority;
    });
    try {
      await sender.setParameters(params);
    } catch (e2) {
      console.warn("Gönderim parametreleri uygulanamadı:", e2?.message || e2);
    }
  }
}

export function useAdaptiveBandwidth() {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const dataSaver = useSettingsStore((s) => s.dataSaver);

  const autoTierRef = useRef(0);
  const dataSaverRef = useRef(dataSaver);
  const appliedTierRef = useRef(-1);
  const recoverTimerRef = useRef(null);
  const applyRef = useRef(() => {});

  useEffect(() => {
    dataSaverRef.current = dataSaver;
    applyRef.current(true);
  }, [dataSaver]);

  useEffect(() => {
    if (!localParticipant || !room) return;

    const effectiveTier = () => Math.max(autoTierRef.current, dataSaverRef.current ? 1 : 0);

    // force: aynı kademede olsak da yeni yayınlanan track'ler için yeniden uygula
    const apply = async (force = false) => {
      const tier = effectiveTier();
      if (!force && tier === appliedTierRef.current) return;
      appliedTierRef.current = tier;
      const pubs = localParticipant.getTrackPublications();
      await Promise.all(
        pubs.map((pub) => {
          const role = roleOf(pub.source);
          const sender = pub.track?.sender;
          return role && sender ? applyToSender(sender, role, tier) : null;
        }),
      );
    };
    applyRef.current = apply;

    const setAutoTier = (next, announce) => {
      if (next === autoTierRef.current) return;
      const prev = autoTierRef.current;
      autoTierRef.current = next;
      console.log(`📶 Bağlantı kalitesi kademesi: ${TIERS[prev].name} → ${TIERS[next].name}`);
      apply();
      if (announce && next > prev) {
        toast.info(
          next === 2
            ? "Bağlantın çok zayıf: veri kullanımı düşürüldü, konuşman öncelikli."
            : "Bağlantın zayıf: yayın kalitesi düşürüldü, konuşman etkilenmesin diye.",
          { id: "net-quality", duration: 5000 },
        );
      }
    };

    const onQuality = (quality, participant) => {
      if (!participant?.isLocal) return;
      const desired = qualityToTier(quality);
      const current = autoTierRef.current;
      if (desired > current) {
        // Kötüleşme: hemen uygula
        clearTimeout(recoverTimerRef.current);
        recoverTimerRef.current = null;
        setAutoTier(desired, true);
      } else if (desired < current && !recoverTimerRef.current) {
        // İyileşme: titreşim olmasın diye bekle, bir kademe yukarı çık
        recoverTimerRef.current = setTimeout(() => {
          recoverTimerRef.current = null;
          setAutoTier(Math.max(desired, autoTierRef.current - 1), false);
        }, RECOVER_MS);
      } else if (desired >= current && recoverTimerRef.current) {
        // Tekrar kötüleşti: bekleyen iyileşmeyi iptal et
        clearTimeout(recoverTimerRef.current);
        recoverTimerRef.current = null;
      }
    };

    const onPublished = () => apply(true);

    room.on(RoomEvent.ConnectionQualityChanged, onQuality);
    localParticipant.on(ParticipantEvent.LocalTrackPublished, onPublished);
    apply(true);

    return () => {
      room.off(RoomEvent.ConnectionQualityChanged, onQuality);
      localParticipant.off(ParticipantEvent.LocalTrackPublished, onPublished);
      clearTimeout(recoverTimerRef.current);
      recoverTimerRef.current = null;
      applyRef.current = () => {};
    };
  }, [localParticipant, room]);
}
