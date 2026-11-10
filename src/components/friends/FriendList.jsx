"use client";

/**
 * 📋 FriendList - Displays all accepted friends
 * Supports filtering by online/all. "Tümü" görünümünde çevrimiçi / çevrimdışı ayrı kartlarda gruplanır.
 */

import { useMemo } from "react";
import { Users, UserX, Globe, Moon } from "lucide-react";
import FriendItem from "./FriendItem";
import { SectionCard, EmptyState } from "./FriendsUI";
import { getEffectivePresence } from "@/src/hooks/usePresence";
import { useRtdbPresenceWatch } from "@/src/lib/rtdbPresence";

export default function FriendList({
  friends,
  filter = "all", // "all" | "online"
  onMessage,
  onRemove,
  onCall,
  realTimeUsers = {},
  unreadDMCounts = {},
  conversations = []
}) {
  // 🟢 Arkadaşların anlık bağlantı durumu: değişince filtre/sıralama/sayaç yeniden hesaplanır
  const friendUids = useMemo(() => friends.map((f) => f.friendData?.uid || f.friendId).filter(Boolean), [friends]);
  const livePresenceVersion = useRtdbPresenceWatch(friendUids);

  // Satırda gösterilen canlı kullanıcı verisiyle aynı kaynaktan hesapla (filtre ile satır tutarlı olsun)
  const { onlineFriends, offlineFriends } = useMemo(() => {
    const byName = (a, b) =>
      (a.friendData?.displayName || "").toLowerCase().localeCompare((b.friendData?.displayName || "").toLowerCase());
    const online = [];
    const offline = [];
    friends.forEach((f) => {
      const live = realTimeUsers[f.friendId] || f.friendData;
      (getEffectivePresence(live) !== "offline" ? online : offline).push(f);
    });
    return { onlineFriends: online.sort(byName), offlineFriends: offline.sort(byName) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friends, realTimeUsers, livePresenceVersion]);

  const renderRow = (friend) => {
    const convo = conversations.find(c => c.participantIds?.includes(friend.friendId));
    const unreadCount = convo ? (unreadDMCounts[convo.id] || 0) : 0;

    return (
      <FriendItem
        key={friend.friendshipId}
        user={realTimeUsers[friend.friendId] || friend.friendData}
        variant="friend"
        friendshipId={friend.friendshipId}
        onMessage={() => onMessage?.(friend.friendData)}
        onRemove={onRemove}
        onCall={() => onCall?.(friend)}
        unreadCount={unreadCount}
      />
    );
  };

  const visibleCount = filter === "online" ? onlineFriends.length : friends.length;

  if (visibleCount === 0) {
    return (
      <EmptyState
        icon={filter === "online" ? Users : UserX}
        title={filter === "online" ? "Kimse çevrimiçi değil" : "Henüz arkadaş yok"}
        description={
          filter === "online"
            ? "Arkadaşların şu anda çevrimdışı görünüyor."
            : "\"Arkadaş Ekle\" sekmesinden kullanıcı arayarak yeni arkadaşlar edinebilirsin."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {onlineFriends.length > 0 && (
        <SectionCard icon={Globe} tone="green" title="Çevrimiçi" count={onlineFriends.length} countTone="green">
          <div className="space-y-1.5">{onlineFriends.map(renderRow)}</div>
        </SectionCard>
      )}

      {filter === "all" && offlineFriends.length > 0 && (
        <SectionCard icon={Moon} tone="slate" title="Çevrimdışı" count={offlineFriends.length}>
          <div className="space-y-1.5">{offlineFriends.map(renderRow)}</div>
        </SectionCard>
      )}
    </div>
  );
}
