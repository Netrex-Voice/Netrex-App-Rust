import { useEffect, useRef } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { RoomEvent, Track } from "livekit-client";
import { useSettingsStore } from "@/src/store/settingsStore";
import {
  useVoiceGroupStore,
  computeAudience,
  isReplyActive,
  IDLE_TALK,
  TALK_MODES,
  VOICE_GROUPS,
} from "@/src/store/voiceGroupStore";
import { toast } from "@/src/utils/toast";

/**
 * 🎙️ Konuşma Grupları denetleyicisi — odada TEK KEZ çalışır (ActiveRoom'da bir kez bağlanır).
 *
 * Nasıl çalışır:
 *  - Kimin kimi duyacağını GÖNDEREN belirler: mikrofon yayınımın abonelik izni (setTrackSubscriptionPermissions)
 *    sadece duyabilecek kişilere verilir. Duymaması gerekenlere ses hiç gitmez (bant genişliği de azalır).
 *    Kamera / ekran paylaşımı herkese açık kalır.
 *  - Grup atamaları odadaki herkeste aynıdır: değişiklik data mesajıyla yayınlanır, yeni gelene mevcut durum gönderilir.
 *  - Basılı tut-konuş: "Herkese", "Gruba", "Fısılda" modları basılı tutulduğu sürece sesi geçici olarak genişletir/daraltır.
 *  - Konuştuğum kişilere "sana fısıldıyor" bilgisi gider (kartlarda gösterilir).
 */

export const VG_TOPICS = {
  STATE: "vg_state",
  REQUEST: "vg_request",
  TALK: "vg_talk",
  LISTEN: "vg_listen", // hangi (başka) grupları dinlemek istediğim; gönderenler sesini bana da açar
};

const HEARTBEAT_MS = 8000; // basılı tutarken hedeflere "hâlâ konuşuyorum" bilgisi
const INCOMING_EXPIRE_MS = 20000; // heartbeat kesilirse (bağlantı koptu) gösterge kendiliğinden kapanır
const MAX_PAYLOAD_BYTES = 8 * 1024;
const REPLY_WINDOW_MS = 8000; // fısıltı bittikten sonra yanıt penceresi açık kalma süresi
const HOLD_MAX_MS = 90_000; // basılı tut-konuş en fazla bu kadar sürer (takılma/unutma koruması)
const REPLY_EXTEND_MS = 3000; // yanıt verirken pencere her seferinde bu kadar uzar

const encode = (obj) => new TextEncoder().encode(JSON.stringify(obj));
const decode = (payload) => JSON.parse(new TextDecoder().decode(payload));

function publish(localParticipant, topic, obj, destinationIdentities) {
  try {
    localParticipant?.publishData(encode(obj), {
      topic,
      reliable: true,
      ...(destinationIdentities ? { destinationIdentities } : {}),
    });
  } catch (e) {}
}

// ──────────────────────────────────────
// Eylemler (arayüzden de çağrılır)
// ──────────────────────────────────────
function broadcastState(localParticipant, state, destinationIdentities) {
  publish(
    localParticipant,
    VG_TOPICS.STATE,
    { assignments: state.assignments, version: state.version, versionBy: state.versionBy },
    destinationIdentities,
  );
}

/** Dinlemek istediğim grupları (seviyesi > 0) odaya duyur. */
function announceListen(localParticipant, destinationIdentities) {
  const vols = useSettingsStore.getState().groupListenVolumes || {};
  const groups = VOICE_GROUPS.filter((g) => (Number(vols[g.id]) || 0) > 0).map((g) => g.id);
  // Hiç grup dinlemiyorsam ve yeni gelene gönderiyorsam gerek yok (varsayılan zaten "dinlemiyor")
  if (destinationIdentities && groups.length === 0) return;
  publish(localParticipant, VG_TOPICS.LISTEN, { groups }, destinationIdentities);
}

// Odanın DIŞINDAN (örn. sol kanal listesi) grup işlemi yapabilmek için: odadaki hook kendini buraya kaydeder.
let bridgeParticipant = null;
export const groupActions = {
  /** Bir odadayım ve gruplar çalışıyor mu? */
  isReady: () => !!bridgeParticipant,
  /** Kişi(ler)i bir gruba taşı */
  move: (identities, groupId) => moveToGroup(bridgeParticipant, identities, groupId),
  /** Onunla ayrı konuş: ben ve o boş bir gruba geçeriz */
  splitWith: (identity, allIdentities) => splitWith(bridgeParticipant, identity, allIdentities),
};

/** Kişi(ler)i bir gruba taşı ve odaya duyur. */
export function moveToGroup(localParticipant, identities, groupId) {
  if (!localParticipant) return;
  const state = useVoiceGroupStore.getState().assign(identities, groupId, localParticipant.identity);
  broadcastState(localParticipant, state);
}

/** Herkesi tek grupta birleştir ve odaya duyur. */
export function mergeAllGroups(localParticipant) {
  if (!localParticipant) return;
  const state = useVoiceGroupStore.getState().mergeAll(localParticipant.identity);
  broadcastState(localParticipant, state);
  toast.success("Herkes tek grupta birleşti.");
}

/** Basılı tut-konuş başlat/bitir (arayüz düğmeleri ve kısayol tuşları aynı yolu kullanır). */
export function startTalk(talk) {
  useVoiceGroupStore.getState().setTalk(talk);
}
export function endTalk() {
  useVoiceGroupStore.getState().setTalk(IDLE_TALK);
}

/** Fısıltı: sadece bu kişi duyar. Kişi hatırlanır, böylece "Fısılda" kısayol tuşu da son fısıldanan kişiye çalışır. */
export function startWhisper(identity) {
  const s = useVoiceGroupStore.getState();
  s.setWhisperTarget(identity);
  s.setTalk({ mode: TALK_MODES.WHISPER, groupId: null });
}

/** Tek tıkla "onunla ayrı konuş": ben ve o, boş bir gruba geçeriz. */
export function splitWith(localParticipant, identity, allIdentities) {
  if (!localParticipant || !identity) return;
  const { assignments } = useVoiceGroupStore.getState();
  const groupOf = (id) => assignments[id] ?? 1;
  const taken = new Set(allIdentities.filter((id) => id !== identity && id !== localParticipant.identity).map(groupOf));
  const free = VOICE_GROUPS.find((g) => g.id !== 1 && !taken.has(g.id)) || VOICE_GROUPS[1];
  const state = useVoiceGroupStore.getState().assign([localParticipant.identity, identity], free.id, localParticipant.identity);
  broadcastState(localParticipant, state);
}

// ──────────────────────────────────────
// Denetleyici hook
// ──────────────────────────────────────
export function useVoiceGroups() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const identity = localParticipant?.identity;

  // Gelen son durumu / son uygulanan izin anahtarını tut (gereksiz sinyal gönderme)
  const lastPermKeyRef = useRef("all");
  const lastAudienceRef = useRef([]); // son bildirim gönderdiğim kişiler (bitişte onlara haber verilir)

  // ── 1) Grup durumu senkronu ──────────────
  useEffect(() => {
    if (!room || !identity || !localParticipant) return;
    const store = () => useVoiceGroupStore.getState();

    const onData = (payload, participant, _kind, topic) => {
      if (!participant || !payload || payload.byteLength > MAX_PAYLOAD_BYTES) return;
      if (
        topic !== VG_TOPICS.STATE &&
        topic !== VG_TOPICS.REQUEST &&
        topic !== VG_TOPICS.TALK &&
        topic !== VG_TOPICS.LISTEN
      ) {
        return;
      }
      const senderId = participant.identity;
      if (!senderId || senderId === identity) return;

      if (topic === VG_TOPICS.REQUEST) {
        // Yeni gelen durumu istiyor: bende varsa sadece ona gönder
        const s = store();
        if (s.version > 0) broadcastState(localParticipant, s, [senderId]);
        announceListen(localParticipant, [senderId]);
        return;
      }

      let msg;
      try {
        msg = decode(payload);
      } catch (e) {
        return;
      }
      if (!msg || typeof msg !== "object") return;

      if (topic === VG_TOPICS.LISTEN) {
        const groups = Array.isArray(msg.groups)
          ? msg.groups.filter((g) => VOICE_GROUPS.some((v) => v.id === g))
          : [];
        store().setListener(senderId, groups);
        return;
      }

      if (topic === VG_TOPICS.STATE) {
        if (typeof msg.version !== "number" || typeof msg.assignments !== "object") return;
        // Sadece geçerli grup numaralarını kabul et (bozuk/kötü niyetli veri)
        const clean = {};
        for (const [id, g] of Object.entries(msg.assignments || {})) {
          if (VOICE_GROUPS.some((v) => v.id === g)) clean[id] = g;
        }
        store().applyRemote({ assignments: clean, version: msg.version, versionBy: String(msg.versionBy || "") });
        return;
      }

      // TALK: biri bana (veya grubuma) özel konuşuyor
      if (msg.mode === TALK_MODES.WHISPER || msg.mode === TALK_MODES.GROUP || msg.mode === TALK_MODES.ALL) {
        const prevMode = store().incoming[senderId]?.mode;
        const fresh = prevMode !== msg.mode;
        store().setIncoming(senderId, msg.mode);
        // Bana fısıldıyor: yanıtım otomatik olarak sadece ona gider (cevap herkese yayılmasın)
        // Sadece YENİ başlayan fısıltıda açılır: heartbeat'ler (8 sn'de bir) kullanıcının ✕ ile kapattığı yanıtı geri açmasın
        if (fresh && msg.mode === TALK_MODES.WHISPER && useSettingsStore.getState().whisperAutoReply !== false) {
          store().setReplyTo(senderId, Infinity);
          toast.info(`${participant.name || "Biri"} sana fısıldıyor — cevabın sadece ona gider (kartındaki ✕ ile iptal)`, {
            id: `vg-whisper-${senderId}`,
            duration: 4500,
          });
        }
      } else {
        const wasWhisper = store().incoming[senderId]?.mode === TALK_MODES.WHISPER;
        store().clearIncoming(senderId);
        // Fısıltı bitti: yanıt penceresi kısa süre daha açık kalır
        if (wasWhisper && store().replyTo?.id === senderId) {
          store().setReplyTo(senderId, Date.now() + REPLY_WINDOW_MS);
        }
      }
    };

    // Odaya girince mevcut durumu iste
    publish(localParticipant, VG_TOPICS.REQUEST, { t: Date.now() });

    // Yeni biri girince ona mevcut durumu gönder
    const onJoin = (p) => {
      const s = store();
      if (s.version > 0 && p?.identity) broadcastState(localParticipant, s, [p.identity]);
      if (p?.identity) announceListen(localParticipant, [p.identity]);
    };
    const onLeave = (p) => {
      if (!p?.identity) return;
      store().clearIncoming(p.identity);
      store().setListener(p.identity, null);
      if (store().replyTo?.id === p.identity) store().setReplyTo(null);
      // Fısıltı hedefi odadan çıktıysa seçim kalkar (yoksa tuş sessizce kimseye gitmez)
      if (store().whisperTargetId === p.identity) store().setWhisperTarget(null);
    };
    store().setLocalIdentity(identity);
    bridgeParticipant = localParticipant;

    // Dinleme ayarım değişince odaya duyur; girişte de mevcut ayarımı bildir
    announceListen(localParticipant, [...room.remoteParticipants.values()].map((p) => p.identity));
    const unsubListen = useSettingsStore.subscribe((state, prev) => {
      if (state.groupListenVolumes !== prev.groupListenVolumes) announceListen(localParticipant);
    });

    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.ParticipantConnected, onJoin);
    room.on(RoomEvent.ParticipantDisconnected, onLeave);

    // Heartbeat gelmeyen göstergeleri temizle
    const expireTimer = setInterval(() => {
      const { incoming, clearIncoming } = store();
      const now = Date.now();
      Object.entries(incoming).forEach(([id, v]) => {
        if (now - v.at > INCOMING_EXPIRE_MS) {
          clearIncoming(id);
          // Bitiş mesajı kaybolduysa yanıt penceresi sonsuza kadar açık kalmasın
          const r = store().replyTo;
          if (r?.id === id && r.until === Infinity) store().setReplyTo(id, now + REPLY_WINDOW_MS);
        }
      });
    }, 5000);

    return () => {
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.ParticipantConnected, onJoin);
      room.off(RoomEvent.ParticipantDisconnected, onLeave);
      if (bridgeParticipant === localParticipant) bridgeParticipant = null;
      unsubListen();
      clearInterval(expireTimer);
    };
  }, [room, identity, localParticipant]);

  // ── 2) Mikrofon izinlerini duruma göre uygula ──────────────
  useEffect(() => {
    if (!room || !identity || !localParticipant) return;

    let timer = null;
    const apply = () => {
      timer = null;
      try {
        const remotes = [...room.remoteParticipants.values()];
        const remoteIds = remotes.map((p) => p.identity);
        const allowed = computeAudience(identity, remoteIds, useVoiceGroupStore.getState());

        // Herkes duyabiliyorsa varsayılan davranışa dön (özellik kullanılmıyorsa hiçbir şey değişmez)
        if (remoteIds.every((id) => allowed.has(id))) {
          if (lastPermKeyRef.current !== "all") {
            localParticipant.setTrackSubscriptionPermissions(true, []);
            lastPermKeyRef.current = "all";
          }
          return;
        }

        // Mikrofon DIŞINDaki yayınlarım (kamera, ekran paylaşımı) herkese açık kalır
        const openSids = [];
        localParticipant.trackPublications.forEach((pub) => {
          if (pub.source !== Track.Source.Microphone && pub.trackSid) openSids.push(pub.trackSid);
        });

        const perms = remotes.map((p) =>
          allowed.has(p.identity)
            ? { participantIdentity: p.identity, allowAll: true }
            : { participantIdentity: p.identity, allowAll: false, allowedTrackSids: openSids },
        );
        const key = JSON.stringify(perms);
        if (key === lastPermKeyRef.current) return;
        localParticipant.setTrackSubscriptionPermissions(false, perms);
        lastPermKeyRef.current = key;
      } catch (e) {
        console.warn("Konuşma grubu izinleri uygulanamadı:", e);
      }
    };
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(apply, 30);
    };

    const unsub = useVoiceGroupStore.subscribe((state, prev) => {
      if (
        state.assignments !== prev.assignments ||
        state.listeners !== prev.listeners ||
        state.talk !== prev.talk ||
        state.whisperTargetId !== prev.whisperTargetId ||
        state.replyTo?.id !== prev.replyTo?.id
      ) {
        schedule();
      }
    });
    const events = [
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.LocalTrackPublished, // yeni kamera/ekran yayınım izin listesine girmeli
      RoomEvent.LocalTrackUnpublished,
    ];
    events.forEach((e) => room.on(e, schedule));
    // Yeniden bağlanınca izinleri sunucuya tekrar gönder (önbellek anahtarı sıfırlanır)
    const onReconnected = () => {
      lastPermKeyRef.current = "";
      schedule();
    };
    room.on(RoomEvent.Reconnected, onReconnected);
    schedule();

    return () => {
      unsub();
      events.forEach((e) => room.off(e, schedule));
      room.off(RoomEvent.Reconnected, onReconnected);
      if (timer) clearTimeout(timer);
    };
  }, [room, identity, localParticipant]);

  // ── 3) Kısayol tuşları (basılı tut) ──────────────
  const activeActionRef = useRef(null);
  useEffect(() => {
    const api = typeof window !== "undefined" ? window.netrex : null;
    if (!api?.onHotkeyTriggered || !room) return;

    const resolveTalk = (action) => {
      const store = useVoiceGroupStore.getState();
      if (action === "talk-all") return { mode: TALK_MODES.ALL, groupId: null };
      if (action === "talk-whisper") {
        const target = store.whisperTargetId;
        if (!target || !room.remoteParticipants.has(target)) {
          toast.info("Kısayol, en son fısıldadığın kişiye çalışır. Önce bir kişinin kartındaki kulak simgesini basılı tutarak fısılda.");
          return null;
        }
        return { mode: TALK_MODES.WHISPER, groupId: null };
      }
      const m = action.match(/^talk-group-(\d+)$/);
      if (m) {
        const groupId = Number(m[1]);
        if (!VOICE_GROUPS.some((g) => g.id === groupId)) return null;
        return { mode: TALK_MODES.GROUP, groupId };
      }
      return null;
    };

    const cleanup = api.onHotkeyTriggered((action) => {
      if (typeof action !== "string") return;
      if (action.startsWith("hold-start-")) {
        const name = action.slice("hold-start-".length);
        const talk = resolveTalk(name);
        if (!talk) return;
        activeActionRef.current = name;
        startTalk(talk);
      } else if (action.startsWith("hold-end-")) {
        const name = action.slice("hold-end-".length);
        // Sadece en son başlatılan tuş bırakılınca bitir (başka tuş araya girdiyse onu bozma)
        if (activeActionRef.current === name) {
          activeActionRef.current = null;
          endTalk();
        }
      }
    });
    return () => {
      cleanup?.();
      activeActionRef.current = null;
    };
  }, [room]);

  // ── 4) Konuşma modu değişince hedeflere bildir (+ heartbeat) ──────────────
  useEffect(() => {
    if (!room || !identity || !localParticipant) return;
    let heartbeat = null;

    // Şu an kime, hangi modda konuşuyorum? Basılı tuş > fısıltıya otomatik yanıt (sadece KONUŞURKEN bildirilir)
    const effectiveMode = (s, remoteIds) => {
      if (s.talk.mode !== TALK_MODES.NORMAL) return s.talk.mode;
      const speaking = !!useSettingsStore.getState().localIsSpeaking;
      return speaking && isReplyActive(s.replyTo, remoteIds) ? TALK_MODES.WHISPER : TALK_MODES.NORMAL;
    };

    const notify = () => {
      const s = useVoiceGroupStore.getState();
      const remoteIds = [...room.remoteParticipants.values()].map((p) => p.identity);
      const mode = effectiveMode(s, remoteIds);

      if (mode === TALK_MODES.NORMAL) {
        if (lastAudienceRef.current.length) {
          publish(localParticipant, VG_TOPICS.TALK, { mode: TALK_MODES.NORMAL }, lastAudienceRef.current);
          lastAudienceRef.current = [];
        }
        return;
      }
      const audience = [...computeAudience(identity, remoteIds, s)];
      // Daha önce bildirilen ama artık kapsama girmeyenlere kapanış gönder
      const dropped = lastAudienceRef.current.filter((id) => !audience.includes(id));
      if (dropped.length) publish(localParticipant, VG_TOPICS.TALK, { mode: TALK_MODES.NORMAL }, dropped);
      lastAudienceRef.current = audience;
      if (audience.length) publish(localParticipant, VG_TOPICS.TALK, { mode }, audience);
    };

    // Mod değişince bildir; konuşma sürdükçe heartbeat gönder
    const refresh = () => {
      notify();
      clearInterval(heartbeat);
      const s = useVoiceGroupStore.getState();
      const remoteIds = [...room.remoteParticipants.values()].map((p) => p.identity);
      heartbeat = effectiveMode(s, remoteIds) === TALK_MODES.NORMAL ? null : setInterval(notify, HEARTBEAT_MS);
    };

    const unsub = useVoiceGroupStore.subscribe((state, prev) => {
      if (state.talk !== prev.talk || state.replyTo?.id !== prev.replyTo?.id) refresh();
    });
    // Yanıt penceresindeyken konuşmaya başlayınca / susunca karşı tarafa haber ver
    const unsubSpeaking = useSettingsStore.subscribe((state, prev) => {
      if (state.localIsSpeaking !== prev.localIsSpeaking && useVoiceGroupStore.getState().replyTo) refresh();
    });

    return () => {
      unsub();
      unsubSpeaking();
      clearInterval(heartbeat);
      // Bileşen sökülürken açık bir bildirim kalmasın
      if (lastAudienceRef.current.length) {
        publish(localParticipant, VG_TOPICS.TALK, { mode: TALK_MODES.NORMAL }, lastAudienceRef.current);
        lastAudienceRef.current = [];
      }
    };
  }, [room, identity, localParticipant]);

  // ── 4b) Yanıt penceresi: konuştukça uzar, susunca kapanır ──────────────
  useEffect(() => {
    if (!room) return;
    const timer = setInterval(() => {
      const s = useVoiceGroupStore.getState();
      const r = s.replyTo;
      if (!r || r.until === Infinity) return; // hâlâ fısıldıyor: süre işlemez
      const now = Date.now();
      if (now >= r.until) {
        s.setReplyTo(null);
      } else if (useSettingsStore.getState().localIsSpeaking && r.until < now + REPLY_EXTEND_MS) {
        s.setReplyTo(r.id, now + REPLY_EXTEND_MS); // sohbet sürüyor
      }
    }, 500);
    return () => clearInterval(timer);
  }, [room]);

  // ── 4c) Takılı kalma bekçisi: basılı tut modu çok uzun sürerse (tuş takıldı / unutuldu) otomatik bırak ──────────────
  useEffect(() => {
    if (!room) return;
    let timer = null;
    const unsub = useVoiceGroupStore.subscribe((state, prev) => {
      if (state.talk === prev.talk) return;
      clearTimeout(timer);
      if (state.talk.mode === TALK_MODES.NORMAL) return;
      timer = setTimeout(() => {
        endTalk();
        toast.info("Basılı tut konuşma 90 saniye sonra otomatik kapatıldı.");
      }, HOLD_MAX_MS);
    });
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, [room]);

  // ── 4d) Otomatik yanıt ayarı kapatılırsa açık yanıt penceresi de kapanır ──────────────
  useEffect(() => {
    return useSettingsStore.subscribe((state, prev) => {
      if (prev.whisperAutoReply !== false && state.whisperAutoReply === false) {
        useVoiceGroupStore.getState().setReplyTo(null);
      }
    });
  }, []);

  // ── 5) Odadan çıkınca her şeyi sıfırla ──────────────
  useEffect(() => {
    if (!room) return;
    const reset = () => {
      useVoiceGroupStore.getState().reset();
      lastPermKeyRef.current = "all";
    };
    room.on(RoomEvent.Disconnected, reset);
    return () => {
      room.off(RoomEvent.Disconnected, reset);
      reset();
    };
  }, [room]);
}
