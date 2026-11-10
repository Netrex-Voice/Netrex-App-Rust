"use client";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ExternalLink, X, ShieldAlert } from "lucide-react";
import { createPortal } from "react-dom";

export default function SecurityModal({ isOpen, url, onClose, onConfirm }) {
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
            {/* Header / Top Accent */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-rose-500/50 to-transparent" />
            
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
                <div className="absolute inset-0 bg-rose-500/20 blur-2xl rounded-full" />
                <div className="relative w-20 h-20 bg-gradient-to-br from-[#2b2d31] to-[#1e1f22] rounded-3xl border border-rose-500/20 flex items-center justify-center shadow-2xl">
                  <ShieldAlert size={40} className="text-rose-500" />
                </div>
              </div>

              {/* Text Content */}
              <h2 className="text-2xl font-black text-white mb-3 tracking-tight uppercase">
                Güvenlik Uyarısı
              </h2>
              <p className="text-[#b5bac1] text-[15px] leading-relaxed mb-6 font-medium">
                Netrex dışındaki bir dış bağlantıya tıklamak üzeresiniz. Lütfen sadece güvendiğiniz bağlantılara ilerleyin.
              </p>

              {/* URL Display Box */}
              <div className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 mb-8 flex items-start gap-3 group text-left">
                <div className="flex-1 min-w-0">
                  <span className="text-rose-400/90 text-[10px] font-black uppercase tracking-[0.2em] block mb-1.5 text-center">Dış Bağlantı Adresi</span>
                  <div className="text-sky-400 hover:text-sky-300 text-[13px] break-all font-mono leading-tight underline underline-offset-4 decoration-sky-400/30 hover:decoration-sky-300 transition-colors cursor-default">
                    {url}
                  </div>
                </div>
                <div className="mt-6 shrink-0">
                  <ExternalLink size={14} className="text-[#949ba4]" />
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
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-black text-[14px] rounded-xl transition-all shadow-xl shadow-rose-600/20 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest"
                >
                  Bağlantıya Git
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
