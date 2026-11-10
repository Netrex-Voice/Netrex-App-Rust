"use client";

import { useState, useEffect, useCallback } from "react";
import { VolumeX, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function TtsStopBadge() {
  const [isActive, setIsActive] = useState(false);
  const [currentText, setCurrentText] = useState("");

  useEffect(() => {
    const handler = (e) => {
      setIsActive(e.detail?.active || false);
      if (e.detail?.text) {
        setCurrentText(e.detail.text.substring(0, 100));
      }
    };
    window.addEventListener("netrex-tts-state", handler);
    return () => window.removeEventListener("netrex-tts-state", handler);
  }, []);

  const handleStop = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.__netrexTtsQueueCount = 0;
      window.__netrexTtsActive = false;
      setIsActive(false);
    }
  }, []);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.button
          key="tts-badge"
          initial={{ opacity: 0, y: 15, scale: 0.9, x: "-50%" }}
          animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
          exit={{ opacity: 0, y: 10, scale: 0.95, x: "-50%" }}
          transition={{ 
            type: "spring",
            stiffness: 400,
            damping: 25,
            opacity: { duration: 0.2 }
          }}
          onClick={handleStop}
          className="absolute bottom-full mb-[18px] left-1/2 z-[100] flex items-center gap-3 px-5 py-3 
            bg-[#1a1b1f]/98 backdrop-blur-3xl border border-white/20 rounded-[20px]
            shadow-[0_12px_48px_rgba(0,0,0,0.6)] hover:bg-[#25262b] hover:border-red-500/50
            hover:shadow-[0_0_30px_rgba(239,68,68,0.3)] hover:scale-[1.05] whitespace-nowrap
            pointer-events-auto
            transition-colors duration-300 group cursor-pointer"
          title="TTS'i Durdur"
        >
          <div className="relative">
            <Volume2 
              size={18} 
              className="text-emerald-400 group-hover:hidden animate-pulse" 
            />
            <VolumeX 
              size={18} 
              className="text-red-400 hidden group-hover:block" 
            />
          </div>
          <span className="text-[12px] font-bold text-white/85 group-hover:text-red-400 transition-colors max-w-[140px] truncate tracking-wide">
            {currentText || "Sohbet Okunuyor..."}
          </span>
          <div className="w-px h-4 bg-white/10 group-hover:bg-red-500/20 transition-colors"></div>
          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-white/40 group-hover:text-red-500/80 transition-colors">
            DURDUR
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
