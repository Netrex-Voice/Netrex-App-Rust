"use client";

/**
 * 🔍 AddFriendView - Search and add friends
 * Inline view (not a modal) that appears as a tab in FriendsPanel
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, UserPlus, Loader2, Users, Sparkles } from "lucide-react";
import { useFriendStore } from "@/src/store/friendStore";
import { useAuthStore } from "@/src/store/authStore";
import FriendItem from "./FriendItem";
import { SectionCard, EmptyState } from "./FriendsUI";

export default function AddFriendView() {
  const user = useAuthStore((s) => s.user);
  const {
    searchResults,
    isSearching,
    searchUsers,
    clearSearch,
    sendFriendRequest,
    incomingRequests,
    acceptRequest,
  } = useFriendStore();

  const [searchQuery, setSearchQuery] = useState("");
  const searchTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search
  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!value.trim()) {
      clearSearch();
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(value, user?.uid);
    }, 400);
  }, [searchUsers, clearSearch, user?.uid]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      clearSearch();
    };
  }, [clearSearch]);

  const handleSendRequest = async (targetUserId) => {
    if (!user?.uid) return;
    await sendFriendRequest(user.uid, targetUserId);
    // Refresh search to update statuses
    if (searchQuery.trim()) {
      searchUsers(searchQuery, user.uid);
    }
  };

  const handleAcceptFromSearch = async (targetUserId) => {
    const request = incomingRequests.find(r => r.senderId === targetUserId);
    if (request) {
      await acceptRequest(request.id);
      if (searchQuery.trim()) {
        searchUsers(searchQuery, user.uid);
      }
    }
  };

  const hasQuery = !!searchQuery.trim();

  return (
    <div className="flex flex-col gap-4">
      {/* Arama kartı */}
      <SectionCard
        icon={UserPlus}
        tone="emerald"
        title="Arkadaş Ekle"
        description="Netrex kullanıcı adı ile arayabilirsin. En az 2 karakter girmen gerekiyor."
      >
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#949ba4] pointer-events-none">
            {isSearching ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Search size={18} />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Kullanıcı adı ara..."
            className="
              w-full h-12 pl-12 pr-4
              bg-black/30
              text-white placeholder:text-[#5c5e66]
              border border-white/10 rounded-xl
              outline-none
              focus:border-indigo-500/50 focus:shadow-[0_0_20px_rgba(99,102,241,0.15)]
              transition-all duration-300
              text-sm
            "
          />
        </div>
      </SectionCard>

      {/* Sonuçlar */}
      {searchResults.length > 0 && (
        <SectionCard icon={Users} tone="indigo" title="Sonuçlar" count={searchResults.length}>
          <div className="space-y-1.5">
            {searchResults.map((result) => (
              <FriendItem
                key={result.uid}
                user={result}
                variant="search"
                relationshipStatus={result.relationshipStatus}
                onSendRequest={handleSendRequest}
                onAccept={handleAcceptFromSearch}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Sonuç yok */}
      {hasQuery && !isSearching && searchResults.length === 0 && (
        <EmptyState
          icon={Users}
          title="Kullanıcı bulunamadı"
          description={`"${searchQuery}" ile eşleşen kullanıcı bulunamadı.`}
        />
      )}

      {/* Henüz arama yapılmadı */}
      {!hasQuery && (
        <EmptyState
          icon={Sparkles}
          tone="indigo"
          title="Yeni arkadaşlar bul"
          description="Kullanıcı adı yazarak arkadaş ekleyebilirsin."
        />
      )}
    </div>
  );
}
