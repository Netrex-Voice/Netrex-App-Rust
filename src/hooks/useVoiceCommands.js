import { useEffect, useRef } from "react";
import { ref, onChildAdded, remove } from "firebase/database";
import { rtdb } from "@/src/lib/firebase";
import {
  VOICE_COMMAND_PERMISSION,
  VOICE_COMMAND_TYPES,
  issuerHasPermission,
} from "@/src/utils/voiceCommands";

const MAX_COMMAND_AGE_MS = 60_000; // bundan eski komutlar (ör. uygulama kapalıyken yazılmış) yok sayılır

/**
 * 🎛️ Bana gelen sesli kanal komutlarını (taşı / sesli kanaldan at) dinler.
 * Uygulamada TEK KEZ, oturum açıkken çalışmalıdır (app/page.js).
 *
 * Her komut: tek kullanımlık (okunur okunmaz silinir), taze olmalı ve GÖNDERENİN YETKİSİ doğrulanmalı.
 *
 * onMove(cmd)       : { serverId, toChannelId, byName }
 * onDisconnect(cmd) : { serverId, byName }
 */
export function useVoiceCommands({ userId, onMove, onDisconnect }) {
  // Callback'ler her render'da değişebilir; dinleyiciyi yeniden kurmamak için ref'te tutulur
  const handlersRef = useRef({ onMove, onDisconnect });
  useEffect(() => {
    handlersRef.current = { onMove, onDisconnect };
  }, [onMove, onDisconnect]);

  useEffect(() => {
    if (!userId) return;

    const handled = new Set();
    const unsub = onChildAdded(
      ref(rtdb, `voice_commands/${userId}`),
      async (snap) => {
        const key = snap.key;
        if (!key || handled.has(key)) return;
        handled.add(key);

        const cmd = snap.val();
        // Tek kullanımlık: hemen sil (işlenemese bile bir daha denenmesin)
        remove(snap.ref).catch(() => {});

        if (!cmd || typeof cmd !== "object") return;
        const permission = VOICE_COMMAND_PERMISSION[cmd.type];
        if (!permission || !cmd.serverId || !cmd.by || cmd.by === userId) return;

        // Taze mi? (ts sunucu saatidir; yerel saat farkı için ±60 sn tolerans)
        const age = Date.now() - Number(cmd.ts || 0);
        if (!cmd.ts || age > MAX_COMMAND_AGE_MS || age < -MAX_COMMAND_AGE_MS) return;

        // Gönderen gerçekten yetkili mi? (rastgele biri komut yazamaz)
        const allowed = await issuerHasPermission(cmd.serverId, cmd.by, permission);
        if (!allowed) return;

        if (cmd.type === VOICE_COMMAND_TYPES.MOVE) handlersRef.current.onMove?.(cmd);
        else if (cmd.type === VOICE_COMMAND_TYPES.DISCONNECT) handlersRef.current.onDisconnect?.(cmd);
      },
      (error) => console.warn("Sesli komut dinleyicisi hatası (kurallar voice_commands'a izin vermiyor olabilir):", error?.code || error),
    );

    return () => unsub();
  }, [userId]);
}
