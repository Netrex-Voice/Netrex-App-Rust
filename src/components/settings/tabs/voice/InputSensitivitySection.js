import { useState, useEffect, useRef, useCallback } from "react";
import { Zap } from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { rmsToSlider } from "@/src/utils/voiceThreshold";
import { effectiveAutoGainControl } from "@/src/utils/micConstraints";

export default function InputSensitivitySection({ isSettingsModalOpen }) {
  const audioInputId = useSettingsStore(s => s.audioInputId);
  const voiceThreshold = useSettingsStore(s => s.voiceThreshold);
  const setVoiceThreshold = useSettingsStore(s => s.setVoiceThreshold);
  const noiseSuppressionMode = useSettingsStore(s => s.noiseSuppressionMode);

  const [micVolume, setMicVolume] = useState(0);
  const [localThreshold, setLocalThreshold] = useState(voiceThreshold);
  const animationRef = useRef();

  useEffect(() => {
    setLocalThreshold(voiceThreshold);
  }, [voiceThreshold]);

  // RMS → yüzde: gate ile AYNI sabitler (src/utils/voiceThreshold.js), çizgi gerçek eşiği göstersin
  const rmsToPercentage = useCallback((rms) => rmsToSlider(rms), []);

  useEffect(() => {
    if (!isSettingsModalOpen) return;

    let audioContext, analyser, stream;
    const initAudio = async () => {
      // Çift başlatma koruması
      if (!audioInputId || animationRef.current) return;
      
      try {
        // Gate'in gerçekte ölçtüğü sinyalle aynı kısıtlar: aksi halde tarayıcı varsayılanı (AGC açık)
        // göstergeyi olduğundan yüksek gösterir ve çizgi gerçek eşikle uyuşmaz.
        const s = useSettingsStore.getState();
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId:
              audioInputId !== "default"
                ? { exact: audioInputId }
                : undefined,
            echoCancellation: s.echoCancellation,
            noiseSuppression:
              s.noiseSuppression && (s.noiseSuppressionMode === "none" || !s.noiseSuppressionMode),
            autoGainControl: effectiveAutoGainControl(s.autoGainControl, s.noiseSuppressionMode),
          },
        });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048; // useVoiceProcessor ile aynı
        analyser.smoothingTimeConstant = 0.25; // useVoiceProcessor ile aynı
        audioContext.createMediaStreamSource(stream).connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateMeter = () => {
          analyser.getByteTimeDomainData(dataArray);
          // RMS hesapla (useVoiceProcessor ile aynı yöntem)
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const x = (dataArray[i] - 128) / 128.0;
            sum += x * x;
          }
          const rms = Math.sqrt(sum / dataArray.length);

          // RMS'yi yüzdeye dönüştür (slider ile uyumlu)
          const percentage = rmsToPercentage(rms);
          setMicVolume(percentage);

          animationRef.current = requestAnimationFrame(updateMeter);
        };
        updateMeter();
      } catch (error) {
        console.error(error);
      }
    };
    initAudio();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null; // 🔥 FIX: Ref'i sıfırla ki çift başlatma koruması doğru çalışsın
      }
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (audioContext) {
        audioContext.close().catch(() => {});
        audioContext = null;
      }
    };
  }, [audioInputId, rmsToPercentage, isSettingsModalOpen]);

  return (
    <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 mb-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
      
      <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-2 flex items-center gap-2 relative z-10">
        <div className="w-6 h-6 rounded-lg bg-green-500/20 flex items-center justify-center">
          <Zap size={14} className="text-green-400" />
        </div>
        Giriş Hassasiyeti (Noise Gate)
        <span className="ml-auto text-xs text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded-lg">
          {localThreshold}%
        </span>
      </h4>
      <p className="text-xs text-[#949ba4] mb-4 ml-8 relative z-10">
        Beyaz çizgi eşiğinizdir: konuşurken yeşil çubuk çizgiyi geçerse sesiniz karşıya gider, geçemezse (kırmızı) kesilir. Klavye ve fan gibi sesler karşıya gidiyorsa çizgiyi sağa, sesiniz kesiliyorsa sola çekin.
      </p>
      
      <div className="relative z-10 bg-[#1e1f22] rounded-xl p-5 border border-white/5">
        <div className="h-4 w-full bg-[#2b2d31] rounded-full overflow-hidden relative mb-4 shadow-inner">
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              background:
                "linear-gradient(to right, #da373c 0%, #da373c 10%, #f0b232 40%, #23a559 100%)",
              opacity: 0.3,
            }}
          ></div>
          <div
            className="absolute top-0 bottom-0 w-1 bg-white z-20 shadow-[0_0_10px_rgba(255,255,255,0.8)] rounded-full"
            style={{ left: `${localThreshold}%` }}
          ></div>
          <div
            className="h-full transition-all duration-75 ease-out z-10 rounded-full"
            style={{
              width: `${micVolume}%`,
              backgroundColor:
                micVolume > localThreshold ? "#23a559" : "#da373c",
              boxShadow: micVolume > localThreshold ? "0 0 10px rgba(35,165,89,0.5)" : "0 0 10px rgba(218,55,60,0.5)",
            }}
          ></div>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="0"
            max="100"
            value={localThreshold}
            onChange={(e) => setLocalThreshold(Number(e.target.value))}
            onMouseUp={() => setVoiceThreshold(localThreshold)}
            onTouchEnd={() => setVoiceThreshold(localThreshold)}
            className="w-full h-2 bg-[#404249] rounded-lg appearance-none cursor-pointer accent-green-500"
          />
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-[#949ba4]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full"></span> Gürültü</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-500 rounded-full"></span> Geçiş</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full"></span> Konuşma</span>
        </div>
      </div>
    </div>
  );
}
