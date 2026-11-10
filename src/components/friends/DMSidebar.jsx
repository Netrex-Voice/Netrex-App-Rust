"use client";

/**
 * 💬 DMSidebar - Direct Message conversations list
 * Void Theme - ServerSidebar ile aynı tasarım dili:
 * gradyan başlık kartı, rounded-xl satırlar, aktifte soldaki mor parlayan çubuk, soluk bölüm başlıkları.
 */

import { memo, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { MessageCircle, Search, X, Users } from "lucide-react";
import { useDMStore } from "@/src/store/dmStore";
import { useAuthStore } from "@/src/store/authStore";
import { useFriendStore } from "@/src/store/friendStore";
import { getEffectivePresence } from "@/src/hooks/usePresence";
import { useRtdbPresenceWatch } from "@/src/lib/rtdbPresence";
import Avatar from "@/src/components/ui/Avatar";

const presenceLabels = {
  online: "Çevrimiçi",
  idle: "Boşta",
  dnd: "Rahatsız Etme",
  offline: "Çevrimdışı",
};

const presenceText = {
  online: "text-green-400",
  idle: "text-yellow-400",
  dnd: "text-red-400",
  offline: "text-[#5c5e66]",
};

// Firestore Timestamp / sayı / {seconds} → ms
const toMs = (ts) => {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts === "number") return ts;
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return 0;
};

// Satır sonundaki kısa zaman etiketi: şimdi / 5 dk / 3 sa / dün / 3 g / 12 Eki
function shortTime(ms, now) {
  if (!ms) return "";
  const diff = Math.max(0, now - ms);
  const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
  if (diff < MIN) return "şimdi";
  if (diff < HOUR) return `${Math.floor(diff / MIN)} dk`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} sa`;
  if (diff < 2 * DAY) return "dün";
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} g`;
  return new Date(ms).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

const ConversationItem = memo(
  function ConversationItem({ convo, other, otherId, presence, isActive, unread, isMine, timeLabel, onSelect }) {
    const name = other?.displayName || "Bilinmeyen";
    const text = convo.lastMessage?.text || "";
    const hasUnread = unread > 0;
    const isOffline = presence === "offline";

    return (
      <button
        onClick={() => onSelect(convo)}
        className={`
          group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
          text-left transition-all duration-200
          ${isActive ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}
        `}
      >
        {/* Active Pill Indicator (kanal listesiyle aynı) */}
        {isActive && (
          <div className="absolute left-0 h-6 w-1 bg-purple-500 rounded-r-full shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
        )}

        {/* Avatar */}
        <div className={`relative flex-shrink-0 transition-opacity duration-200 ${isOffline && !isActive && !hasUnread ? "opacity-70 group-hover:opacity-100" : ""}`}>
          <Avatar
            uid={otherId}
            src={other?.photoURL}
            name={name}
            color={other?.profileColor}
            size="lg"
            status={presence}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-sm truncate ${hasUnread || isActive ? "font-semibold text-white" : "font-medium text-[#dbdee1] group-hover:text-white"}`}>
              {name}
            </p>
            {timeLabel && (
              <span className={`text-[10px] flex-shrink-0 ${hasUnread ? "text-purple-300 font-semibold" : "text-[#5c5e66]"}`}>
                {timeLabel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            {text ? (
              <p className={`text-xs truncate flex-1 ${hasUnread ? "text-[#dbdee1]" : "text-[#5c5e66]"}`}>
                {isMine && <span className="text-[#949ba4]">Sen: </span>}
                {text}
              </p>
            ) : (
              <p className={`text-xs truncate flex-1 ${presenceText[presence] || presenceText.offline}`}>
                {presenceLabels[presence] || "Çevrimdışı"}
              </p>
            )}

            {hasUnread && (
              <span className="
                min-w-[18px] h-[18px] px-1.5 rounded-full
                bg-red-500 text-white
                text-[10px] font-bold leading-none
                flex items-center justify-center flex-shrink-0
                shadow-[0_0_8px_rgba(239,68,68,0.4)]
              ">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  },
  (prev, next) =>
    prev.convo === next.convo &&
    prev.other === next.other &&
    prev.otherId === next.otherId &&
    prev.presence === next.presence &&
    prev.isActive === next.isActive &&
    prev.unread === next.unread &&
    prev.isMine === next.isMine &&
    prev.timeLabel === next.timeLabel &&
    prev.onSelect === next.onSelect,
);

export default function DMSidebar({
  onSelectConversation,
  onOpenFriends,
  activeConversationId,
  showFriendsPanel,
}) {
  const user = useAuthStore((s) => s.user);
  // Seçicisiz abonelik depodaki her değişiklikte (mesajlar, yazıyor bilgisi…) listeyi yeniden çiziyordu
  const { conversations, unreadDMCounts, users: realTimeUsers } = useDMStore(
    useShallow((s) => ({
      conversations: s.conversations,
      unreadDMCounts: s.unreadDMCounts,
      users: s.users,
    })),
  );
  const incomingRequests = useFriendStore((s) => s.incomingRequests);
  const [searchQuery, setSearchQuery] = useState("");

  // Zaman etiketleri ("5 dk") kimse bir şey yazmasa da güncellensin
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const pendingCount = incomingRequests.length;
  const totalUnread = useMemo(
    () => Object.values(unreadDMCounts).reduce((sum, n) => sum + n, 0),
    [unreadDMCounts],
  );

  // 🟢 Sohbet ettiğin kişilerin anlık bağlantı durumu (kopunca anında çevrimdışı görünür)
  const partnerUids = useMemo(
    () => conversations.map((c) => c.participantIds?.find((id) => id !== user?.uid)).filter(Boolean),
    [conversations, user?.uid],
  );
  const livePresenceVersion = useRtdbPresenceWatch(partnerUids);

  const filteredConvos = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(c =>
      (c.otherUser?.displayName || "").toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  return (
    <div className="w-sidebar h-full flex flex-col shrink-0 relative bg-[#0a0a0c] border-r border-white/5 overflow-hidden">
      {/* Background Effects (Void Theme) */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03] pointer-events-none" />

      {/* 1. HEADER — sunucu başlığıyla aynı kart dili */}
      <div className="relative z-10 p-4 pb-2">
        <div className="
          relative overflow-hidden group flex items-center gap-3
          p-4 rounded-3xl border border-white/10
          bg-gradient-to-br from-[#16171a] to-[#111214]
          hover:border-white/20 hover:shadow-lg transition-all duration-300
        ">
          <div className="absolute inset-0 bg-white/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg flex-shrink-0 relative z-10">
            <MessageCircle size={20} className="text-white" />
          </div>

          <div className="min-w-0 relative z-10">
            <h1 className="font-bold text-lg text-white tracking-tight truncate">Mesajlar</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`flex w-2 h-2 rounded-full ${
                  totalUnread > 0
                    ? "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]"
                    : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                }`}
              />
              <span className="text-xs text-[#949ba4] font-medium truncate">
                {totalUnread > 0 ? `${totalUnread} okunmamış` : `${conversations.length} sohbet`}
              </span>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mt-3">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5c5e66] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Sohbet ara..."
            className="
              w-full h-10 pl-10 pr-9
              bg-[#16171a] rounded-xl
              text-sm text-[#dbdee1] placeholder:text-[#5c5e66]
              border border-white/10
              outline-none focus:border-indigo-500/40 focus:shadow-[0_0_20px_rgba(99,102,241,0.12)]
              transition-all duration-200
            "
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5c5e66] hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 2. NAVIGATION */}
      <div className="relative z-10 px-4 pb-1">
        {/* Arkadaşlar Button (kanal satırıyla aynı: aktifte mor çubuk) */}
        <button
          onClick={onOpenFriends}
          className={`
            group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
            transition-all duration-200
            ${showFriendsPanel ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}
          `}
        >
          {showFriendsPanel && (
            <div className="absolute left-0 h-6 w-1 bg-purple-500 rounded-r-full shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
          )}
          <Users
            size={18}
            className={`${showFriendsPanel ? "text-purple-400" : "text-[#5c5e66] group-hover:text-[#949ba4]"} transition-colors`}
          />
          <span className={`flex-1 text-left text-sm font-medium ${showFriendsPanel ? "text-white" : "text-[#949ba4] group-hover:text-[#dbdee1]"}`}>
            Arkadaşlar
          </span>
          {pendingCount > 0 && (
            <span className="
              min-w-[18px] h-[18px] px-1.5 rounded-full
              bg-red-500 text-white
              text-[10px] font-bold leading-none
              flex items-center justify-center
              shadow-[0_0_8px_rgba(239,68,68,0.4)]
            ">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* 3. DM LIST */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#2b2d31] scrollbar-track-transparent p-4 pt-3">
        {/* Section Header */}
        <div className="flex items-center justify-between px-2 mb-3">
          <span className="text-[11px] font-extrabold text-[#5c5e66] uppercase tracking-[0.1em]">
            Direkt Mesajlar
          </span>
          {filteredConvos.length > 0 && (
            <span className="text-[10px] font-bold text-[#5c5e66]">{filteredConvos.length}</span>
          )}
        </div>

        {/* Empty State */}
        {filteredConvos.length === 0 && (
          <div className="flex flex-col items-center pt-8 pb-4 px-3 text-center">
            <div className="
              w-12 h-12 rounded-2xl
              bg-gradient-to-br from-[#2b2d31] to-[#1e1f22]
              border border-white/5 shadow-lg
              flex items-center justify-center mb-3
            ">
              <MessageCircle size={22} className="text-[#5c5e66]" />
            </div>
            <p className="text-sm font-semibold text-white mb-1">
              {searchQuery ? "Sonuç bulunamadı" : "Henüz mesajın yok"}
            </p>
            <p className="text-xs text-[#5c5e66] leading-relaxed">
              {searchQuery ? "Farklı bir isim dene." : "Arkadaş ekleyerek sohbet başlatabilirsin."}
            </p>
            {!searchQuery && (
              <button
                onClick={onOpenFriends}
                className="
                  mt-4 px-3.5 py-2 rounded-xl
                  bg-indigo-500/15 border border-indigo-500/30
                  text-indigo-300 text-xs font-semibold
                  hover:bg-indigo-500/30 hover:text-white
                  transition-all duration-200
                "
              >
                Arkadaşlara git
              </button>
            )}
          </div>
        )}

        {/* Conversation Items */}
        <div className="space-y-1">
          {filteredConvos.map((convo) => {
            const otherId = convo.participantIds.find(id => id !== user?.uid);
            const other = realTimeUsers[otherId] || convo.otherUser; // Fallback to initial static data
            const presence = getEffectivePresence(other && !other.uid ? { ...other, uid: otherId } : other);

            return (
              <ConversationItem
                key={convo.id}
                convo={convo}
                other={other}
                otherId={otherId}
                presence={presence}
                isActive={activeConversationId === convo.id}
                unread={unreadDMCounts[convo.id] || 0}
                isMine={!!user?.uid && convo.lastMessage?.senderId === user.uid}
                timeLabel={shortTime(toMs(convo.lastMessageAt), nowTick)}
                onSelect={onSelectConversation}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
