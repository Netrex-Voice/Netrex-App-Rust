import { Pencil } from "lucide-react";
import { QUICK_MESSAGES } from "@/src/utils/tickerSend";

/**
 * 💬 Hızlı mesaj kareleri — "Hızlı Durum" (QuickStatusManager) ile aynı görsel dil:
 * 4 sütun, kare koyu kutular, büyük emoji + küçük büyük harfli etiket, üzerine gelince tam metin balonu.
 *
 * Hem yayının "Mesaj" kutusunda hem de yayına sağ tıklayınca açılan menüde kullanılır.
 *
 * onSend(text)  : bir kareye tıklanınca
 * onWrite       : verilirse son kare "Yaz" olur (kendi mesajını yazmak için)
 * writing       : "Yaz" karesi açık mı (vurgulu görünür)
 * disabled      : bekleme/spam sınırı sırasında kareler pasif
 */
export function QuickMessageGrid({ onSend, onWrite, writing = false, disabled = false }) {
  return (
    <div className="grid grid-cols-4 gap-2 px-1 relative z-10">
      {QUICK_MESSAGES.map((m) => (
        <button
          key={m.text}
          type="button"
          disabled={disabled}
          onClick={() => onSend(m.text)}
          className="
            relative group/icon-btn
            flex flex-col items-center justify-center
            aspect-square rounded-2xl
            transition-colors duration-150 border
            bg-[#1a1b1e] border-white/5 hover:border-white/10 hover:bg-[#202225]
            active:scale-95
            disabled:opacity-40 disabled:hover:bg-[#1a1b1e] disabled:hover:border-white/5 disabled:active:scale-100
          "
        >
          <span className="text-2xl mb-1 transition-transform duration-150 group-hover/icon-btn:scale-110">
            {m.icon}
          </span>
          <span className="text-[8px] font-bold uppercase truncate w-full px-1 text-center text-[#949ba4] group-hover/icon-btn:text-white transition-colors duration-150">
            {m.label}
          </span>

          {/* Tam metin balonu (Hızlı Durum'daki gibi) */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-[#111214] text-[10px] font-bold text-white rounded-lg border border-white/10 opacity-0 group-hover/icon-btn:opacity-100 transition-opacity duration-150 whitespace-nowrap z-[100] pointer-events-none shadow-lg">
            {m.text}
            <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[#111214] border-b border-r border-white/10 rotate-45"></div>
          </div>
        </button>
      ))}

      {onWrite && (
        <button
          type="button"
          onClick={onWrite}
          className={`
            relative group/icon-btn
            flex flex-col items-center justify-center
            aspect-square rounded-2xl
            transition-colors duration-150 border
            ${writing
              ? "bg-indigo-500/10 border-indigo-500/40"
              : "bg-[#1a1b1e] border-white/5 hover:border-white/10 hover:bg-[#202225]"}
          `}
        >
          <Pencil
            size={20}
            className={`mb-1 transition-transform duration-150 ${writing ? "text-indigo-300" : "text-[#949ba4] group-hover/icon-btn:text-white group-hover/icon-btn:scale-110"}`}
          />
          <span className={`text-[8px] font-bold uppercase truncate w-full px-1 text-center transition-colors duration-150 ${writing ? "text-white" : "text-[#949ba4] group-hover/icon-btn:text-white"}`}>
            Yaz
          </span>
        </button>
      )}
    </div>
  );
}
