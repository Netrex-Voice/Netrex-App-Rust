"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Ban, Shield } from "lucide-react";
import { toast } from "sonner";
import Button from "@/src/components/ui/Button";

export default function BansTab({ serverId, fetchBans, unbanMember }) {
    const [bannedUsers, setBannedUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [unbanModal, setUnbanModal] = useState({ isOpen: false, userId: null });

    useEffect(() => {
        loadBans();
    }, [serverId]);

    const loadBans = async () => {
        setIsLoading(true);
        const bans = await fetchBans(serverId);
        setBannedUsers(bans || []);
        setIsLoading(false);
    };

    const handleUnbanClick = (userId) => {
        setUnbanModal({ isOpen: true, userId });
    };

    const confirmUnban = async () => {
        if (!unbanModal.userId) return;
        await unbanMember(serverId, unbanModal.userId);
        toast.success("Yasak kaldırıldı");
        setUnbanModal({ isOpen: false, userId: null });
        loadBans(); // Refresh list
    };

    return (
        <div className="space-y-6">
           <div className="flex justify-between items-center mb-4">
               <h3 className="text-xl font-bold text-white flex items-center gap-2">
                   <Ban size={20} className="text-red-500" />
                   Yasaklılar ({bannedUsers.length})
               </h3>
               <Button size="xs" variant="ghost" onClick={loadBans}>Yenile</Button>
           </div>

           <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg min-h-[300px]">
               {isLoading ? (
                   <div className="flex items-center justify-center h-40 text-gray-500">Yükleniyor...</div>
               ) : bannedUsers.length === 0 ? (
                   <div className="flex flex-col items-center justify-center h-40 text-gray-500 gap-2">
                       <Shield size={32} className="opacity-20" />
                       <p>Yasaklı kullanıcı bulunmamaktadır.</p>
                   </div>
               ) : (
                   <div className="space-y-2">
                       {bannedUsers.map(ban => (
                           <div key={ban.id} className="flex items-center justify-between p-3 bg-[#1e1f22] rounded-xl border border-white/5 hover:bg-[#2b2d31] transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-900 to-red-600 flex items-center justify-center text-white font-bold text-sm">
                                        {ban.displayName?.charAt(0).toUpperCase() || "U"}
                                    </div>
                                    <div>
                                        <div className="text-white font-medium">{ban.displayName}</div>
                                        <div className="text-xs text-red-400">Sebep: {ban.reason}</div>
                                    </div>
                                </div>
                                <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="text-gray-400 hover:text-green-400 hover:bg-green-500/10 border-transparent hover:border-green-500/20 opacity-0 group-hover:opacity-100 transition-all"
                                    onClick={() => handleUnbanClick(ban.userId)}
                                >
                                    Yasağı Kaldır
                                </Button>
                           </div>
                       ))}
                   </div>
               )}
           </div>

           {/* Unban Confirmation Modal */}
           {unbanModal.isOpen && createPortal(
                <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-nds-fade-in" onClick={() => setUnbanModal({isOpen: false, userId: null})}></div>
                
                <div className="relative w-full max-w-md rounded-3xl border border-green-500/30 shadow-[0_0_50px_rgba(34,197,94,0.15)] overflow-hidden animate-nds-scale-in bg-gradient-to-br from-[#1a1b1e] via-[#16171a] to-[#111214]">
                    {/* Top Glow & Effects */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-500/50 to-transparent z-10"></div>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-24 bg-green-500/10 blur-[50px] pointer-events-none"></div>

                    <div className="p-8 text-center relative z-10">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-900/10 flex items-center justify-center mx-auto mb-6 text-green-500 shadow-[0_0_25px_rgba(34,197,94,0.15)] border border-green-500/20 group">
                            <div className="animate-nds-bounce-subtle">
                                <Shield size={40} className="group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                            </div>
                        </div>
                        
                        <h3 className="text-2xl font-bold text-white mb-3">Yasağı Kaldır</h3>
                        
                        <p className="text-gray-400 text-base mb-8 leading-relaxed">
                            Bu kullanıcının sunucu yasağını kaldırmak istediğinize emin misiniz? <br/>
                            <span className="text-green-400/80 text-sm mt-2 block">Kullanıcı tekrar sunucuya katılabilir.</span>
                        </p>
                        
                        <div className="flex gap-4 justify-center">
                            <Button 
                                variant="ghost" 
                                onClick={() => setUnbanModal({isOpen: false, userId: null})}
                                className="hover:bg-white/5 text-gray-400 hover:text-white px-6 h-11"
                            >
                                İptal
                            </Button>
                            <Button 
                                onClick={confirmUnban}
                                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg shadow-green-500/25 px-8 h-11 border-0"
                            >
                                Yasağı Kaldır
                            </Button>
                        </div>
                    </div>
                </div>
                </div>,
                document.body
           )}
        </div>
    );
}
