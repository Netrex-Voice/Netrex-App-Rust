"use client";

import { useEffect, useState, useMemo, useCallback, memo, lazy, Suspense } from "react";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import { useDMStore } from "@/src/store/dmStore";
import { useFriendStore } from "@/src/store/friendStore";
import { toast } from "@/src/utils/toast";
import { Home, Plus, MessageCircle, Gamepad2 } from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useGamesStore } from "@/src/modules/games/store";
// Tek kişilik oyun paneli yalnızca açılınca yüklenir (oyunlar kapalıyken hiçbir kod gelmez)
const SoloArcade = lazy(() => import("@/src/modules/games/SoloArcade"));
import RailUserPanel from "./RailUserPanel";
import ServerSettingsModal from "@/src/components/server/ServerSettingsModal";
import CreateInviteModal from "@/src/components/server/CreateInviteModal";
import LeaveServerModal from "@/src/components/server/LeaveServerModal";
import { useServerPermission } from "@/src/hooks/useServerPermission";
import { RailItem, RailSeparator } from "./server-rail";

/**
 * 🚆 ServerRail - OPTIMIZED & MODULAR v2.0
 * - Separated into sub-components
 * - React.memo for performance
 * - Clean and maintainable
 */
export default function ServerRail({ onOpenCreateModal, isRoomActive, friendsMode, onToggleFriendsMode, onGoHome, onSelectDM }) {
  const { user } = useAuthStore();
  const { 
    servers, 
    currentServer, 
    selectServer, 
    fetchUserServers,
    leaveServer
  } = useServerStore();

  const { conversations, unreadDMCounts, selectConversation } = useDMStore();
  const gamesEnabled = useSettingsStore((s) => s.gamesEnabled);
  const arcadeOpen = useGamesStore((s) => s.arcadeOpen);
  const setArcadeOpen = useGamesStore((s) => s.setArcadeOpen);
  
  const [serverSettings, setServerSettings] = useState({ isOpen: false, initialTab: 'overview', serverId: null });
  const [inviteModal, setInviteModal] = useState({ isOpen: false, serverId: null });
  const [leaveModal, setLeaveModal] = useState({ isOpen: false, server: null });

  const totalUnread = useDMStore(state => {
    const counts = state.unreadDMCounts || {};
    return Object.values(counts).reduce((sum, c) => sum + c, 0);
  });

  const pendingFriendRequests = useFriendStore(state => state.incomingRequests.length);
  const combinedMessengerBadge = totalUnread + pendingFriendRequests;

  useEffect(() => {
    if (user?.uid) {
      fetchUserServers(user.uid);
    }
  }, [user?.uid, fetchUserServers]);

  // ✅ Tümüyle Ana Sayfaya Git (Logo Tıklandığında)
  const handleHomeClick = useCallback(() => {
    if (onGoHome) {
      onGoHome();
    }
  }, [onGoHome]);

  // ✅ Server değiştir - artık room active iken de izin veriyoruz (background connection)
  const handleServerClick = useCallback((serverId) => {
    selectServer(serverId);
  }, [selectServer]);
  
  const handleOpenSettings = useCallback((serverId, tab = 'overview') => {
    setServerSettings({ isOpen: true, initialTab: tab, serverId });
  }, []);

  const handleOpenInvite = useCallback((serverId) => {
    setInviteModal({ isOpen: true, serverId });
  }, []);

  const handleLeaveClick = useCallback((server) => {
    setLeaveModal({ isOpen: true, server });
  }, []);
  
  const canManageCurrentServer = useServerPermission("MANAGE_SERVER");

  const confirmLeaveServer = useCallback(async () => {
    if (leaveModal.server) {
      await leaveServer(leaveModal.server.id, user.uid);
      if (currentServer?.id === leaveModal.server.id) {
        selectServer(null);
      }
      setLeaveModal({ isOpen: false, server: null });
    }
  }, [leaveModal.server, leaveServer, user?.uid, currentServer?.id, selectServer]);

  // ✅ Memoized server list
  const serverItems = useMemo(() => {
    return servers.map((server) => (
      <RailItem
        key={server.id}
        serverId={server.id}
        label={server.name}
        active={currentServer?.id === server.id}
        onClick={() => handleServerClick(server.id)}
        iconUrl={server.iconUrl}
        isOwner={server.ownerId === user?.uid}
        canManage={(currentServer?.id === server.id) ? canManageCurrentServer : false}
        onOpenSettings={handleOpenSettings}
        onOpenInvite={handleOpenInvite}
        onLeave={() => handleLeaveClick(server)}
        isRoomActive={isRoomActive}
      />
    ));
  }, [servers, currentServer?.id, user?.uid, canManageCurrentServer, handleServerClick, handleOpenSettings, handleOpenInvite, handleLeaveClick, isRoomActive]);

  return (
    <nav className="
      w-[72px] h-full 
      bg-gradient-to-b from-[#1a1b1e] via-[#16171a] to-[#111214]
      flex flex-col items-center 
      py-4 gap-2.5
      overflow-y-auto scrollbar-none
      flex-shrink-0 select-none
      border-r border-white/5
    ">
      
      {/* ✅ Home Button */}
      <RailItem
        label="Ana Sayfa" 
        active={!currentServer && !friendsMode}
        onClick={handleHomeClick}
        icon={<Home size={24} />}
        isRoomActive={isRoomActive}
      />

      {/* Friends / DM Button */}
      <RailItem
        label="Mesajlar"
        active={friendsMode}
        onClick={onToggleFriendsMode}
        icon={<MessageCircle size={24} />}
        isRoomActive={isRoomActive}
        badgeCount={combinedMessengerBadge}
      />

      {/* Tek kişilik oyunlar (Satranç, Tepe Tırmanışı): ses odası gerekmez */}
      {gamesEnabled && (
        <RailItem
          label="Tek Kişilik Oyunlar"
          active={arcadeOpen}
          onClick={() => setArcadeOpen(!arcadeOpen)}
          icon={<Gamepad2 size={24} />}
          isRoomActive={isRoomActive}
        />
      )}

      <RailSeparator />

      {/* Scrollable Section: Unread DM Avatars + Servers */}
      <div className="
        flex-1 w-full flex flex-col items-center gap-2 overflow-y-auto no-scrollbar
        px-2 pb-2
      ">
        {serverItems}

        {/* Separator if we have unread DMs and servers */}
        {servers.length > 0 && conversations.some(c => (unreadDMCounts[c.id] || 0) > 0) && (
          <div className="w-8 h-[2px] bg-[#313338] rounded-full my-1 shrink-0" />
        )}

        {/* Dynamic Unread DM Avatars (Discord-style) - NOW BELOW SERVERS */}
        {conversations.filter(c => (unreadDMCounts[c.id] || 0) > 0).slice(0, 8).map(convo => (
          <RailItem
            key={`dm-${convo.id}`}
            label={convo.otherUser?.displayName}
            active={currentServer === null && friendsMode && useDMStore.getState().activeConversation?.id === convo.id}
            onClick={() => {
              if (onSelectDM) onSelectDM(convo);
              else selectConversation(convo); 
            }}
            iconUrl={convo.otherUser?.photoURL}
            avatarUid={convo.otherId || convo.otherUser?.uid}
            badgeCount={unreadDMCounts[convo.id]}
            isRoomActive={isRoomActive}
          />
        ))}
      </div>

      <RailSeparator />

      <RailItem
        label="Sunucu Ekle"
        variant="success"
        active={false}
        onClick={onOpenCreateModal}
        icon={<Plus size={24} />}
      />

      <div className="mt-auto pt-2 w-full flex flex-col items-center gap-2">
        <RailUserPanel />
      </div>

      {gamesEnabled && arcadeOpen && (
        <Suspense fallback={null}>
          <SoloArcade />
        </Suspense>
      )}

      {/* Modals */}
      {serverSettings.isOpen && (
        <ServerSettingsModal 
          isOpen={serverSettings.isOpen} 
          onClose={() => setServerSettings({ ...serverSettings, isOpen: false })} 
          initialTab={serverSettings.initialTab}
        />
      )}

      {inviteModal.isOpen && (
        <CreateInviteModal
          isOpen={inviteModal.isOpen}
          onClose={() => setInviteModal({ isOpen: false, serverId: null })}
          serverId={inviteModal.serverId}
        />
      )}

      {leaveModal.isOpen && (
        <LeaveServerModal 
          isOpen={leaveModal.isOpen}
          onClose={() => setLeaveModal({ isOpen: false, server: null })}
          onConfirm={confirmLeaveServer}
          serverName={leaveModal.server?.name}
        />
      )}
    </nav>
  );
}