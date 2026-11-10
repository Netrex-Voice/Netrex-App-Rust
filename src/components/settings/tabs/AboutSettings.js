import { Github, Youtube, ExternalLink } from "lucide-react";

export default function AboutSettings() {
  // Versiyon bilgilerini package.json'dan al
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0";
  const appName = "Netrex";
  const appDescription = "Güvenli Masaüstü Sesli Sohbet Uygulaması";
  const githubUrl = "https://github.com/MuratGuelr/netrex-standalone";
  const youtubeUrl = "https://www.youtube.com/@ConsolAktif";

  // Teknoloji versiyonları
  const techVersions = {
    nextjs: "14.2.16",
    electron: "Latest",
    react: "19.2.0",
    livekit: "Latest",
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-xl font-bold text-white mb-3 relative">
        <span className="relative z-10">Uygulama Hakkında</span>
      </h3>

      {/* Logo ve Uygulama Bilgileri */}
      <div className="glass-strong rounded-2xl overflow-hidden border border-white/20 shadow-soft-lg hover:shadow-xl transition-all duration-300 mb-4 relative group/card">
        {/* Hover glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 z-10 pointer-events-none"></div>

        <div className="h-32 w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 relative overflow-hidden">
          {/* Animated background pattern */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
          </div>
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30"></div>
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/card:translate-x-full transition-transform duration-1000"></div>
        </div>
        <div className="px-6 pb-6 relative">
          <div className="flex justify-between items-end -mt-10 mb-5">
            <div className="flex items-end gap-4">
              {/* Logo Container */}
              <div className="p-2 bg-gradient-to-br from-[#1e1f22] to-[#2b2d31] rounded-2xl shadow-xl border border-white/10">
                <div className="w-24 h-24 rounded-xl overflow-hidden shadow-2xl relative group/logo">
                  <img
                    src="logo.png"
                    alt="Netrex Logo"
                    className="w-full h-full object-contain bg-gradient-to-br from-nds-bg-secondary to-nds-bg-tertiary p-2 transition-transform duration-300 group-hover/logo:scale-110"
                  />
                  {/* Logo glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 opacity-0 group-hover/logo:opacity-100 transition-opacity duration-300"></div>
                </div>
              </div>
              <div className="mb-2">
                <h2 className="text-2xl font-bold text-white leading-none mb-2 flex items-center gap-2">
                  {appName}
                  <span className="px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full text-white shadow-lg">
                    v{appVersion}
                  </span>
                </h2>
                <span className="text-sm text-[#949ba4] font-medium flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                  Aktif Sürüm
                </span>
              </div>
            </div>
          </div>
          <div className="glass-strong rounded-xl p-4 border border-white/10 relative z-10 bg-gradient-to-r from-nds-bg-secondary/50 to-transparent">
            <p className="text-white text-sm leading-relaxed font-medium">
              {appDescription}
            </p>
            <p className="text-[#949ba4] text-xs mt-2">
              Gizliliğinize önem veren, açık kaynak kodlu masaüstü sesli iletişim platformu.
            </p>
          </div>
        </div>
      </div>

      {/* Versiyon Bilgileri */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 mb-3 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        {/* Hover glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-2 relative z-10">
          <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
          Versiyon Bilgileri
        </h4>
        <div className="grid grid-cols-2 gap-3 relative z-10">
          <div className="bg-[#1e1f22] rounded-xl p-3 border border-white/5 hover:border-indigo-500/30 transition-colors duration-300 group/tech">
            <span className="text-[10px] font-bold text-[#949ba4] uppercase block mb-1">Uygulama</span>
            <span className="text-white text-sm font-bold group-hover/tech:text-indigo-400 transition-colors">{appVersion}</span>
          </div>
          <div className="bg-[#1e1f22] rounded-xl p-3 border border-white/5 hover:border-purple-500/30 transition-colors duration-300 group/tech">
            <span className="text-[10px] font-bold text-[#949ba4] uppercase block mb-1">Next.js</span>
            <span className="text-white text-sm font-bold group-hover/tech:text-purple-400 transition-colors">{techVersions.nextjs}</span>
          </div>
          <div className="bg-[#1e1f22] rounded-xl p-3 border border-white/5 hover:border-cyan-500/30 transition-colors duration-300 group/tech">
            <span className="text-[10px] font-bold text-[#949ba4] uppercase block mb-1">Electron</span>
            <span className="text-white text-sm font-bold group-hover/tech:text-cyan-400 transition-colors">{techVersions.electron}</span>
          </div>
          <div className="bg-[#1e1f22] rounded-xl p-3 border border-white/5 hover:border-blue-500/30 transition-colors duration-300 group/tech">
            <span className="text-[10px] font-bold text-[#949ba4] uppercase block mb-1">React</span>
            <span className="text-white text-sm font-bold group-hover/tech:text-blue-400 transition-colors">{techVersions.react}</span>
          </div>
        </div>
      </div>

      {/* Geliştirici Bilgileri */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 mb-3 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        {/* Hover glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-2 relative z-10">
          <div className="w-1 h-1 bg-green-400 rounded-full"></div>
          Geliştirici
        </h4>
        <div className="space-y-3 relative z-10">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[#b5bac1] text-sm">Geliştirici</span>
            <span className="text-white text-sm font-semibold">ConsolAktif</span>
          </div>
          <div className="h-px bg-white/10"></div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[#b5bac1] text-sm">Lisans</span>
            <span className="text-white text-sm font-semibold">MIT</span>
          </div>
          <div className="h-px bg-white/10"></div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[#b5bac1] text-sm">Teknolojiler</span>
            <span className="text-white text-sm font-semibold">Next.js, Electron, LiveKit</span>
          </div>
        </div>
      </div>

      {/* Linkler */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        {/* Hover glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-2 relative z-10">
          <div className="w-1 h-1 bg-purple-400 rounded-full"></div>
          Linkler
        </h4>
        <div className="space-y-2 relative z-10">
          <button
            onClick={() => {
              if (window.netrex?.openExternalLink) {
                window.netrex.openExternalLink(githubUrl);
              } else {
                window.open(githubUrl, "_blank", "noopener,noreferrer");
              }
            }}
            onMouseDown={(e) => e.preventDefault()}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1e1f22] border border-white/10 hover:bg-gradient-to-r hover:from-indigo-500/10 hover:to-purple-500/10 hover:border-indigo-500/30 text-[#b5bac1] hover:text-white transition-all duration-300 group/link w-full text-left relative overflow-hidden focus:outline-none"
          >
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/link:opacity-100 transition-opacity duration-300"></div>
            <Github
              size={18}
              className="relative z-10 group-hover/link:scale-110 transition-transform duration-300"
            />
            <span className="text-sm font-medium relative z-10">
              GitHub Repository
            </span>
            <ExternalLink
              size={14}
              className="ml-auto opacity-0 group-hover/link:opacity-100 transition-opacity relative z-10"
            />
          </button>
          <button
            onClick={() => {
              if (window.netrex?.openExternalLink) {
                window.netrex.openExternalLink(youtubeUrl);
              } else {
                window.open(youtubeUrl, "_blank", "noopener,noreferrer");
              }
            }}
            onMouseDown={(e) => e.preventDefault()}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1e1f22] border border-white/10 hover:bg-gradient-to-r hover:from-red-500/10 hover:to-red-600/10 hover:border-red-500/30 text-[#b5bac1] hover:text-white transition-all duration-300 group/link w-full text-left relative overflow-hidden focus:outline-none"
          >
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/link:opacity-100 transition-opacity duration-300"></div>
            <Youtube
              size={18}
              className="relative z-10 group-hover/link:scale-110 transition-transform duration-300 text-red-500"
            />
            <span className="text-sm font-medium relative z-10">
              YouTube Kanalı
            </span>
            <ExternalLink
              size={14}
              className="ml-auto opacity-0 group-hover/link:opacity-100 transition-opacity relative z-10"
            />
          </button>
        </div>
      </div>
    </div>
  );
}
