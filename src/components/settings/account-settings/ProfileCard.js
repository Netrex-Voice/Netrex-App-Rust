"use client";

import { memo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { User, Mail, Camera } from "lucide-react";
import Avatar from "@/src/components/ui/Avatar";
import { toast } from "@/src/utils/toast";
import {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
} from "@/src/utils/imageUpload";
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "@/src/lib/firebase";
import { updateProfile } from "firebase/auth";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import ImageCropModal from "@/src/components/ui/ImageCropModal";
import { useSettingsStore } from "@/src/store/settingsStore";
import { extractDominantGradient } from "@/src/utils/extractDominantGradient";

// ✅ Küfür/Hakaret Filtresi (Profanity Filter List)
const BANNED_WORDS = [
  "amk", "aq", "sg", "oç", "orospu", "pic", "piç", "siktir", "yarak", "yarrak", 
  "amcik", "amcık", "fuck", "bitch", "cunt", "nigger", "nigga", "asshole",
  "admin", "netrex", "system", "moderator", "mod", "destek", "support",
  "yarram", "sikim", "sikerim", "göt", "gotveren", "ibne", "kahpe", "pezevenk",
  "şerefsiz", "serefsiz", "yavşak", "yavsak", "gavat", "kaltak", "orosbu", 
  "orosp", "sikiş", "sikis", "döl", "porn", "porno", "sex", "seks", "am", 
  "sik", "memeler"
];

// Kelimenin sansürlü listeyi içerip içermediğini kontrol et
const containsProfanity = (text) => {
  const normalizedText = text.toLowerCase().replace(/1/g, 'i').replace(/0/g, 'o').replace(/3/g, 'e').replace(/@/g, 'a').replace(/\s+/g, '');
  return BANNED_WORDS.some(word => normalizedText.includes(word));
};

/**
 * ✅ ProfileCard - Optimized account profile header
 * Avatar tıklandığında dosya seçilir → ImageCropModal açılır →
 * Onaylanınca Cloudinary'ye yüklenir.
 */
const ProfileCard = memo(function ProfileCard({ user, profileColor, bgImage }) {
  if (!user) return null;

  const fileInputRef = useRef(null);
  const [bannerColor, setBannerColor] = useState(profileColor);
  const [cropFile, setCropFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const setProfileColor = useSettingsStore((s) => s.setProfileColor);
  const autoThemeFromImage = useSettingsStore((s) => s.autoThemeFromImage);

  // Düzenleme stateleri
  const [editingField, setEditingField] = useState(null); // 'displayName' veya 'username'
  const [tempValue, setTempValue] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  // ── Dosya seç → doğrula → kırpma modalını aç ────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen bir resim dosyası seçin.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Resim boyutu maksimum 5MB olmalıdır.");
      return;
    }

    setCropFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Kırpma onaylandı → Cloudinary + opsiyonel tema güncelle ─────────────────
  const handleCropSave = async (croppedFile) => {
    const { servers } = useServerStore.getState();
    setIsUploading(true);
    setCropFile(null);

    try {
      // Eski Cloudinary görselini sil
      if (user.photoURL && user.photoURL.includes("cloudinary.com")) {
        await deleteImageFromCloudinary(user.photoURL);
      }

      // Cloudinary yüklemesi ve opsiyonel tema çıkarımı paralel çalışsın
      const [imageUrl, gradient] = await Promise.all([
        uploadImageToCloudinary(croppedFile),
        autoThemeFromImage
          ? extractDominantGradient(croppedFile).catch(() => null)
          : Promise.resolve(null),
      ]);

      // users koleksiyonunda güncelle
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

      // Sunucu üyeliklerinde güncelle
      if (Array.isArray(servers) && servers.length > 0) {
        const tasks = servers.map((s) =>
          updateDoc(doc(db, "servers", s.id, "members", user.uid), {
            photoURL: imageUrl,
          }).catch(() => {}),
        );
        await Promise.all(tasks);
      }

      // authStore'daki user'ı güncelle
      useAuthStore.setState((prev) => ({
        ...prev,
        user: { ...prev.user, photoURL: imageUrl },
      }));

      // Resmin dominant renklerinden profil temasını güncelle
      if (gradient) {
        setProfileColor(gradient);
        setBannerColor(gradient);
        toast.success("Profil resmin ve tema güncellendi!");
      } else {
        toast.success("Profil resmin güncellendi!");
      }
    } catch (error) {
      console.error("Error updating avatar from ProfileCard:", error);
      toast.error("Profil resmi güncellenemedi: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // ── Banner rengi: mevcut arka plan veya avatar yüklendiğinde güncelle ─────────
  const handleImageLoaded = async (event) => {
    try {
      const imgEl = event.target;
      // Banner için hızlı ortalama renk (canvas, mevcut img elementinden)
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = 32;
      canvas.height = 32;
      ctx.drawImage(imgEl, 0, 0, 32, 32);
      const data = ctx.getImageData(0, 0, 32, 32).data;
      let r = 0,
        g = 0,
        b = 0,
        count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
      if (count > 0) {
        setBannerColor(
          `rgba(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)}, 0.9)`,
        );
      }
    } catch {
      // sessiz geç
    }
  };

  const handleSaveName = async (field) => {
    if (!tempValue.trim() || tempValue.trim() === user[field]) {
      setEditingField(null);
      return;
    }

    const value = tempValue.trim();

    // Uzunluk Sınırları (Length Constraints)
    if (field === "username") {
      if (value.length < 3 || value.length > 20) {
        toast.error("Kullanıcı adı 3 ile 20 karakter arasında olmalıdır.");
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(value)) {
        toast.error("Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir.");
        return;
      }
    } else if (field === "displayName") {
      if (value.length < 2 || value.length > 32) {
        toast.error("Görünen ad 2 ile 32 karakter arasında olmalıdır.");
        return;
      }
    }

    // Küfür & Yasaklı Kelime Koruması (Profanity Filter)
    if (containsProfanity(value)) {
      toast.error("İsim uygunsuz veya ayrılmış kelimeler içeriyor.");
      return;
    }

    setIsSavingName(true);
    try {
      if (field === "username") {
        // Uniqueness check
        const q = query(
          collection(db, "users"),
          where("username", "==", value.toLowerCase())
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          toast.error("Bu kullanıcı adı zaten alınmış!");
          setIsSavingName(false);
          return;
        }
      }

      const updateData = {};
      
      if (field === "username") {
        updateData.username = value.toLowerCase();
      } else {
        updateData.displayName = value;
      }

      await updateDoc(doc(db, "users", user.uid), updateData);

      // Auth update for displayName
      if (field === "displayName" && auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: value }).catch(() => {});
      }

      // Sunucu üyeliklerinde (Server Members) güncelle
      const { servers } = useServerStore.getState();
      if (Array.isArray(servers) && servers.length > 0) {
        const tasks = servers.map((s) =>
          updateDoc(doc(db, "servers", s.id, "members", user.uid), updateData)
            .catch((err) => console.warn(`Server member update failed for ${s.id}:`, err))
        );
        await Promise.allSettled(tasks);
      }

      // Update local store
      useAuthStore.setState((prev) => ({
        ...prev,
        user: { ...prev.user, ...updateData },
      }));

      toast.success(`${field === "username" ? "Kullanıcı adı" : "Görünen ad"} başarıyla güncellendi!`);
      setEditingField(null);
    } catch (error) {
      console.error("Name update error:", error);
      toast.error("İsim güncellenemedi.");
    } finally {
      setIsSavingName(false);
    }
  };

  return (
    <>
      <div className="glass-strong rounded-2xl overflow-hidden border border-white/20 shadow-soft-lg mb-8 relative group/card hover:shadow-xl transition-all duration-300">
        {/* Hover glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 z-10 pointer-events-none" />

        {/* Banner - Arka plan resmi varsa onu göster, yoksa dominant renk */}
        <div
          className="h-28 w-full transition-all duration-300 relative overflow-hidden"
          style={{ background: bannerColor || profileColor }}
        >
          {bgImage ? (
            <>
              <img
                src={bgImage}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                crossOrigin="anonymous"
                onLoad={handleImageLoaded}
              />
              <div className="absolute inset-0 bg-black/20" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20" />
          )}
        </div>

        {/* Content */}
        <div className="px-5 pb-5 relative">
          <div className="flex justify-between items-end -mt-10 mb-4">
            <div className="flex items-end gap-3">
              {/* Avatar - tıkla ve kırpma modalı açılır */}
              <div className="p-1.5 bg-[#1e1f22] rounded-xl">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="relative w-24 h-24 rounded-xl overflow-hidden shadow-sm group/avatar focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed"
                >
                  <div className="w-full h-full flex items-center justify-center text-white text-4xl font-bold">
                    <Avatar
                      size="2xl"
                      uid={user.uid}
                      src={user.photoURL || null}
                      name={user.displayName || "Kullanıcı"}
                      color={profileColor}
                      borderColor={profileColor}
                      onImageLoad={!bgImage ? handleImageLoaded : undefined}
                    />
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                    {isUploading ? (
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Camera size={22} className="text-white/90" />
                        <span className="text-[11px] text-white/80 font-medium">
                          Düzenle
                        </span>
                      </>
                    )}
                  </div>
                </button>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {/* Kullanıcı bilgisi */}
              <div className="mb-1">
                <h2 className="text-xl font-bold text-white leading-none">
                  {user.displayName || "Misafir Kullanıcı"}
                </h2>
                <span className="text-sm text-[#949ba4] font-medium">
                  {user.username ? `@${user.username}` : `#${user.uid?.substring(0, 4)}`}
                </span>
              </div>
            </div>
          </div>

          {/* Bilgi kartları */}
          <div className="glass-strong rounded-xl p-5 space-y-4 border border-white/10 relative z-10">
            {/* Display Name */}
            <div className="flex justify-between items-center group">
              <div className="flex-1">
                <label className="text-[11px] font-bold text-[#949ba4] uppercase mb-1.5 flex items-center gap-1.5">
                  <User size={12} className="text-indigo-400" /> Görünen Ad
                </label>
                {editingField === "displayName" ? (
                   <div className="flex gap-2">
                     <input 
                       value={tempValue}
                       maxLength={32}
                       onChange={(e) => setTempValue(e.target.value)}
                       className="bg-[#111214] text-white text-sm px-3 py-1.5 rounded-lg border border-indigo-500/50 outline-none w-full"
                       autoFocus
                       onKeyDown={(e) => {
                         if (e.key === "Enter") handleSaveName("displayName");
                         if (e.key === "Escape") setEditingField(null);
                       }}
                     />
                     <button 
                       disabled={isSavingName}
                       onClick={() => handleSaveName("displayName")}
                       className="px-3 py-1.5 bg-indigo-500 text-white text-xs font-bold rounded-lg hover:bg-indigo-600 transition-colors"
                     >
                       Kaydet
                     </button>
                   </div>
                ) : (
                  <div className="text-white text-sm font-medium">
                    {user.displayName || "Belirtilmemiş"}
                  </div>
                )}
              </div>
              {editingField !== "displayName" && (
                <button 
                  onClick={() => { setEditingField("displayName"); setTempValue(user.displayName || ""); }}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-[#b5bac1] hover:text-white transition-colors"
                >
                  Düzenle
                </button>
              )}
            </div>

            <div className="h-px bg-white/10" />

            {/* Username */}
            <div className="flex justify-between items-center group">
              <div className="flex-1">
                <label className="text-[11px] font-bold text-[#949ba4] uppercase mb-1.5 flex items-center gap-1.5">
                  <User size={12} className="text-purple-400" /> Kullanıcı Adı (Benzersiz)
                </label>
                {editingField === "username" ? (
                   <div className="flex gap-2">
                     <input 
                       value={tempValue}
                       maxLength={20}
                       onChange={(e) => setTempValue(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                       className="bg-[#111214] text-white text-sm px-3 py-1.5 rounded-lg border border-purple-500/50 outline-none w-full"
                       placeholder="benzersiz_ad"
                       autoFocus
                       onKeyDown={(e) => {
                         if (e.key === "Enter") handleSaveName("username");
                         if (e.key === "Escape") setEditingField(null);
                       }}
                     />
                     <button 
                       disabled={isSavingName}
                       onClick={() => handleSaveName("username")}
                       className="px-3 py-1.5 bg-purple-500 text-white text-xs font-bold rounded-lg hover:bg-purple-600 transition-colors"
                     >
                       Kaydet
                     </button>
                   </div>
                ) : (
                  <div className="text-white text-sm font-medium flex items-center gap-1">
                    {user.username ? (
                      `@${user.username}`
                    ) : (
                      <span className="text-yellow-400/80 italic text-xs">Ayarlanmadı (Zorunlu)</span>
                    )}
                  </div>
                )}
              </div>
              {editingField !== "username" && (
                <button 
                  onClick={() => { setEditingField("username"); setTempValue(user.username || ""); }}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-[#b5bac1] hover:text-white transition-colors"
                >
                  Düzenle
                </button>
              )}
            </div>

            <div className="h-px bg-white/10" />
            <div className="flex justify-between items-center group">
              <div>
                <label className="text-[11px] font-bold text-[#949ba4] uppercase mb-1.5 flex items-center gap-1.5">
                  <Mail size={12} className="text-indigo-400" /> E-Posta
                </label>
                <div className="text-white text-sm font-medium">
                  {user.email || (
                    <span className="text-[#949ba4] italic">Anonim Hesap</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Kırpma Modalı - 1:1 daire */}
      {cropFile && (
        <ImageCropModal
          file={cropFile}
          aspectRatio={1}
          shape="rect"
          title="Profil Resmini Düzenle"
          onSave={handleCropSave}
          onClose={() => setCropFile(null)}
        />
      )}
    </>
  );
});

export default ProfileCard;
