import imageCompression from 'browser-image-compression';
import { API_URL, apiCall } from '@/src/lib/netrexApi';

// Resim yükleme (Cloudinary).
//
// Netrex sunucusu tanımlıysa (NEXT_PUBLIC_NETREX_API_URL) yükleme İMZALIDIR: klasörü sunucu belirler
// (netrex/u/<uid> ya da netrex/s/<sunucuId>), böylece her resmin sahibi bilinir ve yalnızca sahibi silebilir.
// Sunucu tanımsızsa (yerel geliştirme) eski imzasız preset yoluna düşülür.

// Sıkıştırma başarısız olursa orijinal dosya bu boyutu aşıyorsa yüklenmez (eskiden sınırsız yükleniyordu)
const MAX_UNCOMPRESSED_BYTES = 2 * 1024 * 1024;

const PRESETS = {
  // Mesaj resmi / profil fotoğrafı: ~50KB, 800px
  image: { maxSizeMB: 0.05, maxWidthOrHeight: 800, initialQuality: 0.7 },
  // Sunucu simgesi küçük gösterilir (48-96px): ~15KB, 128px
  serverIcon: { maxSizeMB: 0.015, maxWidthOrHeight: 128, initialQuality: 0.8 },
  // Rozet (16-32px): ~10KB, 64px
  badge: { maxSizeMB: 0.01, maxWidthOrHeight: 64, initialQuality: 0.85 },
  // Profil arka planı bulanık ve soluk gösterilir: ~30KB, 400px
  profileBackground: { maxSizeMB: 0.03, maxWidthOrHeight: 400, initialQuality: 0.7 },
};

async function compress(file, preset) {
  try {
    return await imageCompression(file, { ...preset, useWebWorker: true, fileType: 'image/webp' });
  } catch (compError) {
    console.warn('Compression failed:', compError);
    if (file.size > MAX_UNCOMPRESSED_BYTES) {
      throw new Error('Resim işlenemedi ve sıkıştırılmadan yüklemek için çok büyük.');
    }
    return file;
  }
}

/**
 * @param {File} file
 * @param {keyof PRESETS} kind
 * @param {string|null} serverId  sunucuya ait resimler (simge, rozet) için; kullanıcının kendi resimlerinde null
 * @returns {Promise<string>} resmin https adresi
 */
async function upload(file, kind, serverId = null) {
  if (!file) throw new Error('Dosya seçilmedi.');

  const compressed = await compress(file, PRESETS[kind]);
  const formData = new FormData();
  formData.append('file', compressed);

  let cloudName;
  if (API_URL) {
    const signed = await apiCall('/api/cloudinary-sign', { method: 'POST', body: serverId ? { serverId } : {} });
    cloudName = signed.cloudName;
    formData.append('api_key', signed.apiKey);
    formData.append('timestamp', String(signed.timestamp));
    formData.append('folder', signed.folder);
    formData.append('signature', signed.signature);
  } else {
    cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) throw new Error('Resim yükleme servisi yapılandırılmamış.');
    formData.append('upload_preset', uploadPreset);
  }

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Yükleme sunucusu hatası.');
  }
  return (await res.json()).secure_url;
}

export const uploadImageToCloudinary = (file) => upload(file, 'image');
export const uploadProfileBackgroundToCloudinary = (file) => upload(file, 'profileBackground');
/** `serverId` verilirse resim sunucunun klasörüne gider (yöneticiler silebilir); verilmezse yükleyenin klasörüne. */
export const uploadServerIconToCloudinary = (file, serverId = null) => upload(file, 'serverIcon', serverId);
export const uploadBadgeIconToCloudinary = (file, serverId = null) => upload(file, 'badge', serverId);

/** Cloudinary adresinden public_id çıkarır: .../upload/v123/<public_id>.<uzantı> */
export function publicIdFromUrl(imageUrl) {
  if (!imageUrl || !imageUrl.includes('cloudinary.com')) return null;
  const uploadIndex = imageUrl.indexOf('/upload/');
  if (uploadIndex === -1) return null;
  const parts = imageUrl.substring(uploadIndex + 8).split('?')[0].split('/');
  if (parts.length > 1 && /^v\d+$/.test(parts[0])) parts.shift();
  const pathWithExt = parts.join('/');
  const lastDot = pathWithExt.lastIndexOf('.');
  return (lastDot !== -1 ? pathWithExt.substring(0, lastDot) : pathWithExt) || null;
}

/** Resmi Cloudinary'den siler. Başarısızlık (ör. sahibi değilim, eski sahipsiz resim) sessizce günlüğe yazılır. */
export const deleteImageFromCloudinary = async (imageUrl) => {
  const publicId = publicIdFromUrl(imageUrl);
  if (!publicId) return;
  try {
    let result;
    if (typeof window !== 'undefined' && window.netrex?.deleteCloudinaryImage) {
      result = await window.netrex.deleteCloudinaryImage(publicId);
    } else if (API_URL) {
      result = await apiCall('/api/cloudinary-delete', { method: 'POST', body: { public_id: publicId } });
    } else {
      return; // sunucu yok: silinemez
    }
    if (result?.result?.result !== 'ok') console.warn('Cloudinary uyarısı:', result?.result);
  } catch (e) {
    console.warn("Cloudinary'den resim silinemedi:", e?.message || e);
  }
};
