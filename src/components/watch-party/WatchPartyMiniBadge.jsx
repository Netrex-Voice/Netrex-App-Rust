// src/components/watch-party/WatchPartyMiniBadge.jsx
import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useWatchPartyStore } from '@/src/store/watchPartyStore';
import { useSettingsStore } from '@/src/store/settingsStore';
import { useChatStore } from '@/src/store/chatStore';
import { Music, Play, Pause } from 'lucide-react';

export function WatchPartyMiniBadge() {
  const isActive     = useWatchPartyStore((s) => s.isActive);
  const showPlayer   = useWatchPartyStore((s) => s.localPreferences.showPlayer);
  const togglePlayer = useWatchPartyStore((s) => s.togglePlayer);
  const currentTrack = useWatchPartyStore((s) => s.currentTrack);
  const isPlaying    = useWatchPartyStore((s) => s.playbackState.isPlaying);

  const controlBarHidden = useSettingsStore((s) => s.controlBarHidden);
  const { showChatPanel, chatPosition, chatWidth } = useChatStore();

  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isActive && !showPlayer && (
        <motion.button
          key="mini-badge"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ 
            scale: 1, 
            opacity: 1, 
            y: 0,
            right: (showChatPanel && chatPosition === "right") 
              ? chatWidth + (controlBarHidden ? 88 : 24) 
              : (controlBarHidden ? 88 : 24),
            left: (showChatPanel && chatPosition === "left")
              ? chatWidth + (controlBarHidden ? 88 : 24)
              : "auto",
          }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.93 }}
          transition={{ type: "spring", damping: 25, stiffness: 400 }}
          layout
          onClick={togglePlayer}
          className="fixed z-[100] w-12 h-12
                     bg-zinc-900/95 backdrop-blur-xl border border-white/15
                     rounded-full shadow-2xl shadow-black/60
                     flex items-center justify-center
                     cursor-pointer overflow-hidden group"
          style={{ bottom: "20px" }}
          title={`${currentTrack?.title || 'Watch Party'} - Göster`}
        >
          {/* Thumbnail arka plan */}
          {currentTrack?.thumbnail && (
            <div className="absolute inset-0 opacity-40 group-hover:opacity-60 transition-opacity">
              <img
                src={currentTrack.thumbnail} alt=""
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

          {/* İkon */}
          <div className="relative z-10">
            {isPlaying
              ? <Pause size={20} className="text-white fill-white" />
              : <Music size={20} className="text-white" />
            }
          </div>

          {/* Çalan animasyonu */}
          {isPlaying && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-emerald-400/60"
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </motion.button>
      )}
    </AnimatePresence>,
    document.body
  );
}