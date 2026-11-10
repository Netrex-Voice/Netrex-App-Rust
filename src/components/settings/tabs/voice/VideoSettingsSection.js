import { useState, useEffect, useRef } from "react";
import { Camera, Video, VideoOff } from "lucide-react";
import { useRoomContext } from "@livekit/components-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import ToggleSwitch from "../../ToggleSwitch";

export default function VideoSettingsSection({ videoInputs, onDevicesChanged }) {
  let room;
  try {
    room = useRoomContext();
  } catch (e) {
    // room context optional
  }

  const enableCamera = useSettingsStore(s => s.enableCamera);
  const toggleEnableCamera = useSettingsStore(s => s.toggleEnableCamera);
  const videoId = useSettingsStore(s => s.videoId);
  const setVideoInput = useSettingsStore(s => s.setVideoInput);
  const cameraMirrorEffect = useSettingsStore(s => s.cameraMirrorEffect);
  const setCameraMirrorEffect = useSettingsStore(s => s.setCameraMirrorEffect);
  const videoResolution = useSettingsStore(s => s.videoResolution);
  const setVideoResolution = useSettingsStore(s => s.setVideoResolution);
  const videoFrameRate = useSettingsStore(s => s.videoFrameRate);
  const setVideoFrameRate = useSettingsStore(s => s.setVideoFrameRate);

  const videoRef = useRef(null);
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  // Efekt dizinin kendisine değil yalnızca "kamera var mı"ya bağlı olmalı: cihaz listesi yenilenince (kamera açılınca
  // tarayıcı devicechange verir, ayrıca onDevicesChanged listeyi yeniler) dizi yeni referans alır ve önizleme
  // kendini kapatıp açan sonsuz döngüye giriyordu (telefonda bariz).
  const hasCameras = videoInputs.length > 0;

  // Kamera Önizleme
  useEffect(() => {
    let active = true;
    let activeStream = null;

    // Eğer kamera devre dışıysa veya kullanıcı henüz önizlemeyi başlatmadıysa stream başlatma
    if (!enableCamera || !isPreviewActive) return;

    const initVideo = async () => {
      if (!hasCameras) return;
      try {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId:
                videoId !== "default"
                  ? { exact: videoId }
                  : undefined,
              width: { ideal: 640 },
              height: { ideal: 360 },
            },
          });
        } catch (exactErr) {
          // Kayıtlı cihaz kimliği artık geçersiz olabilir (telefonda sık): seçime takılmadan aç
          if (exactErr?.name !== "OverconstrainedError" && exactErr?.name !== "NotFoundError") throw exactErr;
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 360 } },
          });
        }

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        activeStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        // Kamera izni artık verildi: cihaz adları ancak şimdi okunabilir, listeyi yenile
        onDevicesChanged?.();
      } catch (e) {
        console.error("Kamera önizleme hatası:", e);
        if (active) {
          setIsPreviewActive(false);
        }
      }
    };

    initVideo();
    return () => {
      active = false;
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [videoId, hasCameras, enableCamera, isPreviewActive]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-[#949ba4] uppercase flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Camera size={14} className="text-purple-400" />
          </div>
          Video Ayarları
        </h4>
        <span
          className={`text-[10px] px-3 py-1 rounded-full font-bold flex items-center gap-1.5 ${
            enableCamera
              ? "bg-green-500/15 text-green-400 border border-green-500/30"
              : "bg-red-500/15 text-red-400 border border-red-500/30"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${enableCamera ? "bg-green-400" : "bg-red-400"}`}></span>
          {enableCamera ? "AÇIK" : "DEVRE DIŞI"}
        </span>
      </div>

      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        {/* Hover glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

        {/* KAMERA AÇ/KAPA TOGGLE */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10 relative z-10">
          <div>
            <div className="font-bold text-sm text-white">
              Kamerayı Etkinleştir
            </div>
            <div className="text-xs text-[#949ba4]">
              Kapatırsanız uygulama içinde kamera butonu devre dışı kalır.
            </div>
          </div>
          <ToggleSwitch
            checked={enableCamera}
            onChange={() => {
              toggleEnableCamera();
              setIsPreviewActive(false); // Kamera kapatıldığında önizlemeyi de sıfırla
            }}
          />
        </div>

        {/* Sadece kamera etkinse göster */}
        {enableCamera ? (
          <>
            <div className="mb-4">
              <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2">
                Kamera
              </label>
              <div className="relative">
                <select
                  value={videoId}
                  onChange={(e) => {
                    setVideoInput(e.target.value);
                    setIsPreviewActive(false); // Cihaz değiştiğinde önizlemeyi durdur ki tekrar basılsın
                    if (room?.localParticipant)
                      room.switchActiveDevice("videoinput", e.target.value);
                  }}
                  className="w-full bg-[#1e1f22] border border-white/10 text-white p-2.5 rounded-lg hover:border-indigo-500/50 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none cursor-pointer pl-9 transition-all duration-300 relative z-10"
                >
                  {videoInputs.length > 0 ? (
                    videoInputs.map((d, i) => (
                      <option key={d.deviceId || `cam-${i}`} value={d.deviceId}>
                        {/* İzin verilene kadar tarayıcı kamera adını vermez; "Önizle"den sonra gerçek ad gelir */}
                        {d.label || `Kamera ${i + 1}`}
                      </option>
                    ))
                  ) : (
                    <option disabled>Kamera Bulunamadı</option>
                  )}
                </select>
                <div className="absolute left-3 top-2.5 pointer-events-none text-gray-400">
                  <Video size={16} />
                </div>
              </div>
            </div>

            <div className="relative w-full aspect-video bg-[#0a0a0c] rounded-xl overflow-hidden border-2 border-white/10 shadow-lg flex items-center justify-center relative z-10">
              {videoInputs.length > 0 ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover transition-transform duration-300 ${cameraMirrorEffect ? "scale-x-[-1]" : ""} ${isPreviewActive ? "opacity-100" : "opacity-0"}`}
                  />
                  
                  {/* ÖNİZLEME OVERLAY */}
                  {!isPreviewActive && (
                    <div className="absolute inset-0 bg-[#0a0a0c]/80 backdrop-blur-md flex flex-col items-center justify-center z-20 transition-all duration-300">
                      <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4 shadow-2xl group/btn animate-pulse-slow">
                        <Camera size={32} className="text-white/40 group-hover/btn:text-white group-hover/btn:scale-110 transition-all duration-300" />
                      </div>
                      <button
                        onClick={() => setIsPreviewActive(true)}
                        className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:scale-105 active:scale-95"
                      >
                        Kamerayı Önizle
                      </button>
                      <p className="text-[10px] text-[#949ba4] mt-3 font-medium uppercase tracking-wider">Gizliliğinizi korumak için önizleme kapalı</p>
                    </div>
                  )}

                  {isPreviewActive && (
                    <div className="absolute top-2 left-2 bg-red-500/80 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm z-30 flex items-center gap-1.5 shadow-lg border border-red-400/20 animate-in fade-in duration-300">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                      ÖNİZLEME AKTİF
                    </div>
                  )}
                  
                  {isPreviewActive && (
                    <button 
                      onClick={() => setIsPreviewActive(false)}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white text-[10px] font-bold px-3 py-1 rounded-lg backdrop-blur-sm z-30 transition-all border border-white/10 shadow-lg"
                    >
                      Durdur
                    </button>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center text-[#949ba4] opacity-50">
                  <VideoOff size={48} className="mb-2" />
                  <span className="text-sm font-bold">Kamera Yok</span>
                </div>
              )}
            </div>

            {/* Ayna Efekti */}
            <div className="mt-4 pt-4 border-t border-white/10 relative z-10">
              <ToggleSwitch
                label="Ayna Efekti"
                description="Kamera görüntüsünü yatay olarak çevir (kendini aynada görür gibi)."
                checked={cameraMirrorEffect}
                onChange={() =>
                  setCameraMirrorEffect(!cameraMirrorEffect)
                }
              />
            </div>

            {/* Video Kalite Ayarları */}
            <div className="mt-4 pt-4 border-t border-white/10 relative z-10">
              <h5 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                Video Kalitesi
              </h5>

              {/* Çözünürlük Seçimi */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2">
                  Çözünürlük
                </label>
                <p className="text-xs text-[#949ba4] mb-2 -mt-1">Görüntünün netliği. Yüksek çözünürlük daha net görünür ama daha fazla internet ve işlemci kullanır.</p>
                <div className="grid grid-cols-3 gap-2">
                  {[ 
                    { value: "360p", label: "360p", desc: "Düşük" },
                    { value: "480p", label: "480p", desc: "Normal" },
                    { value: "720p", label: "720p", desc: "HD" },
                  ].map((res) => (
                    <button
                      key={res.value}
                      onClick={() => setVideoResolution(res.value)}
                      onMouseDown={(e) => e.preventDefault()}
                      className={`p-3 rounded-xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1 focus:outline-none ${
                        videoResolution === res.value
                          ? "border-indigo-500 bg-indigo-500/10 text-white"
                          : "border-white/10 bg-white/5 text-[#949ba4] hover:border-white/20 hover:bg-white/10"
                      }`}
                    >
                      <span className="font-bold text-sm">{res.label}</span>
                      <span className="text-[10px] opacity-70">{res.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* FPS Seçimi */}
              <div className="mb-2">
                <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2">
                  Kare Hızı (FPS)
                </label>
                <p className="text-xs text-[#949ba4] mb-2 -mt-1">Saniyedeki görüntü sayısı. Yüksek FPS daha akıcı görünür; bağlantınız zayıfsa düşük tutun.</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 15, label: "15 FPS", desc: "Düşük" },
                    { value: 18, label: "18 FPS", desc: "Normal" },
                    { value: 24, label: "24 FPS", desc: "Sinematik" },
                  ].map((fps) => (
                    <button
                      key={fps.value}
                      onClick={() => setVideoFrameRate(fps.value)}
                      onMouseDown={(e) => e.preventDefault()}
                      className={`p-3 rounded-xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1 focus:outline-none ${
                        videoFrameRate === fps.value
                          ? "border-indigo-500 bg-indigo-500/10 text-white"
                          : "border-white/10 bg-white/5 text-[#949ba4] hover:border-white/20 hover:bg-white/10"
                      }`}
                    >
                      <span className="font-bold text-sm">{fps.label}</span>
                      <span className="text-[10px] opacity-70">{fps.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-[#949ba4] mt-3 flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">⚠️</span>
                <span>Yüksek kalite daha fazla bant genişliği kullanır. Bağlantı sorunları yaşarsanız kaliteyi düşürün.</span>
              </p>
            </div>
          </>
        ) : (
          // Kamera Devre Dışı İse Gösterilecek Mesaj
          <div className="flex flex-col items-center justify-center py-8 text-[#949ba4] opacity-70">
            <span className="mb-3 text-[#da373c]">
               {/* ShieldAlert icon from lucide-react used in main file, we can import or just use SVG. 
                   Wait, lucide-react is available. Let's import ShieldAlert.
               */}
               <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
            </span>
            <p className="text-sm font-medium text-center max-w-[200px]">
              Gizlilik ayarlarından kamera erişimi kapatıldı.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
