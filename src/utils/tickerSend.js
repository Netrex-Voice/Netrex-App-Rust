import { toast } from "@/src/utils/toast";
import {
  TICKER_TOPIC,
  TICKER_SEND_COOLDOWN_MS,
  TICKER_MAX_PER_MINUTE,
  TICKER_DUPLICATE_WINDOW_MS,
  sanitizeTickerText,
} from "@/src/hooks/useCursorShareController";

/**
 * 💬 Yayıncıya kayan mesaj gönderme — TEK ortak yer.
 *
 * Mesaj kutusu (düğme) ve yayının sağ tık menüsü aynı sınırlamaları paylaşır; hangisinden gönderirsen
 * gönder bekleme süresi ve dakika sınırı birlikte işler. (Asıl spam koruması alıcı tarafta;
 * burası kullanıcıya erken ve anlaşılır geri bildirim verir.)
 */

// Mikrofonu açamayan biri için tek tıkla gönderilebilen hazır mesajlar
// icon: karedeki simge, label: karedeki kısa etiket, text: yayıncıya giden yazı (karenin üstünde balon olarak da görünür)
export const QUICK_MESSAGES = [
  { icon: "🤐", label: "Konuşamam", text: "Konuşamıyorum" },
  { icon: "⚠️", label: "Baskın", text: "Baskın!" },
  { icon: "🔇", label: "Ses yok", text: "Sesin gelmiyor" },
  { icon: "⏳", label: "Bekle", text: "Bir dakika" },
  { icon: "👍", label: "Tamam", text: "Tamam" },
  { icon: "🏃", label: "Geliyorum", text: "Geliyorum" },
  { icon: "🙏", label: "Sağ ol", text: "Teşekkürler" },
];

const sentTimes = []; // son gönderim zamanları (dakika sınırı için)
let lastText = { text: "", at: 0 };

/** Şimdi göndersem ne kadar beklemem gerekir? { ms: 0 → hemen, limit: dakika sınırı mı } */
export function getTickerWait() {
  const now = Date.now();
  while (sentTimes.length && now - sentTimes[0] >= 60_000) sentTimes.shift();

  if (sentTimes.length >= TICKER_MAX_PER_MINUTE) {
    return { ms: 60_000 - (now - sentTimes[0]), limit: true };
  }
  const sinceLast = now - (sentTimes[sentTimes.length - 1] || 0);
  if (sinceLast < TICKER_SEND_COOLDOWN_MS) {
    return { ms: TICKER_SEND_COOLDOWN_MS - sinceLast, limit: false };
  }
  return { ms: 0, limit: false };
}

/**
 * Mesajı hedef yayıncıya gönderir. Başarılıysa { ok: true }.
 * Sınır/hata durumunda kullanıcıya bildirim gösterir ve { ok: false } döner.
 */
export function sendTickerMessage(localParticipant, targetIdentity, rawText) {
  const clean = sanitizeTickerText(rawText);
  if (!clean || !localParticipant || !targetIdentity) return { ok: false };

  const wait = getTickerWait();
  if (wait.ms > 0) {
    toast.info(
      wait.limit
        ? `Dakikada en fazla ${TICKER_MAX_PER_MINUTE} mesaj gönderebilirsin. ${Math.ceil(wait.ms / 1000)} sn sonra tekrar dene.`
        : "Biraz bekle, mesajlar arasında kısa bir ara gerekiyor.",
    );
    return { ok: false };
  }

  // Aynı mesajı arka arkaya göndermek spam sayılır
  const now = Date.now();
  if (clean === lastText.text && now - lastText.at < TICKER_DUPLICATE_WINDOW_MS) {
    toast.info("Aynı mesajı az önce gönderdin.");
    return { ok: false };
  }

  try {
    localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({ type: TICKER_TOPIC, text: clean })),
      { topic: TICKER_TOPIC, reliable: true, destinationIdentities: [targetIdentity] },
    );
  } catch (e) {
    toast.error("Mesaj gönderilemedi.");
    return { ok: false };
  }

  sentTimes.push(now);
  lastText = { text: clean, at: now };
  toast.success("Mesaj gönderildi.");
  return { ok: true };
}
