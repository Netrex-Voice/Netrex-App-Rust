import { Search, X } from "lucide-react";
import { findNavItem } from "./nav";

/** Arama kutusu */
export function SettingsSearchInput({ query, setQuery, className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#949ba4] pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ayarlarda ara..."
        className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-sm text-white placeholder:text-[#5c5e66] focus:outline-none focus:border-indigo-500/50 transition-colors"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-[#949ba4] hover:text-white"
          aria-label="Aramayı temizle"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

/** Arama sonuçları: hangi ayar hangi sekmede */
export function SettingsSearchResults({ results, onPick }) {
  if (results.length === 0) {
    return <div className="px-3 py-6 text-center text-xs text-[#949ba4]">Eşleşen ayar bulunamadı. Başka bir kelime deneyin.</div>;
  }

  return (
    <div className="space-y-1">
      {results.map((r) => {
        const Icon = findNavItem(r.tab)?.icon;
        return (
          <button
            key={`${r.tab}-${r.title}`}
            type="button"
            onClick={() => onPick(r.tab)}
            className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group"
          >
            {Icon && <Icon size={16} className="mt-0.5 text-[#949ba4] group-hover:text-white flex-shrink-0" />}
            <div className="min-w-0">
              <div className="text-sm text-white font-medium leading-snug">{r.title}</div>
              <div className="text-[11px] text-[#949ba4]">{r.tabLabel}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
