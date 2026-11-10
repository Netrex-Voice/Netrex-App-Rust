"use client";
import { useState, useEffect } from "react";

export default function UpdateSplash({ onComplete }) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    // Nokta animasyonu (Discord benzeri)
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === "...") return "";
        return prev + ".";
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Güncelleme kontrolü tamamlandığında ana ekrana geç
  useEffect(() => {
    if (!window.netrex) {
      // Electron yoksa hemen geç
      setTimeout(() => onComplete?.(), 1000);
      return;
    }

    let timeoutId;
    let hasCompleted = false;

    const complete = () => {
      if (hasCompleted) return;
      hasCompleted = true;
      if (timeoutId) clearTimeout(timeoutId);
      // Electron'a splash tamamlandı mesajı gönder (ana pencereyi göster)
      if (window.netrex?.notifySplashComplete) {
        window.netrex.notifySplashComplete().catch(console.error);
      }
      // Kısa bir gecikme ile ana ekrana geç (kullanıcı ekranı görebilsin)
      setTimeout(() => {
        onComplete?.();
      }, 300);
    };

    // Güncelleme durumunu dinle
    // "checking" durumunda kal, "not-available" veya "available" olduğunda geç
    window.netrex?.onUpdateStatus?.((status) => {
      if (status === "not-available" || status === "available" || status === "error") {
        complete();
      }
    });

    // Eğer 5 saniye içinde yanıt gelmezse ana ekrana geç (timeout)
    timeoutId = setTimeout(() => {
      complete();
    }, 5000);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      hasCompleted = true;
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[99999] bg-gradient-to-br from-[#0f0f11] via-[#1a1b1e] to-[#1e1f22] flex flex-col items-center justify-center select-none">
      {/* Arka plan dekorasyonu */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse-slow"></div>
      </div>

      {/* Logo ve Animasyon */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Netrex Logo - Animasyonlu */}
        <div className="relative">
          {/* Glow efekti */}
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full blur-2xl opacity-30 animate-pulse"></div>
          
          {/* Logo container */}
          <div className="relative w-24 h-24 flex items-center justify-center">
            {/* Dış halka - dönen animasyon */}
            <div className="absolute inset-0 border-4 border-transparent border-t-indigo-500 border-r-purple-500 rounded-full animate-spin-slow"></div>
            
            {/* İç halka - ters yönde dönen animasyon */}
            <div className="absolute inset-2 border-[3px] border-transparent border-b-indigo-400 border-l-purple-400 rounded-full animate-spin-reverse-slow"></div>
            
            {/* Merkez logo */}
            <div className="relative w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-2xl">
              <div className="text-white font-black text-2xl">N</div>
              {/* İç glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl"></div>
            </div>
          </div>
        </div>

        {/* Metin */}
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-white text-xl font-bold tracking-wide">
            Güncellemeler kontrol ediliyor{dots}
          </h2>
          <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full animate-progress-bar"></div>
          </div>
        </div>
      </div>

      {/* CSS Animasyonları */}
      <style jsx>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        @keyframes spin-reverse-slow {
          from {
            transform: rotate(360deg);
          }
          to {
            transform: rotate(0deg);
          }
        }
        
        @keyframes progress-bar {
          0% {
            width: 0%;
            transform: translateX(-100%);
          }
          50% {
            width: 70%;
            transform: translateX(0%);
          }
          100% {
            width: 100%;
            transform: translateX(100%);
          }
        }
        
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
        
        .animate-spin-reverse-slow {
          animation: spin-reverse-slow 2s linear infinite;
        }
        
        .animate-progress-bar {
          animation: progress-bar 2s ease-in-out infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

