"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, X, Radio } from "lucide-react";
import { createPortal } from "react-dom";

/**
 * 🔊 Voice Channel Switch Confirmation Modal
 * 
 * Kullanıcı başka bir voice channel'a geçmek istediğinde onay ister.
 * SecurityModal'a benzer tasarım ama voice channel için.
 */
export default function VoiceChannelSwitchModal({ 
  isOpen, 
  currentChannel, 
  targetChannel, 
  onClose, 
  onConfirm 
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-[#1e1f22] border border-white/10 rounded-[2rem] shadow-[0_32px_128px_rgba(0,0,0,0.8)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Top Accent - Indigo (voice theme) */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
            
            <div className="p-8 flex flex-col items-center text-center">
              {/* Close Button */}
              <button 
                onClick={onClose}
                className="absolute top-6 right-6 p-2 text-[#949ba4] hover:text-white hover:bg-white/5 rounded-full transition-all"
              >
                <X size={20} />
              </button>

              {/* Warning Icon Container */}
              <div className="mb-6 relative">
                <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full" />
                <div className="relative w-20 h-20 bg-gradient-to-br from-[#2b2d31] to-[#1e1f22] rounded-3xl border border-indigo-500/20 flex items-center justify-center shadow-2xl">
                  <Radio size={40} className="text-indigo-400" />
                </div>
              </div>

              {/* Text Content */}
              <h2 className="text-2xl font-black text-white mb-3 tracking-tight uppercase">
                Server Değiştir
              </h2>
              <p className="text-[#b5bac1] text-[15px] leading-relaxed mb-6 font-medium">
                Şu anda bir sesli kanaldasınız. Farklı bir sunucuya geçmek istediğinize emin misiniz?
              </p>

              {/* Server & Channel Info Boxes */}
              <div className="w-full space-y-3 mb-8">
                {/* Current Server/Channel */}
                <div className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-left">
                  <div className="flex items-start gap-3">
                    {/* Server Avatar */}
                    <div className="relative shrink-0">
                      <div className="absolute -inset-1 bg-rose-500/20 blur-md rounded-xl"></div>
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-rose-600 to-rose-800 flex items-center justify-center shadow-lg ring-2 ring-rose-500/30">
                        {currentChannel?.serverIcon ? (
                          <img 
                            src={currentChannel.serverIcon} 
                            alt={currentChannel.serverName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-white font-black text-lg">
                            {(currentChannel?.serverName || "?").charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 pt-0.5">
                      <span className="text-rose-400/90 text-[10px] font-black uppercase tracking-[0.2em] block mb-2">Şu Anda</span>
                      {/* Server Name - BIG */}
                      <div className="text-white text-[17px] font-black truncate mb-1.5 leading-tight">
                        {currentChannel?.serverName || "Bilinmeyen Sunucu"}
                      </div>
                      {/* Channel Name - small */}
                      <div className="text-[#949ba4] text-[13px] truncate flex items-center gap-1.5">
                        <Volume2 size={14} className="text-rose-400/60 shrink-0" />
                        {currentChannel?.name || "Bilinmeyen Kanal"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                  <div className="text-[#949ba4]">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 14L14 10H6L10 14Z" />
                    </svg>
                  </div>
                </div>

                {/* Target Server/Channel */}
                <div className="w-full bg-emerald-950/40 border-2 border-emerald-500/40 rounded-2xl p-4 text-left shadow-lg shadow-emerald-500/10">
                  <div className="flex items-start gap-3">
                    {/* Server Avatar */}
                    <div className="relative shrink-0">
                      <div className="absolute -inset-1.5 bg-emerald-500/30 blur-xl rounded-xl"></div>
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-xl ring-2 ring-emerald-400/50">
                        {targetChannel?.serverIcon ? (
                          <img 
                            src={targetChannel.serverIcon} 
                            alt={targetChannel.serverName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-white font-black text-lg">
                            {(targetChannel?.serverName || "?").charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 pt-0.5">
                      <span className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] block mb-2">Geçilecek</span>
                      {/* Server Name - BIG */}
                      <div className="text-white text-[17px] font-black truncate mb-1.5 leading-tight">
                        {targetChannel?.serverName || "Bilinmeyen Sunucu"}
                      </div>
                      {/* Channel Name - small */}
                      <div className="text-emerald-200/80 text-[13px] truncate flex items-center gap-1.5">
                        <Volume2 size={14} className="text-emerald-400/80 shrink-0" />
                        {targetChannel?.name || "Bilinmeyen Kanal"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full flex flex-row gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold text-[14px] rounded-xl transition-all hover:scale-[1.02] active:scale-95 uppercase tracking-widest border border-white/5"
                >
                  Vazgeç
                </button>
                <button
                  onClick={onConfirm}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[14px] rounded-xl transition-all shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest"
                >
                  <Volume2 size={16} />
                  Kanala Geç
                </button>
              </div>
            </div>

            {/* Bottom Accent */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
