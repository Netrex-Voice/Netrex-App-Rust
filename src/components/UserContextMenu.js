import { useEffect, useRef, useState, useMemo } from "react";
import { useServerPermission } from "@/src/hooks/useServerPermission";
import { useRoomContext, useLocalParticipant, useParticipants } from "@livekit/components-react";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import { useFriendStore } from "@/src/store/friendStore";
import VolumeSlider from "@/src/components/VolumeSlider";
import ModerationPanel from "@/src/components/ModerationPanel";
import UserPhoto from "@/src/components/ui/UserPhoto";
import { AvatarFallback } from "@/src/components/ui/Avatar";
import QuickStatusManager from "@/src/components/settings/QuickStatusManager";
import { useVoiceGroupStore, VOICE_GROUPS, DEFAULT_GROUP_ID } from "@/src/store/voiceGroupStore";
import { moveToGroup, splitWith } from "@/src/hooks/useVoiceGroups";
import { WhisperHold } from "@/src/components/active-room/VoiceGroupsUI";
import { Split } from "lucide-react";

/** Sağ tık menüsünde: tek tıkla ayrı konuş + gruba taşı + basılı tut fısılda */
function VoiceGroupQuickActions({ participant, onDone }) {
  const { localParticipant } = useLocalParticipant();
  const groupId = useVoiceGroupStore((s) => s.assignments[participant.identity] ?? DEFAULT_GROUP_ID);
  const participants = useParticipants();
  const myGroupId = useVoiceGroupStore((s) =>
    s.localIdentity ? (s.assignments[s.localIdentity] ?? DEFAULT_GROUP_ID) : DEFAULT_GROUP_ID,
  );
  const together = groupId === myGroupId;

  return (
    <div className="px-2 space-y-2">
      <div className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider">Konuşma Grubu</div>
      <div className="flex items-center gap-1.5">
        {VOICE_GROUPS.map((g) => {
          const active = groupId === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                moveToGroup(localParticipant, participant.identity, g.id);
                onDone?.();
              }}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 ${
                active ? "text-white" : "bg-white/5 text-[#949ba4] hover:text-white hover:bg-white/10"
              }`}
              style={active ? { background: g.color, boxShadow: `0 0 10px ${g.color}55` } : undefined}
            >
              {g.name}
            </button>
          );
        })}
      </div>
      {/* Tek tıkla: ben ve o ayrı bir gruba geçeriz */}
      {together && participants.length > 2 && (
        <button
          type="button"
          onClick={() => {
            splitWith(localParticipant, participant.identity, participants.map((p) => p.identity));
            onDone?.();
          }}
          className="w-full py-2 rounded-lg bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/20 hover:bg-indigo-500 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <Split size={14} />
          Onunla ayrı konuş
        </button>
      )}

      {/* Basılı tut: sadece bu kişi duyar (menü açık kalır) */}
      <WhisperHold identity={participant.identity} showLabel className="w-full justify-center" />
    </div>
  );
}

/**
 * ✅ ULTRA-OPTIMIZED UserContextMenu v3.1
 * 
 * Component structure:
 * - VolumeSlider: Isolated (volume slider hareket ettiğinde sadece o re-render)
 * - ModerationPanel: Isolated (status değiştiğinde sadece o re-render)
 * - QuickStatusManager: Local user status management
 * - Main: Minimal state (sadece positioning)
 */
export default function UserContextMenu({
  x,
  y,
  participant,
  onClose,
  isLocal,
  roomName,
}) {
  const menuRef = useRef(null);
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const { currentServer } = useServerStore();
  const { user } = useAuthStore();
  const { friends, incomingRequests, outgoingRequests, sendFriendRequest } = useFriendStore();

  const canMute = useServerPermission("MUTE_MEMBERS");
  const canDeafen = useServerPermission("DEAFEN_MEMBERS");
  const canKick = useServerPermission("KICK_VOICE_MEMBERS");

  // ✅ Cached metadata parse
  const targetMetadata = useMemo(() => {
    try {
      return participant.metadata ? JSON.parse(participant.metadata) : {};
    } catch {
      return {};
    }
  }, [participant.metadata]);

  // ✅ Cached status flags
  const statusFlags = useMemo(() => ({
    isTargetSelfMuted: targetMetadata.isMuted || false,
    isTargetSelfDeafened: targetMetadata.isDeafened || false,
    isTargetServerMuted: targetMetadata.serverMuted || false,
    isTargetServerDeafened: targetMetadata.serverDeafened || false,
    mutedBy: targetMetadata.mutedBy || null,
    deafenedBy: targetMetadata.deafenedBy || null,
  }), [targetMetadata]);

  const [coords, setCoords] = useState({ top: y, left: x });
  const [isPositioned, setIsPositioned] = useState(false);

  // ✅ Akıllı pozisyonlama - gerçek menü boyutunu ÖLÇ, sonra konumla
  useEffect(() => {
    setIsPositioned(false);
    
    // RAF ile DOM ölçümü yap (menü render edildikten sonra)
    const raf = requestAnimationFrame(() => {
      const menu = menuRef.current;
      if (!menu) return;

      const rect = menu.getBoundingClientRect();
      const mWidth = rect.width || 288;
      const mHeight = rect.height || 400;
      
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      const PADDING = 8; // Ekran kenarından minimum boşluk

      let newLeft = x;
      let newTop = y;

      // Sağ kenardan taşıyorsa sola kaydır
      if (newLeft + mWidth > viewW - PADDING) {
        newLeft = x - mWidth;
      }
      
      // Sol kenardan taşıyorsa sağa çek
      if (newLeft < PADDING) {
        newLeft = PADDING;
      }

      // Alt kenardan taşıyorsa yukarı kaydır
      if (newTop + mHeight > viewH - PADDING) {
        newTop = viewH - mHeight - PADDING;
      }
      
      // Üst kenardan taşıyorsa aşağı çek
      if (newTop < PADDING) {
        newTop = PADDING;
      }

      setCoords({ top: newTop, left: newLeft });
      setIsPositioned(true);
    });

    return () => cancelAnimationFrame(raf);
  }, [x, y]);

  // Outside click + ESC handler
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };

    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] w-72 bg-[#0d0e10] border border-white/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.05)] p-3 flex flex-col gap-2 select-none overflow-y-auto custom-scrollbar"
      style={{ 
        top: coords.top, 
        left: coords.left,
        maxHeight: 'calc(100vh - 16px)',
        opacity: isPositioned ? 1 : 0,
        transform: isPositioned ? 'scale(1)' : 'scale(0.95)',
        transition: 'opacity 150ms ease-out, transform 150ms ease-out',
        transformOrigin: 'top left',
      }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header - User Info */}
      <div className="flex items-center gap-3 px-2 pb-3 border-b border-white/[0.06]">
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-md opacity-40"></div>
          <UserPhoto
            uid={participant.identity}
            src={targetMetadata.photoURL}
            alt={participant.name || participant.identity}
            className="relative w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-white/10"
            fallback={
              <AvatarFallback
                name={participant.name || participant.identity}
                color={targetMetadata.profileColor}
                className="relative w-10 h-10 rounded-full shrink-0 ring-2 ring-white/10"
                textClassName="text-sm font-bold"
              />
            }
          />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-white truncate block">
            {participant.name || participant.identity}
          </span>
          <span className="text-[10px] text-[#5c5e66]">Kullanıcı</span>
        </div>
      </div>

      {/* Content */}
      <div className="px-1 py-1">
        {!isLocal ? (
          <div className="space-y-4 py-2">
            
            {/* Friend Request Action */}
            {user && participant.identity && (
               <div className="px-2">
                 {(() => {
                   const isFriend = (friends || []).some(f => f.friendId === participant.identity);
                   const isPending = 
                     (incomingRequests || []).some(r => r.senderId === participant.identity) ||
                     (outgoingRequests || []).some(r => r.receiverId === participant.identity);
                   
                   if (isFriend) return null;
                   
                   return (
                     <button
                       onClick={() => {
                         if (!isPending) {
                           sendFriendRequest(user.uid, participant.identity);
                           onClose();
                         }
                       }}
                       disabled={isPending}
                       className="w-full py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all text-xs font-bold ring-1 ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       {isPending ? "İstek Gönderildi" : "Arkadaş Ekle"}
                     </button>
                   );
                 })()}
               </div>
            )}

            {/* 🎙️ Konuşma grubu + fısıltı hedefi (sağ tıkla hızlı erişim) */}
            <VoiceGroupQuickActions participant={participant} onDone={onClose} />

            {/* ✅ Isolated VolumeSlider */}
            <VolumeSlider participantIdentity={participant.identity} />

            {/* ✅ Isolated ModerationPanel */}
            {(canMute || canDeafen || canKick) && (
              <ModerationPanel
                participant={participant}
                localParticipant={localParticipant}
                statusFlags={statusFlags}
                currentServerId={currentServer?.id}
                roomName={roomName}
                canMute={canMute}
                canDeafen={canDeafen}
                canKick={canKick}
              />
            )}
          </div>
        ) : (
          <QuickStatusManager />
        )}
      </div>
    </div>
  );
}
