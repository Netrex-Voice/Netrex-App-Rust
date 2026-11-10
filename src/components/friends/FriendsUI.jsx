"use client";

/**
 * 🎨 FriendsUI - Arkadaşlar ekranının ortak yapı taşları (Netrex tasarım dili)
 *
 * Ayarlar ekranındaki kartlarla aynı dil: glass-strong yüzey, rounded-2xl, border-white/20,
 * renkli ikon çipli büyük harfli bölüm başlığı, hover'da hafif indigo parıltı.
 * Tailwind sınıfları JIT için tam metin olarak yazılır (dinamik birleştirme yok).
 */

// Bölüm başlığı çipi renkleri (ikon arka planı + ikon rengi)
const CHIP_TONES = {
  indigo: { bg: "bg-indigo-500/20", text: "text-indigo-400" },
  green: { bg: "bg-green-500/20", text: "text-green-400" },
  emerald: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
  slate: { bg: "bg-white/10", text: "text-[#949ba4]" },
  red: { bg: "bg-red-500/20", text: "text-red-400" },
};

// Sayı rozeti renkleri
const COUNT_TONES = {
  neutral: "bg-white/5 border-white/10 text-[#b5bac1]",
  green: "bg-green-500/10 border-green-500/25 text-green-400",
  red: "bg-red-500/15 border-red-500/30 text-red-400",
};

/** Başlıklı bölüm kartı (ör. "ÇEVRİMİÇİ — 3") */
export function SectionCard({ icon: Icon, tone = "indigo", title, count, countTone = "neutral", description, children, className = "" }) {
  const chip = CHIP_TONES[tone] || CHIP_TONES.indigo;
  return (
    <section className={`glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 shadow-soft-lg relative group/card ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pointer-events-none" />
      <header className={`relative z-10 flex items-center gap-2 ${description ? "mb-1.5" : "mb-3"}`}>
        {Icon && (
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${chip.bg}`}>
            <Icon size={14} className={chip.text} />
          </div>
        )}
        <h4 className="text-xs font-bold text-[#949ba4] uppercase tracking-wider">{title}</h4>
        {count != null && (
          <span className={`min-w-[22px] h-5 px-1.5 rounded-full border text-[10px] font-bold flex items-center justify-center ${COUNT_TONES[countTone] || COUNT_TONES.neutral}`}>
            {count}
          </span>
        )}
      </header>
      {description && <p className="relative z-10 text-xs text-[#949ba4] mb-3 ml-8">{description}</p>}
      <div className="relative z-10">{children}</div>
    </section>
  );
}

const EMPTY_TONES = {
  slate: {
    box: "from-[#2b2d31] to-[#1e1f22] border-white/5",
    icon: "text-[#5c5e66]",
  },
  indigo: {
    box: "from-indigo-500/10 to-purple-500/10 border-indigo-500/20",
    icon: "text-indigo-400",
  },
};

/** Boş durum kartı */
export function EmptyState({ icon: Icon, title, description, tone = "slate", children }) {
  const t = EMPTY_TONES[tone] || EMPTY_TONES.slate;
  return (
    <div className="glass-strong rounded-2xl border border-white/20 shadow-soft-lg flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br border flex items-center justify-center mb-5 shadow-lg ${t.box}`}>
        <Icon size={36} className={t.icon} />
      </div>
      <h3 className="text-lg font-bold text-white mb-1.5">{title}</h3>
      {description && <p className="text-sm text-[#949ba4] max-w-sm leading-relaxed">{description}</p>}
      {children}
    </div>
  );
}
