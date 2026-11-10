"use client";

import { useState, useEffect, useRef } from "react";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import Input from "@/src/components/ui/Input";
import Button from "@/src/components/ui/Button";
import { 
  X, 
  Hash, 
  Volume2, 
  Settings, 
  Shield, 
  Trash2,
  Eye,
  EyeOff,
  Mic,
  MicOff,
  Check,
  ChevronRight,
  Save
} from "lucide-react";
import { toast } from "sonner";

export default function ChannelSettingsModal({ isOpen, onClose, channel, initialTab = "overview" }) {
  const { roles, currentServer, updateChannel, deleteChannel, setChannelPermissions } = useServerStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [channelName, setChannelName] = useState(channel?.name || "");
  const [permOverwrites, setPermOverwrites] = useState(channel?.permissionOverwrites || {});
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update active tab when initialTab changes or modal opens
  useEffect(() => {
    if (isOpen) {
        setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Reset state when channel changes
  useEffect(() => {
    if (channel) {
      setChannelName(channel.name || "");
      setPermOverwrites(channel.permissionOverwrites || {});
    }
  }, [channel]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (isOpen && e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);
  
  // Scroll to top when tab changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  if (!mounted || !isOpen || !channel || !currentServer) return null;

  const isOwner = currentServer.ownerId === user?.uid;
  const isVoiceChannel = channel.type === "voice";

  // Save channel name
  const handleSaveName = async () => {
    if (!channelName.trim() || channelName === channel.name) return;
    setIsLoading(true);
    const result = await updateChannel(channel.id, { 
      name: channelName.trim().toLowerCase().replace(/\s+/g, "-") 
    });
    if (result.success) {
      toast.success("Kanal adı güncellendi");
    } else {
      toast.error("Kanal adı güncellenemedi");
    }
    setIsLoading(false);
  };

  // Toggle role permission (Cycle: Neutral -> Allow -> Deny -> Neutral)
  const toggleRolePermission = (roleId, permType) => {
    const currentPerms = permOverwrites[roleId] || {};
    const currentValue = currentPerms[permType];
    
    let newValue;
    if (currentValue === undefined || currentValue === null) {
        newValue = true; // Neutral -> Allow
    } else if (currentValue === true) {
        newValue = false; // Allow -> Deny
    } else {
        newValue = undefined; // Deny -> Neutral
    }
    
    setPermOverwrites(prev => {
      const rolePerms = { ...prev[roleId], [permType]: newValue };
      
      // Clean up undefined values from the object to keep it clean
      if (newValue === undefined) {
          delete rolePerms[permType];
      }
      
      // If role object is empty, remove it entirely?
      // We can do this cleanup on save, but keeping state clean is good too.
      // However, we might have other perms.
      
      return {
        ...prev,
        [roleId]: rolePerms
      };
    });
  };

  // Save permissions
  const handleSavePermissions = async () => {
    setIsLoading(true);
    
    // Clean up empty permission objects before saving
    const cleanedOverwrites = { ...permOverwrites };
    Object.keys(cleanedOverwrites).forEach(roleId => {
        const perms = cleanedOverwrites[roleId];
        // Remove undefined/null properties
        Object.keys(perms).forEach(key => {
            if (perms[key] === undefined || perms[key] === null) {
                delete perms[key];
            }
        });
        // If object is empty, delete the role key
        if (Object.keys(perms).length === 0) {
            delete cleanedOverwrites[roleId];
        }
    });

    const result = await setChannelPermissions(channel.id, cleanedOverwrites);
    if (result.success) {
      toast.success("Kanal izinleri güncellendi");
      // Update local state to match cleaned version
      setPermOverwrites(cleanedOverwrites);
    } else {
      toast.error("İzinler güncellenemedi");
    }
    setIsLoading(false);
  };

  // Delete channel
  const handleDelete = async () => {
    if (window.confirm(`"${channel.name}" kanalını silmek istediğinize emin misiniz?`)) {
      await deleteChannel(currentServer.id, channel.id);
      toast.success("Kanal silindi");
      onClose();
    }
  };

  // Get permission state: true (Allow), false (Deny), undefined (Neutral)
  const getPermissionState = (roleId, permType) => {
    return permOverwrites[roleId]?.[permType];
  };

  // Check if role is restricted (explicitly set)
  const isRestricted = (roleId) => {
    return permOverwrites[roleId] !== undefined;
  };

  const sortedRoles = [...roles].sort((a, b) => (b.order || 0) - (a.order || 0));

  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <div className="space-y-6 animate-in fade-in duration-300 slide-in-from-bottom-2">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Settings size={20} className="text-indigo-400" />
              Genel Bakış
            </h3>

            {/* Channel Name */}
            <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg">
              <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2">
                <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
                Kanal Adı
              </h4>
              <div className="flex gap-3">
                <Input
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="Kanal adı..."
                  className="flex-1"
                />
                <Button 
                  onClick={handleSaveName} 
                  loading={isLoading}
                  disabled={channelName === channel.name}
                  className="px-4"
                >
                  <Save size={16} />
                </Button>
              </div>
            </div>

            {/* Channel Type Info */}
            <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg">
              <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2">
                <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
                Kanal Tipi
              </h4>
              <div className={`flex items-center gap-4 p-4 rounded-xl border border-white/5 ${isVoiceChannel ? 'bg-gradient-to-r from-green-500/10 to-green-600/5' : 'bg-gradient-to-r from-indigo-500/10 to-indigo-600/5'}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${isVoiceChannel ? 'bg-green-500/20 text-green-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                   {isVoiceChannel ? <Volume2 size={24} /> : <Hash size={24} />}
                </div>
                <div>
                  <div className="text-white font-bold text-base mb-0.5">{isVoiceChannel ? "Ses Kanalı" : "Metin Kanalı"}</div>
                  <div className="text-xs text-gray-400">{isVoiceChannel ? "Sesli sohbet için kullanılır" : "Yazılı mesajlaşma için kullanılır"}</div>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            {isOwner && (
              <div className="glass-strong rounded-2xl border border-red-500/30 overflow-hidden p-5 shadow-soft-lg bg-red-500/5">
                <h4 className="text-xs font-bold text-red-400 uppercase mb-4 flex items-center gap-2">
                  <div className="w-1 h-1 bg-red-400 rounded-full"></div>
                  Tehlikeli Bölge
                </h4>
                <Button variant="danger" onClick={handleDelete} className="w-full sm:w-auto">
                  <Trash2 size={16} className="mr-2" />
                  Kanalı Sil
                </Button>
              </div>
            )}
          </div>
        );
      case "permissions":
        return (
          <div className="space-y-6 animate-in fade-in duration-300 slide-in-from-bottom-2">
             <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Shield size={20} className="text-purple-400" />
                  İzinler
                </h3>
             </div>

            <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg">
                <div className="text-xs text-indigo-300 mb-6 p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 flex gap-3 items-start">
                  <div className="p-1 bg-indigo-500/20 rounded-lg mt-0.5">
                    <Shield size={12} />
                  </div>
                  <div className="leading-relaxed">
                    Bir rolü etkinleştirdiğinizde, sadece o role sahip kullanıcılar bu kanalı görebilir veya işlem yapabilir. 
                    Hiçbir rol seçilmezse herkes (varsayılan izinlere göre) erişebilir.
                  </div>
                </div>

                {/* Role Permission List */}
                <div className="space-y-2">
                  {sortedRoles.map(role => (
                    <div 
                      key={role.id}
                      className={`flex items-center justify-between p-3 rounded-xl transition-all duration-200 border group ${
                        isRestricted(role.id) 
                            ? 'bg-indigo-500/5 border-indigo-500/30' 
                            : 'bg-[#1e1f22] border-white/5 hover:border-white/10 hover:bg-[#2b2d31]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0 shadow-[0_0_8px_currentColor]"
                          style={{ backgroundColor: role.color, color: role.color }}
                        />
                        <div>
                          <span className="text-gray-200 font-medium">{role.name}</span>
                          {role.isDefault && (
                            <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded bg-white/10 text-gray-400">@everyone</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* View Permission Toggle */}
                        {(() => {
                           const state = getPermissionState(role.id, 'view');
                           return (
                            <button
                               onClick={() => toggleRolePermission(role.id, 'view')}
                               className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
                                 state === true 
                                   ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
                                   : state === false
                                     ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                                     : 'bg-white/5 text-gray-500 border-white/5 hover:bg-white/10 hover:text-gray-300'
                               }`}
                               title={state === true ? "İzin Verildi" : state === false ? "Yasaklandı" : "Nötr"}
                             >
                               {state === true ? <Check size={14} /> : state === false ? <X size={14} /> : <Eye size={14} />}
                               <span className="hidden sm:inline">
                                 {state === true ? "Görüntüleme" : state === false ? "Yasaklı" : "Görüntüle"}
                               </span>
                             </button>
                           );
                        })()}

                        {/* Speak Permission Toggle (Voice Only) */}
                        {isVoiceChannel && (
                           (() => {
                            const state = getPermissionState(role.id, 'speak');
                            return (
                             <button
                               onClick={() => toggleRolePermission(role.id, 'speak')}
                               className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
                                 state === true 
                                   ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
                                   : state === false
                                     ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                                     : 'bg-white/5 text-gray-500 border-white/5 hover:bg-white/10 hover:text-gray-300'
                               }`}
                               title={state === true ? "İzin Verildi" : state === false ? "Yasaklandı" : "Nötr"}
                             >
                               {state === true ? <Check size={14} /> : state === false ? <X size={14} /> : <Mic size={14} />}
                               <span className="hidden sm:inline">
                                 {state === true ? "Konuşma" : state === false ? "Yasaklı" : "Konuş"}
                               </span>
                            </button>
                            );
                           })()
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {sortedRoles.length === 0 && (
                  <div className="text-center text-gray-500 py-12">
                     Rol bulunamadı.
                  </div>
                )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-md animate-nds-fade-in">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent pointer-events-none"></div>

      <div className="glass-modal w-[800px] h-[600px] rounded-3xl shadow-nds-elevated flex overflow-hidden border border-nds-border-medium animate-nds-scale-in backdrop-blur-2xl bg-gradient-to-br from-nds-bg-deep/95 via-nds-bg-secondary/95 to-nds-bg-tertiary/95 relative">
        {/* ESC Close Button */}
        <div
          className="absolute top-5 right-5 flex flex-col items-center group cursor-pointer z-[10000]"
          onClick={onClose}
        >
          <div className="w-9 h-9 rounded-xl glass-strong border border-nds-border-light flex items-center justify-center text-nds-text-tertiary group-hover:bg-gradient-to-br group-hover:from-nds-danger/20 group-hover:to-nds-danger/30 group-hover:text-nds-danger group-hover:border-nds-danger/30 transition-all duration-medium hover:scale-110 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] relative group/close">
            <X
              size={18}
              strokeWidth={2.5}
              className="relative z-10 group-hover/close:rotate-90 transition-transform duration-300"
            />
          </div>
          <span className="text-[9px] font-bold text-nds-text-tertiary mt-1 group-hover:text-nds-text-secondary transition-colors">
            ESC
          </span>
        </div>
        
        {/* Sidebar */}
        <div className="w-60 bg-gradient-to-b from-[#1a1b1e] via-[#16171a] to-[#111214] p-3 flex flex-col border-r border-white/10 relative overflow-hidden flex-shrink-0">
          {/* Header */}
          <div className="relative z-10 px-3 py-4 mb-2">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg text-white font-bold ${isVoiceChannel ? 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-500/20' : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/20'}`}>
                {isVoiceChannel ? <Volume2 size={20} /> : <Hash size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-white font-bold text-sm leading-none truncate">{channel.name}</h1>
                <span className="text-[10px] text-[#949ba4] font-medium">Kanal Ayarları</span>
              </div>
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mx-2 mb-3 relative z-10"></div>

          {/* Menu Items */}
          <div className="relative z-10 space-y-1">
             <SidebarItem 
               label="Genel Bakış"
               icon={<Settings size={18} />}
               active={activeTab === "overview"}
               onClick={() => setActiveTab("overview")}
               color="indigo"
             />
             <SidebarItem 
               label="İzinler"
               icon={<Shield size={18} />}
               active={activeTab === "permissions"}
               onClick={() => setActiveTab("permissions")}
               color="purple"
             />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-gradient-to-br from-nds-bg-tertiary to-nds-bg-primary relative flex flex-col min-w-0">
            <div ref={contentRef} className="flex-1 overflow-y-auto scrollbar-thin p-8 pb-24 relative">
               {/* Animated background particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl animate-pulse-slow"></div>
                  <div
                    className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl animate-pulse-slow"
                    style={{ animationDelay: "1s" }}
                  ></div>
                </div>

                <div className="relative z-10">
                   {renderContent()}
                </div>
            </div>

            {/* Sticky Save Button for Permissions */}
            {activeTab === "permissions" && (
                <div className="absolute bottom-6 right-8 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <Button 
                        onClick={handleSavePermissions} 
                        loading={isLoading} 
                        className="shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)]"
                    >
                        <Check size={16} className="mr-1.5" />
                        Değişiklikleri Kaydet
                    </Button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}

// Sidebar Item Component (Reused from ServerSettingsModal roughly)
function SidebarItem({ label, icon, active, onClick, color = "indigo" }) {
  const colorClasses = {
    indigo: {
      activeBg: "from-indigo-500/20 to-indigo-600/10",
      activeBorder: "border-indigo-500/40",
      activeIcon: "text-indigo-400",
      activeDot: "bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]",
    },
    purple: {
      activeBg: "from-purple-500/20 to-purple-600/10",
      activeBorder: "border-purple-500/40",
      activeIcon: "text-purple-400",
      activeDot: "bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]",
    },
  };

  const colors = colorClasses[color] || colorClasses.indigo;

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 w-full text-left relative group/item overflow-hidden ${
        active
          ? `bg-gradient-to-r ${colors.activeBg} text-white border ${colors.activeBorder}`
          : "text-[#949ba4] hover:text-white border border-transparent hover:bg-white/5"
      }`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
          active
            ? `bg-white/10 ${colors.activeIcon}`
            : "bg-white/5 text-[#949ba4] group-hover/item:bg-white/10 group-hover/item:text-white"
        }`}
      >
        {icon}
      </div>
      
      <span className="flex-1 truncate">{label}</span>

      {active && (
        <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${colors.activeDot}`}></div>
      )}
      
      {!active && (
        <ChevronRight 
          size={14} 
          className="text-[#949ba4] opacity-0 group-hover/item:opacity-100 transition-all duration-300" 
        />
      )}
    </button>
  );
}
