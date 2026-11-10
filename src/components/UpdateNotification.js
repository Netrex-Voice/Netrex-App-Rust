"use client";

/**
 * 🚀 UpdateNotification - v2.1 - OPTIMIZED
 * Better user feedback for all update states
 */

import { useState, useEffect } from "react";
import {
  Rocket,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Download,
  Minimize2
} from "lucide-react";
import { useUpdateStore } from "@/src/store/updateStore";
import { toast } from "@/src/utils/toast";

export default function UpdateNotification() {
  const { status, progress, updateInfo } = useUpdateStore();
  const [show, setShow] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  // 🌐 Web'de auto-update gösterme
  if (typeof window !== 'undefined' && !window.netrex) return null;

  const handleRestart = () => {
    if (window.netrex) {
        toast.info("Netrex güncelleniyor, lütfen bekleyin...");
        window.netrex.quitAndInstall();
    }
  };

  const handleClose = (e) => {
    e?.stopPropagation();
    setShow(false);
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // ✅ FIX: Show toast and auto-expand for both available and downloaded
  useEffect(() => {
    if (status === "available") {
      toast.info("Yeni güncelleme bulundu! İndirme başlatılıyor...", {
        title: `Netrex v${updateInfo?.version || '...'}`,
        duration: 6000
      });
      setIsExpanded(true);
      setShow(true);
    } else if (status === "downloaded") {
      toast.success("Yenilikleri kullanmak için uygulamayı yeniden başlatın.", {
        title: "Netrex Güncellemesi Hazır!",
        duration: 8000
      });
      setIsExpanded(true);
      setShow(true);
    }
  }, [status, updateInfo]);

  // Sadece ilgili durumlarda göster
  if (
    !show ||
    status === "idle" ||
    status === "checking" ||
    status === "not-available"
  )
    return null;

  // --- PILL VIEW (Collapsed) ---
  if (!isExpanded) {
    return (
      <div 
        onClick={toggleExpand}
        className="fixed top-14 right-6 z-[9999] animate-in slide-in-from-top-4 fade-in duration-500 cursor-pointer group"
      >
        <div className="relative overflow-hidden bg-[#1a1b1e]/90 backdrop-blur-md border border-white/10 rounded-full shadow-lg hover:shadow-indigo-500/20 transition-all duration-300 hover:scale-105 active:scale-95 pr-4 pl-3 py-2 flex items-center gap-3">
            
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                status === 'downloaded' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'
            }`}>
                {status === 'downloaded' ? (
                    <CheckCircle2 size={16} />
                ) : status === 'downloading' ? (
                    <div className="relative">
                        <Download size={16} />
                        <span className="absolute -bottom-1 -right-1 flex h-2 w-2">
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        </span>
                    </div>
                ) : (
                    <Rocket size={16} />
                )}
            </div>

            <div className="flex flex-col">
                <span className="text-white text-xs font-bold leading-none mb-0.5">
                    {status === 'downloaded' ? 'Hazır' : status === 'available' ? 'Bulundu' : 'Güncelleniyor'}
                </span>
                <span className="text-[10px] text-white/50 leading-none font-medium">
                    {status === 'downloading' ? `%${progress}` : 'Tıkla'}
                </span>
            </div>

            {status === 'downloading' && (
                <div className="absolute bottom-0 left-0 h-[2px] bg-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }} />
            )}
        </div>
      </div>
    );
  }

  // --- CARD VIEW (Expanded) ---
  return (
    <div className="fixed top-14 right-6 z-[9999] animate-in slide-in-from-top-4 fade-in duration-500">
      <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/20 to-purple-600/20 rounded-[2rem] blur-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>

      <div className="relative w-80 bg-[#0e0f12]/95 backdrop-blur-2xl rounded-3xl border border-white/[0.08] shadow-2xl overflow-hidden">
        <div className="relative p-5">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-all duration-300 ${
                status === "downloaded"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
              }`}>
                {status === "downloaded" ? <Sparkles size={18} /> : <Rocket size={18} />}
              </div>
              <div className="cursor-pointer" onClick={toggleExpand}>
                <h4 className="text-white font-bold text-sm flex items-center gap-2">
                  {status === "downloaded" ? "Güncelleme Hazır" : status === "available" ? "Güncelleme Bulundu" : "Güncelleniyor"}
                  <Minimize2 size={12} className="text-white/30" />
                </h4>
                <p className="text-[10px] text-[#949ba4] font-medium uppercase tracking-wider mt-0.5">
                  v{updateInfo?.version || "..."}
                </p>
              </div>
            </div>
            
            <button onClick={handleClose} className="text-[#949ba4] hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
              <X size={16} />
            </button>
          </div>

          {(status === "available" || status === "downloading") && (
            <div className="space-y-3">
               <div className="flex justify-between items-end text-[10px] mb-1">
                  <span className="text-white/50 font-bold uppercase tracking-widest">İlerleme</span>
                  <span className="text-indigo-400 font-black">{progress}%</span>
               </div>
               <div className="h-1.5 bg-white/5 rounded-full overflow-hidden relative">
                  <div 
                    className="absolute inset-0 bg-indigo-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
               </div>
            </div>
          )}

          {status === "downloaded" && (
            <div className="space-y-4">
               <p className="text-xs text-[#949ba4] leading-relaxed">
                  Netrex v{updateInfo?.version} başarıyla indirildi. Yeniden başlatarak yeni özelliklere kavuşabilirsiniz.
               </p>
               <button
                 onClick={handleRestart}
                 className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
               >
                 <RefreshCw size={14} className="animate-spin-slow" />
                 Şimdi Yeniden Başlat
               </button>
            </div>
          )}
          
          {status === "error" && (
            <div className="bg-rose-500/10 p-3 rounded-2xl border border-rose-500/20 flex gap-3">
              <AlertCircle size={16} className="text-rose-400 shrink-0" />
              <div className="flex flex-col gap-1">
                <span className="text-rose-400 text-[11px] font-bold uppercase">Hata Oluştu</span>
                <p className="text-[10px] text-white/50 leading-tight">Yükleme sırasında bir problem oluştu. Otomatik olarak tekrar denenecek.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
