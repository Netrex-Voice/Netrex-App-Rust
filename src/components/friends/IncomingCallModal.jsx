"use client";

import { useEffect, useRef } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import UserPhoto from "@/src/components/ui/UserPhoto";
import { AvatarFallback } from "@/src/components/ui/Avatar";

export default function IncomingCallModal({ caller, onAccept, onDecline, isOpen }) {
  const audioRef = useRef(null);

  // Auto-play ringing sound
  useEffect(() => {
    if (isOpen && audioRef.current) {
      audioRef.current.volume = 0.5;
      audioRef.current.play().catch(e => console.log("Audio play error:", e));
    }
  }, [isOpen]);

  if (!caller) return null;

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
              shadow-[0_0_50px_rgba(0,0,0,0.5),0_0_20px_rgba(129,140,248,0.1)]
            "
          >
            {/* Decorative Ring */}
            <div className="absolute inset-0 rounded-[32px] border border-white/5 pointer-events-none" />

            {/* Pulsing Avatar Container */}
            <div className="relative">
              {/* Multi-layer pulse */}
              <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping duration-[2000ms]" />
              <div className="absolute -inset-4 bg-indigo-500/10 rounded-full animate-pulse duration-[1500ms]" />
              
              <div className="relative z-10 w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-2xl">
                <UserPhoto
                  uid={caller.uid || caller.id}
                  src={caller.photoURL}
                  alt={caller.displayName}
                  className="w-full h-full rounded-full object-cover border-4 border-[#111214]"
                  fallback={
                    <AvatarFallback
                      name={caller.displayName}
                      color={caller.profileColor}
                      className="w-full h-full rounded-full border-4 border-[#111214]"
                      textClassName="text-3xl font-bold"
                    />
                  }
                />
              </div>
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-2xl font-black text-white tracking-tight">
                {caller.displayName}
              </h3>
              <div className="flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                <p className="text-sm font-medium text-indigo-300/80 uppercase tracking-widest">
                  Gelen Arama...
                </p>
              </div>
            </div>

            <div className="flex w-full gap-4 pt-2">
              <button
                onClick={onDecline}
                className="
                  flex-1 h-14 rounded-2xl 
                  bg-[#2b2d31]/50 border border-white/5
                  hover:bg-red-500 hover:border-red-400
                  text-[#dbdee1] hover:text-white
                  flex flex-col items-center justify-center gap-1
                  transition-all duration-300 group
                "
              >
                <PhoneOff size={20} className="group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-tighter">Reddet</span>
              </button>
              
              <button
                onClick={onAccept}
                className="
                  flex-1 h-14 rounded-2xl 
                  bg-green-500 border border-green-400
                  hover:bg-green-400 hover:scale-[1.02] active:scale-95
                  text-white flex flex-col items-center justify-center gap-1
                  shadow-[0_10px_20px_rgba(34,197,94,0.3)]
                  transition-all duration-300 group
                "
              >
                <Phone size={20} className="animate-bounce group-hover:animate-none" />
                <span className="text-[10px] font-bold uppercase tracking-tighter">Cevapla</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
