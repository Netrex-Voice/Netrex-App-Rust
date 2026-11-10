"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom"; // Portal eklendi
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import { useSettingsStore } from "@/src/store/settingsStore";
import { Settings, Trash2, Shield, Hash, Volume2, VolumeX, Mic, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";

export default function ChannelContextMenu({
  x,
  y,
  channel,
  onClose,
  onOpenSettings,
}) {
  const { currentServer, deleteChannel, roles, members, channels, reorderChannels } = useServerStore();
  const { user } = useAuthStore();
  const ttsEnabled = useSettingsStore(state => state.ttsEnabled);
  const mutedTtsChannels = useSettingsStore(state => state.mutedTtsChannels);
  const toggleMutedTtsChannel = useSettingsStore(state => state.toggleMutedTtsChannel);
  
  const [coords, setCoords] = useState({ top: y, left: x });

  // Yetki Kontrolleri
  const isOwner = currentServer?.ownerId === user?.uid;
  const currentUserMember = members.find(
    m => m.id === user?.uid || m.userId === user?.uid
  );
  const currentUserRoles = currentUserMember?.roles || [];
  const hasManageChannelsPermission = roles.some(
    r => currentUserRoles.includes(r.id) && r.permissions?.includes("MANAGE_CHANNELS")
  );
  const canManageChannels = isOwner || hasManageChannelsPermission;

  const isVoiceChannel = channel?.type === "voice";

  // Aynı türdeki kanallar arasında sıra (sürüklemeye alternatif: klavye/dokunmatik dostu)
  const sameTypeIds = channels.filter((c) => c.type === channel?.type).map((c) => c.id);
  const channelIndex = sameTypeIds.indexOf(channel?.id);
  const canMoveUp = channelIndex > 0;
  const canMoveDown = channelIndex >= 0 && channelIndex < sameTypeIds.length - 1;

  const handleShift = async (direction) => {
    const next = [...sameTypeIds];
    const j = channelIndex + direction;
    if (channelIndex < 0 || j < 0 || j >= next.length) return;
    [next[channelIndex], next[j]] = [next[j], next[channelIndex]];
    onClose();
    const res = await reorderChannels(currentServer.id, channel.type, next);
    if (res && res.success === false) toast.error("Kanal sırası değiştirilemedi.");
  };

  // Pozisyon Ayarlama (Viewport dışına taşmaması için)
  useEffect(() => {
    let newLeft = x;
    let newTop = y;

    const menuWidth = 240;
    const menuHeight = 250;

    if (x + menuWidth > window.innerWidth) {
      newLeft = window.innerWidth - menuWidth - 10;
    }

    if (y + menuHeight > window.innerHeight) {
      newTop = window.innerHeight - menuHeight - 10;
    }

    if (newLeft < 0) newLeft = 10;
    if (newTop < 0) newTop = 10;

    setCoords({ top: newTop, left: newLeft });
  }, [x, y]);

  const handleDelete = async () => {
    if (window.confirm(`"${channel.name}" kanalını silmek istediğinize emin misiniz?`)) {
      await deleteChannel(currentServer.id, channel.id);
      toast.success("Kanal silindi");
      onClose();
    }
  };

  const handleToggleTtsMute = () => {
    toggleMutedTtsChannel(channel.id);
    const isMuted = !mutedTtsChannels.includes(channel.id);
    toast.success(isMuted ? "Kanal sesi susturuldu" : "Kanal sesi açıldı");
    onClose();
  };

  const handleOpenSettings = (tab = 'overview') => {
    onOpenSettings(channel, tab);
    onClose();
  };

  // SSR hatasını önlemek için document kontrolü
  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* 
         🖱️ Görünmez Backdrop (Arka Plan)
         Menünün arkasındaki her şeyi kaplar. Buraya tıklandığında menü kapanır.
      */}
      <div 
        className="fixed inset-0 z-[9998] cursor-default"
        onClick={(e) => {
            e.stopPropagation();
            onClose();
        }}
        onContextMenu={(e) => {
            e.preventDefault(); // Sağ tık menüsünü engelle
            onClose(); // Menüyü kapat
        }}
      />

      {/* 
         📑 Menü İçeriği
      */}
      <div
        className="fixed z-[9999] w-60 bg-gradient-to-br from-[#1a1b1e] via-[#16171a] to-[#111214] border border-white/10 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl"
        style={{ top: coords.top, left: coords.left }}
        // Menünün içine tıklandığında kapanmasını engelle:
        onClick={(e) => e.stopPropagation()} 
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="p-4 bg-white/5 border-b border-white/5 backdrop-blur-md relative overflow-hidden">
          {/* Decorative background glow */}
          <div 
              className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none opacity-20 transition-colors duration-500
              ${isVoiceChannel ? 'bg-green-500' : 'bg-indigo-500'}`}
          ></div>
          
          <div className="flex items-center gap-3 relative z-10">
            <div 
               className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ring-1 ring-white/10 transition-colors duration-300
               ${isVoiceChannel ? 'bg-green-500/10' : 'bg-indigo-500/10'}`}
            >
              {isVoiceChannel ? (
                <Volume2 size={20} className="text-green-400 drop-shadow-md" />
              ) : (
                <Hash size={20} className="text-indigo-400 drop-shadow-md" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-white text-sm truncate tracking-tight">{channel.name}</div>
              <div className="text-[11px] font-medium text-gray-400 flex items-center gap-1.5 opacity-80">
                  <span className={`w-1.5 h-1.5 rounded-full ${isVoiceChannel ? 'bg-green-500' : 'bg-indigo-500'} shadow-[0_0_5px_currentColor]`}></span>
                  {isVoiceChannel ? "Ses Kanalı" : "Metin Kanalı"}
              </div>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="p-2 space-y-1">
          {!isVoiceChannel && ttsEnabled && (
            <>
              <button
                onClick={handleToggleTtsMute}
                className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200"
              >
                {mutedTtsChannels.includes(channel.id) ? (
                  <>
                    <Mic size={16} className="text-gray-500 group-hover:text-green-400 transition-colors" />
                    <span className="font-medium">Sesli Okumayı Aç</span>
                  </>
                ) : (
                  <>
                    <VolumeX size={16} className="text-gray-500 group-hover:text-red-400 transition-colors" />
                    <span className="font-medium">Sesli Okumayı Kapat</span>
                  </>
                )}
              </button>
              <div className="h-px bg-white/5 my-1.5 mx-2"></div>
            </>
          )}

          {canManageChannels ? (
            <>
              <button
                onClick={() => handleOpenSettings('overview')}
                className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200"
              >
                <Settings size={16} className="text-gray-500 group-hover:text-indigo-400 transition-colors" />
                <span className="font-medium">Kanal Ayarları</span>
              </button>

              <button
                onClick={() => handleOpenSettings('permissions')}
                className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200"
              >
                <Shield size={16} className="text-gray-500 group-hover:text-purple-400 transition-colors" />
                <span className="font-medium">İzinleri Düzenle</span>
              </button>

              <div className="h-px bg-white/5 my-1.5 mx-2"></div>

              <button
                onClick={() => handleShift(-1)}
                disabled={!canMoveUp}
                className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-gray-400 disabled:cursor-not-allowed"
              >
                <ChevronUp size={16} className="text-gray-500 group-hover:text-cyan-400 transition-colors" />
                <span className="font-medium">Yukarı Taşı</span>
              </button>

              <button
                onClick={() => handleShift(1)}
                disabled={!canMoveDown}
                className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-gray-400 disabled:cursor-not-allowed"
              >
                <ChevronDown size={16} className="text-gray-500 group-hover:text-cyan-400 transition-colors" />
                <span className="font-medium">Aşağı Taşı</span>
              </button>

              <div className="h-px bg-white/5 my-1.5 mx-2"></div>

              <button
                onClick={handleDelete}
                className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all duration-200"
              >
                <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
                <span className="font-medium">Kanalı Sil</span>
              </button>
            </>
          ) : (
            <div className="px-3 py-3 text-xs text-center text-gray-500 italic bg-white/5 rounded-lg m-1 border border-dashed border-white/10">
              Kanal yönetim yetkiniz yok
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}