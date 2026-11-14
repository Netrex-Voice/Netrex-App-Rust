// Netrex sunucusu (Vercel, `server/` klasörü) ile konuşan tek yer: LiveKit token, Cloudinary imzalı yükleme ve silme.
// Secret'lar yalnızca sunucuda durur. Adres derleme zamanında `NEXT_PUBLIC_NETREX_API_URL` ile verilir; TANIMSIZSA
// çağıranlar eski yerel yola düşer (masaüstü: Rust; web: göreli /api).

export const API_URL = (process.env.NEXT_PUBLIC_NETREX_API_URL || "").replace(/\/+$/, "");

/** Firebase girişinin güncel ID token'ı (süresi dolmuşsa SDK kendiliğinden yeniler). */
async function firebaseIdToken() {
  const { auth } = await import("@/src/lib/firebase");
  const user = auth.currentUser;
  if (!user) throw new Error("Giriş yapılmamış");
  return user.getIdToken();
}

/** Sunucuya kimlikli istek; hata gövdesindeki mesajı fırlatır. */
export async function apiCall(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await firebaseIdToken()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Sunucu hatası (${res.status})`);
  return data;
}
