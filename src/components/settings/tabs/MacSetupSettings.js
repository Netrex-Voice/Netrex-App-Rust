import { ShieldAlert, Monitor, Mic, Accessibility, ExternalLink, AlertTriangle } from "lucide-react";

export default function MacSetupSettings() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-2xl font-bold text-white mb-2 relative">
        <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
          macOS Kurulum Rehberi
        </span>
      </h3>
      <p className="text-[#949ba4] text-sm mb-8">
        Netrex'ten en iyi performansı almak için bu ayarları kontrol ettiğinizden emin olun.
      </p>

      {/* 1. Global Hotkey (Erişilebilirlik) */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-6 mb-6 shadow-soft-lg group/card relative">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
        
        <div className="flex items-start gap-4 relative z-10">
          <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400 shadow-lg shadow-orange-500/10">
            <Accessibility size={24} />
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              Global Tuş Atamaları (Erişilebilirlik)
              <span className="text-[10px] px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full font-bold uppercase tracking-tight">Kritik</span>
            </h4>
            <p className="text-[#949ba4] text-sm leading-relaxed mb-4">
              Uygulama arka plandayken tuş kombinasyonlarınızın (Push-to-Talk vb.) çalışabilmesi için macOS'te özel izin verilmesi gerekir.
            </p>
            
            <div className="bg-[#1e1f22] rounded-xl px-4 py-2.5 border border-white/5 space-y-2">
              <div className="flex items-center gap-3 text-xs text-[#b5bac1]">
                <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center font-bold text-[10px]">1</div>
                <span>Sistem Ayarları &gt; Gizlilik ve Güvenlik</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#b5bac1]">
                <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center font-bold text-[10px]">2</div>
                <span>Erişilebilirlik sekmesine tıklayın</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#b5bac1]">
                <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center font-bold text-[10px]">3</div>
                <span>Netrex logosunun yanındaki anahtarı <strong>açık</strong> konuma getirin.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Gatekeeper (Uygulama Açılma Sorunu) */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-6 mb-6 shadow-soft-lg group/card relative">
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-orange-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
        
        <div className="flex items-start gap-4 relative z-10">
          <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400 shadow-lg shadow-red-500/10">
            <ShieldAlert size={24} />
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              "Geliştirici Doğrulanamadı" Hatası
            </h4>
            <p className="text-[#949ba4] text-sm leading-relaxed mb-4">
              Uygulama ilk açılışta Apple tarafından doğrulanmadığı için engellenebilir. Bu bir güvenlik açığı değildir.
            </p>
            
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 text-xs p-3 bg-red-500/10 rounded-lg border border-red-500/20 text-red-300">
                <AlertTriangle size={16} />
                <span>Uygulamaya <strong>sağ tıklayıp "Aç"</strong> deyin, ardından gelen mesajda tekrar "Aç" butonuna basın.</span>
              </div>
              <p className="text-[11px] text-[#5c5e66] px-1 italic">
                * Bu işlemi sadece bir kez yapmanız yeterlidir.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Mikrofon İzni */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-6 shadow-soft-lg group/card relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
        
        <div className="flex items-start gap-4 relative z-10">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-500/10">
            <Mic size={24} />
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-bold text-white mb-2">Mikrofon ve Medya Erişimi</h4>
            <p className="text-[#949ba4] text-sm leading-relaxed mb-4">
              Sesli sohbetin çalışması için mikrofon izninin etkin olması gerekir.
            </p>
            
            <div className="bg-[#1e1f22] rounded-xl px-4 py-2.5 border border-white/5 space-y-2">
              <p className="text-xs text-[#b5bac1]">
                Sistem Ayarları &gt; Gizlilik ve Güvenlik &gt; <strong>Mikrofon</strong> altından Netrex'in aktif olduğundan emin olun.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-center">
        <p className="text-[#949ba4] text-xs">
          Sorun yaşamaya devam ederseniz lütfen bizimle <span className="text-indigo-400 font-bold cursor-pointer hover:underline">destek kanalımızdan</span> iletişime geçin.
        </p>
      </div>
    </div>
  );
}
