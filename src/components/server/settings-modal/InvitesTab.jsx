"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, Copy, Users, Calendar, Infinity, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import Button from "@/src/components/ui/Button";
import { useServerStore } from "@/src/store/serverStore";

export default function InvitesTab({ invites, onCreate, serverId, userId, fetchInvites }) {
  const { deleteInvite } = useServerStore();
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    fetchInvites(serverId);
  }, [serverId, fetchInvites]);
  
  const handleCreate = async () => {
    await onCreate(serverId, { userId });
    toast.success("Davet kodu oluşturuldu");
  };

  const handleConfirmDelete = async () => {
    if (deleteId) {
       await deleteInvite(deleteId, serverId);
       toast.success("Davet silindi");
       setDeleteId(null);
    }
  };

  const copyToClipboard = (code) => {
    const link = `netrex://${code}`;
    navigator.clipboard.writeText(link)
      .then(() => toast.success("Davet linki kopyalandı"))
      .catch(() => toast.error("Kopyalama başarısız"));
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Link size={20} className="text-orange-400" />
          Davetler
        </h3>
      </div>

      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg min-h-[400px]">
        <div className="space-y-3">
          {invites && invites.length > 0 ? invites.map(invite => (
            <div 
              key={invite.code} 
              className="group relative overflow-hidden rounded-xl bg-[#1e1f22]/50 border border-white/5 hover:border-orange-500/30 transition-all duration-300 hover:shadow-[0_0_20px_rgba(249,115,22,0.1)]"
            >
              {/* Hover Gradient Background */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="relative p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div 
                      onClick={() => copyToClipboard(invite.code)}
                      className="h-9 px-3 rounded-lg bg-[#111214] border border-white/10 flex items-center gap-2 cursor-pointer group/code hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all"
                    >
                      <span className="text-gray-500 text-xs font-mono select-none">netrex://</span>
                      <span className="text-indigo-300 text-sm font-mono font-bold tracking-wide group-hover/code:text-indigo-200 transition-colors">
                        {invite.code}
                      </span>
                    </div>

                    <button 
                      onClick={() => copyToClipboard(invite.code)}
                      className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 duration-200"
                      title="Kopyala"
                    >
                      <Copy size={16} />
                    </button>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500 font-medium pl-1">
                     <div className="flex items-center gap-1.5">
                        <Users size={12} className="text-gray-400" />
                        <span className="text-gray-300">{invite.uses}</span>
                        <span className="text-gray-600">/</span>
                        <span className="text-gray-400">{invite.maxUses || <Infinity size={12} />}</span>
                     </div>
                     <div className="w-1 h-1 rounded-full bg-gray-700"></div>
                     <div className="flex items-center gap-1.5">
                        <Calendar size={12} className="text-gray-400" />
                        <span className="text-gray-400">
                          {invite.expiresAt ? 'Süreli' : 'Süresiz'}
                        </span>
                     </div>
                  </div>
                </div>
                
                <button 
                  onClick={() => setDeleteId(invite.code)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:scale-105 transition-all opacity-0 group-hover:opacity-100"
                  title="Daveti Sil"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          )) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-600/20 flex items-center justify-center mb-4 animate-pulse-slow">
                <Link size={32} className="text-orange-400" />
              </div>
              <h4 className="text-white font-bold text-lg mb-2">Henüz Davet Yok</h4>
              <p className="text-gray-400 text-sm max-w-[250px] leading-relaxed">
                Arkadaşlarını sunucuna davet etmek için yeni bir davet kodu oluştur.
              </p>
              <Button 
                onClick={handleCreate} 
                className="mt-6 bg-white/5 hover:bg-white/10 border-white/10"
                variant="outline"
              >
                <Plus size={14} className="mr-2" />
                İlk Daveti Oluştur
              </Button>
            </div>
          )}
        </div>
      </div>


      {/* Delete Confirmation Modal */}
      {deleteId && createPortal(
        <div className="fixed inset-0 z-[10020] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-nds-fade-in" onClick={() => setDeleteId(null)}></div>
          
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-nds-scale-in bg-gradient-to-br from-[#1a1b1e] via-[#16171a] to-[#111214]">
             {/* Top Glow & Effects */}
             <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent z-10"></div>
             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-24 bg-red-500/10 blur-[50px] pointer-events-none"></div>

             <div className="p-8 text-center relative z-10">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-900/10 flex items-center justify-center mx-auto mb-6 text-red-500 shadow-[0_0_25px_rgba(239,68,68,0.15)] border border-red-500/20 group">
                    <div className="animate-nds-bounce-subtle">
                      <Trash2 size={40} className="group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                    </div>
                </div>
                
                <h3 className="text-2xl font-bold text-white mb-3">Daveti Sil</h3>
                
                <p className="text-gray-400 text-base mb-8 leading-relaxed">
                   <span className="text-indigo-300 font-mono font-bold bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20 mx-1 select-all">{deleteId}</span> 
                   kodlu daveti silmek istediğinize emin misiniz? <br/>
                   <span className="text-red-400/80 text-sm mt-2 block">Bu işlem geri alınamaz.</span>
                </p>
                
                <div className="flex gap-4 justify-center">
                    <Button 
                      variant="ghost" 
                      onClick={() => setDeleteId(null)}
                      className="hover:bg-white/5 text-gray-400 hover:text-white px-6 h-11"
                    >
                      İptal
                    </Button>
                    <Button 
                      onClick={handleConfirmDelete}
                      className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/25 px-8 h-11 border-0"
                    >
                      Evet, Sil
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
