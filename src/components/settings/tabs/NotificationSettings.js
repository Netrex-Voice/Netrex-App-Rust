import { Bell, Monitor, Zap } from "lucide-react";
import ToggleSwitch from "../ToggleSwitch";
import { TabBanner, SettingsCard, SettingRow } from "../SettingsCard";
import { useSettingsStore } from "@/src/store/settingsStore";

export default function NotificationSettings() {
  const desktopNotifications = useSettingsStore(state => state.desktopNotifications);
  const notifyOnMessage = useSettingsStore(state => state.notifyOnMessage);
  const notifyOnJoin = useSettingsStore(state => state.notifyOnJoin);
  const notifyOnLeave = useSettingsStore(state => state.notifyOnLeave);
  const setDesktopNotifications = useSettingsStore(state => state.setDesktopNotifications);
  const setNotifyOnMessage = useSettingsStore(state => state.setNotifyOnMessage);
  const setNotifyOnJoin = useSettingsStore(state => state.setNotifyOnJoin);
  const setNotifyOnLeave = useSettingsStore(state => state.setNotifyOnLeave);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-xl font-bold text-white mb-3 relative">
        <span className="relative z-10">Bildirimler</span>
      </h3>

      <TabBanner
        icon={<Bell size={24} className="text-white" />}
        title="Bildirimler"
        description="Ne zaman haber verilsin? (Bildirim sesi ve mesajları sesli okuma Sesler sekmesinde)"
        gradient="from-yellow-600 via-orange-600 to-yellow-600"
      />

      <SettingsCard
        icon={<Monitor size={14} className="text-indigo-400" />}
        iconBg="bg-indigo-500/20"
        title="Masaüstü Bildirimleri"
        description="Uygulama arka plandayken ya da başka bir pencerede çalışırken ekranın köşesinde çıkan bildirimler."
      >
        <SettingRow>
          <ToggleSwitch
            label="Masaüstü Bildirimleri"
            description="Yeni mesajlar ve diğer olaylar için masaüstü bildirimleri göster."
            checked={desktopNotifications}
            onChange={() => setDesktopNotifications(!desktopNotifications)}
          />
        </SettingRow>
      </SettingsCard>

      <SettingsCard
        icon={<Zap size={14} className="text-purple-400" />}
        iconBg="bg-purple-500/20"
        title="Hangi Olaylarda Bildirim Gelsin?"
        description="Bildirim almak istediğiniz olayları seçin."
        className="mb-0"
      >
        <SettingRow hoverBorder="hover:border-blue-500/20">
          <ToggleSwitch
            label="Yeni Mesaj"
            description="Yeni mesaj geldiğinde bildirim göster."
            checked={notifyOnMessage}
            onChange={() => setNotifyOnMessage(!notifyOnMessage)}
          />
        </SettingRow>
        <SettingRow hoverBorder="hover:border-green-500/20">
          <ToggleSwitch
            label="Odaya Katılan"
            description="Birisi bulunduğunuz sesli odaya katıldığında bildirim göster."
            checked={notifyOnJoin}
            onChange={() => setNotifyOnJoin(!notifyOnJoin)}
          />
        </SettingRow>
        <SettingRow hoverBorder="hover:border-red-500/20">
          <ToggleSwitch
            label="Odadan Ayrılan"
            description="Birisi bulunduğunuz sesli odadan ayrıldığında bildirim göster."
            checked={notifyOnLeave}
            onChange={() => setNotifyOnLeave(!notifyOnLeave)}
          />
        </SettingRow>
      </SettingsCard>
    </div>
  );
}
