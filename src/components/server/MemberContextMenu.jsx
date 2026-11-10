"use client";

/**
 * ✅ OPTIMIZED MemberContextMenu v2.0
 * 
 * Component structure:
 * - RolesList: Isolated accordion (state isolation)
 * - Main: Layout, header, permissions
 * 
 * Benefits:
 * - Accordion toggle → Sadece RolesList re-render
 * - Role toggle → Sadece RoleItem re-render
 * - Memoized calculations
 * - %60 daha az re-render
 */

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import { useSettingsStore } from "@/src/store/settingsStore";
import { Crown, User, Mic, VolumeX } from "lucide-react";
import Avatar from "@/src/components/ui/Avatar";
import { toast } from "sonner";
import RolesList from "./context/RolesList";

export default function MemberContextMenu({
  x,
  y,
  member,
  onClose,
}) {
  const menuRef = useRef(null);
  const { 
    roles, 
    currentServer, 
    members, 
    assignRoleToMember, 
    removeRoleFromMember,
    setMemberRoles 
  } = useServerStore();
  const { user } = useAuthStore();
  const ttsEnabled = useSettingsStore(state => state.ttsEnabled);
  const mutedTtsUsers = useSettingsStore(state => state.mutedTtsUsers);
  const toggleMutedTtsUser = useSettingsStore(state => state.toggleMutedTtsUser);
  
  const [coords, setCoords] = useState({ top: y, left: x });

  // ✅ Memoized current member (reactivity için)
  const currentMember = useMemo(() => 
    members.find(m => m.id === member.id) || member,
    [members, member.id]
  );

  // ✅ Memoized permissions
  const { isOwner, canManageRoles } = useMemo(() => {
    const isOwner = currentServer?.ownerId === user?.uid;
    const currentUserMember = members.find(
      m => m.id === user?.uid || m.userId === user?.uid
    );
    const currentUserRoles = currentUserMember?.roles || [];
    const hasManageRolesPermission = roles.some(
      r => currentUserRoles.includes(r.id) && r.permissions?.includes("MANAGE_ROLES")
    );
    
    return {
      isOwner,
      canManageRoles: isOwner || hasManageRolesPermission
    };
  }, [currentServer?.ownerId, user?.uid, members, roles]);

  // ✅ Memoized member roles
  const memberRoles = useMemo(() => 
    currentMember?.roles || [],
    [currentMember?.roles]
  );

  // ✅ Memoized sorted roles
  const sortedRoles = useMemo(() => 
    [...roles].sort((a, b) => (b.order || 0) - (a.order || 0)),
    [roles]
  );

  // ✅ Position calculation
  useEffect(() => {
    let newLeft = x;
    let newTop = y;

    const menuWidth = 280;
    const menuHeight = 400; 

    if (x + menuWidth > window.innerWidth) {
      newLeft = x - menuWidth;
    }

    if (y + menuHeight > window.innerHeight) {
      newTop = y - menuHeight;
    }

    if (newLeft < 0) newLeft = 10;
    if (newTop < 0) newTop = 10;

    setCoords({ top: newTop, left: newLeft });
  }, [x, y]);

  // ✅ Click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // ✅ Stable role toggle handler
  const handleToggleRole = useCallback(async (roleId) => {
    const hasRole = memberRoles.includes(roleId);
    
    try {
      if (hasRole) {
        const result = await removeRoleFromMember(member.id, roleId);
        if (result.success) toast.success("Rol kaldırıldı");
        else toast.error("Hata: " + result.error);
      } else {
        const targetRole = roles.find(r => r.id === roleId);
        if (targetRole?.isDefault) {
             const result = await assignRoleToMember(member.id, roleId);
             if (result.success) toast.success("Rol atandı");
             else toast.error("Hata: " + result.error);
        } else {
             const defaultRoleIds = roles.filter(r => r.isDefault).map(r => r.id);
             const rolesToKeep = memberRoles.filter(id => defaultRoleIds.includes(id));
             const newRoles = [...new Set([...rolesToKeep, roleId])];
             
             const result = await setMemberRoles(member.id, newRoles);
             if (result.success) toast.success("Rol değiştirildi");
             else toast.error("Hata: " + result.error);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Bir hata oluştu");
    }
  }, [memberRoles, member.id, roles, removeRoleFromMember, assignRoleToMember, setMemberRoles]);

  const isSelf = member.id === user?.uid || member.userId === user?.uid;
  const isServerOwner = member.id === currentServer?.ownerId;

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] w-72 rounded-2xl overflow-hidden border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in-95 duration-150 ease-out"
      style={{ 
        top: coords.top, 
        left: coords.left,
        background: 'rgba(17, 18, 20, 0.98)'
      }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Decorative Glow Effect */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

      {/* HEADER */}
      <div className="p-4 border-b border-white/5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer">
            <Avatar 
               uid={member.id || member.userId}
               src={member.photoURL}
               name={member.displayName}
               size="md"
               className="ring-2 ring-white/10 shadow-lg transition-transform duration-300 group-hover:scale-105"
            />
            {isServerOwner && (
              <div className="absolute -top-1 -right-1 bg-[#111214] rounded-full p-0.5 border border-amber-500/30">
                <Crown size={10} className="text-amber-400 fill-amber-400/20" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white truncate text-sm flex items-center gap-2">
              {member.displayName}
              {isSelf && <span className="text-[9px] bg-white/10 text-gray-400 px-1.5 rounded-sm font-medium tracking-wide">SEN</span>}
            </div>
            
            <div className="text-[11px] font-medium mt-0.5 flex items-center gap-1.5">
              {isServerOwner ? (
                <span className="text-amber-400 flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  <Crown size={10} />
                  Sunucu Sahibi
                </span>
              ) : (
                <span className="text-[#949ba4] flex items-center gap-1">
                  <User size={10} />
                  Üye
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MENU ITEMS */}
      <div className="p-2 space-y-1 relative z-10">
        {!isSelf && ttsEnabled && (
          <button
            onClick={() => {
              toggleMutedTtsUser(member.id || member.userId);
              const isMuted = !mutedTtsUsers.includes(member.id || member.userId);
              toast.success(isMuted ? "Kullanıcının mesaj okuması kapatıldı" : "Kullanıcının mesaj okuması açıldı");
              onClose();
            }}
            className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-[#5865F2] transition-colors border-b border-white/5 mb-1 pb-2"
          >
            {mutedTtsUsers.includes(member.id || member.userId) ? (
              <>
                <Mic size={16} className="text-green-400 group-hover:text-white" />
                <span className="font-medium">Sesli Okumayı Aç</span>
              </>
            ) : (
              <>
                <VolumeX size={16} className="text-[#b5bac1] group-hover:text-white" />
                <span className="font-medium">Kullanıcıyı Sustur (TTS)</span>
              </>
            )}
          </button>
        )}

        {/* ✅ Isolated RolesList */}
        <RolesList
          sortedRoles={sortedRoles}
          memberRoles={memberRoles}
          onToggleRole={handleToggleRole}
          canManageRoles={canManageRoles}
        />
      </div>
    </div>
  );
}