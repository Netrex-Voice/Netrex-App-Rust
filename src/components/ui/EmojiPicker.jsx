"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";

const EMOJI_CATEGORIES = [
  {
    name: "Sık Kullanılan",
    emojis: ["😀", "😂", "🫠", "🤔", "😊", "😍", "😎", "🫡", "😭", "😤", "🤯", "😴", "🚽", "⏰", "🚨"]
  },
  {
    name: "Durumlar",
    emojis: ["🚽", "⏰", "🚨", "🍲", "🎮", "📞", "🚶", "🏃", "🛌", "🛀", "🚬", "🍻", "🍿", "🎧", "💻", "🚪", "🛡️", "⚔️", "💊", "💤", "🔋", "🔌"]
  },
  {
    name: "Suratlar",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "🫠", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🫢", "🫢", "🤫", "🤔", "🫡", "🤐", "🤨", "😐", "😑", "😶", "🫥", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥", "🫨", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "😵‍💫", "🤯", "🤠", "🥳", "🥸", "😎"]
  },
  {
    name: "Nesneler & Aktiviteler",
    emojis: ["⚽", "🏀", "🏈", "🎾", "🏐", "🏉", "🎱", "🏓", "🏸", "🏒", "🏑", "🏏", "🎯", "🏹", "⛳", "🪁", "🪁", "🎣", "🤿", "🥊", "🥋", "⛸️", "🎿", "🛷", "🛹", "🛼", "🏋️", "⛹️", "🤺", "🏇", "🏌️", "🏄", "🏊", "🤽", "🚣", "🚵", "🚴"]
  },
  {
    name: "Semboller",
    emojis: ["❤️", "✨", "🔥", "💯", "✅", "❌", "⚠️", "🕒", "💤", "💻", "🛑", "🔔", "⭐", "🎉", "🎈", "📌", "💎", "🔮", "🧿", "🌀", "💠", "🎵", "🎶", "💹", "➕", "➖", "➗", "✖️", "♾️"]
  }
];

export default function EmojiPicker({ onSelect, onClose }) {
  const [search, setSearch] = useState("");

  const filteredEmojis = useMemo(() => {
    if (!search) return EMOJI_CATEGORIES;
    
    return EMOJI_CATEGORIES.map(cat => ({
      ...cat,
      emojis: cat.emojis.filter(e => e.includes(search)) // Simple check, actual emoji name searching is complex
    })).filter(cat => cat.emojis.length > 0);
  }, [search]);

  return (
    <div className="flex flex-col h-[320px] bg-[#1a1b1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-nds-fade-in relative">
      {/* Header */}
      <div className="p-3 border-b border-white/5 flex items-center justify-between">
        <div className="relative flex-1 mr-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5c5e66]" />
          <input 
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Emoji ara..."
            className="w-full bg-white/5 border border-white/5 rounded-xl py-2 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-all"
          />
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/5 rounded-xl text-[#5c5e66] hover:text-white transition-all"
        >
          <X size={16} />
        </button>
      </div>

      {/* Emoji List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-4">
        {filteredEmojis.map((cat, idx) => (
          <div key={idx}>
            <h5 className="text-[10px] font-bold text-[#5c5e66] uppercase tracking-widest mb-2 px-1">
              {cat.name}
            </h5>
            <div className="grid grid-cols-6 gap-1">
              {cat.emojis.map((emoji, eIdx) => (
                <button
                  key={eIdx}
                  onClick={() => {
                    onSelect(emoji);
                  }}
                  className="w-9 h-9 flex items-center justify-center text-xl rounded-xl hover:bg-white/10 transition-all hover:scale-125 active:scale-95"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
        
        {filteredEmojis.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-[#5c5e66] text-xs py-10">
                <span>Sonuç yok 😢</span>
            </div>
        )}
      </div>
    </div>
  );
}
