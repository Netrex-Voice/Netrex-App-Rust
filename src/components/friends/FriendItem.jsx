"use client";

/**
 * 👤 FriendItem - Single friend row with actions
 * Used in FriendList, friend requests and search results.
 * Netrex tasarım dili: koyu inset satır, hover'da indigo kenarlık + sol vurgu çubuğu (üye listesiyle aynı),
 * yumuşak tonlu eylem düğmeleri.
 */

import { useState, useEffect } from "react";
import { MessageCircle, UserMinus, UserPlus, Check, X, Clock, Phone } from "lucide-react";
import { getEffectivePresence } from "@/src/hooks/usePresence";
import Avatar from "@/src/components/ui/Avatar";

const presenceText = {
  online: "text-green-400",
  idle: "text-yellow-400",
  dnd: "text-red-400",
  offline: "text-[#949ba4]",
};

const presenceLabels = {
  online: "Çevrimiçi",
  idle: "Boşta",
  dnd: "Rahatsız Etme",
  offline: "Çevrimdışı",
};

export default function FriendItem({
  user,
  variant = "friend", // "friend" | "incoming" | "outgoing" | "search"
  relationshipStatus, // for search: "none" | "friend" | "incoming" | "outgoing"
  onMessage,
  onAccept,
  onReject,
  onRemove,
  onSendRequest,
  onCancelRequest,
  onCall,
  friendshipId,
  unreadCount = 0,
}) {
  const [actionLoading, setActionLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);

  // Close context menu on click elsewhere - ✅ Sadece menü açıkken listener ekle
  useEffect(() => {
    if (!contextMenu) return;
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, [contextMenu]);

  const handleContextMenu = (e) => {
    if (variant !== "friend") return;
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY
    });
  };

  if (!user) return null;

  const presence = getEffectivePresence(user);
  const isOffline = presence === "offline";
  const isFriendRow = variant === "friend";

  const handleAction = async (fn) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await fn?.();
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div
      className={`
        group/row relative flex items-center gap-3 px-3.5 py-2.5
        bg-black/25 rounded-xl border border-white/5
        hover:border-indigo-500/25 hover:bg-black/35
        transition-all duration-200
        ${isFriendRow ? "cursor-pointer" : "cursor-default"}
      `}
      onClick={() => { if (isFriendRow) onMessage?.(); }}
      onContextMenu={handleContextMenu}
    >
      {/* Sol vurgu çubuğu (üye listesindeki gibi) */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-indigo-500 rounded-r opacity-0 group-hover/row:opacity-100 transition-opacity duration-200" />

      {/* Avatar (uygulamanın tek Avatar bileşeni: üye listesi, ses odası, mesajlarla aynı şekil/yedek/durum noktası) */}
      <div className={`relative flex-shrink-0 transition-opacity duration-200 ${isFriendRow && isOffline ? "opacity-60 group-hover/row:opacity-100" : ""}`}>
        <Avatar
          uid={user.uid || user.id}
          src={user.photoURL}
          name={user.displayName}
          color={user.profileColor}
          size="lg"
          status={variant !== "search" ? presence : undefined}
        />
      </div>

      {/* Info */}
      <div className={`flex-1 min-w-0 transition-opacity duration-200 ${isFriendRow && isOffline ? "opacity-70 group-hover/row:opacity-100" : ""}`}>
        <p className="text-sm font-semibold text-white truncate">
          {user.displayName || "Bilinmeyen"}
        </p>
        <p className="text-xs truncate flex items-center gap-1.5">
          {variant === "incoming" ? (
            <span className="text-[#949ba4]">Arkadaşlık isteği gönderdi</span>
          ) : variant === "outgoing" ? (
            <span className="text-[#949ba4]">İstek gönderildi</span>
          ) : variant === "search" ? (
            <span className="text-[#949ba4]">{user.username ? `@${user.username}` : ""}</span>
          ) : (
            <>
              <span className={`font-medium ${presenceText[presence] || presenceText.offline}`}>
                {presenceLabels[presence] || "Çevrimdışı"}
              </span>
              {user.username && <span className="text-[#5c5e66] truncate">· @{user.username}</span>}
            </>
          )}
        </p>
      </div>

      {/* Unread Badge */}
      {unreadCount > 0 && (
        <div className="
          min-w-[20px] h-5 px-1.5 rounded-full
          bg-[#f23f43] border-2 border-[#16171a]
          flex items-center justify-center
          animate-pulse shadow-[0_0_8px_rgba(242,63,67,0.4)]
        ">
          <span className="text-[11px] font-bold text-white leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Friend actions */}
        {isFriendRow && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onMessage?.(); }}
              className="
                w-9 h-9 rounded-xl flex items-center justify-center
                bg-indigo-500/10 border border-indigo-500/20
                text-indigo-300 hover:text-white hover:bg-indigo-500/30 hover:border-indigo-500/40
                transition-all duration-200
              "
              title="Mesaj Gönder"
            >
              <MessageCircle size={16} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onCall?.(user); }}
              className="
                w-9 h-9 rounded-xl flex items-center justify-center
                bg-green-500/10 border border-green-500/20
                text-green-400 hover:text-white hover:bg-green-500/30 hover:border-green-500/40
                transition-all duration-200
              "
              title="Sesli Ara"
            >
              <Phone size={16} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleAction(() => onRemove?.(friendshipId)); }}
              className="
                w-9 h-9 rounded-xl flex items-center justify-center
                bg-white/5 border border-white/10
                text-[#b5bac1] hover:text-red-400 hover:bg-red-500/15 hover:border-red-500/30
                transition-all duration-200
                hidden sm:flex opacity-0 group-hover/row:opacity-100
              "
              title="Arkadaşlıktan Çıkart"
              style={onRemove ? undefined : { display: "none" }}
            >
              <UserMinus size={16} />
            </button>
          </>
        )}

        {/* Incoming request actions */}
        {variant === "incoming" && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); handleAction(() => onAccept?.(friendshipId)); }}
              disabled={actionLoading}
              className="
                w-9 h-9 rounded-xl flex items-center justify-center
                bg-green-500/15 border border-green-500/30
                text-green-400 hover:text-white hover:bg-green-500/35
                transition-all duration-200
                disabled:opacity-50
              "
              title="Kabul Et"
            >
              <Check size={16} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleAction(() => onReject?.(friendshipId)); }}
              disabled={actionLoading}
              className="
                w-9 h-9 rounded-xl flex items-center justify-center
                bg-red-500/15 border border-red-500/30
                text-red-400 hover:text-white hover:bg-red-500/35
                transition-all duration-200
                disabled:opacity-50
              "
              title="Reddet"
            >
              <X size={16} />
            </button>
          </>
        )}

        {/* Outgoing request actions */}
        {variant === "outgoing" && (
          <button
            onClick={(e) => { e.stopPropagation(); handleAction(() => onCancelRequest?.(friendshipId)); }}
            disabled={actionLoading}
            className="
              px-3 h-9 rounded-xl flex items-center justify-center gap-1.5
              bg-white/5 border border-white/10
              text-[#b5bac1] hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/25
              transition-all duration-200 text-xs font-medium
              disabled:opacity-50
            "
            title="İptal Et"
          >
            <Clock size={14} />
            <span>Bekliyor</span>
          </button>
        )}

        {/* Search result actions */}
        {variant === "search" && (
          <>
            {relationshipStatus === "none" && (
              <button
                onClick={(e) => { e.stopPropagation(); handleAction(() => onSendRequest?.(user.uid)); }}
                disabled={actionLoading}
                className="
                  px-3 h-9 rounded-xl flex items-center justify-center gap-1.5
                  bg-indigo-500/15 border border-indigo-500/30
                  text-indigo-300 hover:text-white hover:bg-indigo-500/35
                  transition-all duration-200 text-xs font-semibold
                  disabled:opacity-50
                "
              >
                <UserPlus size={14} />
                <span>Ekle</span>
              </button>
            )}
            {relationshipStatus === "friend" && (
              <span className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium border border-green-500/20">
                Arkadaş
              </span>
            )}
            {relationshipStatus === "outgoing" && (
              <span className="px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 text-xs font-medium border border-yellow-500/20 flex items-center gap-1">
                <Clock size={12} />
                Gönderildi
              </span>
            )}
            {relationshipStatus === "blocked" && (
              <span className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20">
                Engellendi
              </span>
            )}
            {relationshipStatus === "incoming" && (
              <button
                onClick={(e) => { e.stopPropagation(); handleAction(() => onAccept?.(user.uid)); }}
                disabled={actionLoading}
                className="
                  px-3 h-9 rounded-xl flex items-center justify-center gap-1.5
                  bg-green-500/15 border border-green-500/30
                  text-green-400 hover:text-white hover:bg-green-500/35
                  transition-all duration-200 text-xs font-semibold
                  disabled:opacity-50
                "
              >
                <Check size={14} />
                <span>Kabul Et</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Context Menu ── */}
      {contextMenu && (
        <div
          className="fixed z-[1000] w-48 bg-[#111214] border border-white/10 shadow-2xl rounded-xl py-1.5 animate-nds-scale-in"
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 180),
            left: Math.min(contextMenu.x, window.innerWidth - 200),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { onCall?.(); setContextMenu(null); }}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-[#dbdee1] hover:bg-white/5 hover:text-white transition-colors"
          >
            <Phone size={14} className="text-[#949ba4]" />
            Ara
          </button>
          <button
            onClick={() => { onMessage?.(); setContextMenu(null); }}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-[#dbdee1] hover:bg-white/5 hover:text-white transition-colors"
          >
            <MessageCircle size={14} className="text-[#949ba4]" />
            Mesajlara Git
          </button>
          <div className="h-px bg-white/5 my-1 mx-2" />
          <button
            onClick={() => { handleAction(() => onRemove?.(friendshipId)); setContextMenu(null); }}
            style={onRemove ? undefined : { display: "none" }}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <UserMinus size={14} />
            Arkadaşlıktan Çıkar
          </button>
        </div>
      )}
    </div>
  );
}
