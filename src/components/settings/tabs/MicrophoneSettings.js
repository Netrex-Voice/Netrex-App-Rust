import { useState, useEffect } from "react";
import { Mic } from "lucide-react";
import { TabBanner } from "../SettingsCard";
import AudioDevicesSection from "./voice/AudioDevicesSection";
import InputSensitivitySection from "./voice/InputSensitivitySection";
import NoiseSuppressionSection from "./voice/NoiseSuppressionSection";
import AdvancedAudioSection from "./voice/AdvancedAudioSection";
import MicGuardSection from "./voice/MicGuardSection";
import VoiceGroupsSection from "./voice/VoiceGroupsSection";

export default function MicrophoneSettings({ isSettingsModalOpen }) {
  const [audioInputs, setAudioInputs] = useState([]);
  const [audioOutputs, setAudioOutputs] = useState([]);

  useEffect(() => {
    const getDevices = async () => {
      let tempStream;
      try {
        // Yalnızca mikrofon izni iste (kamera burada gerekmez, kamera ışığı yanmasın)
        tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const devs = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devs.filter((d) => d.kind === "audioinput"));
        setAudioOutputs(devs.filter((d) => d.kind === "audiooutput"));
      } catch (err) {
        console.error("Audio device permission/enumeration error:", err);
      } finally {
        if (tempStream) tempStream.getTracks().forEach((track) => track.stop());
      }
    };
    getDevices();
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-xl font-bold text-white mb-3 relative">
        <span className="relative z-10">Mikrofon ve Ses</span>
      </h3>

      <TabBanner
        icon={<Mic size={24} className="text-white" />}
        title="Mikrofon ve Ses"
        description="Cihazlarınız, ses kalitesi ve mikrofon uyarısı"
        gradient="from-cyan-600 via-blue-600 to-cyan-600"
      />

      {/* 1. Hangi cihazı kullanıyorum? */}
      <AudioDevicesSection audioInputs={audioInputs} audioOutputs={audioOutputs} />

      {/* 2. Ne zaman konuşmuş sayılayım? */}
      <InputSensitivitySection isSettingsModalOpen={isSettingsModalOpen} />

      {/* 3. Arka plan gürültüsü ve ses işleme */}
      <NoiseSuppressionSection />
      <div className="mb-6">
        <AdvancedAudioSection />
      </div>

      {/* 4. Mikrofon kapalıyken konuşursam beni uyar */}
      <MicGuardSection />

      {/* 5. Konuşma grupları: fısıltıya otomatik yanıt */}
      <VoiceGroupsSection />
    </div>
  );
}
