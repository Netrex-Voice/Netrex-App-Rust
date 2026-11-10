"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Keyboard, MousePointerClick, MessageSquare } from "lucide-react";
import { getKeyLabel, isModifierKey, getMouseLabel } from "@/src/utils/keyMap";

const formatKeybinding = (keybinding) => {
  if (!keybinding) return null;
  if (keybinding.type === "mouse" || keybinding.mouseButton)
    return getMouseLabel(keybinding.mouseButton);
  if (typeof keybinding.code !== "string") return null;
  const keyLabel = getKeyLabel(keybinding.code);
  const isStandaloneModifier = isModifierKey(keybinding.code);
  if (isStandaloneModifier) return keyLabel;
  const modifiers = [];
  if (keybinding.ctrlKey) modifiers.push("Ctrl");
  if (keybinding.shiftKey) modifiers.push("Shift");
  if (keybinding.altKey) modifiers.push("Alt");
  if (keybinding.metaKey) modifiers.push("Win");
  if (modifiers.length > 0) return [...modifiers, keyLabel].join(" + ");
  return keyLabel;
};

const STATIC_SHORTCUTS = [
  {
    combo: "Ctrl + /",
    description: "Klavye kısayollarını göster",
    action: null,
  },
  { combo: "Ctrl + Enter", description: "Mesaj gönder", action: null },
  { combo: "ESC", description: "Açık modalları kapat", action: null },
];

export default function ShortcutHelpModal({ isOpen, onClose }) {
  const [muteKeybinding, setMuteKeybinding] = useState(null);
  const [deafenKeybinding, setDeafenKeybinding] = useState(null);
  const [cameraKeybinding, setCameraKeybinding] = useState(null);

  useEffect(() => {
    if (!isOpen || !window.netrex) return;
    window.netrex.getHotkey("mute").then((k) => setMuteKeybinding(k || null));
    window.netrex
      .getHotkey("deafen")
      .then((k) => setDeafenKeybinding(k || null));
    window.netrex
      .getHotkey("camera")
      .then((k) => setCameraKeybinding(k || null));
  }, [isOpen]);

  const dynamicShortcuts = [
    {
      combo: formatKeybinding(muteKeybinding),
      description: "Mikrofonu Sustur (Mute)",
      action: "mute",
    },
    {
      combo: formatKeybinding(deafenKeybinding),
      description: "Sağırlaştır (Deafen)",
      action: "deafen",
    },
    {
      combo: formatKeybinding(cameraKeybinding),
      description: "Kamerayı Aç/Kapat",
      action: "camera",
    },
  ].filter((s) => s.combo); // Sadece atanmış olanları göster

  const allShortcuts = [...STATIC_SHORTCUTS, ...dynamicShortcuts];
  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-fadeIn">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent pointer-events-none"></div>
      
      <div className="glass-strong border border-white/20 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scaleIn backdrop-blur-2xl bg-gradient-to-br from-[#1e1f22]/95 via-[#25272a]/95 to-[#2b2d31]/95 relative">
        {/* Top glow effect */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent z-10"></div>
        
        <div className="p-8 flex items-center gap-4 border-b border-white/10 relative z-10">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/30 shadow-soft">
            <Keyboard size={28} className="text-indigo-300" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">Klavye Kısayolları</h3>
            <p className="text-sm text-[#949ba4]">
              Netrex'i daha hızlı kullanın
            </p>
          </div>
        </div>
        
        <div className="p-6 space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar relative z-10">
          {allShortcuts.map(({ combo, description, action }) => (
            <div
              key={combo || action}
              className="flex items-center justify-between glass-strong border border-white/10 rounded-xl px-5 py-4 gap-4 hover:bg-white/5 transition-all duration-300 group"
            >
              <div>
                <p className="text-white font-semibold text-sm group-hover:text-[#dbdee1] transition-colors">
                  {description}
                </p>
                <p className="text-xs text-[#949ba4] mt-1 group-hover:text-[#b5bac1] transition-colors">
                  {action
                    ? "Ayarlardan değiştirilebilir"
                    : "Masaüstü uygulaması"}
                </p>
              </div>
              <span className="text-xs font-bold text-indigo-300 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-lg px-4 py-2 shadow-soft">
                {combo || "Atanmadı"}
              </span>
            </div>
          ))}
          
          <div className="bg-gradient-to-r from-blue-500/15 to-indigo-500/15 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3 text-sm text-blue-200 mt-4 shadow-soft">
            <MousePointerClick size={18} className="text-blue-300 shrink-0 mt-0.5" />
            <p>
              Kısayol penceresini açmak için{" "}
              <span className="font-bold text-white bg-blue-500/20 px-2 py-0.5 rounded">Ctrl + /</span>{" "}
              kombinasyonunu kullanabilirsiniz.
            </p>
          </div>
        </div>
        
        <div className="flex justify-end gap-3 bg-gradient-to-t from-[#1e1f22] via-[#25272a] to-transparent p-6 border-t border-white/10 rounded-b-3xl backdrop-blur-xl relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
          <button
            onClick={onClose}
            onMouseDown={(e) => e.preventDefault()}
            className="px-8 py-3 gradient-primary hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 relative overflow-hidden group/save focus:outline-none"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 group-hover/save:opacity-100 transition-opacity duration-300"></div>
            <span className="relative z-10">Anladım</span>
          </button>
        </div>
      </div>
    </div>
  );

  // React Portal kullanarak document.body'ye render et
  if (typeof window !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  return null;
}
