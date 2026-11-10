"use client";

/**
 * 📱 MobileNavBar — Alt Navigasyon Çubuğu
 * Mobil web'de ServerRail'in yerini alır.
 * Tam ekran butonu, Sunucular, Mesajlar, Ayarlar ve Ana Sayfa barındırır.
 */

import { useState, useEffect } from "react";
import { Home, MessageCircle, Server, Users, Settings, Maximize, Minimize } from "lucide-react";

export default function MobileNavBar({
  friendsMode,
  hasCurrentServer,
  onGoHome,
  onToggleFriendsMode,
  onOpenServers,
  onOpenMembers,
  onOpenSettings,
  messengerBadge = 0,
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
          document.documentElement.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    } catch (e) {
      console.warn("Fullscreen toggle error:", e);
    }
  };

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

      {/* Fullscreen Toggle */}
      <button
        className={`mobile-nav-item ${isFullscreen ? "active" : ""}`}
        onClick={toggleFullscreen}
        title={isFullscreen ? "Tam Ekrandan Çık" : "Tam Ekran Yap"}
      >
        {isFullscreen ? (
          <Minimize className="mobile-nav-icon text-indigo-400" />
        ) : (
          <Maximize className="mobile-nav-icon" />
        )}
        <span>{isFullscreen ? "Küçült" : "Tam Ekran"}</span>
      </button>
    </nav>
  );
}

