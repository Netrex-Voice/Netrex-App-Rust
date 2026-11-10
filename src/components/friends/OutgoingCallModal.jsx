"use client";

import { useEffect, useRef } from "react";
import { PhoneOff } from "lucide-react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import UserPhoto from "@/src/components/ui/UserPhoto";
import { AvatarFallback } from "@/src/components/ui/Avatar";

export default function OutgoingCallModal({ targetUser, onCancel, isOpen }) {
  if (!targetUser) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          {/* Background Overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm" 
          />

          <motion.div 
            initial={{ scale: 0.8, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 20, opacity: 0 }}
            transition={{ 
              type: "spring", 
              stiffness: 260, 
              damping: 20,
              mass: 0.8
            }}
            className="
              relative z-10
              w-full max-w-[340px] 
              bg-[#111214]/80 backdrop-blur-2xl
              border border-white/10 rounded-[32px] 
              p-8 flex flex-col items-center gap-6
              shadow-[0_0_50px_rgba(0,0,0,0.5),0_0_20px_rgba(88,101,242,0.1)]
            "
          >
            {/* Decorative Ring */}
            <div className="absolute inset-0 rounded-[32px] border border-white/5 pointer-events-none" />

            {/* Pulsing Avatar Container */}
            <div className="relative">
              {/* Outgoing multi-pulse (Cyan/Indigo) */}
              <div className="absolute inset-0 bg-cyan-500/20 rounded-full animate-ping duration-[3000ms]" />
              <div className="absolute -inset-4 bg-indigo-500/10 rounded-full animate-pulse duration-[2000ms]" />
              
              <div className="relative z-10 w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-cyan-500 to-indigo-500 shadow-2xl">
                <UserPhoto
                  uid={targetUser.uid || targetUser.id}
                  src={targetUser.photoURL}
                  alt={targetUser.displayName}
                  className="w-full h-full rounded-full object-cover border-4 border-[#111214]"
                  fallback={
                    <AvatarFallback
                      name={targetUser.displayName}
                      color={targetUser.profileColor}
                      className="w-full h-full rounded-full border-4 border-[#111214]"
                      textClassName="text-3xl font-bold"
                    />
                  }
                />
              </div>
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-cyan-400/80 uppercase tracking-[0.2em] animate-pulse">
                Aranıyor...
              </h3>
              <h2 className="text-2xl font-black text-white tracking-tight">
                {targetUser.displayName}
              </h2>
            </div>

            <div className="w-full pt-2">
              <button
                onClick={onCancel}
                className="
                  w-full h-14 rounded-2xl 
                  bg-[#2b2d31]/50 border border-white/5
                  hover:bg-red-500 hover:border-red-400
                  text-[#dbdee1] hover:text-white
                  flex flex-col items-center justify-center gap-1
                  transition-all duration-300 group
                  shadow-xl
                "
              >
                <PhoneOff size={22} className="group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Aramayı İptal Et</span>
              </button>
            </div>

            <p className="text-[10px] text-[#949ba4] font-medium opacity-50">
              Cevap verene kadar çalmaya devam edecek...
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
