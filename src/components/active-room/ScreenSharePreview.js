
import { useState, useRef, useEffect } from "react";

// Screen Share Önizleme - İlk 1 saniye canlı, sonra donmuş frame
export default function ScreenSharePreviewComponent({ trackRef }) {
  const [previewImage, setPreviewImage] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const hasCapturedRef = useRef(false);
  const captureTimeoutRef = useRef(null);
  const trackSidRef = useRef(null);

  // Track değiştiğinde reset - trackSid'i stabilize et
  const currentTrackSid = trackRef?.participant?.sid ?? null;

  useEffect(() => {
    if (currentTrackSid !== trackSidRef.current) {
      hasCapturedRef.current = false;
      setPreviewImage(null);
      trackSidRef.current = currentTrackSid;
    }
  }, [currentTrackSid]);

  // ✅ Unmount cleanup - base64 image'ı temizle (memory leak önleme)
  useEffect(() => {
    return () => {
      setPreviewImage(null);
      hasCapturedRef.current = false;
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    };
  }, []);

  // Video element'ini track'e bağla - trackSid ve publication'ı stabilize et
  const trackPublicationSid = trackRef?.publication?.trackSid ?? null;

  useEffect(() => {
    if (!trackRef?.publication?.track || hasCapturedRef.current) return;

    const trackPublication = trackRef.publication;

    const track = trackPublication.track;
    const video = videoRef.current;

    if (!video) return;

    track.attach(video);

    // Video yüklendiğinde 1 saniye sonra frame yakala
    const handleLoadedMetadata = () => {
      if (hasCapturedRef.current) return;

      captureTimeoutRef.current = setTimeout(() => {
        if (video && canvasRef.current && !hasCapturedRef.current) {
          try {
            // ✅ OPTIMIZATION: Düşük çözünürlüklü preview (RAM tasarrufu)
            // Blur filtresi detayı gizlediği için yüksek kaliteye gerek yok
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            canvas.width = Math.min(video.videoWidth || 640, 320);
            canvas.height = Math.min(video.videoHeight || 360, 180);

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = canvas.toDataURL("image/jpeg", 0.4);
            setPreviewImage(imageData);
            hasCapturedRef.current = true;

            // Video track'i detach et (artık gerek yok, bandwidth tasarrufu)
            track.detach(video);
          } catch (error) {
            console.warn("Preview capture error:", error);
          }
        }
      }, 1000); // 1 saniye sonra yakala
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      if (captureTimeoutRef.current) {
        clearTimeout(captureTimeoutRef.current);
        captureTimeoutRef.current = null;
      }
      if (track && video) {
        track.detach(video);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrackSid, trackPublicationSid]);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden rounded-2xl pointer-events-none">
      {!hasCapturedRef.current && (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{
              filter: "blur(2px) brightness(0.7)",
            }}
          />
          <canvas ref={canvasRef} className="hidden" />
        </>
      )}
      {previewImage && (
        <img
          src={previewImage}
          alt="Screen share preview"
          className="w-full h-full object-cover"
          style={{
            filter: "blur(2px) brightness(0.7)",
          }}
        />
      )}
      <div className="absolute inset-0 bg-black/30"></div>
    </div>
  );
}
