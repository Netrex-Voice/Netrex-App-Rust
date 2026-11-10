import { useState, useRef } from "react";
import { Image, Upload, Trash2 } from "lucide-react";
import { toast } from "@/src/utils/toast";
import {
  uploadProfileBackgroundToCloudinary,
  deleteImageFromCloudinary,
} from "@/src/utils/imageUpload";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import Avatar from "@/src/components/ui/Avatar";
import ImageCropModal from "@/src/components/ui/ImageCropModal";
import { useSettingsStore } from "@/src/store/settingsStore";
import { extractDominantGradient } from "@/src/utils/extractDominantGradient";

/**
 * ✅ ProfileBackgroundUploader - Kırpma destekli arkaplan yükleyici.
 * Önce ImageCropModal ile 16:9 kırpma yapılır, onay sonrası Cloudinary'ye yüklenir.
 */
export default function ProfileBackgroundUploader({
  user,
  profileBgImage,
  setProfileBgImage,
}) {
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const [cropFile, setCropFile] = useState(null);
  const bgInputRef = useRef(null);
  const setProfileColor = useSettingsStore((s) => s.setProfileColor);
  const autoThemeFromImage = useSettingsStore((s) => s.autoThemeFromImage);

  // Dosya seçildiğinde → doğrulama → kırpma modalı
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen bir resim dosyası seçin.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Resim boyutu maksimum 5MB olmalıdır.");
      return;
    }

    setCropFile(file);
    if (bgInputRef.current) bgInputRef.current.value = "";
  };

  // Kırpma onaylandı → Cloudinary + opsiyonel tema güncelle
  const handleCropSave = async (croppedFile) => {
    setIsUploadingBg(true);
    setCropFile(null);

    try {
      if (profileBgImage) {
        await deleteImageFromCloudinary(profileBgImage);
      }

      // Yükleme ve renk çıkarımı paralel
      const [imageUrl, gradient] = await Promise.all([
        uploadProfileBackgroundToCloudinary(croppedFile),
        autoThemeFromImage
          ? extractDominantGradient(croppedFile, { angle: 160 }).catch(
              () => null,
            )
          : Promise.resolve(null),
      ]);

      setProfileBgImage(imageUrl);

      await updateDoc(doc(db, "users", user.uid), {
        profileBgImage: imageUrl,
        updatedAt: serverTimestamp(),
      });

      if (gradient) {
        setProfileColor(gradient);
        toast.success("Arkaplan ve tema güncellendi!");
      } else {
        toast.success("Arkaplan resmi yüklendi!");
      }
    } catch (error) {
      console.error("Error uploading background image:", error);
      toast.error("Resim yüklenemedi: " + error.message);
    } finally {
      setIsUploadingBg(false);
    }
  };

  const handleRemoveBgImage = async () => {
    if (!profileBgImage) return;

    setIsUploadingBg(true);
    try {
      await deleteImageFromCloudinary(profileBgImage);

      await updateDoc(doc(db, "users", user.uid), {
        profileBgImage: null,
        updatedAt: serverTimestamp(),
      });

      setProfileBgImage(null);
      toast.success("Arkaplan resmi kaldırıldı!");
    } catch (error) {
      console.error("Error removing background image:", error);
      toast.error("Resim kaldırılamadı: " + error.message);
    } finally {
      setIsUploadingBg(false);
    }
  };

  return (
    <>
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 mb-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-blue-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />

        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <Image size={14} className="text-cyan-400" />
          </div>
          Arkaplan Resmi
        </h4>

        <div className="relative z-10">
          <p className="text-xs text-[#949ba4] mb-4">
            Profil kartınızda hafif blur efektiyle görüntülenir. Seçtikten sonra
            16:9 oranında kırpma ekranı açılır.
          </p>

          {/* Önizleme */}
          {profileBgImage && (
            <div className="mb-4 relative rounded-xl overflow-hidden border border-white/10 group/preview">
              <div
                className="h-24 w-full bg-cover bg-center"
                style={{
                  backgroundImage: `url(${profileBgImage})`,
                  filter: "blur(1px)",
                  opacity: 0.8,
                }}
              />
              <div
                className="absolute inset-0 bg-cover bg-center opacity-40"
                style={{ backgroundImage: `url(${profileBgImage})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1e1f22] via-transparent to-transparent" />
              <div className="absolute bottom-2 left-3 flex items-center gap-2">
                <Avatar
                  size="sm"
                  uid={user?.uid}
                  name={user?.displayName || "Kullanıcı"}
                  src={user?.photoURL || null}
                />
                <span className="text-white text-sm font-semibold drop-shadow-lg">
                  {user?.displayName || "Kullanıcı"}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            {/* Yükle butonu */}
            <button
              onClick={() => bgInputRef.current?.click()}
              disabled={isUploadingBg}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-300 border ${
                isUploadingBg
                  ? "bg-cyan-500/20 text-cyan-300/70 cursor-not-allowed border-cyan-500/30"
                  : "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]"
              }`}
            >
              {isUploadingBg ? (
                <>
                  <div className="w-4 h-4 border-2 border-cyan-300/30 border-t-cyan-300 rounded-full animate-spin" />
                  Yükleniyor...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  {profileBgImage ? "Değiştir" : "Resim Yükle"}
                </>
              )}
            </button>

            {/* Kaldır butonu */}
            {profileBgImage && (
              <button
                onClick={handleRemoveBgImage}
                disabled={isUploadingBg}
                className={`px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-300 border flex items-center gap-2 ${
                  isUploadingBg
                    ? "bg-red-500/10 text-red-300/50 cursor-not-allowed border-red-500/20"
                    : "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30 hover:border-red-500/50"
                }`}
              >
                <Trash2 size={16} />
                Kaldır
              </button>
            )}
          </div>

          <input
            ref={bgInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <p className="text-[10px] text-[#5c5e66] mt-3 text-center">
            Önerilen: 1920×1080 veya üzeri, maksimum 5MB
          </p>
        </div>
      </div>

      {/* Kırpma Modalı - 16:9 oran */}
      {cropFile && (
        <ImageCropModal
          file={cropFile}
          aspectRatio={16 / 9}
          shape="rect"
          title="Arkaplan Resmini Kırp"
          onSave={handleCropSave}
          onClose={() => setCropFile(null)}
        />
      )}
    </>
  );
}
