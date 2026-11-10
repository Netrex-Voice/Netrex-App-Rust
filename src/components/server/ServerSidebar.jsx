"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import { useSettingsStore } from "@/src/store/settingsStore";
import { Plus, Trash2 } from "lucide-react";
import { useChatStore } from "@/src/store/chatStore";
import ServerSettingsModal from "./ServerSettingsModal";
import CreateInviteModal from "./CreateInviteModal";
import LeaveServerModal from "./LeaveServerModal";
import CreateChannelModal from "./CreateChannelModal";
import ChannelContextMenu from "./ChannelContextMenu";
import ChannelSettingsModal from "./ChannelSettingsModal";
import VoiceParticipantContextMenu from "./VoiceParticipantContextMenu";
import { USER_MIME } from "./sidebar/dnd";
import { sendVoiceCommand, describeVoiceCommandError, VOICE_COMMAND_TYPES } from "@/src/utils/voiceCommands";
import { toast } from "@/src/utils/toast";
import { useServerPermission } from "@/src/hooks/useServerPermission";
import { useVoiceGroupStore, DEFAULT_GROUP_ID } from "@/src/store/voiceGroupStore";
import { groupActions } from "@/src/hooks/useVoiceGroups";
import {
  ServerHeader,
  TextChannelItem,
  VoiceChannelItem,
  ServerDropdownMenu,
} from "./sidebar";

/**
 * 🎨 ServerSidebar - OPTIMIZED & MODULAR v2.0
 * - Separated into sub-components
 * - Memoized channel items
 * - Reduced re-renders
 */
export default function ServerSidebar({ onJoinChannel, activeTextChannelId }) {
  const {
    currentServer,
    channels,
    deleteServer,
    members,
    canUserViewChannel,
    voiceStates,
  } = useServerStore(
    // Seçicisiz abonelik roller/rozetler/mobil çekmece gibi alakasız değişikliklerde de kenar çubuğunu render ediyordu
    useShallow((s) => ({
      currentServer: s.currentServer,
      channels: s.channels,
      deleteServer: s.deleteServer,
      members: s.members,
      canUserViewChannel: s.canUserViewChannel,
      voiceStates: s.voiceStates,
    })),
  );
  const user = useAuthStore((s) => s.user);
  // Seçicisiz useChatStore() her gelen sohbet mesajında (mesaj listesi, yazıyor bilgisi…) kenar çubuğunu yeniden çiziyordu
  const { unreadCounts, currentChannel, showChatPanel } = useChatStore(
    useShallow((s) => ({
      unreadCounts: s.unreadCounts,
      currentChannel: s.currentChannel,
      showChatPanel: s.showChatPanel,
    })),
  );
  const canManageChannels = useServerPermission("MANAGE_CHANNELS");
  const canManageServer = useServerPermission("MANAGE_SERVER");
  const canMoveMembers = useServerPermission("MOVE_MEMBERS");
  const canDisconnectMembers = useServerPermission("KICK_VOICE_MEMBERS");
  const ttsEnabled = useSettingsStore((state) => state.ttsEnabled);
  const mutedTtsChannels = useSettingsStore((state) => state.mutedTtsChannels);
  const toggleMutedTtsChannel = useSettingsStore(
    (state) => state.toggleMutedTtsChannel,
  );

  // State
  const [serverSettings, setServerSettings] = useState({
    isOpen: false,
    initialTab: "overview",
  });
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [createChannelModal, setCreateChannelModal] = useState({
    isOpen: false,
    type: "text",
  });
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    type: null,
    data: null,
  });
  const [channelContextMenu, setChannelContextMenu] = useState(null);
  const [participantMenu, setParticipantMenu] = useState(null); // sesli kanaldaki kişiye sağ tık
  // 🎙️ Konuşma grupları: bağlı olduğum odanın grup durumu (sol listede gruplar için)
  const groupAssignments = useVoiceGroupStore((s) => s.assignments);
  const groupsReady = useVoiceGroupStore((s) => !!s.localIdentity);
  const [channelSettings, setChannelSettings] = useState({
    isOpen: false,
    channel: null,
    initialTab: "overview",
  });

  const menuRef = useRef(null);

  // Click Outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ✅ OPTIMIZATION: Memoized computed values
  // ✅ CPU OPT: O(n) member find → O(1) Map lookup (ses kanalı katılımcı enrichment'ında kullanılacak)
  const memberMap = useMemo(() => {
    const map = new Map();
    members.forEach(m => {
      if (m.id) map.set(m.id, m);
      if (m.userId && m.userId !== m.id) map.set(m.userId, m);
    });
    return map;
  }, [members]);
  const currentUserMember = useMemo(
    () => memberMap.get(user?.uid) || members.find((m) => m.id === user?.uid || m.userId === user?.uid),
    [memberMap, members, user?.uid],
  );

  const userRoles = currentUserMember?.roles || [];
  const isOwner = currentServer?.ownerId === user?.uid;

  const visibleChannels = useMemo(() => {
    if (!currentServer) return [];
    if (isOwner || canManageChannels) return channels;
    return channels.filter((channel) => canUserViewChannel(channel, userRoles));
  }, [
    channels,
    isOwner,
    canManageChannels,
    userRoles,
    canUserViewChannel,
    currentServer,
  ]);

  const textChannels = useMemo(
    () => visibleChannels.filter((c) => c.type === "text"),
    [visibleChannels],
  );
  const voiceChannels = useMemo(
    () => visibleChannels.filter((c) => c.type === "voice"),
    [visibleChannels],
  );

  const voiceCount = useMemo(() => {
    return voiceStates ? Object.values(voiceStates).flat().length : 0;
  }, [voiceStates]);

  // ✅ OPTIMIZATION: Memoized callbacks
  const hasRestrictions = useCallback((channel) => {
    return (
      channel.permissionOverwrites &&
      Object.keys(channel.permissionOverwrites).length > 0
    );
  }, []);

  const handleChannelContextMenu = useCallback((e, channel) => {
    e.preventDefault();
    setChannelContextMenu({ x: e.clientX, y: e.clientY, channel });
  }, []);

  const handleCreateChannel = useCallback((type) => {
    setCreateChannelModal({ isOpen: true, type });
    setShowMenu(false);
  }, []);

  const handleDeleteServer = useCallback(() => {
    setDeleteModal({ isOpen: true, type: "server", data: currentServer });
    setShowMenu(false);
  }, [currentServer]);

  const onConfirmDelete = useCallback(async () => {
    if (deleteModal.type === "server") {
      await deleteServer(deleteModal.data.id);
    } else if (deleteModal.type === "channel") {
      await useServerStore
        .getState()
        .deleteChannel(currentServer.id, deleteModal.data.id);
    }
    setDeleteModal({ isOpen: false, type: null, data: null });
  }, [deleteModal, deleteServer, currentServer?.id]);

  const handleTextChannelClick = useCallback(
    (channel) => {
      onJoinChannel(channel);
    },
    [onJoinChannel],
  );

  // ── Sunucu yönetimi: kişi taşıma / atma / kanal sıralama ──────────────

  // Sesli kanaldaki kişiyi başka bir sesli kanala taşı. Komut Realtime Database üzerinden hedefe gider;
  // hedef, gönderenin yetkisini kendisi doğrular (bu yüzden başkası adına komut yazılamaz).
  const handleMoveUser = useCallback(
    async (targetUid, toChannelId) => {
      if (!currentServer || !user || !targetUid || !toChannelId) return;
      const toChannel = channels.find((c) => c.id === toChannelId && c.type === "voice");
      if (!toChannel) return;

      // Kendini sürükleyip bırakmak = o kanala katılmak
      if (targetUid === user.uid) {
        onJoinChannel(toChannel);
        return;
      }
      if (!canMoveMembers) {
        toast.error("Üyeleri taşıma yetkin yok.");
        return;
      }
      const ok = await sendVoiceCommand({
        serverId: currentServer.id,
        targetUid,
        type: VOICE_COMMAND_TYPES.MOVE,
        toChannelId,
        byUid: user.uid,
        byName: user.displayName,
      });
      if (ok) toast.success(`"${toChannel.name}" kanalına taşıma isteği gönderildi.`);
      else toast.error(describeVoiceCommandError("Taşıma isteği gönderilemedi."), { duration: 9000 });
    },
    [currentServer, user, channels, canMoveMembers, onJoinChannel],
  );

  const handleDisconnectUser = useCallback(
    async (targetUid) => {
      if (!currentServer || !user || !targetUid) return;
      if (!canDisconnectMembers) {
        toast.error("Sesli kanaldan atma yetkin yok.");
        return;
      }
      const ok = await sendVoiceCommand({
        serverId: currentServer.id,
        targetUid,
        type: VOICE_COMMAND_TYPES.DISCONNECT,
        byUid: user.uid,
        byName: user.displayName,
      });
      if (ok) toast.success("Sesli kanaldan atma isteği gönderildi.");
      else toast.error(describeVoiceCommandError("İstek gönderilemedi."), { duration: 9000 });
    },
    [currentServer, user, canDisconnectMembers],
  );

  // Sürüklenen kanal, bırakıldığı kanalın yerini alır (aynı türdeki kanallar arasında)
  const handleReorderChannels = useCallback(
    async (draggedId, targetId) => {
      if (!currentServer) return;
      const dragged = channels.find((c) => c.id === draggedId);
      const target = channels.find((c) => c.id === targetId);
      if (!dragged || !target || dragged.type !== target.type) return;

      const ids = channels.filter((c) => c.type === dragged.type).map((c) => c.id);
      const from = ids.indexOf(draggedId);
      const to = ids.indexOf(targetId);
      if (from < 0 || to < 0 || from === to) return;
      ids.splice(from, 1);
      ids.splice(to, 0, draggedId);

      const res = await useServerStore.getState().reorderChannels(currentServer.id, dragged.type, ids);
      if (res && res.success === false) toast.error("Kanal sırası değiştirilemedi.");
    },
    [channels, currentServer],
  );

  const handleParticipantContextMenu = useCallback(
    (e, participant, channelId) => {
      const isSelf = participant.userId === user?.uid;
      // 🎙️ Bağlı olduğum kanaldaki herkese (kendim dahil) konuşma grubu menüsü açılır, yetki gerekmez
      const inMyChannel = !!voiceStates?.[channelId]?.some((u) => u.userId === user?.uid);
      const canGroup = inMyChannel && groupsReady;
      // Kendime yönetim (taşı/at) menüsü yok; sadece grup menüsü
      if (!canGroup && (isSelf || (!canMoveMembers && !canDisconnectMembers))) return;
      e.preventDefault();
      setParticipantMenu({ x: e.clientX, y: e.clientY, participant, channelId, canGroup, isSelf });
    },
    [user?.uid, canMoveMembers, canDisconnectMembers, voiceStates, groupsReady],
  );

  const handleParticipantDragStart = useCallback((e, participant, channelId) => {
    e.dataTransfer.setData(USER_MIME, JSON.stringify({ userId: participant.userId, fromChannelId: channelId }));
    e.dataTransfer.setData("text/plain", participant.displayName || "Kullanıcı");
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const closeParticipantMenu = useCallback(() => setParticipantMenu(null), []);

  // Şu an bulunduğum sesli kanal ("Kanalıma çek" için)
  const myVoiceChannelId = useMemo(() => {
    return voiceChannels.find((c) => voiceStates?.[c.id]?.some((u) => u.userId === user?.uid))?.id || null;
  }, [voiceChannels, voiceStates, user?.uid]);

  if (!currentServer) return null;

  return (
    <div className="w-full sm:w-sidebar h-full flex flex-col shrink-0 relative bg-[#0a0a0c] border-r border-white/5 overflow-hidden">
      {/* Background Effects (Void Theme) */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03] pointer-events-none" />


      {/* 1. DASHBOARD HEADER */}
      <div className="relative z-10 p-4 pb-2" ref={menuRef}>
        <ServerHeader
          server={currentServer}
          showMenu={showMenu}
          onToggleMenu={() => setShowMenu(!showMenu)}
          voiceCount={voiceCount}
          memberCount={members.length}
        />

        {/* Dropdown Menu */}
        {showMenu && (
          <ServerDropdownMenu
            isOwner={isOwner}
            canManageServer={canManageServer}
            canManageChannels={canManageChannels}
            onInvite={() => {
              setShowInviteModal(true);
              setShowMenu(false);
            }}
            onSettings={() => {
              setServerSettings({ isOpen: true, initialTab: "overview" });
              setShowMenu(false);
            }}
            onCreateChannel={() => handleCreateChannel("text")}
            onDeleteServer={handleDeleteServer}
            onLeaveServer={() => {
              setLeaveModalOpen(true);
              setShowMenu(false);
            }}
          />
        )}
      </div>

      {/* 2. CHANNELS SCROLL AREA */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        {/* TEXT CHANNELS */}
        <div>
          <div className="flex items-center justify-between px-2 mb-3">
            <span className="text-[11px] font-extrabold text-[#5c5e66] uppercase tracking-[0.1em]">
              Sohbet
            </span>
            {canManageChannels && (
              <button
                onClick={() => handleCreateChannel("text")}
                className="text-[#5c5e66] hover:text-white transition-colors"
              >
                <Plus size={14} />
              </button>
            )}
          </div>

          <div className="space-y-1">
            {textChannels.map((channel) => {
              const hasUnread = unreadCounts[channel.id] > 0;
              const isActive =
                (currentChannel?.id === channel.id && showChatPanel) ||
                activeTextChannelId === channel.id;
              const isTtsMuted =
                ttsEnabled && mutedTtsChannels.includes(channel.id);

              return (
                <TextChannelItem
                  key={channel.id}
                  channel={channel}
                  isActive={isActive}
                  hasUnread={hasUnread}
                  hasRestrictions={hasRestrictions(channel)}
                  ttsEnabled={ttsEnabled}
                  isTtsMuted={isTtsMuted}
                  onToggleTtsMute={toggleMutedTtsChannel}
                  onClick={() => handleTextChannelClick(channel)}
                  onContextMenu={(e) => handleChannelContextMenu(e, channel)}
                  canReorder={canManageChannels}
                  onReorder={handleReorderChannels}
                />
              );
            })}
          </div>
        </div>

        {/* VOICE CHANNELS */}
        <div>
          <div className="flex items-center justify-between px-2 mb-3">
            <span className="text-[11px] font-extrabold text-[#5c5e66] uppercase tracking-[0.1em]">
              Ses Odaları
            </span>
            {canManageChannels && (
              <button
                onClick={() => handleCreateChannel("voice")}
                className="text-[#5c5e66] hover:text-white transition-colors"
              >
                <Plus size={14} />
              </button>
            )}
          </div>

          <div className="space-y-3">
            {voiceChannels.map((channel) => {
              const isActive =
                voiceStates?.[channel.id]?.some(
                  (u) => u.userId === user?.uid,
                ) || false;

              // ✅ voiceStates sadece room_presence'tan geliyor, profileColor içermiyor.
              // members listesiyle cross-reference yaparak enrich ediyoruz.
              // ✅ CPU OPT: memberMap ile O(1) lookup
              const participants = (voiceStates?.[channel.id] || []).map(
                (p) => {
                  const member = memberMap.get(p.userId);
                  return {
                    ...p,
                    profileColor:
                      member?.profileColor || p.profileColor || null,
                    photoURL: member?.photoURL || p.photoURL || null,
                  };
                },
              );

              return (
                <VoiceChannelItem
                  key={channel.id}
                  channel={channel}
                  isActive={isActive}
                  participants={participants}
                  hasRestrictions={hasRestrictions(channel)}
                  onClick={() => onJoinChannel(channel)}
                  onContextMenu={(e) => handleChannelContextMenu(e, channel)}
                  canMoveUsers={canMoveMembers}
                  canReorder={canManageChannels}
                  onMoveUser={handleMoveUser}
                  onReorder={handleReorderChannels}
                  onParticipantContextMenu={handleParticipantContextMenu}
                  onParticipantDragStart={handleParticipantDragStart}
                  groupAssignments={isActive && groupsReady ? groupAssignments : undefined}
                  myIdentity={isActive && groupsReady ? user?.uid : undefined}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* MODALS */}
      {serverSettings.isOpen && (
        <ServerSettingsModal
          isOpen={serverSettings.isOpen}
          onClose={() =>
            setServerSettings({ ...serverSettings, isOpen: false })
          }
          initialTab={serverSettings.initialTab}
        />
      )}

      <CreateInviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        serverId={currentServer.id}
      />

      <LeaveServerModal
        isOpen={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
        onConfirm={async () => {
          await useServerStore
            .getState()
            .leaveServer(currentServer.id, user.uid);
          setLeaveModalOpen(false);
        }}
        serverName={currentServer.name}
      />

      <CreateChannelModal
        isOpen={createChannelModal.isOpen}
        onClose={() =>
          setCreateChannelModal({ ...createChannelModal, isOpen: false })
        }
        channelType={createChannelModal.type}
        serverId={currentServer.id}
      />

      {deleteModal.isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in"
              onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}
            ></div>
            <div className="relative w-full max-w-md rounded-3xl border border-white/10 shadow-2xl bg-[#111214] overflow-hidden animate-in zoom-in-95">
              <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 text-red-500">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {deleteModal.type === "server"
                    ? "Sunucuyu Yok Et"
                    : "Kanalı Sil"}
                </h3>
                <p className="text-[#949ba4] mb-6">
                  <span className="text-white font-bold">
                    {deleteModal.data?.name}
                  </span>{" "}
                  kalıcı olarak silinecek. Bu işlem geri alınamaz.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() =>
                      setDeleteModal({ ...deleteModal, isOpen: false })
                    }
                    className="px-5 py-2.5 rounded-xl text-[#dbdee1] hover:bg-white/5 transition-colors"
                  >
                    Vazgeç
                  </button>
                  <button
                    onClick={onConfirmDelete}
                    className="px-6 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20"
                  >
                    Sil ve Onayla
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {channelContextMenu && (
        <ChannelContextMenu
          x={channelContextMenu.x}
          y={channelContextMenu.y}
          channel={channelContextMenu.channel}
          onClose={() => setChannelContextMenu(null)}
          onOpenSettings={(channel, initialTab) =>
            setChannelSettings({
              isOpen: true,
              channel,
              initialTab: initialTab || "overview",
            })
          }
        />
      )}

      {participantMenu && (
        <VoiceParticipantContextMenu
          x={participantMenu.x}
          y={participantMenu.y}
          participant={participantMenu.participant}
          currentChannelId={participantMenu.channelId}
          myChannelId={myVoiceChannelId}
          voiceChannels={voiceChannels}
          canMove={canMoveMembers && !participantMenu.isSelf}
          canDisconnect={canDisconnectMembers && !participantMenu.isSelf}
          group={
            participantMenu.canGroup
              ? {
                  groupId: groupAssignments[participantMenu.participant.userId] ?? DEFAULT_GROUP_ID,
                  isSelf: participantMenu.isSelf,
                  onMoveToGroup: (gid) => groupActions.move(participantMenu.participant.userId, gid),
                  onSplit: () =>
                    groupActions.splitWith(
                      participantMenu.participant.userId,
                      (voiceStates?.[participantMenu.channelId] || []).map((u) => u.userId),
                    ),
                  roomSize: (voiceStates?.[participantMenu.channelId] || []).length,
                  myGroupId: groupAssignments[user?.uid] ?? DEFAULT_GROUP_ID,
                }
              : null
          }
          onMove={(toChannelId) => handleMoveUser(participantMenu.participant.userId, toChannelId)}
          onDisconnect={() => handleDisconnectUser(participantMenu.participant.userId)}
          onClose={closeParticipantMenu}
        />
      )}

      <ChannelSettingsModal
        isOpen={channelSettings.isOpen}
        onClose={() => setChannelSettings({ isOpen: false, channel: null })}
        channel={channelSettings.channel}
        initialTab={channelSettings.initialTab}
      />
    </div>
  );
}
