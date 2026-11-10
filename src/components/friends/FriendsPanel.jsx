"use client";

/**
 * 🏠 FriendsPanel - Main friends view with tabs
 * Netrex tasarım dili: void arka plan, gradyan banner (Ayarlar sekmeleriyle aynı), glass-strong kartlar.
 */

import { useState, useMemo, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { Users, UserPlus, Inbox, Globe } from "lucide-react";
import { useFriendStore } from "@/src/store/friendStore";
import { useAuthStore } from "@/src/store/authStore";
import { useDMStore } from "@/src/store/dmStore";
import FriendList from "./FriendList";
import FriendRequestList from "./FriendRequestList";
import AddFriendView from "./AddFriendView";
import Modal from "@/src/components/ui/Modal";
import Button from "@/src/components/ui/Button";
import { toast } from "@/src/utils/toast";
import { getEffectivePresence } from "@/src/hooks/usePresence";
import { useRtdbPresenceWatch } from "@/src/lib/rtdbPresence";

// Sekme kimliği → görünüm. Tailwind sınıfları tam metin (JIT).
const TABS = [
  { id: "online", label: "Çevrimiçi", icon: Globe },
  { id: "all", label: "Tümü", icon: Users },
  { id: "pending", label: "Bekleyen", icon: Inbox },
  { id: "add", label: "Arkadaş Ekle", icon: UserPlus, accent: "emerald" },
];

const ACTIVE_STYLES = {
  default: "bg-gradient-to-r from-indigo-500/25 to-purple-500/25 border-indigo-500/30 text-white shadow-[0_0_20px_rgba(99,102,241,0.15)]",
  emerald: "bg-gradient-to-r from-emerald-500/25 to-green-500/25 border-emerald-500/30 text-white shadow-[0_0_20px_rgba(16,185,129,0.15)]",
};

export default function FriendsPanel({ onOpenDM }) {
  const [activeTab, setActiveTab] = useState("online");
  const user = useAuthStore((s) => s.user);
  // Seçicisiz abonelik depodaki her değişiklikte (arama sonuçları, engellenenler…) paneli yeniden çiziyordu
  const {
    friends,
    incomingRequests,
    outgoingRequests,
    acceptRequest,
    rejectRequest,
    removeFriend,
  } = useFriendStore(
    useShallow((s) => ({
      friends: s.friends,
      incomingRequests: s.incomingRequests,
      outgoingRequests: s.outgoingRequests,
      acceptRequest: s.acceptRequest,
      rejectRequest: s.rejectRequest,
      removeFriend: s.removeFriend,
    })),
  );
  const { users: realTimeUsers, unreadDMCounts, conversations, startUserPresenceListener } = useDMStore(
    useShallow((s) => ({
      users: s.users,
      unreadDMCounts: s.unreadDMCounts,
      conversations: s.conversations,
      startUserPresenceListener: s.startUserPresenceListener,
    })),
  );

  const pendingCount = incomingRequests.length;

  // ENSURE we are listening to real-time presence of all friends
  useEffect(() => {
    friends.forEach(f => {
      if (f.friendId && !realTimeUsers[f.friendId]) {
        startUserPresenceListener(f.friendId);
      }
    });
  }, [friends, realTimeUsers, startUserPresenceListener]);

  // Banner / sekme sayaçları için çevrimiçi sayısı (RTDB bağlantı durumu dahil, canlı)
  const friendUids = useMemo(() => friends.map((f) => f.friendData?.uid || f.friendId).filter(Boolean), [friends]);
  const livePresenceVersion = useRtdbPresenceWatch(friendUids);
  const onlineCount = useMemo(
    () => friends.filter((f) => getEffectivePresence(realTimeUsers[f.friendId] || f.friendData) !== "offline").length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [friends, realTimeUsers, livePresenceVersion],
  );

  const [removeConfirm, setRemoveConfirm] = useState({
    isOpen: false,
    friendshipId: null,
    friendDisplayName: ""
  });

  const handleRemoveClick = (friendshipId, friendDisplayName) => {
    setRemoveConfirm({
      isOpen: true,
      friendshipId,
      friendDisplayName
    });
  };

  const confirmRemove = async () => {
    if (!removeConfirm.friendshipId) return;

    try {
      await removeFriend(removeConfirm.friendshipId);
    } catch (error) {
      toast.error("Arkadaş silinirken hata oluştu.");
    } finally {
      setRemoveConfirm({ isOpen: false, friendshipId: null, friendDisplayName: "" });
    }
  };

  const handleCall = async (targetId) => {
    if (!user?.uid || !targetId) return;
    try {
      const { openOrCreateConversation, startCall } = useDMStore.getState();
      const conversationId = await openOrCreateConversation(user.uid, targetId);
      if (conversationId) {
        await startCall(conversationId, user.uid);
      } else {
        toast.error("Sohbet oluşturulamadı.");
      }
    } catch (error) {
      console.error("Call error:", error);
      toast.error("Arama başlatılamadı.");
    }
  };

  // Sekme üzerindeki sayaç rozeti
  const tabBadge = (tabId) => {
    if (tabId === "pending" && pendingCount > 0) {
      return { value: pendingCount, className: "bg-red-500 text-white" };
    }
    if (tabId === "online" && onlineCount > 0) {
      return { value: onlineCount, className: "bg-green-500/20 text-green-400 border border-green-500/25" };
    }
    return null;
  };

  return (
    <div className="
      h-full w-full flex flex-col relative overflow-hidden
      bg-gradient-to-br from-[#111214] via-[#16171a] to-[#0f1012]
    ">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black_40%,transparent_100%)]" />
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#2b2d31] scrollbar-track-transparent">
        <div className="mx-auto w-full max-w-3xl px-3 sm:px-6 py-4 sm:py-6">
          {/* ── Banner (Ayarlar sekmeleriyle aynı gradyan şerit) ── */}
          <div className="glass-strong rounded-2xl overflow-hidden border border-white/20 shadow-soft-lg mb-4 relative">
            <div className="h-20 w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 relative overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30"></div>
              <div className="absolute inset-0 flex items-center justify-between gap-3 px-4 sm:px-6">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-lg flex-shrink-0">
                    <Users size={24} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-white font-bold text-lg truncate">Arkadaşlar</h4>
                    <p className="text-white/70 text-sm truncate">
                      {friends.length > 0 ? `${friends.length} arkadaş` : "Henüz arkadaş eklemedin"}
                    </p>
                  </div>
                </div>

                {/* Canlı sayaçlar */}
                <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/25 border border-white/15">
                    <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
                    <span className="text-xs font-semibold text-white">{onlineCount} çevrimiçi</span>
                  </div>
                  {pendingCount > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/25 border border-white/15">
                      <Inbox size={13} className="text-white" />
                      <span className="text-xs font-semibold text-white">{pendingCount} istek</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Sekmeler ── */}
          <div className="glass-strong rounded-2xl border border-white/20 shadow-soft-lg p-1.5 mb-4 flex items-center gap-1 overflow-x-auto scrollbar-hidden">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const badge = tabBadge(tab.id);
              const activeStyle = ACTIVE_STYLES[tab.accent] || ACTIVE_STYLES.default;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex-1 min-w-fit flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl border
                    text-xs font-semibold whitespace-nowrap transition-all duration-200
                    ${isActive
                      ? activeStyle
                      : tab.accent === "emerald"
                        ? "border-transparent text-emerald-400 hover:bg-emerald-500/10"
                        : "border-transparent text-[#949ba4] hover:text-white hover:bg-white/5"
                    }
                  `}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                  {badge && (
                    <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-none flex items-center justify-center ${badge.className}`}>
                      {badge.value}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── İçerik (sekme değişince yumuşak geçiş) ── */}
          <div key={activeTab} className="animate-nds-slide-up">
            {activeTab === "online" && (
              <FriendList
                friends={friends}
                filter="online"
                onMessage={(friendData) => onOpenDM?.(friendData)}
                onCall={(friend) => handleCall(friend.friendId)}
                realTimeUsers={realTimeUsers}
                unreadDMCounts={unreadDMCounts}
                conversations={conversations}
              />
            )}

            {activeTab === "all" && (
              <FriendList
                friends={friends}
                filter="all"
                onMessage={(friendData) => onOpenDM?.(friendData)}
                onRemove={(id) => {
                  const friend = friends.find(f => f.friendshipId === id);
                  handleRemoveClick(id, friend?.friendData?.displayName || "bu kişi");
                }}
                onCall={(friend) => handleCall(friend.friendId)}
                realTimeUsers={realTimeUsers}
                unreadDMCounts={unreadDMCounts}
                conversations={conversations}
              />
            )}

            {activeTab === "pending" && (
              <FriendRequestList
                incomingRequests={incomingRequests}
                outgoingRequests={outgoingRequests}
                onAccept={acceptRequest}
                onReject={rejectRequest}
                onCancelRequest={rejectRequest}
              />
            )}

            {activeTab === "add" && (
              <AddFriendView />
            )}
          </div>
        </div>
      </div>

      {/* ── Remove Confirmation Modal ── */}
      <Modal
        isOpen={removeConfirm.isOpen}
        onClose={() => setRemoveConfirm({ ...removeConfirm, isOpen: false })}
        title="Arkadaşı Sil"
        size="sm"
      >
        <div className="flex flex-col gap-4 py-2">
          <p className="text-sm text-[#dbdee1] leading-relaxed">
            <strong className="text-white">{removeConfirm.friendDisplayName}</strong> isimli kişiyi arkadaş listenden silmek istediğine emin misin? Bu işlem geri alınamaz.
          </p>

          <div className="flex items-center justify-end gap-3 mt-4">
            <button
              onClick={() => setRemoveConfirm({ ...removeConfirm, isOpen: false })}
              className="px-4 py-2 text-sm font-semibold text-white hover:underline transition-all"
            >
              Vazgeç
            </button>
            <Button
              variant="danger"
              size="md"
              onClick={confirmRemove}
            >
              Arkadaşlıktan Çıkart
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
