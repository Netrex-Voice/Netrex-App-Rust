"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";

export default function InfoModal({
  isOpen,
  title,
  message,
  onClose,
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-fadeIn" 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent pointer-events-none"></div>
      
      <div className="glass-strong border border-white/20 rounded-3xl shadow-2xl w-full max-w-md animate-scaleIn backdrop-blur-2xl bg-gradient-to-br from-[#1e1f22]/95 via-[#25272a]/95 to-[#2b2d31]/95 relative overflow-hidden">
        {/* Top glow effect */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent z-10"></div>
        
        <div className="p-8 space-y-5 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/30 shadow-soft">
                <Info size={24} className="text-indigo-300" />
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight">{title}</h3>
            </div>
            <button
              onClick={onClose}
              onMouseDown={(e) => e.preventDefault()}
              className="w-10 h-10 rounded-xl glass-strong border border-white/10 flex items-center justify-center text-[#949ba4] hover:bg-gradient-to-br hover:from-red-500/20 hover:to-red-600/20 hover:text-red-400 hover:border-red-500/30 transition-all duration-300 hover:scale-110 focus:outline-none"
            >
              <X size={18} />
            </button>
          </div>
          
          <p className="text-sm text-[#b5bac1] leading-relaxed">{message}</p>
        </div>
        
        <div className="flex justify-end bg-gradient-to-t from-[#1e1f22] via-[#25272a] to-transparent p-6 border-t border-white/10 rounded-b-3xl backdrop-blur-xl relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
          <button
            onClick={onClose}
            onMouseDown={(e) => e.preventDefault()}
            className="px-8 py-3 gradient-primary hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 relative overflow-hidden group/save focus:outline-none"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 group-hover/save:opacity-100 transition-opacity duration-300"></div>
            <span className="relative z-10">Tamam</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof window !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  
  return null;
}

