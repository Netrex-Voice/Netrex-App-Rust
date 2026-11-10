"use client";

/**
 * 💎 Netrex Optimized Ultra-Premium Toast System (NDS v6.1)
 * Optimized for high performance and low CPU usage while maintaining
 * the ultra-premium aesthetic.
 */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, AlertCircle, Info, MessageSquare, ChevronRight, UserPlus, UserMinus, Tv, ShieldAlert } from "lucide-react";
import { useToastStore } from "@/src/store/toastStore";
import { useSettingsStore } from "@/src/store/settingsStore";

const ToastItem = ({ toast }) => {
  const removeToast = useToastStore((s) => s.removeToast);
  const disableAnimations = useSettingsStore(state => state.disableAnimations);
  const graphicsQuality = useSettingsStore(state => state.graphicsQuality);

  // Optimized remove timer (Single timeout instead of interval)
  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, toast.duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, removeToast]);

  const config = {
    success: { 
      icon: <CheckCircle2 size={20} className="text-emerald-400" />, 
      titleColor: "text-emerald-400",
      glow: "rgba(16, 185, 129, 0.15)",
      accent: "#10b981"
    },
    error: { 
      icon: <ShieldAlert size={20} className="text-rose-400" />, 
      titleColor: "text-rose-400",
      glow: "rgba(244, 63, 94, 0.15)",
      accent: "#f43f5e"
    },
    info: { 
      icon: <Info size={20} className="text-indigo-400" />, 
      titleColor: "text-indigo-400",
      glow: "rgba(99, 102, 241, 0.15)",
      accent: "#6366f1"
    },
    warning: { 
      icon: <AlertCircle size={20} className="text-amber-400" />, 
      titleColor: "text-amber-400",
      glow: "rgba(245, 158, 11, 0.15)",
      accent: "#f59e0b"
    },
    chat: { 
      icon: <MessageSquare size={20} className="text-white" />, 
      titleColor: "text-white",
      glow: "rgba(255, 255, 255, 0.05)",
      accent: "var(--nds-accent-primary)"
    },
    join: { 
      icon: <UserPlus size={20} className="text-emerald-400" />, 
      titleColor: "text-emerald-400",
      glow: "rgba(16, 185, 129, 0.15)",
      accent: "#10b981"
    },
    leave: { 
      icon: <UserMinus size={20} className="text-amber-400" />, 
      titleColor: "text-amber-400",
      glow: "rgba(245, 158, 11, 0.15)",
      accent: "#f59e0b"
    },
    stream: { 
      icon: <Tv size={20} className="text-rose-400" />, 
      titleColor: "text-rose-400",
      glow: "rgba(244, 63, 94, 0.15)",
      accent: "#f43f5e"
    }
  };

  const current = config[toast.type] || config.info;
  const isPotato = graphicsQuality === "potato";
  const showGlow = !isPotato && !disableAnimations;

  // Simplified Framer Motion Variants
  const variants = {
    initial: { opacity: 0, x: 20, scale: 0.95 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, scale: 0.9, x: 20 },
    hover: disableAnimations ? {} : { scale: 1.02, x: -5 }
  };

  return (
    <motion.div
      layout={!disableAnimations}
      initial="initial"
      animate="animate"
      exit="exit"
      whileHover="hover"
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      onClick={() => {
        if (toast.onClick) toast.onClick();
        removeToast(toast.id);
      }}
      className="w-full sm:w-[340px] max-w-[calc(100vw-24px)] group relative cursor-pointer will-change-transform"
    >
      {/* Liquid Background Glow - Optimized */}
      {showGlow && (
        <div 
          className="absolute -inset-2 rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl pointer-events-none will-change-opacity"
          style={{ background: `radial-gradient(circle at center, ${current.glow} 0%, transparent 70%)` }}
        />
      )}

      {/* Main Glass Container - Optimized Blurs */}
      <div className={`
        relative overflow-hidden
        bg-[#121316]/95 ${isPotato ? "" : "backdrop-blur-xl"}
        border border-white/10 group-hover:border-white/20
        rounded-xl sm:rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.5)]
        p-2.5 sm:p-4 transition-all duration-300
      `}>
        {/* Subtle Inner Highlight */}
        {!isPotato && <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-transparent pointer-events-none" />}

        <div className="flex gap-2.5 sm:gap-4 items-start relative z-10">
          {/* Icon/Avatar Container */}
          <div className="relative shrink-0">
             {toast.type === 'chat' ? (
                <div 
                  className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center text-white font-bold text-sm sm:text-lg shadow-xl relative overflow-hidden transition-transform duration-300 group-hover:scale-105"
                  style={{ background: toast.avatarColor || 'var(--nds-accent-primary)' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
                  {toast.username?.charAt(0).toUpperCase()}
                </div>
             ) : (
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center bg-white/[0.03] border border-white/5 relative transition-transform duration-300 group-hover:scale-105 group-hover:bg-white/[0.06]">
                   <span className="scale-75 sm:scale-100">{current.icon}</span>
                   {/* Animated pulse only on high quality */}
                   {!['chat', 'info'].includes(toast.type) && !isPotato && !disableAnimations && (
                      <div className="absolute inset-0 rounded-lg sm:rounded-xl animate-ping opacity-10" style={{ backgroundColor: current.accent }} />
                   )}
                </div>
             )}
          </div>

          {/* Content Area */}
          <div className="flex-1 min-w-0 flex flex-col pt-0 sm:pt-0.5">
            {toast.type === 'chat' ? (
              <>
                <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                   <span className="font-bold text-white text-xs sm:text-[14px] truncate tracking-tight">{toast.username}</span>
                   <span className="text-[8px] sm:text-[9px] bg-white/5 text-white/50 px-1.5 sm:px-2 py-0.5 rounded uppercase font-black tracking-widest border border-white/5">#{toast.channelName}</span>
                </div>
                <p className="text-[11px] sm:text-[13px] text-[#949ba4] leading-[1.3] sm:leading-[1.4] line-clamp-2 group-hover:text-white/90 transition-colors font-medium">
                  {toast.message}
                </p>
              </>
            ) : (
              <>
                <h4 className={`font-bold text-xs sm:text-[14px] mb-0.5 sm:mb-1 tracking-tight ${current.titleColor}`}>
                  {toast.title}
                </h4>
                <p className="text-[11px] sm:text-[13px] text-[#949ba4] leading-[1.3] sm:leading-[1.4] line-clamp-2 group-hover:text-white/80 transition-colors font-medium">
                  {toast.message}
                </p>
                {toast.action && (
                  <div className="mt-1.5 sm:mt-2.5 flex items-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (toast.action.onClick) toast.action.onClick();
                        removeToast(toast.id);
                      }}
                      className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg bg-white/10 hover:bg-white text-white hover:text-black font-bold text-[10px] sm:text-[11px] transition-all duration-300 border border-white/5 hover:border-white shadow-[0_4px_12px_rgba(0,0,0,0.5)] active:scale-95"
                    >
                      {toast.action.label}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Action/Close Area */}
          <div className="shrink-0 flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 relative mt-0.5">
             <div className="absolute inset-0 flex items-center justify-center scale-100 group-hover:scale-90 opacity-100 group-hover:opacity-0 transition-[transform,opacity] duration-300 ease-ui-out">
                <ChevronRight className="text-[#4e5058] sm:scale-100 scale-75" size={18} />
             </div>
             
             <div className="absolute inset-0 flex items-center justify-center scale-90 group-hover:scale-100 opacity-0 group-hover:opacity-100 transition-[transform,opacity] duration-300 ease-ui-out">
                <div 
                   onClick={(e) => {
                     e.stopPropagation();
                     removeToast(toast.id);
                   }}
                   className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center border border-white/10 shadow-lg"
                >
                   <X size={12} className="text-white sm:scale-110" />
                </div>
             </div>
          </div>
        </div>

        {/* CSS-Only High Performance Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.02]">
           <div 
              className="h-full bg-current transition-all linear will-change-[width]"
              style={{ 
                width: '100%',
                animation: `toast-progress ${toast.duration}ms linear forwards`,
                color: toast.color || current.accent,
                backgroundColor: 'currentColor',
                boxShadow: isPotato ? "none" : `0 0 8px ${toast.color || current.accent}80`
              }}
           />
        </div>
      </div>

      <style jsx>{`
        @keyframes toast-progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </motion.div>
  );
};

export default function ToastSystem() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 sm:translate-x-0 sm:top-auto sm:left-auto sm:bottom-8 sm:right-8 z-[99999] flex flex-col gap-2 sm:gap-4 items-center sm:items-end pointer-events-none p-0 sm:p-4 w-[calc(100vw-24px)] sm:w-auto max-w-[360px] sm:max-w-none">
      <AnimatePresence mode="popLayout" initial={false}>
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto w-full sm:w-auto">
            <ToastItem toast={toast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
