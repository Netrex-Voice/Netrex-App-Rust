import { Volume2, BellRing } from "lucide-react";
import ToggleSwitch from "../ToggleSwitch";
import { TabBanner, SettingsCard, SettingRow } from "../SettingsCard";
import AppSoundsSection from "./voice/AppSoundsSection";
import TtsSection from "./voice/TtsSection";
import { useSettingsStore } from "@/src/store/settingsStore";

export default function SoundsSettings() {
  const notificationSound = useSettingsStore((s) => s.notificationSound);
  const setNotificationSound = useSettingsStore((s) => s.setNotificationSound);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-xl font-bold text-white mb-3 relative">
        <span className="relative z-10">Sesler</span>
      </h3>

      <TabBanner
        icon={<Volume2 size={24} className="text-white" />}
        title="Sesler"
        description="Uygulamanın çaldığı sesler ve mesajların sesli okunması"
        gradient="from-amber-600 via-orange-600 to-amber-600"
      />

      {/* Uygulama içi efekt sesleri: giriş, çıkış, mute... */}
      <AppSoundsSection />

      {/* Bildirimlerin kendi sesi */}
      <SettingsCard
        icon={<BellRing size={14} className="text-purple-400" />}
        iconBg="bg-purple-500/20"
        title="Bildirim Sesi"
        description="Bildirim geldiğinde çalan kısa ses. Hangi olaylar için bildirim geleceğini Bildirimler sekmesinden seçersiniz."
        className="mb-4"
      >
        <SettingRow hoverBorder="hover:border-purple-500/20">
          <ToggleSwitch
            label="Bildirim Sesi"
            description="Bildirimler geldiğinde ses çal."
            checked={notificationSound}
            onChange={() => setNotificationSound(!notificationSound)}
          />
        </SettingRow>
      </SettingsCard>

      {/* Yazılı mesajları sesli okuma */}
      <TtsSection />
    </div>
  );
}
