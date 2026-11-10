"use client";

/**
 * 🪟 Titlebar - Custom Window Titlebar
 * NDS v2.0 - Netrex Design System
 * 
 * A draggable custom titlebar for Electron with:
 * - App logo & title
 * - Window controls (minimize, maximize, close)
 * - Glassmorphism effect
 */

import { useState, useEffect, useCallback } from "react";
import { Minus, Square, X, Copy } from "lucide-react";

export default function Titlebar({ 
  title = "Netrex",
  showLogo = true,
  className = "" 
}) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    const checkElectron = typeof window !== "undefined" && !!window.netrex;
    setIsElectron(checkElectron);

    // Listen for maximize/unmaximize events
    if (checkElectron && window.netrex.onWindowStateChange) {
      window.netrex.onWindowStateChange((state) => {
        setIsMaximized(state === "maximized");
      });
    }
  }, []);

  const handleMinimize = useCallback(() => {
    if (window.netrex?.minimizeWindow) {
      window.netrex.minimizeWindow();
    }
  }, []);

  const handleMaximize = useCallback(() => {
    if (window.netrex?.maximizeWindow) {
      window.netrex.maximizeWindow();
    }
  }, []);

  const handleClose = useCallback(() => {
    if (window.netrex?.closeWindow) {
      window.netrex.closeWindow();
    }
  }, []);

  if (!isElectron) return null;

  return (
    <header className={`
      titlebar
      h-8
      w-full
      flex items-center justify-between
      bg-transparent
      absolute top-0 left-0 z-50
      select-none
      ${className}
    `}>
      {/* Left: Logo & Title (Draggable) */}
      <div className="
        flex items-center gap-2
        h-full px-3
        drag-region
        flex-1
      ">
        {showLogo && (
          <div className="
            w-5 h-5
            rounded-md
            bg-nds-gradient-primary
            flex items-center justify-center
            no-drag
          ">
            <span className="text-[10px] font-bold text-white">N</span>
          </div>
        )}
        <span className="
          text-nds-text-secondary
          text-small
          font-medium
          tracking-wide
        ">
          {title}
        </span>
      </div>

      {/* Right: Window Controls */}
      <div className="
        flex items-center
        h-full
        no-drag
      ">
        {/* Minimize */}
        <button
          onClick={handleMinimize}
          className="
            h-titlebar w-12
            flex items-center justify-center
            text-nds-text-tertiary
            hover:bg-white/10
            hover:text-nds-text-primary
            transition-all duration-fast
            focus:outline-none
          "
          aria-label="Pencereyi küçült"
        >
          <Minus size={14} strokeWidth={2} />
        </button>

        {/* Maximize/Restore */}
        <button
          onClick={handleMaximize}
          className="
            h-titlebar w-12
            flex items-center justify-center
            text-nds-text-tertiary
            hover:bg-white/10
            hover:text-nds-text-primary
            transition-all duration-fast
            focus:outline-none
          "
          aria-label={isMaximized ? "Pencereyi geri yükle" : "Pencereyi büyüt"}
        >
          {isMaximized ? (
            <Copy size={12} strokeWidth={2} className="rotate-180" />
          ) : (
            <Square size={11} strokeWidth={2} />
          )}
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          className="
            h-titlebar w-12
            flex items-center justify-center
            text-nds-text-tertiary
            hover:bg-nds-danger
            hover:text-white
            transition-all duration-fast
            focus:outline-none
          "
          aria-label="Pencereyi kapat"
        >
          <X size={15} strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}
