"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check, RefreshCw, Link } from "lucide-react";
import Button from "@/src/components/ui/Button";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import { toast } from "sonner";

export default function CreateInviteModal({ isOpen, onClose, serverId }) {
  const { fetchServerInvites, activeInvites } = useServerStore();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchServerInvites(serverId).finally(() => {
        setLoading(false);
      });
    }
  }, [isOpen, serverId, fetchServerInvites]);

  // Geçerli bir davet bul (Süresi dolmamış ve kullanım limiti dolmamış)
  const validInvite = activeInvites?.find(inv => {
    const isExpired = inv.expiresAt && inv.expiresAt.toMillis() < Date.now();
    const isFull = inv.maxUses > 0 && inv.uses >= inv.maxUses;
    return !isExpired && !isFull;
  });

  const inviteCode = validInvite?.code;

  const handleCopy = () => {
    if (!inviteCode) return;
    const link = `netrex://${inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Davet bağlantısı kopyalandı!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-md animate-nds-fade-in">
       {/* Animated background gradient */}
       <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent pointer-events-none"></div>

       <div className="glass-modal w-full max-w-md flex flex-col animate-nds-scale-in rounded-3xl border border-nds-border-medium bg-gradient-to-br from-nds-bg-deep/95 via-nds-bg-secondary/95 to-nds-bg-tertiary/95 shadow-nds-elevated relative overflow-hidden backdrop-blur-2xl">
          {/* Top glow effect */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent z-10"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-24 bg-indigo-500/10 blur-[60px] pointer-events-none"></div>
          
          {/* Animated Particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-10 left-10 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl animate-pulse-slow"></div>
            <div className="absolute bottom-10 right-10 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "1s" }}></div>
          </div>

          {/* ESC Close Button - Premium Style */}
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

          <div className="relative z-10">
              {/* Header */}
              <div className="px-8 pt-8 pb-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 flex items-center justify-center mx-auto mb-4 border border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                      <Link size={32} className="text-indigo-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Arkadaşlarını Davet Et</h2>
                  <p className="text-[#949ba4] text-sm leading-relaxed max-w-[280px] mx-auto">
                    Bu sunucunun davet bağlantısını paylaşarak arkadaşlarını aramıza kat.
                  </p>
              </div>

              <div className="p-8 pt-2 pb-8">
                  <div className="space-y-6">
                    {/* Invite Link Display */}
                    <div className="relative group">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5 mb-2">
                           <div className="w-1 h-1 bg-indigo-500 rounded-full"></div>
                           Davet Bağlantısı
                        </label>
                        <div className="bg-[#111214]/80 p-1.5 rounded-xl flex items-center gap-2 border border-white/10 group-hover:border-indigo-500/30 transition-colors shadow-inner">
                          <div className="h-11 px-3 flex-1 flex items-center text-gray-300 font-mono text-sm overflow-hidden bg-transparent outline-none select-all">
                            {loading ? (
                              <span className="flex items-center gap-2 text-gray-500 animate-pulse">
                                <RefreshCw size={14} className="animate-spin" /> Yükleniyor...
                              </span>
                            ) : inviteCode ? (
                                <span className="truncate text-white font-medium tracking-wide">
                                  {`netrex://${inviteCode}`}
                                </span>
                            ) : (
                                <span className="text-red-400 text-xs font-medium">
                                  Aktif davet bağlantısı bulunamadı.
                                </span>
                            )}
                          </div>
                          
                          {inviteCode && (
                            <Button 
                              onClick={handleCopy}
                              disabled={loading || !inviteCode}
                              className={`${copied ? "bg-green-600 hover:bg-green-700 shadow-green-600/20" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20"} min-w-[110px] h-11 shadow-lg border-0 transition-all duration-300 font-semibold`}
                            >
                              {copied ? (
                                <>
                                  <Check size={18} className="mr-2" /> Kopyalandı
                                </>
                              ) : (
                                <>
                                  <Copy size={18} className="mr-2" /> Kopyala
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                    </div>

                    {!inviteCode && !loading && (
                        <p className="text-center text-xs text-gray-500 mt-2">
                            Lütfen sunucu yöneticisiyle iletişime geçin.
                        </p>
                    )}
                  </div>
              </div>
           </div>
       </div>
    </div>,
    document.body
  );
}
