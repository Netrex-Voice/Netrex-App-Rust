
import { useEffect, useRef } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { useSettingsStore } from "@/src/store/settingsStore";
import { effectiveAutoGainControl } from "@/src/utils/micConstraints";

// Mikrofon ve kamera ayarları değiştiğinde track'leri yeniden oluştur
export default function SettingsUpdater({ isMuted, serverMuted, isDeafened, serverDeafened }) {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const audioInputId = useSettingsStore(state => state.audioInputId);
  const videoId = useSettingsStore(state => state.videoId);
  const noiseSuppression = useSettingsStore(state => state.noiseSuppression);
  const echoCancellation = useSettingsStore(state => state.echoCancellation);
  const autoGainControl = useSettingsStore(state => state.autoGainControl);
  const noiseSuppressionMode = useSettingsStore(state => state.noiseSuppressionMode);
  const videoResolution = useSettingsStore(state => state.videoResolution);
  const videoFrameRate = useSettingsStore(state => state.videoFrameRate);
  const videoCodec = useSettingsStore(state => state.videoCodec);

  const prevSettingsRef = useRef({
    audioInputId,
    videoId,
    noiseSuppression,
    echoCancellation,
    autoGainControl,
    noiseSuppressionMode,
    videoResolution,
    videoFrameRate,
  });
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    // localParticipant yoksa veya oda bağlı değilse bekle
    if (!localParticipant || !room || room.state !== ConnectionState.Connected) {
      return;
    }

    // İlk render'da sadece ref'i güncelle
    if (!prevSettingsRef.current.audioInputId) {
      prevSettingsRef.current = {
        audioInputId,
        videoId,
        noiseSuppression,
        echoCancellation,
        autoGainControl,
        noiseSuppressionMode,
        videoResolution,
        videoFrameRate,
      };
      return;
    }

    // Ayarlar değişmediyse hiçbir şey yapma
    // NOT: audioInputId burada YOK. Cihaz değişimi useAudioDeviceSync'te switchActiveDevice ile yapılır;
    // ikisi birden çalışınca yarışıp mikrofonu koparıyordu.
    const audioSettingsChanged =
      prevSettingsRef.current.noiseSuppression !== noiseSuppression ||
      prevSettingsRef.current.echoCancellation !== echoCancellation ||
      prevSettingsRef.current.autoGainControl !== autoGainControl ||
      prevSettingsRef.current.noiseSuppressionMode !== noiseSuppressionMode;

    // Video ayarları değişikliği - cihaz, çözünürlük veya FPS değişirse
    const videoSettingsChanged = 
      prevSettingsRef.current.videoId !== videoId ||
      prevSettingsRef.current.videoResolution !== videoResolution ||
      prevSettingsRef.current.videoFrameRate !== videoFrameRate;

    if (
      (!audioSettingsChanged && !videoSettingsChanged) ||
      isUpdatingRef.current
    ) {
      prevSettingsRef.current = {
        audioInputId,
        videoId,
        noiseSuppression,
        echoCancellation,
        autoGainControl,
        noiseSuppressionMode,
        videoResolution,
        videoFrameRate,
      };
      return;
    }

    // Ayarlar değişti, track'leri yeniden oluştur
    const updateTracks = async () => {
      // Çifte kontrol: Oda hala bağlı mı?
      if (room.state !== ConnectionState.Connected) return;

      isUpdatingRef.current = true;
      try {
        // Mikrofon ayarları değiştiyse mikrofon track'ini güncelle
        if (audioSettingsChanged) {
          const micPublication = localParticipant.getTrackPublication(
            Track.Source.Microphone
          );

          if (micPublication?.track) {
            const oldTrack = micPublication.track;

            // ÖNEMLİ: Eğer yapay zeka (krisp) veya standart gürültü engelleme açıksa,
            // tarayıcının kendi native gürültü engellemesini KAPAT.
            // İkisi birden çalışırsa ses kesilir ("alo" -> "lo" sorunu).
            const shouldUseNativeNoiseSuppression = 
              noiseSuppression && (noiseSuppressionMode === "none" || !noiseSuppressionMode);

            // Yeni constraint'lerle mikrofon stream'i al
            const constraints = {
              audio: {
                deviceId:
                  audioInputId !== "default"
                    ? { exact: audioInputId }
                    : undefined,
                echoCancellation,
                noiseSuppression: shouldUseNativeNoiseSuppression,
                autoGainControl: effectiveAutoGainControl(autoGainControl, noiseSuppressionMode),
              },
            };

            const newStream = await navigator.mediaDevices.getUserMedia(
              constraints
            );
            const newTrack = newStream.getAudioTracks()[0];

            if (newTrack) {
              // Eski track'i unpublish et
              try {
                  await localParticipant.unpublishTrack(oldTrack);
                  oldTrack.stop();
              } catch (err) {
                  console.warn("Eski track durdurulurken hata:", err);
              }

              // Odanın hala bağlı olduğunu kontrol et
              if (room.state !== ConnectionState.Connected) {
                  newTrack.stop();
                  return;
              }

              // Yeni track'i publish et
              const newMicPub = await localParticipant.publishTrack(newTrack, {
                source: Track.Source.Microphone,
              });

              // Susturulmuş kullanıcının mikrofonu ayar değişince kendiliğinden açılmasın
              if (isMuted || serverMuted || isDeafened || serverDeafened) {
                await newMicPub.setMuted(true);
              }

              // Stream'deki diğer track'leri durdur
              newStream.getTracks().forEach((track) => {
                if (track !== newTrack) track.stop();
              });

              if (process.env.NODE_ENV === "development") {
                console.log("✅ Mikrofon ayarları güncellendi");
              }
            }
          }
        }

        // Video ayarları değiştiyse ve kamera açıksa video track'ini güncelle
        if (videoSettingsChanged) {
          const videoPublication = localParticipant.getTrackPublication(
            Track.Source.Camera
          );

          if (videoPublication?.track) {
            const oldTrack = videoPublication.track;

            // Çözünürlük ayarlarını belirle (kullanıcı ayarlarına göre)
            const resolutionMap = {
              "240p": { width: 426, height: 240, bitrate: 120000 },
              "360p": { width: 640, height: 360, bitrate: 250000 },
              "480p": { width: 854, height: 480, bitrate: 450000 },
              "720p": { width: 1280, height: 720, bitrate: 750000 },
            };
            const selectedResolution = resolutionMap[videoResolution] || resolutionMap["720p"] || resolutionMap["480p"];
            const selectedFps = videoFrameRate || 18;

            // Yeni constraint'lerle video stream'i al
            const constraints = {
              video: {
                deviceId:
                  videoId !== "default" ? { exact: videoId } : undefined,
                width: { ideal: selectedResolution.width, max: selectedResolution.width },
                height: { ideal: selectedResolution.height, max: selectedResolution.height },
                frameRate: { ideal: selectedFps, max: selectedFps },
              },
            };

            const newStream = await navigator.mediaDevices.getUserMedia(
              constraints
            );
            const newTrack = newStream.getVideoTracks()[0];

            if (newTrack) {
              // Eski track'i unpublish et
              try {
                  await localParticipant.unpublishTrack(oldTrack);
                  oldTrack.stop();
              } catch (err) {
                  console.warn("Eski video track durdurulurken hata:", err);
              }

              // Odanın hala bağlı olduğunu kontrol et
              if (room.state !== ConnectionState.Connected) {
                   newTrack.stop();
                   return;
              }

              // Yeni track'i publish et - Kullanıcı ayarlarına göre
              const newPublication = await localParticipant.publishTrack(
                newTrack,
                {
                  source: Track.Source.Camera,
                  videoEncoding: {
                    maxBitrate: selectedResolution.bitrate,
                    maxFramerate: selectedFps,
                  },
                  videoCodec: videoCodec || "vp8",
                  simulcast: false,
                }
              );

              // Track'in enabled olduğundan ve muted olmadığından emin ol
              if (newPublication.track) {
                newPublication.track.enabled = true;
                if (newPublication.track.mediaStreamTrack) {
                  newPublication.track.mediaStreamTrack.enabled = true;
                }
              }

              // Mute durumunu kontrol et - Eğer susturulmuşsa mute et, değilse unmute et
              const shouldBeMuted = isMuted || serverMuted || isDeafened || serverDeafened;
              
              if (shouldBeMuted) {
                if (!newPublication.isMuted) {
                  await newPublication.setMuted(true);
                  if (newPublication.track) newPublication.track.enabled = false;
                }
              } else {
                if (newPublication.isMuted) {
                  await newPublication.setMuted(false);
                }
              }

              // Stream'deki diğer track'leri durdur
              newStream.getTracks().forEach((track) => {
                if (track !== newTrack) track.stop();
              });

              if (process.env.NODE_ENV === "development") {
                console.log("✅ Kamera ayarları güncellendi:", {
                  resolution: videoResolution,
                  fps: selectedFps,
                  bitrate: selectedResolution.bitrate,
                });
              }
            }
          }
        }
      } catch (error) {
        console.error("❌ Ayarlar güncellenirken hata:", error);
      } finally {
        isUpdatingRef.current = false;
        prevSettingsRef.current = {
          audioInputId,
          videoId,
          noiseSuppression,
          echoCancellation,
          autoGainControl,
          noiseSuppressionMode,
          videoResolution,
          videoFrameRate,
        };
      }
    };

    updateTracks();
  }, [
    localParticipant,
    room,
    audioInputId,
    videoId,
    noiseSuppression,
    echoCancellation,
    autoGainControl,
    noiseSuppressionMode,
    videoResolution,
    videoFrameRate,
    videoCodec,
  ]);

  // ✅ YENİ: Quick Status Sync (Metadata)
  // Store'daki quickStatus değiştiğinde LiveKit metadata'sını güncelle
  const quickStatus = useSettingsStore(state => state.quickStatus);
  
  useEffect(() => {
    if (!localParticipant || !room || room.state !== ConnectionState.Connected) return;

    const updateMetadata = async () => {
      try {
        const currentMeta = localParticipant.metadata ? JSON.parse(localParticipant.metadata) : {};
        
        // Değişiklik kontrolü (gereksiz update'i önle)
        // Eğer quickStatus null ise ve metadata'da da yoksa güncelleme yapma
        // Eğer quickStatus varsa ve metadata ile aynıysa güncelleme yapma
        const currentQuickStatus = currentMeta.quickStatus;
        
        const isDifferent = JSON.stringify(currentQuickStatus) !== JSON.stringify(quickStatus);
        
        if (!isDifferent) return;
        
        const newMeta = {
          ...currentMeta,
          quickStatus: quickStatus
        };
        
        await localParticipant.setMetadata(JSON.stringify(newMeta));
        
        if (process.env.NODE_ENV === "development") {
            console.log("✅ Quick Status synced to metadata:", quickStatus);
        }
      } catch (error) {
        console.error("❌ Quick Status sync error:", error);
      }
    };

    updateMetadata();
  }, [quickStatus, localParticipant, room]);

  return null;
}
