"use client";

import { createPortal } from "react-dom";
import { Plus, Compass, X } from "lucide-react";
import { useEffect, useState } from "react";

export default function AddServerSelectionModal({ isOpen, onClose, onCreateClick, onJoinClick }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleEsc = (e) => {
      if (isOpen && e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-lg bg-[#111214] rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-[#949ba4] hover:bg-white/10 hover:text-white transition-colors z-10"
        >
            <X size={20} />
        </button>

        <div className="p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Sunucunu Ekle</h2>
            <p className="text-[#949ba4] mb-8">
                Kendi topluluğunu oluştur veya var olan bir topluluğa katıl.
            </p>

            <div className="grid gap-4">
                {/* Create Server Option */}
                <button
                    onClick={onCreateClick}
                    className="group relative flex items-center gap-4 p-4 rounded-2xl border border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all duration-300 text-left w-full"
                >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shrink-0 group-hover:scale-110 transition-transform duration-300">
                        <Plus size={24} />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-white text-lg group-hover:text-indigo-400 transition-colors">
                            Sunucumu Oluştur
                        </h3>
                        <p className="text-[#949ba4] text-sm leading-tight mt-1">
                            Arkadaşlarınla veya topluluğunla takılmak için kendi alanını yarat.
                        </p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all text-[#949ba4]">
                       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                           <path d="M9 18l6-6-6-6"/>
                       </svg>
                    </div>
                </button>

                {/* Join Server Option */}
                <button
                    onClick={onJoinClick}
                    className="group relative flex items-center gap-4 p-4 rounded-2xl border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all duration-300 text-left w-full"
                >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shrink-0 group-hover:scale-110 transition-transform duration-300">
                        <Compass size={24} />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-white text-lg group-hover:text-emerald-400 transition-colors">
                            Bir Sunucuya Katıl
                        </h3>
                        <p className="text-[#949ba4] text-sm leading-tight mt-1">
                            Bir davet kodun mu var? Hemen topluluğa dahil ol.
                        </p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all text-[#949ba4]">
                       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                           <path d="M9 18l6-6-6-6"/>
                       </svg>
                    </div>
                </button>
            </div>
            
        </div>
        
        {/* Footer Design Element */}
        <div className="h-2 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 opacity-20" />
      </div>
    </div>,
    document.body
  );
}
