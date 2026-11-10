import { useEffect, useRef } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { Track, ConnectionState } from "livekit-client";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useToastStore } from "@/src/store/toastStore";
import { useSoundManagerStore } from "@/src/store/soundManagerStore";
import { FRAME_SIZE, measureFrame, isSpeechLike } from "@/src/utils/speechDetector";

// ============================================
// 🛡️ MIC GUARD — "Sesiniz karşıya gitmiyor" uyarı sistemi
// ============================================
// Sürekli öten bir alarm DEĞİL. Yalnızca gerçek bir kanıt olduğunda, nadiren uyarır:
//
//  A) Mikrofon KAPALI iken kullanıcı konuşuyor (mute/deafen/yönetici susturması).
//     → Mute sırasında LiveKit track'i `enabled=false` yaptığı için mevcut VAD sessizlik duyar.
//       Bu yüzden track'in bağımsız bir KLONU yerel olarak analiz edilir. Ses hiçbir yere
//       gönderilmez, kaydedilmez; sadece "insan sesi benzeri mi" ölçülür.
//       Klavye/fare sesleri speechDetector.js ile elenir (süre + periyodiklik kontrolü).
//  B) Mikrofon AÇIK olması gerekirken çalışmıyor (cihaz koptu, yayınlanamadı, veri akmıyor).
//
// Sinir bozucu olmaması için: konuşma kanıtı, mute sonrası ek süre, uyarılar arası bekleme,
// oturum başına üst sınır ve "odada başka kimse yok" kontrolü vardır.

const CONFIG = {
  SAMPLE_MS: 100,
  // Birikmiş konuşma süresi
  SPEECH_TRIGGER_MS: 2000,
  SPEECH_GAIN_MS: 200, // konuşma benzeri pencere başına
  SPEECH_DECAY_MS: 40, // diğer pencerelerde (konuşmadaki kısa duraklamalara tolerans)
  SPEECH_CAP_MS: 6000,
  // Mute'tan sonra uyarmadan önce beklenecek süre KULLANICI AYARIDIR (settingsStore.micGuardDelaySec):
  // kişi mikrofonu bilerek kapattı, hemen uyarmak sinir bozucu olur.
  MUTED_ALERT_COOLDOWN_MS: 90_000,
  MUTED_MAX_ALERTS_PER_SESSION: 3,
  // Cihaz/yayın sorunu bu kadar sürerse uyar
  HW_PROBLEM_MS: 5000,
  HW_CONNECT_WARMUP_MS: 8000, // odaya girdikten sonra mikrofon yayınlanana kadar bekle
  HW_ALERT_COOLDOWN_MS: 120_000,
  HW_MAX_ALERTS_PER_PROBLEM: 3,
  // Ses seviyesi eşiği UYARLANIR: ortam gürültü tabanı (en düşük seviye) ölçülür, eşik = taban × çarpan.
  MIN_THRESHOLD: 0.004,
  MAX_THRESHOLD: 0.03,
  FLOOR_INITIAL: 0.01,
  FLOOR_RISE_RATE: 0.002, // taban yukarı doğru çok yavaş kayar (sürekli konuşma tabanı şişirmesin)
  FLOOR_MULTIPLIER: 3,
  TOAST_DURATION_MS: 12000,
};

const TOAST_ID = "mic-guard";
const ALERT_SOUND = "friend-notificaiton"; // uyarı çıkarken çalan kısa bildirim sesi

function playUiSound(name) {
  try {
    const volume = (useSettingsStore.getState().sfxVolume ?? 100) / 100;
    if (volume > 0) useSoundManagerStore.getState().play(name, volume);
  } catch (e) {}
}

const MESSAGES = {
  muted: {
    title: "Mikrofonunuz kapalı",
    message: "Konuşuyorsunuz ama sesiniz karşıya gitmiyor.",
    speech: "Mikrofonunuz kapalı. Sesiniz gitmiyor.",
    action: {
      label: "Mikrofonu aç",
      run: () => {
        useSettingsStore.getState().toggleMute();
        playUiSound("unmute"); // BottomControls'taki mute düğmesiyle aynı ses
      },
    },
  },
  deafened: {
    title: "Sağırlaştırma açık",
    message: "Mikrofonunuz da kapalı, sesiniz karşıya gitmiyor.",
    speech: "Sağırlaştırma açık. Sesiniz karşıya gitmiyor.",
    action: {
      label: "Sağırlaştırmayı kapat",
      run: () => {
        useSettingsStore.getState().toggleDeaf();
        playUiSound("undeafen");
      },
    },
  },
  serverMuted: {
    title: "Susturuldunuz",
    message: "Bir yönetici sizi susturdu, sesiniz karşıya gitmiyor.",
    speech: "Bir yönetici sizi susturdu. Sesiniz karşıya gitmiyor.",
  },
  serverDeafened: {
    title: "Sağırlaştırıldınız",
    message: "Bir yönetici sizi sağırlaştırdı, sesiniz karşıya gitmiyor.",
    speech: "Bir yönetici sizi sağırlaştırdı. Sesiniz karşıya gitmiyor.",
  },
  notPublished: {
    title: "Mikrofonunuz bağlanamadı",
    message: "Mikrofon odaya bağlanamadı, sesiniz karşıya gitmiyor.",
    speech: "Mikrofonunuz bağlanamadı. Sesiniz karşıya gitmiyor.",
  },
  deviceLost: {
    title: "Mikrofon bağlantısı koptu",
    message: "Mikrofon cihazınızla bağlantı kesildi, sesiniz karşıya gitmiyor.",
    speech: "Mikrofon bağlantısı koptu. Sesiniz karşıya gitmiyor.",
  },
  trackMuted: {
    title: "Mikrofonunuz kapalı görünüyor",
    message: "Mikrofonunuz açık olmasına rağmen sesiniz karşıya gitmiyor.",
    speech: "Mikrofonunuz kapalı görünüyor. Sesiniz karşıya gitmiyor.",
  },
  noData: {
    title: "Mikrofonunuz ses göndermiyor",
    message: "Başka bir uygulama mikrofonunuzu kullanıyor olabilir. Sesiniz karşıya gitmiyor.",
    speech: "Mikrofonunuz ses göndermiyor. Sesiniz karşıya gitmiyor.",
  },
  permissionDenied: {
    title: "Mikrofon izni verilmedi",
    message: "Mikrofondan ses alınamadı, sesiniz karşıya gitmiyor. Tarayıcı/sistem mikrofon iznini kontrol edin.",
    speech: "Mikrofon izni verilmedi. Sesiniz karşıya gitmiyor.",
  },
  deviceNotFound: {
    title: "Mikrofon bulunamadı",
    message: "Mikrofondan ses alınamadı, sesiniz karşıya gitmiyor. Bir mikrofon takılı olduğundan emin olun.",
    speech: "Mikrofon bulunamadı. Sesiniz karşıya gitmiyor.",
  },
  deviceInUse: {
    title: "Mikrofon başka uygulamada kullanılıyor",
    message: "Mikrofondan ses alınamadı, sesiniz karşıya gitmiyor. Mikrofonu kullanan diğer uygulamayı kapatın.",
    speech: "Mikrofon başka bir uygulamada kullanılıyor. Sesiniz karşıya gitmiyor.",
  },
  captureFailed: {
    title: "Mikrofondan ses alınamadı",
    message: "Mikrofon başlatılamadı, sesiniz karşıya gitmiyor.",
    speech: "Mikrofondan ses alınamadı. Sesiniz karşıya gitmiyor.",
  },
};

function speak(text) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const { ttsVolume, ttsVoiceURI } = useSettingsStore.getState();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "tr-TR";
    // Güvenlik uyarısı: ses çok kısık ayarlanmış olsa bile duyulabilir kalsın
    utterance.volume = Math.max(0.4, Math.min(1, (ttsVolume ?? 80) / 100));
    const trVoices = window.speechSynthesis.getVoices().filter((v) => /tr/i.test(v.lang));
    const voice = trVoices.find((v) => v.voiceURI === ttsVoiceURI) || trVoices[0];
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    // TTS yoksa görsel bildirim yeterli
  }
}

function showDesktopNotification(title, body) {
  try {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted" &&
      !document.hasFocus()
    ) {
      const n = new Notification(title, { body, silent: true });
      setTimeout(() => n.close(), 8000);
    }
  } catch (e) {}
}

function dismissAlertToast() {
  useToastStore.getState().dismiss(TOAST_ID);
}

function raiseAlert(kind) {
  const def = MESSAGES[kind];
  if (!def) return;
  const { micGuardEnabled, micGuardVoice } = useSettingsStore.getState();
  if (!micGuardEnabled) return;

  const store = useToastStore.getState();
  store.dismiss(TOAST_ID); // aynı id'li eski uyarı varsa yenile
  store.addToast({
    id: TOAST_ID,
    type: "warning",
    title: def.title,
    message: def.message,
    duration: CONFIG.TOAST_DURATION_MS,
    ...(def.action
      ? { action: { label: def.action.label, onClick: def.action.run } }
      : {}),
  });

  playUiSound(ALERT_SOUND);
  if (micGuardVoice) speak(def.speech);
  showDesktopNotification(def.title, def.message);
}

/**
 * Mikrofon başlatılamadığında (izin yok, cihaz yok, cihaz meşgul...) hook dışından uyarı verir.
 * `error` bir LiveKit/getUserMedia hatası olabilir; türüne göre doğru mesaj seçilir.
 */
export function notifyMicFailure(error) {
  const name = error?.name || "";
  const msg = String(error?.message || "");
  let kind = "captureFailed";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || /permission|denied/i.test(msg)) {
    kind = "permissionDenied";
  } else if (name === "NotFoundError" || name === "OverconstrainedError" || /not found|requested device/i.test(msg)) {
    kind = "deviceNotFound";
  } else if (name === "NotReadableError" || name === "TrackStartError" || /in use|could not start/i.test(msg)) {
    kind = "deviceInUse";
  }
  raiseAlert(kind);
}

/**
 * LiveKitRoom bağlamı içinde çağrılmalıdır.
 * @param {{serverMuted?: boolean, serverDeafened?: boolean}} opts
 */
export function useMicGuard({ serverMuted = false, serverDeafened = false } = {}) {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const enabled = useSettingsStore((s) => s.micGuardEnabled);

  // Effect'lerin yeniden kurulmaması için güncel değerler ref'te
  const flagsRef = useRef({ serverMuted, serverDeafened });
  useEffect(() => {
    flagsRef.current = { serverMuted, serverDeafened };
  }, [serverMuted, serverDeafened]);

  // ─────────────────────────────────────────────
  // A) Mikrofon kapalıyken konuşma algılama
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !room || !localParticipant) return;

    if (isMicrophoneEnabled) {
      // Mikrofon açıldı: kapalı olma uyarısı artık geçersiz
      dismissAlertToast();
      return;
    }

    let cancelled = false;
    let retryTimer = null;
    let sampleTimer = null;
    let ctx = null;
    let source = null;
    let stream = null;

    const mutedSince = Date.now();
    let alertsThisSession = 0;
    let lastAlertAt = 0;

    // Uyarının şu an verilmesini engelleyen bir sebep var mı?
    const isBlocked = () => {
      const now = Date.now();
      if (room.state !== ConnectionState.Connected) return true;
      if (room.remoteParticipants.size === 0) return true; // duyacak kimse yok
      // Ayar her kontrolde okunur: kaydırıcı değişince anında geçerli olur
      const delayMs = (useSettingsStore.getState().micGuardDelaySec ?? 15) * 1000;
      if (now - mutedSince < delayMs) return true;
      if (alertsThisSession >= CONFIG.MUTED_MAX_ALERTS_PER_SESSION) return true;
      if (lastAlertAt && now - lastAlertAt < CONFIG.MUTED_ALERT_COOLDOWN_MS) return true;
      return false;
    };

    const maybeAlert = () => {
      if (isBlocked()) return;

      const { serverMuted: sm, serverDeafened: sd } = flagsRef.current;
      const { isDeafened } = useSettingsStore.getState();
      const kind = sd ? "serverDeafened" : sm ? "serverMuted" : isDeafened ? "deafened" : "muted";

      alertsThisSession += 1;
      lastAlertAt = Date.now();
      raiseAlert(kind);
    };

    // Analiz için LiveKit track'lerine HİÇ bağlanmayız. Ses işlemcisi bağlıyken track.mediaStreamTrack işlenmiş
    // (mute'ta sessiz) track'i verir; ham track'e erişim de SDK iç durumuna bağlıdır. Bunun yerine kendi ham
    // mikrofon akışımızı seçili cihazla açarız: ses işlemcisi/mute/LiveKit durumundan bağımsız, her zaman gerçek
    // girdiyi ölçer. Akış yalnızca mikrofon KAPALIyken, odada dinleyen biri varken ve bekleme süresi dolunca
    // açılır; analiz yereldir, ses hiçbir yere gönderilmez/kaydedilmez.
    let failures = 0;
    const scheduleRetry = (ms) => {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(start, ms);
    };

    const teardownAudio = () => {
      clearInterval(sampleTimer);
      sampleTimer = null;
      try { source?.disconnect(); } catch (e) {}
      try { stream?.getTracks().forEach((t) => t.stop()); } catch (e) {}
      try { ctx?.close(); } catch (e) {}
      source = null;
      stream = null;
      ctx = null;
    };

    async function start() {
      if (cancelled) return;
      // Gereksiz yere mikrofon açma: dinleyen yoksa veya bekleme süresi dolmadıysa sonra tekrar bak
      if (room.state !== ConnectionState.Connected || room.remoteParticipants.size === 0) {
        scheduleRetry(2000);
        return;
      }
      const delayMs = (useSettingsStore.getState().micGuardDelaySec ?? 15) * 1000;
      const remaining = delayMs - (Date.now() - mutedSince);
      if (remaining > 0) {
        scheduleRetry(Math.min(remaining, 5000) + 50);
        return;
      }

      try {
        const deviceId = useSettingsStore.getState().audioInputId;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            ...(deviceId && deviceId !== "default" ? { deviceId: { ideal: deviceId } } : {}),
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          stream = null;
          return;
        }
        failures = 0;
        const clone = stream.getAudioTracks()[0];
        // Cihaz çıkarılırsa akış biter: kapat ve yeniden dene
        clone.onended = () => {
          if (cancelled) return;
          teardownAudio();
          scheduleRetry(2000);
        };

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        ctx = new AudioCtx();
        source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = FRAME_SIZE;
        source.connect(analyser); // BİLEREK hiçbir yere (destination dahil) bağlanmıyor
        const buf = new Float32Array(FRAME_SIZE);
        let speechMs = 0;
        let floor = CONFIG.FLOOR_INITIAL;

        sampleTimer = setInterval(() => {
          if (ctx.state === "suspended") ctx.resume().catch(() => {});
          analyser.getFloatTimeDomainData(buf);

          const measured = measureFrame(buf);
          // Gürültü tabanı: düşüşte anında takip, yükselişte çok yavaş (alt zarf takibi)
          if (measured.rms < floor) floor = measured.rms;
          else floor += (measured.rms - floor) * CONFIG.FLOOR_RISE_RATE;
          const threshold = Math.max(
            CONFIG.MIN_THRESHOLD,
            Math.min(CONFIG.MAX_THRESHOLD, floor * CONFIG.FLOOR_MULTIPLIER),
          );

          // Klavye/fare gibi kısa, periyodik olmayan sesler "konuşma benzeri" sayılmaz
          if (isSpeechLike(buf, ctx.sampleRate, threshold, measured)) {
            speechMs = Math.min(CONFIG.SPEECH_CAP_MS, speechMs + CONFIG.SPEECH_GAIN_MS);
          } else {
            speechMs = Math.max(0, speechMs - CONFIG.SPEECH_DECAY_MS);
          }

          if (speechMs >= CONFIG.SPEECH_TRIGGER_MS) {
            speechMs = 0;
            maybeAlert();
          }
        }, CONFIG.SAMPLE_MS);
      } catch (e) {
        // İzin yok / cihaz meşgul olabilir: sessizce seyrek tekrar dene (kullanıcıyı uyarı yağmuruna tutma)
        failures += 1;
        if (failures <= 3) console.warn("MicGuard: yerel ses analizi başlatılamadı", e?.message || e);
        teardownAudio();
        scheduleRetry(Math.min(60000, 5000 * failures));
      }
    }

    start();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      teardownAudio();
    };
  }, [enabled, room, localParticipant, isMicrophoneEnabled]);

  // ─────────────────────────────────────────────
  // B) Mikrofon AÇIK olması gerekirken çalışmıyor
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !room || !localParticipant) return;

    let connectedAt = 0;
    let problemKind = null;
    let problemSince = 0;
    let alertsThisProblem = 0;
    let lastAlertAt = 0;
    let alertedThisProblem = false;

    const resetProblem = () => {
      if (alertedThisProblem) {
        dismissAlertToast();
        useToastStore.getState().addToast({
          type: "success",
          title: "Mikrofonunuz çalışıyor",
          message: "Sesiniz tekrar karşıya gidiyor.",
          duration: 4000,
        });
      }
      problemKind = null;
      problemSince = 0;
      alertsThisProblem = 0;
      lastAlertAt = 0;
      alertedThisProblem = false;
    };

    const tick = () => {
      const now = Date.now();
      if (room.state !== ConnectionState.Connected) {
        connectedAt = 0;
        return;
      }
      if (!connectedAt) connectedAt = now;

      const { isMuted, isDeafened } = useSettingsStore.getState();
      const { serverMuted: sm, serverDeafened: sd } = flagsRef.current;
      const intendsOpen = !isMuted && !isDeafened && !sm && !sd;

      let kind = null;
      if (intendsOpen) {
        const pub = localParticipant.getTrackPublication(Track.Source.Microphone);
        const mst = pub?.track?.mediaStreamTrack;
        if (!pub || !pub.track) {
          // Odaya yeni girildiyse mikrofonun yayınlanması için süre tanı
          if (now - connectedAt > CONFIG.HW_CONNECT_WARMUP_MS) kind = "notPublished";
        } else if (mst?.readyState === "ended") {
          kind = "deviceLost";
        } else if (pub.isMuted) {
          kind = "trackMuted";
        } else if (mst?.muted) {
          kind = "noData";
        }
      }

      if (!kind) {
        if (problemKind) resetProblem();
        return;
      }

      if (kind !== problemKind) {
        problemKind = kind;
        problemSince = now;
        alertsThisProblem = 0;
        lastAlertAt = 0;
      }

      if (now - problemSince < CONFIG.HW_PROBLEM_MS) return;
      if (room.remoteParticipants.size === 0) return; // duyacak kimse yok
      if (alertsThisProblem >= CONFIG.HW_MAX_ALERTS_PER_PROBLEM) return;
      if (lastAlertAt && now - lastAlertAt < CONFIG.HW_ALERT_COOLDOWN_MS) return;

      alertsThisProblem += 1;
      lastAlertAt = now;
      alertedThisProblem = true;
      raiseAlert(kind);
    };

    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [enabled, room, localParticipant]);
}
