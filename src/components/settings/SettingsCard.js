// Ayar sekmelerinde tekrar eden düzen parçaları (mevcut kartlarla aynı görünüm).
// Tailwind sınıfları tam metin olarak çağıran tarafta verilmeli (JIT, dinamik birleştirme yok).

/** Sekmenin üstündeki renkli başlık şeridi */
export function TabBanner({ icon, title, description, gradient = "from-indigo-600 via-purple-600 to-indigo-600" }) {
  return (
    <div className="glass-strong rounded-2xl overflow-hidden border border-white/20 shadow-soft-lg hover:shadow-xl transition-all duration-300 mb-4 relative group/card">
      <div className={`h-16 w-full bg-gradient-to-r ${gradient} relative overflow-hidden`}>
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30"></div>
        <div className="absolute inset-0 flex items-center px-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
              {icon}
            </div>
            <div>
              <h4 className="text-white font-bold text-lg">{title}</h4>
              {description && <p className="text-white/70 text-sm">{description}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Başlıklı, açıklamalı kart. `iconBg`: ör. "bg-indigo-500/20" */
export function SettingsCard({ icon, iconBg = "bg-indigo-500/20", title, description, children, className = "mb-4" }) {
  return (
    <div className={`glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
      <h4 className={`text-xs font-bold text-[#949ba4] uppercase flex items-center gap-2 relative z-10 ${description ? "mb-2" : "mb-3"}`}>
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${iconBg}`}>{icon}</div>
        {title}
      </h4>
      {description && <p className="text-xs text-[#949ba4] mb-3 ml-8 relative z-10">{description}</p>}
      <div className="relative z-10 space-y-1">{children}</div>
    </div>
  );
}

/** Kart içindeki tek bir ayar satırı kutusu */
export function SettingRow({ children, hoverBorder = "hover:border-indigo-500/20" }) {
  return (
    <div className={`bg-[#1e1f22] rounded-xl px-4 py-2.5 border border-white/5 ${hoverBorder} transition-colors duration-300`}>
      {children}
    </div>
  );
}
