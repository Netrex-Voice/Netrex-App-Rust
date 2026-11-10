"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Loader2, AlertTriangle } from "lucide-react";

export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Onayla",
  cancelLabel = "Vazgeç",
  loading = false,
  variant = "default",
  onConfirm,
  onCancel,
  itemToDelete, // Silinecek öğenin adı (vurgulanacak)
}) {
  useEffect(() => {
    if (isOpen) {
      // Modal açıldığında body scroll'unu kapat
      document.body.style.overflow = "hidden";
    } else {
      // Modal kapandığında body scroll'unu aç
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
        // Backdrop'a tıklandığında modal'ı kapatma
        if (e.target === e.currentTarget && !loading) {
          onCancel();
        }
      }}
    >
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-orange-500/5 to-transparent pointer-events-none"></div>
      
      <div className="glass-strong border border-white/20 rounded-3xl shadow-2xl w-full max-w-md animate-scaleIn backdrop-blur-2xl bg-gradient-to-br from-[#1e1f22]/95 via-[#25272a]/95 to-[#2b2d31]/95 relative overflow-hidden">
        {/* Top glow effect */}
        <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${variant === "danger" ? "via-red-500/50" : "via-white/30"} to-transparent z-10`}></div>
        
        <div className="p-8 space-y-5 relative z-10">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-soft ${
                variant === "danger"
                  ? "bg-gradient-to-br from-red-500/20 to-red-600/20 border-red-500/30"
                  : "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500/30"
              }`}
            >
              <AlertTriangle size={24} className={variant === "danger" ? "text-red-300" : "text-indigo-300"} />
            </div>
            <h3 className="text-2xl font-bold text-white tracking-tight">{title}</h3>
          </div>
          
          {/* Silinecek öğe vurgusu */}
          {itemToDelete && (
            <div className="bg-gradient-to-r from-red-500/15 to-red-600/15 border border-red-500/30 rounded-xl p-4 shadow-soft backdrop-blur-sm">
              <div className="text-lg font-bold text-red-300 break-words">
                {itemToDelete}
              </div>
            </div>
          )}
          
          <p className="text-sm text-[#b5bac1] leading-relaxed">{description}</p>
        </div>
        
        <div className="flex justify-end gap-3 bg-gradient-to-t from-[#1e1f22] via-[#25272a] to-transparent p-6 border-t border-white/10 rounded-b-3xl backdrop-blur-xl relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
          <button
            onClick={onCancel}
            onMouseDown={(e) => e.preventDefault()}
            className="px-6 py-3 text-sm font-semibold text-[#b5bac1] hover:text-white transition-all duration-300 rounded-xl hover:bg-white/5 focus:outline-none"
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            onMouseDown={(e) => e.preventDefault()}
            disabled={loading}
            className={`px-8 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-300 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:scale-105 relative overflow-hidden focus:outline-none ${
              variant === "danger"
                ? "bg-gradient-to-r from-red-500 to-red-600 hover:shadow-[0_0_25px_rgba(239,68,68,0.5)]"
                : "gradient-primary hover:shadow-[0_0_25px_rgba(99,102,241,0.5)]"
            }`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span className="relative z-10">{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );

  // Portal kullanarak modal'ı document.body'ye render et
  if (typeof window !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  
  return null;
}

