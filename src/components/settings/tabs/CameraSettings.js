import { useState, useEffect, useCallback } from "react";
import { Video } from "lucide-react";
import { TabBanner } from "../SettingsCard";
import VideoSettingsSection from "./voice/VideoSettingsSection";
import VideoCodecSection from "./voice/VideoCodecSection";

export default function CameraSettings() {
  const [videoInputs, setVideoInputs] = useState([]);

  // Cihaz listesini KAMERAYI AÇMADAN okur (kamera ışığı yanmaz).
  // Daha önce izin verilmişse kamera adları gelir; verilmemişse adlar boştur ve kullanıcı
  // "Kamerayı Önizle"ye basıp izin verdiğinde (onDevicesChanged) liste yenilenir.
  const refreshDevices = useCallback(async () => {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const list = devs.filter((d) => d.kind === "videoinput");
      // Liste aynıysa state'i değiştirme: gereksiz yeniden render / önizleme yeniden başlatmayı önler
      const sig = (a) => a.map((d) => d.deviceId + "|" + d.label).join(",");
      setVideoInputs((prev) => (sig(prev) === sig(list) ? prev : list));
    } catch (err) {
      console.error("Video device enumeration error:", err);
    }
  }, []);

  useEffect(() => {
    refreshDevices();

    // Kamera takılıp çıkarılınca ve izin durumu değişince listeyi güncel tut
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);

    let permissionStatus = null;
    let disposed = false;
    navigator.permissions
      ?.query({ name: "camera" })
      .then((status) => {
        if (disposed) return;
        permissionStatus = status;
        status.onchange = refreshDevices;
      })
      .catch(() => {}); // Bazı ortamlar "camera" iznini sorgulamayı desteklemez

    return () => {
      disposed = true;
      navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDevices);
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, [refreshDevices]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-xl font-bold text-white mb-3 relative">
        <span className="relative z-10">Kamera</span>
      </h3>

      <TabBanner
        icon={<Video size={24} className="text-white" />}
        title="Kamera"
        description="Kamera seçimi, görüntü kalitesi ve video kodlama"
        gradient="from-emerald-600 via-teal-600 to-emerald-600"
      />

      <VideoSettingsSection videoInputs={videoInputs} onDevicesChanged={refreshDevices} />

      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-6"></div>

      <VideoCodecSection />
    </div>
  );
}
