"use client";
import { useState } from "react";
import Modal from "@/src/components/ui/Modal";
import Input from "@/src/components/ui/Input";
import Button from "@/src/components/ui/Button";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import { toast } from "sonner";

export default function JoinServerModal({ isOpen, onClose, onCreateClick }) {
  const [inviteCode, setInviteCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const joinServer = useServerStore((s) => s.joinServer);
  const { user } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    // Clean up invite code (remove netrex:// prefix if present)
    const cleanCode = inviteCode.trim().replace(/^netrex:\/\//, "");

    setIsLoading(true);
    const result = await joinServer(cleanCode, user?.uid);
    setIsLoading(false);

    if (result.success) {
      toast.success(result.message || "Sunucuya katıldın!");
      onClose();
      setInviteCode("");
    } else {
      toast.error(result.error || "Katılma başarısız.");
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-md animate-nds-fade-in">
       {/* Animated background gradient */}
       <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-transparent pointer-events-none"></div>

       <div className="glass-modal w-full max-w-md flex flex-col animate-nds-scale-in rounded-3xl border border-nds-border-medium bg-gradient-to-br from-nds-bg-deep/95 via-nds-bg-secondary/95 to-nds-bg-tertiary/95 shadow-nds-elevated relative overflow-hidden backdrop-blur-2xl">
          {/* Top glow effect */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent z-10"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-24 bg-emerald-500/10 blur-[60px] pointer-events-none"></div>
          
          {/* Animated Particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-10 left-10 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl animate-pulse-slow"></div>
            <div className="absolute bottom-10 right-10 w-40 h-40 bg-teal-500/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "1s" }}></div>
          </div>

          {/* ESC Close Button - Premium Style */}
          <div
            className="absolute top-5 right-5 flex flex-col items-center group cursor-pointer z-[10000]"
            onClick={onClose}
          >
            <div className="w-9 h-9 rounded-xl glass-strong border border-nds-border-light flex items-center justify-center text-nds-text-tertiary group-hover:bg-gradient-to-br group-hover:from-nds-danger/20 group-hover:to-nds-danger/30 group-hover:text-nds-danger group-hover:border-nds-danger/30 transition-all duration-medium hover:scale-110 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] relative group/close">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="relative z-10 group-hover/close:rotate-90 transition-transform duration-300"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </div>
            <span className="text-[9px] font-bold text-nds-text-tertiary mt-1 group-hover:text-nds-text-secondary transition-colors">
              ESC
            </span>
          </div>

          {/* Header */}
          <div className="px-8 pt-8 pb-4 text-center relative z-10">
              <h2 className="text-2xl font-bold text-white mb-2">Sunucuya Katıl</h2>
              <p className="text-[#949ba4] text-sm leading-relaxed">
                Aşağıya bir davet kodu girerek bir sunucuya katılabilirsin.
              </p>
          </div>

          <div className="p-8 pt-2 relative z-10">
              <form onSubmit={handleSubmit} className="space-y-6">
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#949ba4] uppercase tracking-wider pl-1 flex items-center gap-1.5">
                     <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                     Davet Kodu
                  </label>
                  <Input 
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="ör. htkz2s"
                    className="bg-black/20 border-white/10 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 text-white placeholder:text-gray-600 transition-all duration-300 h-12 text-center text-lg font-mono tracking-wider rounded-xl shadow-inner"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 text-center pt-1">
                     Davet kodları genellikle 6-8 karakter uzunluğundadır.
                  </p>
                </div>

                <div className="flex justify-between items-center">
                   <Button 
                        variant="ghost" 
                        onClick={onCreateClick || onClose} 
                        type="button"
                        className="hover:bg-white/5 text-[#949ba4] hover:text-white px-6"
                   >
                     {onCreateClick ? "Geri Dön" : "İptal"}
                   </Button>
                   <Button 
                        type="submit" 
                        variant="success"
                        loading={isLoading} 
                        disabled={!inviteCode.trim()}
                        className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg shadow-emerald-500/20 px-8 flex-1 ml-4 h-12 rounded-xl"
                   >
                     Sunucuya Katıl
                   </Button>
                </div>
              </form>
              
              {!onCreateClick && (
                  <div className="mt-8 pt-6 border-t border-white/5 text-center">
                    <h4 className="text-[#949ba4] text-xs font-bold uppercase mb-3 tracking-widest">Kendi sunucunu mu kurmak istiyorsun?</h4>
                     <Button 
                      variant="ghost" 
                      onClick={() => {
                          onClose();
                      }}
                      className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 w-full h-11"
                    >
                      Sunucu Oluştur
                    </Button>
                  </div>
              )}
          </div>
       </div>
    </div>
  );
}
