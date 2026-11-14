"use client";

/**
 * 📱 MobileNavBar — Alt Navigasyon Çubuğu
 * Mobil web'de ServerRail'in yerini alır.
 * Ana Sayfa, Mesajlar, Sunucular, Kanallar/Sohbetler, Üyeler ve Ayarlar barındırır.
 */

import { Home, MessageCircle, Server, Users, Settings, Hash, MessagesSquare } from "lucide-react";

export default function MobileNavBar({
  friendsMode,
  hasCurrentServer,
  onGoHome,
  onToggleFriendsMode,
  onOpenServers,
  onOpenSidebar,
  sidebarLabel = "Kanallar",
  onOpenMembers,
  onOpenSettings,
  messengerBadge = 0,
}) {
  return (
    <nav className="mobile-bottom-nav mobile-only">
      {/* Home */}
      <button
        className={`mobile-nav-item ${!friendsMode && !hasCurrentServer ? "active" : ""}`}
        onClick={onGoHome}
      >
        <Home className="mobile-nav-icon" />
        <span>Ana Sayfa</span>
      </button>

      {/* Messages */}
      <button
        className={`mobile-nav-item ${friendsMode ? "active" : ""}`}
        onClick={onToggleFriendsMode}
      >
        <MessageCircle className="mobile-nav-icon" />
        <span>Mesajlar</span>
        {messengerBadge > 0 && (
          <span className="mobile-nav-badge">
            {messengerBadge > 99 ? "99+" : messengerBadge}
          </span>
        )}
      </button>

      {/* Servers */}
      <button
        className={`mobile-nav-item ${hasCurrentServer && !friendsMode ? "active" : ""}`}
        onClick={onOpenServers}
      >
        <Server className="mobile-nav-icon" />
        <span>Sunucular</span>
      </button>

      {/* Kanallar (sunucu) / Sohbetler (mesajlar): sol kenar çubuğunu çekmece olarak açar */}
      {onOpenSidebar && (
        <button className="mobile-nav-item" onClick={onOpenSidebar}>
          {sidebarLabel === "Kanallar" ? <Hash className="mobile-nav-icon" /> : <MessagesSquare className="mobile-nav-icon" />}
          <span>{sidebarLabel}</span>
        </button>
      )}

      {/* Members (Only when in a server) */}
      {hasCurrentServer && (
        <button
          className="mobile-nav-item"
          onClick={onOpenMembers}
        >
          <Users className="mobile-nav-icon text-indigo-400" />
          <span>Üyeler</span>
        </button>
      )}

      {/* Settings */}
      <button
        className="mobile-nav-item"
        onClick={onOpenSettings}
      >
        <Settings className="mobile-nav-icon" />
        <span>Ayarlar</span>
      </button>

    </nav>
  );
}

