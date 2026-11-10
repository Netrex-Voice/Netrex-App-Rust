"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Users, Ban, Shield } from "lucide-react";
import { toast } from "sonner";
import Button from "@/src/components/ui/Button";
import Avatar from "@/src/components/ui/Avatar";
import Input from "@/src/components/ui/Input";
import { useAuthStore } from "@/src/store/authStore";
import { useServerStore } from "@/src/store/serverStore";
import { useServerPermission } from "@/src/hooks/useServerPermission";

export default function MembersTab({ members, roles }) {
  const { user: currentUser } = useAuthStore();
  const { currentServer, kickMember, banMember } = useServerStore();
  
  // Modal States
  const [banModal, setBanModal] = useState({ isOpen: false, member: null });
  const [kickModal, setKickModal] = useState({ isOpen: false, member: null });
  const [banReason, setBanReason] = useState("");

  // Permissions
  const canKickMembers = useServerPermission("KICK_MEMBERS");
  const canBanMembers = useServerPermission("BAN_MEMBERS");
  const isOwner = currentServer?.ownerId === currentUser?.uid;
  
  // Enrich members with fallback data
  const enrichedMembers = members.map(member => {
    if (currentUser && (member.id === currentUser.uid || member.userId === currentUser.uid)) {
      return {
        ...member,
        displayName: member.displayName || member.nickname || currentUser.displayName || "User",
        photoURL: member.photoURL || currentUser.photoURL || null
      };
    }
    return {
      ...member,
      displayName: member.displayName || member.nickname || `User${member.id?.slice(-4) || ''}`,
      photoURL: member.photoURL || null
    };
  });

  // Kick Handlers
  const handleKickClick = (member) => {
    setKickModal({ isOpen: true, member });
  };

  const confirmKick = async () => {
      if (!kickModal.member) return;
      await kickMember(currentServer.id, kickModal.member.id || kickModal.member.userId);
      toast.success("Kullanıcı atıldı");
      setKickModal({ isOpen: false, member: null });
  };

  // Ban Handlers
  const handleBanClick = (member) => {
      setBanModal({ isOpen: true, member });
      setBanReason("");
  };

  const confirmBan = async () => {
      if (!banModal.member) return;
      await banMember(currentServer.id, banModal.member.id || banModal.member.userId, banModal.member.displayName, banReason);
      toast.success("Kullanıcı yasaklandı");
      setBanModal({ isOpen: false, member: null });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Users size={20} className="text-cyan-400" />
        Üyeler ({enrichedMembers.length})
      </h3>

      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg">
        <div className="space-y-2">
          {enrichedMembers.map(member => {
             const isSelf = member.id === currentUser?.uid || member.userId === currentUser?.uid;
             const isMemberOwner = member.id === currentServer.ownerId || member.userId === currentServer.ownerId;
             
             // Can manage this user? (Owner can manage all except self, others depend on perms and hierarchy - simplified here)
             const canManage = !isSelf && !isMemberOwner && (isOwner || canKickMembers || canBanMembers);

             return (
            <div key={member.id} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors group">
              <div className="flex items-center gap-3">
                <Avatar
                  uid={member.id || member.userId}
                  src={member.photoURL}
                  name={member.displayName}
                  color={member.profileColor}
                  size="lg"
                  borderless
                />
                <div>
                  <span className="text-white font-medium">{member.displayName}</span>
                  <div className="flex gap-1 mt-1">
                    {member.roles?.slice(0, 3).map(roleId => {
                      const role = roles.find(r => r.id === roleId);
                      return role ? (
                        <span 
                          key={roleId}
                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: role.color + '30', color: role.color }}
                        >
                          {role.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>

              {/* Actions */}
              {canManage && (
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(isOwner || canKickMembers) && (
                          <Button 
                            size="xs" 
                            variant="ghost" 
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border-red-500/20"
                            onClick={() => handleKickClick(member)}
                            title="At"
                          >
                             At
                          </Button>
                      )}
                      {(isOwner || canBanMembers) && (
                          <Button 
                            size="xs" 
                            variant="ghost" 
                            className="bg-red-500/20 hover:bg-red-500/30 text-red-500 hover:text-red-400 border-red-500/30 font-bold"
                            onClick={() => handleBanClick(member)}
                            title="Yasakla"
                          >
                             <Ban size={14} className="mr-1" />
                             Yasakla
                          </Button>
                      )}
                  </div>
              )}
            </div>
          )})} 
        </div>
      </div>

      {/* Kick Confirmation Modal */}
      {kickModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-nds-fade-in" onClick={() => setKickModal({isOpen: false, member: null})}></div>
           <div className="relative w-full max-w-md rounded-3xl border border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.2)] overflow-hidden animate-nds-scale-in bg-gradient-to-br from-[#1a1b1e] via-[#16171a] to-[#111214]">
                {/* Top Glow */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent z-10"></div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-24 bg-red-500/10 blur-[50px] pointer-events-none"></div>

                <div className="p-8 text-center relative z-10">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-900/10 flex items-center justify-center mx-auto mb-6 text-red-500 shadow-[0_0_25px_rgba(239,68,68,0.15)] border border-red-500/20 group">
                        <div className="animate-nds-bounce-subtle">
                           <Users size={40} className="group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                        </div>
                    </div>
                    
                    <h3 className="text-2xl font-bold text-white mb-3">Kullanıcıyı At</h3>
                    
                    <p className="text-gray-400 text-base mb-8 leading-relaxed">
                        <span className="text-white font-bold">{kickModal.member?.displayName}</span> adlı kullanıcıyı sunucudan atmak istediğinize emin misiniz? <br/>
                        <span className="text-gray-500 text-sm mt-2 block">Kullanıcı tekrar davet kodu ile katılabilir.</span>
                    </p>
                    
                    <div className="flex gap-4 justify-center">
                        <Button 
                          variant="ghost" 
                          onClick={() => setKickModal({isOpen: false, member: null})}
                          className="hover:bg-white/5 text-gray-400 hover:text-white px-6 h-11"
                        >
                          İptal
                        </Button>
                        <Button 
                          onClick={confirmKick}
                          className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/25 px-8 h-11 border-0"
                        >
                          Kullanıcıyı At
                        </Button>
                    </div>
                </div>
           </div>
        </div>,
        document.body
      )}

      {/* Ban Confirmation Modal */}
      {banModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-nds-fade-in" onClick={() => setBanModal({isOpen: false, member: null})}></div>
           <div className="relative w-full max-w-md rounded-3xl border border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.2)] overflow-hidden animate-nds-scale-in bg-gradient-to-br from-[#1a1b1e] via-[#16171a] to-[#111214]">
                {/* Top Glow */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent z-10"></div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-24 bg-red-500/10 blur-[50px] pointer-events-none"></div>

                <div className="p-6 relative z-10">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Ban size={24} className="text-red-500" />
                        Kullanıcıyı Yasakla
                    </h3>
                    <p className="text-gray-400 mb-6">
                        <span className="text-white font-bold">{banModal.member?.displayName}</span> adlı kullanıcıyı sunucudan yasaklamak üzeresiniz.
                    </p>
                    
                    <div className="mb-6">
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Yasaklama Sebebi</label>
                        <Input 
                            value={banReason}
                            onChange={(e) => setBanReason(e.target.value)}
                            placeholder="Örn: Spam, Küfür..."
                            autoFocus
                            className="bg-black/20 border-red-500/20 focus:border-red-500/50"
                        />
                    </div>

                    <div className="flex gap-3 justify-end">
                        <Button variant="ghost" onClick={() => setBanModal({isOpen: false, member: null})}>İptal</Button>
                        <Button 
                            onClick={confirmBan}
                            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/25 border-0"
                        >
                            Yasakla
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
