import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { MessageSquareText, Send, X } from "lucide-react";
import { useLocalParticipant } from "@livekit/components-react";
import {
  TICKER_MAX_CHARS,
  TICKER_MAX_PER_MINUTE,
  sanitizeTickerText,
} from "@/src/hooks/useCursorShareController";
import { getTickerWait, sendTickerMessage } from "@/src/utils/tickerSend";
import { QuickMessageGrid } from "./QuickMessagePicker";
import UserPhoto from "@/src/components/ui/UserPhoto";
import { AvatarFallback } from "@/src/components/ui/Avatar";

/**
 * 💬 Yayıncıya kayan mesaj gönder
 *
 * Mikrofonunu o an açamayan izleyici, yayıncıya kısa bir yazı gönderir; yayıncının ekranında
 * (hangi uygulamada olursa olsun) en üstte kayan yazı olarak görünür.
 *
 * Görünüm, kullanıcıya sağ tıklayınca açılan kartla (UserContextMenu) ve "Hızlı Durum" kareleriyle aynı dilde:
 * koyu kart, parıltılı avatarlı başlık, emojili kareler. Kart izlenen yayının kendi kutusunun içine (alt orta)
 * açılır; tam ekranda da aynı yerde kalır ve üst çubuk gizlense bile yazarken kaybolmaz.
 *
 * En hızlı yol: yayına SAĞ TIK → "Hızlı mesaj" (işaretçi izni varsa Shift + sağ tık). Gönderme sınırları
 * (bekleme, dakika sınırı) o menüyle ortaktır: src/utils/tickerSend.js
 */
export default function TickerMessageButton({ targetParticipant }) {
  const { localParticipant } = useLocalParticipant();
  const [open, setOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [host, setHost] = useState(null);
  const [, forceTick] = useState(0);
  const buttonRef = useRef(null);
  const inputRef = useRef(null);

  const targetId = targetParticipant?.identity;
  const targetName = targetParticipant?.name || targetParticipant?.identity || "Yayıncı";
  const targetPhoto = useMemo(() => {
    try {
      return targetParticipant?.metadata ? JSON.parse(targetParticipant.metadata).photoURL || null : null;
    } catch (e) {
      return null;
    }
  }, [targetParticipant?.metadata]);

  const openBox = () => {
    // Yayının kendi kutusu; bulunamazsa tam ekran elemanı ya da sayfa
    setHost(buttonRef.current?.closest("[data-stage-container]") || document.fullscreenElement || document.body);
    setWriting(false);
    setOpen(true);
  };
  const closeBox = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (open && writing) inputRef.current?.focus();
  }, [open, writing]);

  // Kart açıkken bekleme geri sayımı canlı kalsın (menüden ya da buradan gönderilmiş olabilir)
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => forceTick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [open]);

  // Esc ile kapat (yazma alanında değilken de çalışsın)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = (override) => {
    const res = sendTickerMessage(localParticipant, targetId, override ?? text);
    if (res.ok) {
      setText("");
      setOpen(false);
    }
  };

  const remaining = TICKER_MAX_CHARS - text.length;
  const wait = getTickerWait();
  const waitSec = Math.ceil(wait.ms / 1000);
  const cooling = waitSec > 0;
  const canSend = !!sanitizeTickerText(text) && !cooling;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? closeBox() : openBox())}
        className={`ml-2 px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-200 border ${
          open
            ? "bg-[#5865f2]/20 text-indigo-200 border-[#5865f2]/40"
            : "bg-white/5 text-[#b5bac1] border-white/5 hover:bg-white/10 hover:text-white"
        }`}
        title="Yayıncıya kayan yazı olarak kısa bir mesaj gönder. Daha hızlısı: yayına sağ tıkla (işaretçi izniniz varsa Shift + sağ tık)."
      >
        <MessageSquareText size={14} />
        <span>Mesaj</span>
      </button>

      {open &&
        host &&
        createPortal(
          <div
            // data-pointer-toolbar: işaretçi yakalayıcı bu karttaki tıklamaları ekran işareti saymasın
            data-pointer-toolbar
            className="absolute left-1/2 -translate-x-1/2 bottom-16 z-[60] w-72 max-w-[94%] bg-[#0d0e10] border border-white/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.05)] p-3 flex flex-col gap-2 select-none animate-in fade-in zoom-in-95 duration-150"
            // Tıklamalar altındaki yayın kutusuna (çift tıkla tam ekran, sağ tık menüsü vb.) geçmesin
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {/* Başlık: yayıncı (kullanıcı kartındaki gibi parıltılı avatar) */}
            <div className="flex items-center gap-3 px-2 pb-3 border-b border-white/[0.06]">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-md opacity-40"></div>
                <UserPhoto
                  uid={targetId}
                  src={targetPhoto}
                  alt={targetName}
                  className="relative w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-white/10"
                  fallback={
                    <AvatarFallback
                      name={targetName}
                      className="relative w-10 h-10 rounded-full shrink-0 ring-2 ring-white/10"
                      textClassName="text-sm font-bold"
                    />
                  }
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold text-white truncate block">{targetName}</span>
                <span className="text-[10px] text-[#5c5e66]">Ekranında kayan yazı olarak görünür</span>
              </div>
              <button
                type="button"
                onClick={closeBox}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#5c5e66] hover:text-white hover:bg-white/10 transition-colors shrink-0"
                title="Kapat (Esc)"
              >
                <X size={14} />
              </button>
            </div>

            <div className="px-1 py-1 flex flex-col gap-2">
              {/* Bölüm başlığı: "Hızlı Durum" ile aynı */}
              <div className="flex items-center gap-2 px-2">
                <MessageSquareText size={14} className="text-indigo-400" />
                <span className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider">Hızlı Mesaj</span>
              </div>

              <QuickMessageGrid
                onSend={send}
                onWrite={() => setWriting((w) => !w)}
                writing={writing}
                disabled={cooling}
              />

              {/* Kendin yaz */}
              {writing && (
                <div className="flex items-center gap-1.5 mx-1">
                  <div className="relative flex-1 min-w-0">
                    <input
                      ref={inputRef}
                      value={text}
                      maxLength={TICKER_MAX_CHARS}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation(); // yazarken uygulama kısayolları tetiklenmesin
                        if (e.key === "Enter") send();
                        else if (e.key === "Escape") setWriting(false);
                      }}
                      placeholder="Kısa bir mesaj yaz..."
                      className="w-full h-9 bg-[#1a1b1e] border border-white/5 text-white text-xs pl-3 pr-9 rounded-xl outline-none placeholder:text-[#5c5e66] focus:border-indigo-500/40 transition-colors select-text"
                    />
                    {remaining <= 30 && (
                      <span
                        className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] tabular-nums font-semibold ${
                          remaining <= 10 ? "text-red-400" : "text-[#949ba4]"
                        }`}
                      >
                        {remaining}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => send()}
                    disabled={!canSend}
                    className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/25 flex items-center justify-center shrink-0 hover:bg-indigo-500 hover:text-white active:scale-95 disabled:opacity-40 disabled:hover:bg-indigo-500/15 disabled:hover:text-indigo-300 disabled:active:scale-100 transition-all"
                    title="Gönder (Enter)"
                  >
                    <Send size={14} />
                  </button>
                </div>
              )}

              {/* Bekleme: Hızlı Durum'daki "AKTİF" kutusu gibi */}
              {cooling && (
                <div className="mx-1 p-2.5 rounded-xl bg-[#1a1b1e] border border-amber-500/20 flex items-center justify-between">
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-[9px] text-amber-400 font-black uppercase tracking-wider mb-0.5">
                      {wait.limit ? "Sınıra ulaştın" : "Bekle"}
                    </span>
                    <span className="text-xs text-white font-bold truncate leading-none pb-0.5">
                      {wait.limit
                        ? `Dakikada en fazla ${TICKER_MAX_PER_MINUTE} mesaj`
                        : "Mesajlar arasında kısa bir ara gerekiyor"}
                    </span>
                  </div>
                  <span className="text-sm font-black text-amber-300 tabular-nums shrink-0 ml-2">{waitSec}s</span>
                </div>
              )}
            </div>
          </div>,
          host,
        )}
    </>
  );
}
