import { X } from "lucide-react";

export default function KeybindRow({
  label,
  description,
  shortcut,
  isRecording,
  onClick,
  onRemove,
  icon,
  recordedKeybinding,
  formatKeybinding,
}) {
  // Use recordedKeybinding for live preview if recording, otherwise use the saved shortcut
  const displayShortcut = isRecording && recordedKeybinding 
    ? formatKeybinding(recordedKeybinding) 
    : shortcut;

  return (
    <div className="flex items-center justify-between p-4 hover:bg-white/5 transition-all duration-300 group/item border-b border-white/5 last:border-b-0">
      <div className="pr-4 flex-1 flex items-center gap-3">
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 group-hover/item:border-white/20 transition-colors shrink-0">
            {icon}
          </div>
        )}
        <div>
          <div className="font-medium text-white mb-0.5 group-hover/item:text-[#dbdee1] transition-colors">
            {label}
          </div>
          <div className="text-xs text-[#949ba4] group-hover/item:text-[#b5bac1] transition-colors">
            {description}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {shortcut && shortcut !== "Atanmadı" && !isRecording && (
          <button
            onClick={onRemove}
            onMouseDown={(e) => e.preventDefault()}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#949ba4] hover:text-[#f04747] hover:bg-[#f04747]/10 transition-all duration-300 focus:outline-none border border-transparent hover:border-red-500/30"
            title="Tuş atamasını kaldır"
          >
            <X size={16} />
          </button>
        )}
        <button
          onClick={onClick}
          onMouseDown={(e) => e.preventDefault()}
          className={`w-44 py-2.5 rounded-xl border-2 text-sm font-mono transition-all duration-300 relative overflow-hidden focus:outline-none ${
            isRecording
              ? "bg-gradient-to-r from-red-500/10 to-red-600/10 border-red-500 text-red-400 shadow-[0_0_15px_rgba(240,71,71,0.3)]"
              : shortcut && shortcut !== "Atanmadı"
              ? "bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-500/50 text-indigo-300 hover:border-indigo-400 hover:shadow-[0_0_10px_rgba(99,102,241,0.2)]"
              : "bg-[#1e1f22] border-white/10 text-[#949ba4] hover:border-white/20 hover:text-white"
          }`}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            {isRecording && (
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            )}
            {isRecording && !recordedKeybinding ? "Tuşa Basın..." : displayShortcut || "Atanmadı"}
          </span>
          {isRecording && (
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-red-600/5 animate-pulse"></div>
          )}
        </button>
      </div>
    </div>
  );
}
