import { findNavItem } from "./nav";

// Ayarlarda arama dizini. Yeni bir ayar eklendiğinde buraya da bir satır ekleyin.
// tab: nav.js'teki sekme kimliği, title: sonuçta görünen ad, keywords: aranabilecek diğer kelimeler
export const SETTINGS_INDEX = [
  // Hesap
  { tab: "account", title: "Profil, kullanıcı adı ve avatar", keywords: "profil resmi görünen ad kullanıcı adı avatar arka plan biyografi tema renk hesap çıkış" },

  // Mikrofon ve Ses
  { tab: "mic", title: "Mikrofon ve hoparlör seçimi", keywords: "cihaz giriş çıkış kulaklık hoparlör mikrofon seç" },
  { tab: "mic", title: "Giriş hassasiyeti (noise gate)", keywords: "hassasiyet eşik noise gate konuşma algılama ses seviyesi kısık sesim gitmiyor" },
  { tab: "mic", title: "Gürültü azaltma (Krisp)", keywords: "gürültü krisp rnnoise arka plan klavye fan sesi bastırma" },
  { tab: "mic", title: "Yankı engelleme ve otomatik kazanç", keywords: "yankı echo otomatik kazanç agc ses dengeleme" },
  { tab: "performance", title: "Veri tasarrufu ve ağ kalitesi", keywords: "veri tasarrufu internet yavaş kötü bağlantı mb kota yayın ekran paylaşımı kamera bit hızı fps donuyor kasıyor" },
  { tab: "performance", title: "Konuşma gecikmesi (ses gecikmesi, ping)", keywords: "gecikme ses gecikmesi geç geliyor ping latency gerçek zamanlı düşük gecikme ultra jitter tampon rtt" },
  { tab: "mic", title: "Mikrofon koruması (sesiniz karşıya gitmiyor uyarısı)", keywords: "mikrofon kapalı uyarı mute unuttum açmayı unuttum karşıya gitmiyor bekleme süresi sesli uyarı" },

  // Kamera
  { tab: "camera", title: "Kamera seçimi ve önizleme", keywords: "kamera webcam önizleme ayna efekti kamerayı etkinleştir" },
  { tab: "camera", title: "Video kalitesi (çözünürlük ve FPS)", keywords: "çözünürlük fps kare hızı 720p 480p video kalite" },
  { tab: "camera", title: "Video kodlama (codec)", keywords: "codec vp8 h264 av1 sıkıştırma" },

  // Sesler
  { tab: "sounds", title: "Uygulama sesleri seviyesi", keywords: "efekt sesleri giriş çıkış mute sesi ses yüksekliği sfx" },
  { tab: "sounds", title: "Bildirim sesi", keywords: "bildirim sesi ping" },
  { tab: "sounds", title: "Mesajları sesli oku (TTS)", keywords: "tts metin okuma seslendirme sentez sesli oku mesaj okuma ses motoru" },

  // Görünüm
  { tab: "appearance", title: "Hızlı durum slotları", keywords: "durum özel durum hızlı durum slot meşgul" },
  { tab: "appearance", title: "Ölçek, yazı boyutu ve yazı tipi", keywords: "ölçek zoom font yazı boyutu yazı tipi büyüklük arayüz" },

  // Bildirimler
  { tab: "notifications", title: "Masaüstü bildirimleri", keywords: "masaüstü bildirim açma kapama" },
  { tab: "notifications", title: "Yeni mesaj, katılan ve ayrılan bildirimleri", keywords: "yeni mesaj bildirimi katılım ayrılış odaya katılan ayrılan" },

  // Kısayollar (yalnızca masaüstü)
  { tab: "keybinds", title: "Kısayol tuşları (mute, deafen, kamera)", keywords: "kısayol tuş atama klavye mouse bas konuş mute sustur deafen sağırlaştır kamera", electronOnly: true },
  { tab: "keybinds", title: "Hızlı durum ve TTS kısayolları", keywords: "hızlı durum tts seslendirmeyi durdur kısayol", electronOnly: true },

  // Overlay (yalnızca masaüstü)
  { tab: "overlay", title: "Kayan mesajlar", keywords: "kayan yazı mesaj izleyici yayın mikrofon kapalı opaklık bildirim ticker", electronOnly: true },
  { tab: "overlay", title: "Oyun içi overlay", keywords: "overlay oyun içi konuşan kişiler yerleşim opaklık anti-cheat kontroller", electronOnly: true },

  // Performans
  { tab: "performance", title: "Görsel kalite modu", keywords: "kalite ultra yüksek orta düşük patates fps takılma yavaş" },
  { tab: "performance", title: "Donanım hızlandırma ve animasyonlar", keywords: "donanım hızlandırma gpu animasyon arka plan efekt kapat performans cpu ram" },

  // Genel
  { tab: "application", title: "Sistem tepsisine küçült", keywords: "tepsi sistem tepsisi pencere kapat arka plan" },
  { tab: "application", title: "İzleme partisi (Watch Party)", keywords: "watch party izleme partisi otomatik katıl video birlikte izle" },
  { tab: "application", title: "Güncellemeler", keywords: "güncelleme sürüm yenile otomatik güncelleme" },
  { tab: "application", title: "Geliştirici araçları", keywords: "geliştirici devtools konsol hata ayıklama" },

  // Hakkında
  { tab: "about", title: "Sürüm ve uygulama bilgisi", keywords: "sürüm hakkında lisans bilgi" },
];

// Türkçe karakterleri sadeleştir: "gurultu" yazan "gürültü"yü bulsun
const FOLD_MAP = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
function fold(text) {
  return String(text || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşüâîû]/g, (c) => FOLD_MAP[c] || c);
}

/** Sorgudaki TÜM kelimeleri içeren ayarları döndürür (en fazla `limit` adet) */
export function searchSettings(query, { isElectronApp = false, limit = 12 } = {}) {
  const tokens = fold(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  return SETTINGS_INDEX.filter((entry) => !entry.electronOnly || isElectronApp)
    .map((entry) => {
      const tabLabel = findNavItem(entry.tab)?.label || "";
      const haystack = fold(`${entry.title} ${entry.keywords} ${tabLabel}`);
      const titleFolded = fold(entry.title);
      if (!tokens.every((t) => haystack.includes(t))) return null;
      // Başlıkta geçenler öne çıksın
      const score = tokens.reduce((s, t) => s + (titleFolded.includes(t) ? 2 : 1), 0);
      return { ...entry, tabLabel, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
