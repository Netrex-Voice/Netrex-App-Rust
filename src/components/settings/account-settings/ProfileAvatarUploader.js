import { useState, useRef } from "react";
import { Upload, Trash2, Image } from "lucide-react";
import { toast } from "@/src/utils/toast";
import {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
} from "@/src/utils/imageUpload";
import { doc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/src/lib/firebase";
import { updateProfile } from "firebase/auth";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import ImageCropModal from "@/src/components/ui/ImageCropModal";
import { useSettingsStore } from "@/src/store/settingsStore";
import { extractDominantGradient } from "@/src/utils/extractDominantGradient";

export default function ProfileAvatarUploader() {
  const { user } = useAuthStore();
  const { servers } = useServerStore();
  const setProfileColor = useSettingsStore((s) => s.setProfileColor);
  const autoThemeFromImage = useSettingsStore((s) => s.autoThemeFromImage);

  const [isUploading, setIsUploading] = useState(false);
  const [cropFile, setCropFile] = useState(null); // kırpma modalına gönderilecek dosya
  const fileInputRef = useRef(null);

  if (!user?.uid) return null;

  // Dosya seçildiğinde → kırpma modalını aç (Cloudinary'ye henüz gitme)
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
    // Dosya input'unu temizle; aynı dosyayı tekrar seçebilmek için
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Kırpma onaylandı → Cloudinary + opsiyonel tema güncelle
  const handleCropSave = async (croppedFile) => {
    setIsUploading(true);
    setCropFile(null);

    try {
      if (user.photoURL && user.photoURL.includes("cloudinary.com")) {
        await deleteImageFromCloudinary(user.photoURL);
      }

      // Yükleme ve renk çıkarımı paralel
      const [imageUrl, gradient] = await Promise.all([
        uploadImageToCloudinary(croppedFile),
        autoThemeFromImage
          ? extractDominantGradient(croppedFile).catch(() => null)
          : Promise.resolve(null),
      ]);

      await updateDoc(doc(db, "users", user.uid), {
        photoURL: imageUrl,
        updatedAt: serverTimestamp(),
      });

      // Firebase Auth currentUser'ı güncelle - onAuthStateChanged ezmesin
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: imageUrl }).catch(
          () => {},
        );
      }

      if (Array.isArray(servers) && servers.length > 0) {
        const tasks = servers.map((s) =>
          updateDoc(doc(db, "servers", s.id, "members", user.uid), {
            photoURL: imageUrl,
          }).catch(() => {}),
        );
        await Promise.all(tasks);
      }

      useAuthStore.setState((prev) => ({
        ...prev,
        user: { ...prev.user, photoURL: imageUrl },
      }));

      if (gradient) {
        setProfileColor(gradient);
        toast.success("Profil resmin ve tema güncellendi!");
      } else {
        toast.success("Profil resmin güncellendi!");
      }
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Profil resmi yüklenemedi: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!user.photoURL) return;

    setIsUploading(true);
    try {
      if (user.photoURL.includes("cloudinary.com")) {
        await deleteImageFromCloudinary(user.photoURL);
      }

      // Google hesabıysa Google fotoğrafına geri dön, null'a değil. Kaynaklar sırayla: Auth providerData (güncel),
      // oturum açılırken kaydedilen googlePhotoURL, Firestore'da saklanan googlePhotoURL (providerData boş dönerse).
      const googleProvider = auth.currentUser?.providerData?.find(
        (p) => p.providerId === "google.com"
      );
      let fallbackPhotoURL = googleProvider?.photoURL || user.googlePhotoURL || null;
      if (!fallbackPhotoURL) {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          fallbackPhotoURL = snap.data()?.googlePhotoURL || null;
        } catch (e) {}
      }

      // 1) Firestore users dokümanı - kaynak of truth
      await updateDoc(doc(db, "users", user.uid), {
        photoURL: fallbackPhotoURL,
        updatedAt: serverTimestamp(),
      });

      // 2) Firebase Auth güncelle
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { 
          photoURL: fallbackPhotoURL || "" 
        }).catch(() => {});
      }

      // 3) Tüm sunucu member dokümanları
      if (Array.isArray(servers) && servers.length > 0) {
        const tasks = servers.map((s) =>
          updateDoc(doc(db, "servers", s.id, "members", user.uid), {
            photoURL: fallbackPhotoURL,
          }).catch(() => {}),
        );
        await Promise.all(tasks);
      }

      // 4) authStore'u güncelle
      useAuthStore.setState((prev) => ({
        ...prev,
        user: { ...prev.user, photoURL: fallbackPhotoURL },
      }));

      if (fallbackPhotoURL) {
        toast.success("Özel resim kaldırıldı, Google profil resmine dönüldü.");
      } else {
        toast.success("Profil resmin kaldırıldı.");
      }
    } catch (error) {
      console.error("Error removing avatar:", error);
      toast.error("Profil resmi kaldırılamadı: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 mb-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-blue-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />

        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Image size={14} className="text-emerald-400" />
          </div>
          Profil Resmi
        </h4>

        <div className="relative z-10 space-y-4">
          <p className="text-xs text-[#949ba4]">
            Resim seçtikten sonra kırpma ekranında istediğin alanı
            belirleyebilir, yakınlaştırıp konumlandırabilirsin. Onayladıktan
            sonra Cloudinary&apos;ye yüklenir.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-300 border ${
                isUploading
                  ? "bg-emerald-500/20 text-emerald-300/70 cursor-not-allowed border-emerald-500/30"
                  : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]"
              }`}
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin" />
                  Yükleniyor...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  {user.photoURL ? "Değiştir" : "Resim Yükle"}
                </>
              )}
            </button>

            {user.photoURL && (
              <button
                onClick={handleRemove}
                disabled={isUploading}
                className={`px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-300 border flex items-center gap-2 ${
                  isUploading
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
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <p className="text-[10px] text-[#5c5e66] mt-1 text-center">
            Önerilen: kare görsel, maksimum 5MB. Yükleme öncesi kırpma ekranı
            açılır.
          </p>
        </div>
      </div>

      {/* Kırpma Modalı */}
      {cropFile && (
        <ImageCropModal
          file={cropFile}
          aspectRatio={1}
          shape="rect"
          title="Profil Resmini Kırp"
          onSave={handleCropSave}
          onClose={() => setCropFile(null)}
        />
      )}
    </>
  );
}
