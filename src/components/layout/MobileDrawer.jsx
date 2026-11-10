"use client";

/**
 * 📱 MobileDrawer — Genel Amaçlı Mobil Drawer
 * Sol/sağ yönden açılır, backdrop'a tıklayınca kapanır.
 * Sadece web modunda kullanılır (Electron'da render edilmez).
 */

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export default function MobileDrawer({ 
  isOpen, 
  onClose, 
  children, 
  side = "left", // "left" | "right"
  width = "85vw",
  maxWidth = "320px",
  title,
  showCloseButton = true,
}) {
  // ESC ile kapat
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  // Body scroll'u kilitle
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const slideVariants = {
    left: {
      initial: { x: "-100%" },
      animate: { x: 0 },
      exit: { x: "-100%" },
    },
    right: {
      initial: { x: "100%" },
      animate: { x: 0 },
      exit: { x: "100%" },
    },
  };

  const variants = slideVariants[side];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="mobile-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Drawer Panel */}
          <motion.div
            className={`mobile-drawer ${side === "left" ? "mobile-drawer-left" : "mobile-drawer-right"}`}
            style={{ width, maxWidth }}
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            {Boolean(title || showCloseButton) && (
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 sticky top-0 bg-[#1a1b1e]/95 backdrop-blur-md z-10 shrink-0">
                {title && (
                  <h2 className="text-sm font-semibold text-white">{title}</h2>
                )}
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-[#949ba4] hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
