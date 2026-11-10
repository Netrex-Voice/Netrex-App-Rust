import { MessageSquareText } from "lucide-react";
import ToggleSwitch from "../ToggleSwitch";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useOverlayStore } from "@/src/store/overlayStore";

// Mikrofonu kapalı bir izleyicinin gönderdiği kısa yazıların, ekranınızda kayan yazı olarak görünmesi
export default function TickerSettingsCard() {
  const enabled = useSettingsStore((s) => s.tickerMessagesEnabled);
  const setEnabled = useSettingsStore((s) => s.setTickerMessagesEnabled);
  const opacity = useSettingsStore((s) => s.tickerOpacity);
  const setOpacity = useSettingsStore((s) => s.setTickerOpacity);

  const sendTest = () => {
    if (!window.netrex?.showTickerMessage) return;
    window.netrex.showTickerMessage({
      text: "Bu bir deneme mesajıdır. Kayan yazı böyle görünür.",
      name: "Netrex",
      opacity,
      antiCheatProtection: useOverlayStore.getState().antiCheatProtection,
    });
  };

  return (
    <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 mb-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
      <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 via-indigo-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

      <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-2 relative z-10">
        <div className="w-6 h-6 rounded-lg bg-sky-500/20 flex items-center justify-center">
          <MessageSquareText size={14} className="text-sky-400" />
        </div>
        Kayan Mesajlar
      </h4>

      <div className="relative z-10 bg-[#1e1f22] rounded-xl px-4 py-3 border border-white/5 space-y-4">
        <ToggleSwitch
          label="Kayan mesajları göster"
          description="Yayınınızı izleyen biri mikrofonu kapalıyken size kısa bir yazı gönderirse, ekranınızın üstünde kayan yazı olarak görünür. Hangi uygulamada olursanız olun üstte kalır ve tıklamayı engellemez."
          checked={enabled}
          onChange={() => setEnabled(!enabled)}
        />

        {enabled && (
          <>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#b5bac1] uppercase">Opaklık</span>
                <span className="text-xs text-[#949ba4] tabular-nums">{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="30"
                max="100"
                step="5"
                value={Math.round(opacity * 100)}
                onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                className="w-full accent-sky-500"
              />
              <p className="text-[11px] text-[#949ba4] mt-1.5">
                Daha düşük değer daha az dikkat dağıtır. Yazının süresi uzunluğuna göre otomatik ayarlanır. Sağ uçtaki ✕
                ile anında kapatabilirsiniz.
              </p>
            </div>

            {typeof window !== "undefined" && window.netrex?.showTickerMessage && (
              <button
                type="button"
                onClick={sendTest}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 transition-colors"
              >
                Deneme mesajı göster
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
