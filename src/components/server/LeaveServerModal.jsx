"use client";

import { createPortal } from "react-dom";
import { LogOut } from "lucide-react";

export default function LeaveServerModal({ isOpen, onClose, onConfirm, serverName }) {
  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 shadow-2xl bg-[#111214] overflow-hidden animate-in zoom-in-95 duration-200">
         {/* Top Gradient Line */}
         <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
         
         <div className="p-8 text-center">
            {/* Icon */}
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
               <LogOut size={32} />
            </div>
            
            {/* Title */}
            <h3 className="text-xl font-bold text-white mb-2">
              Sunucudan Ayrıl
            </h3>
            
            {/* Description */}
            <p className="text-[#949ba4] mb-6 leading-relaxed">
               <span className="text-white font-bold">{serverName}</span> sunucusundan ayrılmak istediğinize emin misiniz? 
               Davet bağlantınız yoksa tekrar katılamayabilirsiniz.
            </p>
            
            {/* Actions */}
            <div className="flex gap-3 justify-center">
                <button 
                  onClick={onClose} 
                  className="px-5 py-2.5 rounded-xl text-[#dbdee1] hover:bg-white/5 transition-colors font-medium"
                >
                  Vazgeç
                </button>
                <button 
                  onClick={onConfirm} 
                  className="
                    px-6 py-2.5 rounded-xl font-bold text-white 
                    bg-red-600 hover:bg-red-700 
                    shadow-lg shadow-red-600/20 
                    transition-all active:scale-95
                  "
                >
                  Ayrıl
                </button>
            </div>
         </div>
      </div>
    </div>,
    document.body
  );
}
