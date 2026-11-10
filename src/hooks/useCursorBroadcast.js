import { useEffect, useRef, useCallback } from 'react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import { useCursorShareStore } from '@/src/store/cursorShareStore';
import {
  CURSOR_TOPICS,
  sendPointingRequest,
  sendPointingGrant,
  sendPointingDeny,
  sendPointingRelease,
} from '@/src/hooks/useCursorShareController';

/**
 * 🖱️ Cursor Broadcasting Hook (video kutusu başına)
 *
 * Ekran paylaşımı yapan kullanıcının mouse pozisyonunu LiveKit Data Channel üzerinden
 * diğer katılımcılara gönderir ve izin eylemlerini (iste / ver / reddet) sunar.
 *
 * NOT: Gelen mesajların işlenmesi, overlay senkronu ve temizlik artık burada DEĞİL;
 * odada tek kez çalışan useCursorShareController'dadır. Bu hook birden çok kutuda
 * çağrılabilir, bu yüzden global yan etki (dinleyici, overlay kapatma) içermemelidir.
 */

const CURSOR_SEND_INTERVAL = 33; // ~30fps

export function useCursorBroadcast({ isScreenSharing = false }) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  const shareMyCursor = useCursorShareStore(s => s.shareMyCursor);
  const setIsBroadcasting = useCursorShareStore(s => s.setIsBroadcasting);
  const allowedPointers = useCursorShareStore(s => s.allowedPointers);
  const pointingRequests = useCursorShareStore(s => s.pointingRequests);
  const myPermissions = useCursorShareStore(s => s.myPermissions);

  const lastSentRef = useRef(0);
  const lastPosRef = useRef({ x: -1, y: -1 });
  const isActiveRef = useRef(false);

  // ──────────────────────────────────────
  // Yayıncının mouse konumunu gönder
  // ──────────────────────────────────────
  useEffect(() => {
    if (!isScreenSharing || !shareMyCursor || !room || !localParticipant) {
      if (isActiveRef.current) {
        isActiveRef.current = false;
        setIsBroadcasting(false);
        try {
          localParticipant?.publishData(
            new TextEncoder().encode(JSON.stringify({
              type: CURSOR_TOPICS.HIDE,
              participantId: localParticipant?.identity,
            })),
            { topic: CURSOR_TOPICS.HIDE, reliable: true },
          );
        } catch (e) {}
      }
      return;
    }

    isActiveRef.current = true;
    setIsBroadcasting(true);

    let metadata = {};
    try {
      metadata = localParticipant.metadata ? JSON.parse(localParticipant.metadata) : {};
    } catch (e) {}

    let mouseTracker = null;

    const sendCursorPosition = (x, y, screenWidth, screenHeight) => {
      // Mouse hareket etmediyse boşuna veri gönderme
      if (lastPosRef.current.x === x && lastPosRef.current.y === y) return;

      const now = Date.now();
      if (now - lastSentRef.current < CURSOR_SEND_INTERVAL) return;

      lastSentRef.current = now;
      lastPosRef.current = { x, y };

      try {
        localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify({
            type: CURSOR_TOPICS.POSITION,
            participantId: localParticipant.identity,
            targetId: localParticipant.identity,
            x: x / screenWidth,
            y: y / screenHeight,
            screenWidth,
            screenHeight,
            displayName: metadata.displayName || localParticipant.name || localParticipant.identity,
            color: metadata.profileColor || '#6366f1',
          })),
          { topic: CURSOR_TOPICS.POSITION, reliable: false },
        );
      } catch (error) {}
    };

    if (typeof window !== 'undefined' && window.netrex?.getMousePosition) {
      mouseTracker = setInterval(async () => {
        try {
          const pos = await window.netrex.getMousePosition();
          if (pos) sendCursorPosition(pos.x, pos.y, pos.screenWidth, pos.screenHeight);
        } catch (e) {}
      }, CURSOR_SEND_INTERVAL);
    } else {
      const handleMouseMove = (e) => {
        sendCursorPosition(
          e.screenX || e.clientX,
          e.screenY || e.clientY,
          window.screen.width,
          window.screen.height,
        );
      };
      document.addEventListener('mousemove', handleMouseMove, { passive: true });
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        isActiveRef.current = false;
        setIsBroadcasting(false);
      };
    }

    // NOT: Burada overlay KAPATILMAZ. Bu effect bağımlılıklar değiştikçe (ör. localParticipant
    // nesnesi yenilenince) yeniden çalışır; overlay'in ömrünü useCursorShareController yönetir.
    return () => {
      if (mouseTracker) clearInterval(mouseTracker);
      isActiveRef.current = false;
      setIsBroadcasting(false);
    };
  }, [isScreenSharing, shareMyCursor, room, localParticipant, setIsBroadcasting]);

  // 🤝 İzleyici → yayıncı: işaretçi izni iste
  const requestPointing = useCallback(
    (targetIdentity) => sendPointingRequest(localParticipant, targetIdentity),
    [localParticipant],
  );

  // 🤝 Yayıncı → izleyici: izin ver
  const grantPointing = useCallback(
    (targetIdentity) => sendPointingGrant(localParticipant, room, targetIdentity),
    [localParticipant, room],
  );

  // 🤝 Yayıncı → izleyici: reddet / izni kaldır
  const denyPointing = useCallback(
    (targetIdentity) => sendPointingDeny(localParticipant, targetIdentity),
    [localParticipant],
  );

  // 🤝 İzleyici: kendi işaretlememi kapat / isteği geri çek
  const releasePointing = useCallback(
    (sharerIdentity) => sendPointingRelease(localParticipant, sharerIdentity),
    [localParticipant],
  );

  return {
    isBroadcasting: isActiveRef.current,
    requestPointing, grantPointing, denyPointing, releasePointing,
    myPermissions, allowedPointers, pointingRequests,
  };
}
