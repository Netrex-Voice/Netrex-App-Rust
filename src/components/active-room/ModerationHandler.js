
import { useEffect, useRef } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { RoomEvent, ConnectionState } from "livekit-client";
import { Mic, MicOff, VolumeX, Headphones, ShieldAlert } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { toast } from "@/src/utils/toast";

// Moderasyon Komutlarını Dinleyen ve Mikrofon Senkronizasyonu Yapan Bileşen
export default function ModerationHandler({ 
  serverId,
  setServerMuted, 
  setServerDeafened, 
  setMutedBy,
  setDeafenedBy,
  setMutedAt,
  setDeafenedAt,
  serverMuted, 
  serverDeafened, 
  isDeafened, 
  setIsDeafened, 
  isMuted, 
  setIsMuted, 
  playSound,
  onKicked
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  // ✅ FIX v3.0: Sync Lock + Debounce + Pending State for race condition prevention
  const syncLockRef = useRef(false);
  const syncTimerRef = useRef(null);
  const lastDesiredStateRef = useRef(null);
  const pendingStateRef = useRef(null); // 🔥 FIX: Lock sırasında gelen state kaybolmasın

  // Mikrofon ve Hoparlör durumunu hem manuel hem de sunucu kısıtlamalarına göre senkronize et
  useEffect(() => {
    if (!localParticipant) return;

    // ✅ Desired state hesapla
    const shouldEnableMic = !(isMuted || serverMuted || isDeafened || serverDeafened);

    // ✅ Eğer istenen durum aynıysa tekrar çalıştırma
    if (lastDesiredStateRef.current === shouldEnableMic) {
      return;
    }
    lastDesiredStateRef.current = shouldEnableMic;

    // ✅ Debounce: Hızlı art arda değişimlerde sadece son durumu uygula (120ms)
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }

    syncTimerRef.current = setTimeout(async () => {
      // Asıl istenen durumu tekrar kontrol et (debounce sırasında değişmiş olabilir)
      const currentDesiredState = !(isMuted || serverMuted || isDeafened || serverDeafened);
      
      // 🔥 FIX: Lock aktifse state'i kaybet değil, KAYDET ve sonra uygula
      if (syncLockRef.current) {
        console.log("⏳ syncMicState: Lock aktif, pending state kaydedildi:", currentDesiredState);
        pendingStateRef.current = currentDesiredState;
        return;
      }

      // Döngü koruması: Mevcut durum zaten istenen gibiyse işlem yapma
      if (localParticipant.isMicrophoneEnabled === currentDesiredState) {
        return;
      }

      syncLockRef.current = true;

      try {
        await localParticipant.setMicrophoneEnabled(currentDesiredState);
      } catch (error) {
        console.error("Microphone state sync error:", error);
      } finally {
        syncLockRef.current = false;
        
        // 🔥 FIX: Lock sırasında bekleyen state varsa hemen uygula
        if (pendingStateRef.current !== null) {
          const nextState = pendingStateRef.current;
          pendingStateRef.current = null;
          
          if (localParticipant.isMicrophoneEnabled !== nextState) {
            try {
              await localParticipant.setMicrophoneEnabled(nextState);
              console.log("✅ Pending mic state uygulandı:", nextState);
            } catch (e) {
              console.error("Pending mic state hatası:", e);
            }
          }
        }
      }
    }, 120); // 120ms debounce - hızlı toggle'ı birleştirir, 50ms'de race condition oluyordu

    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, [isMuted, serverMuted, isDeafened, serverDeafened, localParticipant]);

  // İlk bağlantıda metadata'dan durumu oku
  useEffect(() => {
    if (localParticipant && localParticipant.metadata) {
       try {
         const meta = JSON.parse(localParticipant.metadata);
         if (meta.serverMuted !== undefined) setServerMuted(meta.serverMuted);
         if (meta.serverDeafened !== undefined) setServerDeafened(meta.serverDeafened);
         if (meta.mutedBy) setMutedBy(meta.mutedBy);
         if (meta.deafenedBy) setDeafenedBy(meta.deafenedBy);
         if (meta.mutedAt) setMutedAt(meta.mutedAt);
         if (meta.deafenedAt) setDeafenedAt(meta.deafenedAt);
       } catch (e) {
         console.error("Metadata parse error:", e);
       }
    }
  }, [localParticipant, setServerMuted, setServerDeafened, setMutedBy, setDeafenedBy, setMutedAt, setDeafenedAt]);

  // ✅ FIX: useRef guard to prevent duplicate event listener registration
  const hasRegisteredModerationRef = useRef(false);
  
  useEffect(() => {
    if (!room || !localParticipant) return;
    
    // ✅ CRITICAL FIX: Only register events ONCE per room instance
    if (hasRegisteredModerationRef.current) {
      return;
    }
    
    hasRegisteredModerationRef.current = true;
    console.log("✅ Registering moderation event listener (ONCE)");

    const handleDataReceived = (payload, participant) => {
      // Sadece debugging için log ekleyelim
      if (process.env.NODE_ENV === "development") {
        console.log("📨 Veri alındı:", participant?.identity);
      }
      const str = new TextDecoder().decode(payload);
      try {
        const data = JSON.parse(str);
        if (data.type === "MODERATION_COMMAND") {
          if (process.env.NODE_ENV === "development") {
            console.log("🛠️ Moderasyon komutu:", data.action, "Hedef:", data.targetId, "Sen:", localParticipant.identity);
          }
          // Eğer hedef bensem
           if (data.targetId === localParticipant.identity) {
             if (data.action === "MUTE") {
               const modName = data.moderatorName || "Bir yetkili";
               // ✅ FIX: Batch state updates - syncMicState'in tekrar çalışmasını sağla
               lastDesiredStateRef.current = null;
               setServerMuted(data.value);
               if (data.value) {
                 setMutedBy(modName);
                 setMutedAt(Date.now());
               } else {
                 setMutedBy(null);
                 setMutedAt(null);
               }
               
               // Metadata güncellemesi artık ActiveRoom'un ana useEffect'i tarafından yapılacak

               // Sadece bildirim ve ses
               if (data.value) {
                 playSound("mute");
                 toast.error(`${modName} tarafından susturuldunuz.`, {
                   icon: <MicOff className="text-red-500" size={18} />
                 });
               } else {
                 playSound("unmute");
                 toast.success(`${modName} susturmanızı kaldırdı.`, {
                   icon: <Mic className="text-green-500" size={18} />
                 });
               }
             } else if (data.action === "DEAFEN") {
                const modName = data.moderatorName || "Bir yetkili";
                const newValue = data.value;
                // ✅ FIX: syncMicState'in tekrar çalışmasını sağla
                lastDesiredStateRef.current = null;
                setServerDeafened(newValue);
                if (newValue) {
                  setDeafenedBy(modName);
                  setDeafenedAt(Date.now());
                } else {
                  setDeafenedBy(null);
                  setDeafenedAt(null);
                }

                if (newValue) {
                  playSound("deafen");
                  toast.error(`${modName} tarafından sağırlaştırıldınız.`, {
                    icon: <VolumeX className="text-red-500" size={18} />
                  });
                } else {
                  playSound("undeafen");
                  toast.success(`${modName} sağırlaştırmanızı kaldırdı.`, {
                    icon: <Headphones className="text-green-500" size={18} />
                  });
                }
              } else if (data.action === "VOICE_KICK") {
                // 🚪 Sesli kanaldan atılma
                const modName = data.moderatorName || "Bir yetkili";
                
                playSound("left");
                toast.error(`${modName} tarafından sesli kanaldan atıldınız.`, {
                  duration: 8000
                });

                // Room'dan disconnect ol
                setTimeout(() => {
                  try {
                    // 1. Önce ebeveyn UI'ı sıfırla (onKicked/onLeave çağır)
                    if (onKicked) {
                      onKicked();
                    }
                    
                    // 2. Sonra room bağlantısını kes (zaten unmount sırasında da kesilir ama garanti olsun)
                    if (room && room.state !== ConnectionState.Disconnected) {
                      room.disconnect();
                      console.log("🚪 Sesli kanaldan atıldı:", modName);
                    }
                  } catch (e) {
                    console.error("Voice kick disconnect hatası:", e);
                  }
                }, 800); // UI Toast'un okunması için biraz daha süre tanıyalım
              }
           }
        } else if (data.type === "MODERATION_REQUEST") {
          // Eğer moderasyon yetkim varsa bu talepleri gör
          // (Actually, check if I have the permission locally)
          // Simplified: All participants in room will see it if they are listening, but typically only mods care.
          if (data.action === "UNMUTE_REQUEST") {
            const requesterName = data.username || "Bir kullanıcı";
            const requesterId = data.userId;

            // ✅ Native Notification (Masaüstü Bildirimi)
            if (Notification.permission === "granted") {
              const notification = new Notification("Susturma Kaldırma Talebi", {
                body: `${requesterName} susturulmasının kaldırılmasını istiyor.`,
                icon: "/favicon.ico",
              });
              notification.onclick = () => {
                if (window.netrex?.focusWindow) window.netrex.focusWindow();
                else window.focus();
              };
            }

            toast.info(`${requesterName} susturulmasının kaldırılmasını talep ediyor.`, {
              duration: 10000,
              action: {
                label: "Aç",
                onClick: async () => {
                   const payload = JSON.stringify({
                     type: "MODERATION_COMMAND",
                     targetId: requesterId,
                     moderatorName: localParticipant.name || localParticipant.identity,
                     action: "MUTE",
                     value: false
                   });
                   localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
                   
                   if (serverId) {
                     try {
                        const memberRef = doc(db, "servers", serverId, "members", requesterId);
                        await updateDoc(memberRef, { 
                          isMutedByServer: false,
                          mutedBy: null,
                          mutedAt: null
                        });
                     } catch (err) {
                        console.error("Unmute request firebase update failed:", err);
                     }
                   }
                }
              }
            });
          } else if (data.action === "UNDEAFEN_REQUEST") {
            const requesterName = data.username || "Bir kullanıcı";
            const requesterId = data.userId;

            toast.info(`${requesterName} sağırlaştırmasının kaldırılmasını talep ediyor.`, {
              duration: 10000,
              action: {
                label: "Aç",
                onClick: async () => {
                   const payload = JSON.stringify({
                     type: "MODERATION_COMMAND",
                     targetId: requesterId,
                     moderatorName: localParticipant.name || localParticipant.identity,
                     action: "DEAFEN",
                     value: false
                   });
                   localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
                   
                   if (serverId) {
                     try {
                        const memberRef = doc(db, "servers", serverId, "members", requesterId);
                        await updateDoc(memberRef, { 
                          isDeafenedByServer: false,
                          deafenedBy: null,
                          deafenedAt: null
                        });
                     } catch (err) {
                        console.error("Undeafen request firebase update failed:", err);
                     }
                   }
                }
              }
            });
          }
        }
      } catch (e) {}
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      console.log("🧹 Cleaning up moderation event listener");
      hasRegisteredModerationRef.current = false;
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, localParticipant]); // ✅ Minimal dependencies - callbacks are stable via closure

  return null;
}
