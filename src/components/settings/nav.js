import { User, Mic, Video, Volume2, Palette, Bell, Keyboard, Layers, Cpu, AppWindow, Info, Monitor } from "lucide-react";

// Ayarlar gezinmesinin TEK kaynağı: masaüstü kenar çubuğu, mobil sekme çubuğu,
// mobil başlık etiketi ve arama sonuçları buradan beslenir.
//
// label: kenar çubuğundaki ad, short: mobilde kısa ad
// electronOnly: yalnızca masaüstü uygulamasında, macOnly: yalnızca macOS'ta görünür
export const SETTINGS_NAV = [
  {
    title: "Kullanıcı",
    accent: "from-indigo-500",
    items: [{ id: "account", label: "Hesabım", short: "Hesap", icon: User, color: "indigo" }],
  },
  {
    title: "Ses ve Görüntü",
    accent: "from-cyan-500",
    items: [
      { id: "mic", label: "Mikrofon ve Ses", short: "Mikrofon", icon: Mic, color: "cyan" },
      { id: "camera", label: "Kamera", short: "Kamera", icon: Video, color: "green" },
      { id: "sounds", label: "Sesler", short: "Sesler", icon: Volume2, color: "amber" },
    ],
  },
  {
    title: "Uygulama",
    accent: "from-purple-500",
    items: [
      { id: "appearance", label: "Görünüm", short: "Görünüm", icon: Palette, color: "pink" },
      { id: "notifications", label: "Bildirimler", short: "Bildirim", icon: Bell, color: "yellow" },
      { id: "keybinds", label: "Kısayollar", short: "Kısayol", icon: Keyboard, color: "orange", electronOnly: true },
      { id: "overlay", label: "Oyun İçi Overlay", short: "Overlay", icon: Layers, color: "amber", electronOnly: true },
      { id: "performance", label: "Performans", short: "Performans", icon: Cpu, color: "green" },
      { id: "application", label: "Genel", short: "Genel", icon: AppWindow, color: "purple" },
    ],
  },
  {
    title: "Hakkında",
    accent: "from-indigo-500",
    items: [
      { id: "about", label: "Uygulama Hakkında", short: "Hakkında", icon: Info, color: "indigo" },
      { id: "mac-setup", label: "macOS Kurulumu", short: "macOS", icon: Monitor, color: "orange", macOnly: true },
    ],
  },
];

/** Ortama göre görünür olan sekmeler (gruplar boşsa elenir) */
export function getVisibleNav({ isElectronApp, isMac }) {
  return SETTINGS_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => (!item.electronOnly || isElectronApp) && (!item.macOnly || isMac)),
  })).filter((group) => group.items.length > 0);
}

export function findNavItem(id) {
  for (const group of SETTINGS_NAV) {
    const found = group.items.find((item) => item.id === id);
    if (found) return found;
  }
  return null;
}
