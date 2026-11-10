"use client";

import { useState } from "react";
import { X, Search, PhoneForwarded } from "lucide-react";
import { useFriendStore } from "@/src/store/friendStore";
import { useDMStore } from "@/src/store/dmStore";
import { useAuthStore } from "@/src/store/authStore";
import { getEffectivePresence } from "@/src/hooks/usePresence";
import UserPhoto from "@/src/components/ui/UserPhoto";
import { AvatarFallback } from "@/src/components/ui/Avatar";
import { toast } from "sonner";
import { createPortal } from "react-dom";

export default function CallInviteModal({ roomId, onClose }) {
  const { user } = useAuthStore();
  const { friends } = useFriendStore();
  const { openOrCreateConversation, sendMessage } = useDMStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  const filteredFriends = friends.filter((f) =>
    f.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInvite = async (friend) => {
    if (isInviting) return;
    setIsInviting(true);

    try {
      // Önce arkadaşla olan DM kanalını bul veya oluştur
      const convoId = await openOrCreateConversation(user.uid, friend.uid, { activate: false }); // arka planda: açık sohbeti değiştirmesin
      if (!convoId) throw new Error("Sohbet açılamadı.");

      // Gizli invite kodunu mesaja bas
      await sendMessage(
        convoId,
        `[CALL_INVITE:${roomId}]`,
        user.uid,
        user.displayName || "Kullanıcı"
      );

      toast.success(`${friend.displayName} aramaya davet edildi!`);
      onClose();
    } catch (error) {
      toast.error("Davet gönderilemedi.");
      console.error(error);
    } finally {
      setIsInviting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[999999] bg-[#000000cc] flex justify-center items-center backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#2b2d31] w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/5 relative scale-in-center">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.05] flex items-center justify-between bg-[#1e1f22]">
          <div>
            <h2 className="text-[19px] font-bold text-[#f2f3f5] leading-tight">Aramaya Davet Et</h2>
            <p className="text-sm text-[#b5bac1] mt-1">
              Odana katılmaları için arkadaşlarını çağır.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-[#b5bac1] hover:text-[#f2f3f5] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-white/[0.02] bg-[#1e1f22]/50">
          <div className="relative">
            <input
              type="text"
              placeholder="Arkadaş ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#111214] border border-white/5 text-white text-sm rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-indigo-500/50 focus:bg-[#111214]/80 transition-all placeholder:text-[#5c5e66]"
            />
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5c5e66]" />
          </div>
        </div>

        {/* Friends List */}
        <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2">
          {filteredFriends.length === 0 ? (
            <div className="text-center py-8 text-[#949ba4] text-sm">
              Arkadaş bulunamadı.
            </div>
          ) : (
            <div className="space-y-1">
              {filteredFriends.map((friend) => {
                const presence = getEffectivePresence(friend);
                return (
                  <div 
                    key={friend.uid} 
                    className="flex justify-between items-center p-2 rounded-xl hover:bg-white/5 transition-colors group cursor-pointer"
                    onClick={() => handleInvite(friend)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <UserPhoto
                          uid={friend.uid || friend.id}
                          src={friend.photoURL}
                          alt={friend.displayName}
                          className="w-9 h-9 rounded-full object-cover"
                          fallback={
                            <AvatarFallback
                              name={friend.displayName}
                              color={friend.profileColor}
                              className="w-9 h-9 rounded-full"
                              textClassName="text-sm"
                            />
                          }
                        />
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#2b2d31]
                          ${presence === "online" ? "bg-green-500" : presence === "idle" ? "bg-yellow-500" : presence === "dnd" ? "bg-red-500" : "bg-gray-500"}
                        `} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[#f2f3f5] font-semibold text-sm">{friend.displayName}</span>
                        <span className="text-[#949ba4] text-xs">{friend.username ? "@"+friend.username : ""}</span>
                      </div>
                    </div>
                    <button 
                      className="px-4 py-1.5 rounded-lg bg-transparent border border-indigo-500/30 text-indigo-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-500 hover:text-white"
                    >
                      Davet Et
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
}
