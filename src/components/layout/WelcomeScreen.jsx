"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  Radio, 
  Mic, 
  Headphones, 
  Sparkles, 
  Zap, 
  Users, 
  Settings, 
  Keyboard, 
  X,
  Command,
  Music,
  ShieldCheck
} from "lucide-react";

/**
 * 👋 WelcomeScreen - Netrex Premium Empty State
 * 
 * Özellikler:
 * - SettingsModal ile uyumlu modern tasarım
 * - CSS tabanlı hafif animasyonlar
 * - Özel animasyonlu Kısayol Modalı
 */
export default function WelcomeScreen({ 
  userName = "Kullanıcı",
  version = process.env.NEXT_PUBLIC_APP_VERSION || "8.0.0",
  shortcuts = [],
  className = "" 
}) {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Hydration hatasını önlemek için
  useEffect(() => {
    setMounted(true);
  }, []);

  const defaultShortcuts = shortcuts.length > 0 ? shortcuts : [
    { icon: <Mic size={18} />, label: "Mikrofonu Sustur", hint: "CTRL + M", color: "indigo" },
    { icon: <Headphones size={18} />, label: "Sağırlaştır", hint: "CTRL + D", color: "purple" },
    { icon: <Radio size={18} />, label: "Bas Konuş", hint: "V", color: "cyan" },
  ];

  const features = [
    { 
      icon: <Users size={20} />, 
      label: "Sesli Sohbet", 
      desc: "Kristal netliğinde ses kalitesi", 
      color: "indigo"
    },
    { 
      icon: <ShieldCheck size={20} />, 
      label: "Güvenli Bağlantı", 
      desc: "Uçtan uca şifreli iletişim", 
      color: "purple" 
    },
    { 
      icon: <Zap size={20} />, 
      label: "Düşük Gecikme", 
      desc: "Optimize edilmiş hızlı altyapı", 
      color: "orange" 
    },
  ];

  if (!mounted) return null;

  return (
    <div className={`
      relative h-full w-full flex flex-col items-center justify-start sm:justify-center p-4 sm:p-8 pb-24 sm:pb-12 overflow-y-auto custom-scrollbar
      bg-gradient-to-br from-[#111214] via-[#16171a] to-[#0f1012]
      ${className}
    `}>
      {/* --- Arkaplan Efektleri --- */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Grid Deseni */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black_40%,transparent_100%)]" />
        
        {/* Static background orbs */}
        <div className="absolute top-1/4 left-1/4 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-indigo-500/10 rounded-full blur-[60px] opacity-60" />
        <div className="absolute bottom-1/4 right-1/4 w-[250px] sm:w-[400px] h-[250px] sm:h-[400px] bg-purple-500/10 rounded-full blur-[50px] opacity-60" />
      </div>

      {/* --- Üst Sağ Kısayol Butonu (Sadece Masaüstü) --- */}
      <div className="absolute top-6 right-6 z-20 hidden sm:block">
          <button 
             onClick={() => setShowShortcuts(true)}
             className="
               group relative flex items-center justify-center w-11 h-11
               bg-[#1e1f22]/50 backdrop-blur-md border border-white/5 rounded-2xl
               hover:bg-white/10 hover:border-white/20 hover:scale-105
               transition-all duration-300 shadow-lg
             " 
          >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity duration-300" />
              <Keyboard size={18} className="text-[#949ba4] group-hover:text-white transition-colors relative z-10" />
              
              {/* Tooltip */}
              <span className="absolute right-full mr-3 px-2 py-1 bg-black/80 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10">
                Klavye Kısayolları
              </span>
          </button>
      </div>

      {/* --- Ana İçerik --- */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-3xl w-full my-auto py-4">
        
        {/* 1. Hero İkonu */}
        <div className="relative mb-4 sm:mb-10">
          <div className="absolute inset-0 bg-indigo-500/10 rounded-full opacity-20" />
          
          <div className="
            relative w-16 h-16 sm:w-28 sm:h-28 
            bg-gradient-to-br from-[#1e1f22] to-[#111214]
            rounded-2xl sm:rounded-3xl
            flex items-center justify-center 
            border border-white/10
            shadow-[0_10px_30px_rgba(0,0,0,0.5)]
          ">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl sm:rounded-3xl" />
            
            <Radio 
              size={28} 
              className="
                text-indigo-400 
                drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]
                relative z-10
                sm:hidden
              " 
            />
            <Radio 
              size={48} 
              className="
                text-indigo-400 
                drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]
                relative z-10
                hidden sm:block
              " 
            />
            
            <Sparkles size={16} className="absolute -top-2 -right-2 text-purple-400 opacity-60" />
            <Music size={14} className="absolute -bottom-1 -left-1 text-cyan-400 opacity-60" />
          </div>
        </div>

        {/* 2. Karşılama Metni */}
        <div className="space-y-2 sm:space-y-4 mb-5 sm:mb-10">
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight">
            Hoş Geldin, <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">{userName}</span>
          </h2>
          <p className="text-[#949ba4] text-xs sm:text-base max-w-lg mx-auto leading-relaxed px-2">
            Hemen bir odaya katıl veya sol menüden arkadaşlarını davet et.
            Netrex ile iletişim hiç olmadığı kadar net.
          </p>
        </div>

        {/* 3. Özellik Kartları (Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 w-full mb-6 sm:mb-10 max-w-2xl">
          {features.map((feature, index) => (
            <FeatureCard key={index} feature={feature} />
          ))}
        </div>

        {/* 4. Alt Bilgi (Ayarlar İpucu - Mobilde daha kompakt) */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-[11px] sm:text-xs text-[#949ba4] hover:bg-white/10 hover:text-white transition-colors cursor-default mb-4">
            <Settings size={13} className="shrink-0" />
            <span>Ayarlar menüsünden ses cihazlarını test edebilirsin</span>
        </div>

        {/* 5. Versiyon Bilgisi */}
        <div className="flex items-center gap-2 px-3 py-1 bg-black/20 backdrop-blur-sm rounded-lg border border-white/5 opacity-60">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.6)]" />
          <span className="text-[10px] text-[#949ba4] font-medium tracking-wide">NETREX CLIENT</span>
          <span className="w-px h-2.5 bg-white/10 mx-0.5" />
          <span className="text-[10px] text-[#dbdee1] font-mono">v{version}</span>
        </div>
      </div>
      
      {/* --- Kısayol Modalı --- */}
      {showShortcuts && (
        <ShortcutsModal 
          onClose={() => setShowShortcuts(false)} 
          shortcuts={defaultShortcuts}
        />
      )}
    </div>
  );
}

/**
 * ✨ FeatureCard - Statik özellik kartı
 */
function FeatureCard({ feature }) {
  const colorStyles = {
    indigo: "border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.15)]",
    purple: "border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.15)]",
    orange: "border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.15)]",
  };

  const iconColors = {
    indigo: "text-indigo-400 bg-indigo-500/10",
    purple: "text-purple-400 bg-purple-500/10",
    orange: "text-orange-400 bg-orange-500/10",
  };

  return (
    <div 
      className={`
        relative overflow-hidden
        bg-[#1e1f22]/60 backdrop-blur-sm
        border border-white/5 rounded-2xl
        p-4 text-left
      `}
    >
      <div className="relative z-10 flex items-start gap-4">
        <div className={`p-2.5 rounded-xl ${iconColors[feature.color]}`}>
          {feature.icon}
        </div>
        <div>
          <h3 className="text-sm font-bold text-white mb-0.5">
            {feature.label}
          </h3>
          <p className="text-xs text-[#949ba4]">
            {feature.desc}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * 🪟 ShortcutsModal - Animasyonlu Kısayol Menüsü
 */
function ShortcutsModal({ onClose, shortcuts }) {
  // Modal dışına tıklamayı yakala
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // ESC tuşu ile kapatma
  useEffect(() => {
    const handleEsc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* 
         🎨 Animasyon CSS Tanımları
      */}
      <style>{`
        @keyframes nds-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes nds-scale-in {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-nds-fade-in {
          animation: nds-fade-in 0.3s ease-out forwards;
        }
        .animate-nds-scale-in {
          animation: nds-scale-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* 
         🌑 Arka Plan (Backdrop)
      */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-nds-fade-in"
        onClick={handleBackdropClick}
      />

      {/* 
         📦 Modal İçeriği 
      */}
      <div 
        className="
          relative w-full max-w-md mx-4
          bg-gradient-to-br from-[#1a1b1e] via-[#16171a] to-[#111214]
          border border-white/10 rounded-3xl 
          shadow-[0_0_50px_rgba(0,0,0,0.5)] 
          overflow-hidden
          animate-nds-scale-in
        "
        onClick={(e) => e.stopPropagation()}
      >
          {/* Üst Parlama Efekti */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent z-20" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-20 bg-indigo-500/10 blur-[40px] pointer-events-none" />
          
          {/* --- Başlık Kısmı --- */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/[0.02] relative z-10">
              <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-lg">
                      <Keyboard size={20} />
                  </div>
                  <div>
                      <h2 className="text-lg font-bold text-white">Kısayol Tuşları</h2>
                      <p className="text-xs text-[#949ba4]">Hızlı erişim kombinasyonları</p>
                  </div>
              </div>
              
              <button 
                  onClick={onClose}
                  className="group w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 text-[#949ba4] hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/20 transition-all duration-200"
              >
                  <X size={18} className="group-hover:scale-110 transition-transform" />
              </button>
          </div>

          {/* --- Liste Kısmı --- */}
          <div className="p-6 space-y-3 relative z-10">
              {shortcuts.map((shortcut, index) => (
                  <div 
                    key={index} 
                    className="
                      group flex items-center justify-between 
                      p-3 rounded-xl 
                      bg-[#1e1f22]/50 border border-white/5 
                      hover:border-indigo-500/30 hover:bg-white/[0.07] 
                      transition-all duration-200 cursor-default
                    "
                  >
                      <div className="flex items-center gap-3">
                          <div className={`
                            p-2 rounded-lg bg-[#2b2d31] border border-white/5 text-[#949ba4]
                            group-hover:text-indigo-400 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20 
                            transition-all duration-300
                          `}>
                              {shortcut.icon}
                          </div>
                          <span className="text-sm font-medium text-[#dbdee1] group-hover:text-white transition-colors">
                            {shortcut.label}
                          </span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <kbd className="
                          px-2.5 py-1.5 rounded-lg 
                          bg-black/30 border border-white/10 
                          text-xs font-mono font-bold text-[#b5bac1] 
                          shadow-inner min-w-[32px] text-center
                          group-hover:border-white/20 group-hover:text-white group-hover:bg-black/50
                          transition-all duration-200
                        ">
                            {shortcut.hint}
                        </kbd>
                      </div>
                  </div>
              ))}
          </div>
          
          {/* --- Footer Kısmı --- */}
          <div className="px-6 py-3 bg-black/20 border-t border-white/5 flex items-center justify-center gap-2 relative z-10">
              <Command size={12} className="text-[#5c5e66]" />
              <span className="text-[10px] text-[#5c5e66]">Tuş atamalarını Ayarlar'dan değiştirebilirsin</span>
          </div>
      </div>
    </div>,
    document.body
  );
}