import { memo, useCallback, useMemo, useState, useEffect } from "react";
import { MicOff, Headphones, ShieldAlert, LogOut } from "lucide-react";
import { toast } from "sonner";
import { doc, updateDoc, serverTimestamp, arrayRemove, getDoc } from "firebase/firestore";
import { ref, remove } from "firebase/database";
import { db, rtdb } from "@/src/lib/firebase";

/**
 * ✅ OPTIMIZED ModerationPanel
 * - Isolated component - statusFlags değişince re-render
 * - Memoized handlers
 * - Firebase update optimized
 */
const ModerationPanel = memo(({ 
  participant, 
  localParticipant,
  statusFlags,
  currentServerId,
  roomName,
  canMute,
  canDeafen,
  canKick
}) => {
  // ✅ OPTIMISTIC UI: Beklemeyi ortadan kaldır
  const [localMute, setLocalMute] = useState(null);
  const [localDeafen, setLocalDeafen] = useState(null);

  // Prop değiştikçe yerel state'i sıfırla (senkronize olduk)
  useEffect(() => {
    if (localMute !== null && statusFlags.isTargetServerMuted === localMute) {
      setLocalMute(null);
    }
  }, [statusFlags.isTargetServerMuted, localMute]);

  useEffect(() => {
    if (localDeafen !== null && statusFlags.isTargetServerDeafened === localDeafen) {
      setLocalDeafen(null);
    }
  }, [statusFlags.isTargetServerDeafened, localDeafen]);

  const isMuted = localMute !== null ? localMute : statusFlags.isTargetServerMuted;
  const isDeafened = localDeafen !== null ? localDeafen : statusFlags.isTargetServerDeafened;

  // Firebase update helper
  const updateFirebaseStatus = useCallback(async (type, value) => {
    if (!currentServerId || !participant.identity) return;

    try {
      const memberRef = doc(db, "servers", currentServerId, "members", participant.identity);
      const updates = {};
      
      const moderatorInfo = {
        uid: localParticipant.identity,
        displayName: localParticipant.name || localParticipant.identity
      };

      if (type === "MUTE") {
        updates.isMutedByServer = value;
        if (value) {
          updates.mutedBy = moderatorInfo;
          updates.mutedAt = serverTimestamp();
        } else {
           updates.mutedBy = null;
           updates.mutedAt = null;
        }
      } else if (type === "DEAFEN") {
        updates.isDeafenedByServer = value;
        if (value) {
          updates.deafenedBy = moderatorInfo;
          updates.deafenedAt = serverTimestamp();
        } else {
          updates.deafenedBy = null;
          updates.deafenedAt = null;
        }
      }

      await updateDoc(memberRef, updates);
    } catch (error) {
      console.error("Firebase update failed:", error);
      toast.error("Veritabanı güncellenemedi.");
    }
  }, [currentServerId, participant.identity, localParticipant]);

  const handleMuteToggle = useCallback((e) => {
    e.stopPropagation();
    // ✅ FIX: Prop yerine o anki UI durumuna bak (isMuted değişkeni)
    const newValue = !isMuted;
    
    // Yerel durumu anında güncelle (Optimistic)
    setLocalMute(newValue);

    const payload = JSON.stringify({
      type: "MODERATION_COMMAND",
      targetId: participant.identity,
      moderatorName: localParticipant.name || localParticipant.identity,
      action: "MUTE",
      value: newValue
    });

    if (localParticipant) {
      localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
      updateFirebaseStatus("MUTE", newValue);
      toast.success(newValue 
        ? `${participant.name || participant.identity} susturuldu` 
        : `${participant.name || participant.identity} susturması kaldırıldı`
      );
    }
  }, [isMuted, participant.identity, participant.name, localParticipant, updateFirebaseStatus]);

  const handleDeafenToggle = useCallback((e) => {
    e.stopPropagation();
    // ✅ FIX: Prop yerine o anki UI durumuna bak
    const newValue = !isDeafened;

    // Yerel durumu anında güncelle
    setLocalDeafen(newValue);

    const payload = JSON.stringify({
      type: "MODERATION_COMMAND",
      targetId: participant.identity,
      moderatorName: localParticipant.name || localParticipant.identity,
      action: "DEAFEN",
      value: newValue
    });

    if (localParticipant) {
      localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
      updateFirebaseStatus("DEAFEN", newValue);
      toast.success(newValue 
        ? `${participant.name || participant.identity} sağırlaştırıldı` 
        : `${participant.name || participant.identity} sağırlaştırması kaldırıldı`
      );
    }
  }, [isDeafened, participant.identity, participant.name, localParticipant, updateFirebaseStatus]);

  const handleVoiceKick = useCallback(async (e) => {
    e.stopPropagation();
    
    const payload = JSON.stringify({
      type: "MODERATION_COMMAND",
      targetId: participant.identity,
      moderatorName: localParticipant.name || localParticipant.identity,
      action: "VOICE_KICK",
      value: true
    });

    try {
      if (localParticipant) {
        // 1. LiveKit Data Channel ile atma komutu gönder
        localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });

        // 2. Firestore üzerinde EXPLICIT temizlik yap (Anlık UI güncellemesi için)
        const targetUid = participant.identity;
        
        // A. Kullanıcının kendi dokümanını temizle
        const userRef = doc(db, "users", targetUid);
        await updateDoc(userRef, {
          currentRoom: null,
          gameActivity: null
        });

        // B. Oda varlığı (room_presence) listesinden çıkar
        if (roomName) {
          const presenceRef = ref(rtdb, `room_presence/${roomName}/${targetUid}`);
          await remove(presenceRef);
        }

        toast.success(`${participant.name || participant.identity} sesli kanaldan atıldı`);
      }
    } catch (error) {
      console.error("Voice kick cleanup failed:", error);
      toast.error("Atma işlemi sırasında sunucu hatası oluştu.");
    }
  }, [participant.identity, participant.name, localParticipant, roomName]);

  return (
    <div className="bg-white/[0.02] rounded-xl p-3 border border-white/[0.04] space-y-2.5">
      <div className="flex items-center gap-2">
        <ShieldAlert size={12} className="text-amber-500" />
        <span className="text-[10px] font-semibold text-[#5c5e66] uppercase tracking-wider">
          Moderasyon
        </span>
      </div>

      {(statusFlags.isTargetSelfMuted || statusFlags.isTargetSelfDeafened) && (
        <div className="text-[10px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
          ⚠️ Kullanıcı kendini {statusFlags.isTargetSelfMuted && statusFlags.isTargetSelfDeafened ? 'susturdu ve sağırlaştırdı' : statusFlags.isTargetSelfMuted ? 'susturdu' : 'sağırlaştırdı'}.
        </div>
      )}

      <div className="space-y-1">
        {canMute && (
          <div 
            className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer group"
            onClick={handleMuteToggle}
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                isMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-[#5c5e66] group-hover:text-[#949ba4]'
              }`}>
                <MicOff size={13} />
              </div>
              <span className={`text-[13px] font-medium transition-colors ${
                isMuted ? 'text-red-400' : 'text-[#b5bac1] group-hover:text-white'
              }`}>
                Sunucu Susturması
              </span>
              {isMuted && (statusFlags.mutedBy || (localMute !== null && localParticipant.name)) && (
                <span className="text-[10px] text-red-500/60 font-medium ml-1 truncate max-w-[60px]">
                   ({localMute !== null ? 'Sen' : statusFlags.mutedBy})
                </span>
              )}
            </div>
            
            <div className={`w-9 h-5 rounded-full transition-all duration-200 relative ${
              isMuted 
                ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' 
                : 'bg-[#2b2d31]'
            }`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
                isMuted ? 'left-[18px]' : 'left-0.5'
              }`} />
            </div>
          </div>
        )}

        {canDeafen && (
          <div 
            className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer group"
            onClick={handleDeafenToggle}
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                isDeafened ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-[#5c5e66] group-hover:text-[#949ba4]'
              }`}>
                <Headphones size={13} />
              </div>
              <span className={`text-[13px] font-medium transition-colors ${
                isDeafened ? 'text-orange-400' : 'text-[#b5bac1] group-hover:text-white'
              }`}>
                Sunucu Sağırlaştırması
              </span>
              {isDeafened && (statusFlags.deafenedBy || (localDeafen !== null && localParticipant.name)) && (
                 <span className="text-[10px] text-orange-500/60 font-medium ml-1 truncate max-w-[60px]">
                   ({localDeafen !== null ? 'Sen' : statusFlags.deafenedBy})
                </span>
              )}
            </div>
            
            <div className={`w-9 h-5 rounded-full transition-all duration-200 relative ${
              isDeafened 
                ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]' 
                : 'bg-[#2b2d31]'
            }`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
                isDeafened ? 'left-[18px]' : 'left-0.5'
              }`} />
            </div>
          </div>
        )}

        {/* Voice Kick */}
        {canKick && (
          <>
            <div className="h-px bg-white/[0.06] mx-1 my-1" />
            <div 
              className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer group"
              onClick={handleVoiceKick}
            >
              <div className="w-6 h-6 rounded-md flex items-center justify-center bg-red-500/10 text-red-400 group-hover:bg-red-500/20">
                <LogOut size={13} />
              </div>
              <span className="text-[13px] font-medium text-red-400 group-hover:text-red-300">
                Sesli Kanaldan At
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render when relevant props change
  return (
    prevProps.participant.identity === nextProps.participant.identity &&
    prevProps.participant.name === nextProps.participant.name &&
    prevProps.statusFlags.isTargetSelfMuted === nextProps.statusFlags.isTargetSelfMuted &&
    prevProps.statusFlags.isTargetSelfDeafened === nextProps.statusFlags.isTargetSelfDeafened &&
    prevProps.statusFlags.isTargetServerMuted === nextProps.statusFlags.isTargetServerMuted &&
    prevProps.statusFlags.isTargetServerDeafened === nextProps.statusFlags.isTargetServerDeafened &&
    prevProps.statusFlags.mutedBy === nextProps.statusFlags.mutedBy &&
    prevProps.statusFlags.deafenedBy === nextProps.statusFlags.deafenedBy &&
    prevProps.canMute === nextProps.canMute &&
    prevProps.canDeafen === nextProps.canDeafen &&
    prevProps.canKick === nextProps.canKick
  );
});

ModerationPanel.displayName = 'ModerationPanel';

export default ModerationPanel;
