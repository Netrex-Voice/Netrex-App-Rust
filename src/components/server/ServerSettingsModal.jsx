"use client";

import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { X, Settings, Shield, Award, Users as UsersIcon, Link, Ban, Plus } from "lucide-react";
import { toast } from "sonner";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import { useServerPermission } from "@/src/hooks/useServerPermission";
import Button from "@/src/components/ui/Button";

// ✅ OPTIMIZATION: Lazy load tabs - Only load when needed
const OverviewTab = lazy(() => import("./settings-modal/OverviewTab"));
const RolesTab = lazy(() => import("./settings-modal/RolesTab"));
const MembersTab = lazy(() => import("./settings-modal/MembersTab"));
const InvitesTab = lazy(() => import("./settings-modal/InvitesTab"));
const BansTab = lazy(() => import("./settings-modal/BansTab"));
const BadgesTab = lazy(() => import("./settings-modal/BadgesTab"));

export default function ServerSettingsModal({ isOpen, onClose, initialTab = "overview" }) {
  const { 
    currentServer, 
    roles, 
    members, 
    updateServer, 
    deleteServer, 
    createRole, 
    updateRole, 
    deleteRole, 
    activeInvites,
    fetchServerInvites, 
    createInvite, 
    badges, 
    createBadge, 
    updateBadge, 
    deleteBadge, 
    assignBadgeToMember, 
    removeBadgeFromMember, 
    fetchBans, 
    unbanMember 
  } = useServerStore();
  
  const { user } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [showCreateBadgeModal, setShowCreateBadgeModal] = useState(false);
  const contentRef = useRef(null);

  // Permissions
  const canManageServer = useServerPermission("MANAGE_SERVER");
  const canManageRoles = useServerPermission("MANAGE_ROLES");
  const canKickMembers = useServerPermission("KICK_MEMBERS");
  const canBanMembers = useServerPermission("BAN_MEMBERS");
  const isOwner = currentServer?.ownerId === user?.uid;

  const canViewOverview = isOwner || canManageServer;
  const canViewRoles = isOwner || canManageRoles;
  const canViewBadges = isOwner || canManageRoles;
  const canViewMembers = isOwner || canKickMembers || canBanMembers || canManageServer;
  const canViewInvites = canManageServer || isOwner;
  const canViewBans = canBanMembers || isOwner;

  // ✅ OPTIMIZATION: Reset tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // ✅ OPTIMIZATION: Scroll to top when tab changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (isOpen && e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  // ✅ OPTIMIZATION: Early return if not open - Component unmounts
  if (!isOpen || !currentServer) return null;

  const renderContent = () => {
    // ✅ OPTIMIZATION: Suspense with loading fallback
    const LoadingFallback = () => (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );

    return (
      <Suspense fallback={<LoadingFallback />}>
        {activeTab === "overview" && canViewOverview && (
          <OverviewTab 
            server={currentServer} 
            onUpdate={updateServer} 
            onDelete={deleteServer} 
            isOwner={isOwner}
            onClose={onClose}
          />
        )}
        
        {activeTab === "roles" && canViewRoles && (
          <RolesTab 
            roles={roles} 
            onCreate={createRole} 
            onUpdate={updateRole} 
            onDelete={deleteRole} 
            showCreateModal={showCreateRoleModal} 
            setShowCreateModal={setShowCreateRoleModal} 
          />
        )}

        {activeTab === "badges" && canViewBadges && (
          <BadgesTab 
            badges={badges} 
            members={members} 
            onCreate={createBadge} 
            onUpdate={updateBadge} 
            onDelete={deleteBadge} 
            onAssign={assignBadgeToMember} 
            onRemove={removeBadgeFromMember} 
            showCreateModal={showCreateBadgeModal} 
            setShowCreateModal={setShowCreateBadgeModal} 
            serverId={currentServer.id} 
          />
        )}

        {activeTab === "members" && canViewMembers && (
          <MembersTab 
            members={members} 
            roles={roles} 
          />
        )}

        {activeTab === "invites" && canViewInvites && (
          <InvitesTab 
            invites={activeInvites} 
            onCreate={createInvite} 
            serverId={currentServer.id} 
            userId={user.uid} 
            fetchInvites={fetchServerInvites} 
          />
        )}

        {activeTab === "bans" && canViewBans && (
          <BansTab 
            serverId={currentServer.id} 
            fetchBans={fetchBans} 
            unbanMember={unbanMember} 
          />
        )}
      </Suspense>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-md animate-nds-fade-in">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent pointer-events-none"></div>

      <div className="glass-modal w-[900px] h-[700px] rounded-3xl shadow-nds-elevated flex overflow-hidden border border-nds-border-medium backdrop-blur-2xl bg-gradient-to-br from-nds-bg-deep/95 via-nds-bg-secondary/95 to-nds-bg-tertiary/95 relative animate-nds-scale-in">
        {/* Close Button */}
        <div
          className="absolute top-6 right-6 flex flex-col items-center group cursor-pointer z-[10000]"
          onClick={onClose}
        >
          <div className="w-10 h-10 rounded-xl glass-strong border border-nds-border-light flex items-center justify-center text-nds-text-tertiary group-hover:bg-gradient-to-br group-hover:from-nds-danger/20 group-hover:to-nds-danger/30 group-hover:text-nds-danger group-hover:border-nds-danger/30 transition-all duration-medium hover:scale-110 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] relative group/close">
            <X
              size={20}
              strokeWidth={2.5}
              className="relative z-10 group-hover/close:rotate-90 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-white/5 rounded-xl opacity-0 group-hover/close:opacity-100 transition-opacity duration-300"></div>
          </div>
          <span className="text-nano font-bold text-nds-text-tertiary mt-1.5 group-hover:text-nds-text-secondary transition-colors">
            ESC
          </span>
        </div>
        
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent z-10"></div>

        {/* Sidebar */}
        <div className="w-64 bg-gradient-to-b from-[#1a1b1e] via-[#16171a] to-[#111214] p-3 flex flex-col border-r border-white/10 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-indigo-500/10 to-transparent"></div>
            <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-purple-500/5 to-transparent"></div>
          </div>

          {/* Header */}
          <div className="relative z-10 px-3 py-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Settings size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg leading-none">Ayarlar</h1>
                <span className="text-[10px] text-[#949ba4] font-medium">{currentServer.name}</span>
              </div>
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mx-2 mb-3 relative z-10"></div>

          {/* Menu Items */}
          <div className="relative z-10 space-y-0.5">
            {canViewOverview && (
              <SidebarItem
                label="Genel Bakış"
                icon={<Settings size={16} />}
                active={activeTab === "overview"}
                onClick={() => setActiveTab("overview")}
                color="indigo"
              />
            )}
            
            {canViewRoles && (
              <SidebarItem
                label="Roller"
                icon={<Shield size={16} />}
                active={activeTab === "roles"}
                onClick={() => setActiveTab("roles")}
                color="purple"
              />
            )}
            
            {canViewBadges && (
              <SidebarItem
                label="Rozetler"
                icon={<Award size={16} />}
                active={activeTab === "badges"}
                onClick={() => setActiveTab("badges")}
                color="amber"
              />
            )}
            
            {canViewMembers && (
              <SidebarItem
                label="Üyeler"
                icon={<UsersIcon size={16} />}
                active={activeTab === "members"}
                onClick={() => setActiveTab("members")}
                color="cyan"
              />
            )}
            
            {canViewInvites && (
              <SidebarItem
                label="Davetler"
                icon={<Link size={16} />}
                active={activeTab === "invites"}
                onClick={() => setActiveTab("invites")}
                color="orange"
              />
            )}
            
            {canViewBans && (
              <SidebarItem
                label="Yasaklılar"
                icon={<Ban size={16} />}
                active={activeTab === "bans"}
                onClick={() => setActiveTab("bans")}
                color="red"
              />
            )}
          </div>

          {/* Footer */}
          <div className="mt-auto px-2 pt-3 relative z-10">
            <div className="glass-strong rounded-xl p-3 border border-white/10 flex items-center gap-2.5">
              <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
              <div className="flex-1">
                <div className="text-[11px] text-white font-medium">{members.length} Üye</div>
                <div className="text-[10px] text-[#949ba4]">{roles.length} Rol</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-gradient-to-br from-nds-bg-tertiary to-nds-bg-primary relative flex flex-col min-w-0">
          
          {/* Action Header for Tabs that need it */}
          {(activeTab === 'roles' || activeTab === 'badges' || activeTab === 'invites') && (
            <div className="absolute top-6 right-8 z-20 flex gap-2">
               {activeTab === 'roles' && canViewRoles && (
                 <Button size="sm" onClick={() => setShowCreateRoleModal(true)} className="shadow-lg">
                   <Plus size={16} className="mr-1" />
                   Rol Ekle
                 </Button>
               )}
               {activeTab === 'badges' && canViewBadges && (
                 <Button size="sm" onClick={() => setShowCreateBadgeModal(true)} className="shadow-lg bg-gradient-to-r from-amber-500 to-orange-500 border-0">
                   <Plus size={16} className="mr-1" />
                   Rozet Ekle
                 </Button>
               )}
               {activeTab === 'invites' && canViewInvites && (
                 <Button 
                   size="sm" 
                   onClick={async () => {
                     await createInvite(currentServer.id, { userId: user.uid });
                     toast.success("Davet oluşturuldu");
                   }} 
                   className="shadow-lg bg-indigo-500 hover:bg-indigo-600 border-0"
                 >
                   <Plus size={16} className="mr-1" />
                   Davet Oluştur
                 </Button>
               )}
            </div>
          )}

          <div ref={contentRef} className="flex-1 overflow-y-auto scrollbar-thin p-6 pb-20 relative">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl"></div>
              <div
                className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl"
                style={{ animationDelay: "1s" }}
              ></div>
            </div>

            <div className="relative z-10" key={activeTab}>
              <div className="animate-page-enter">
                {renderContent()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sidebar Item Component
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
    cyan: {
      activeBg: "from-cyan-500/20 to-cyan-600/10",
      activeBorder: "border-cyan-500/40",
      activeIcon: "text-cyan-400",
      activeDot: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]",
    },
    amber: {
      activeBg: "from-amber-500/20 to-amber-600/10",
      activeBorder: "border-amber-500/40",
      activeIcon: "text-amber-400",
      activeDot: "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]",
    },
    orange: {
      activeBg: "from-orange-500/20 to-orange-600/10",
      activeBorder: "border-orange-500/40",
      activeIcon: "text-orange-400",
      activeDot: "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.6)]",
    },
    red: {
      activeBg: "from-red-500/20 to-red-600/10",
      activeBorder: "border-red-500/40",
      activeIcon: "text-red-400",
      activeDot: "bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.6)]",
    },
  };

  const colors = colorClasses[color] || colorClasses.indigo;

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-300 w-full text-left relative group/item overflow-hidden ${
        active
          ? `bg-gradient-to-r ${colors.activeBg} text-white border ${colors.activeBorder}`
          : "text-[#949ba4] hover:text-white border border-transparent hover:bg-white/5"
      }`}
    >
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 ${
          active
            ? `bg-white/10 ${colors.activeIcon}`
            : "bg-white/5 text-[#949ba4] group-hover/item:bg-white/10 group-hover/item:text-white"
        }`}
      >
        {icon}
      </div>
      
      <span className="flex-1">{label}</span>

      {active && (
        <div className={`w-1.5 h-1.5 rounded-full ${colors.activeDot}`}></div>
      )}
    </button>
  );
}
