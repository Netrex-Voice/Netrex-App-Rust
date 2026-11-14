// ============================================
// 🌐 PLATFORM BRIDGE — Masaüstü ↔ Web soyutlaması
// ============================================
//
// Uygulama kodu her zaman bu modülü kullanır; altta masaüstü (Tauri/Rust, `window.netrex`) mi yoksa
// tarayıcı mı olduğunu bilmesine gerek yoktur.
//
//   Masaüstü:  window.netrex.*            (src/lib/tauriBridge.js)
//   Web:       Netrex sunucusu (Vercel)   (src/lib/netrexApi.js)
//
// ============================================

import { API_URL, apiCall } from '@/src/lib/netrexApi';

/**
 * Masaüstü uygulaması mı? (Ad tarihsel: köprü artık Tauri/Rust.)
 */
export function isElectron() {
  return typeof window !== 'undefined' && !!window.netrex;
}

// Web'de sunucu adresi tanımsızsa eski göreli /api yoluna düşülür (yalnızca geliştirme)
async function legacyFetch(path, init) {
  const res = await fetch(path, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

/**
 * LiveKit erişim token'ı. `serverId`: odanın ait olduğu Netrex sunucusu (DM aramasında null); sunucu, kullanıcının
 * o odaya girme yetkisini bununla doğrular.
 */
async function fetchLiveKitToken(room, identity, displayName, serverIndex = 0, serverId = null) {
  if (isElectron()) {
    return window.netrex.getLiveKitToken(room, identity, displayName, serverIndex, serverId);
  }
  const body = { room, identity, displayName, serverIndex, serverId };
  if (API_URL) return (await apiCall('/api/livekit-token', { method: 'POST', body })).token;
  return (await legacyFetch('/api/livekit-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })).token;
}

/** Seçili LiveKit sunucusunun adresi ve havuz bilgisi: { url, serverCount, serverIndex, poolMode } */
async function fetchLiveKitServerInfo(serverIndex = 0) {
  if (isElectron()) {
    return window.netrex.getLiveKitServerInfo(serverIndex);
  }
  const path = `/api/livekit-server-info?serverIndex=${encodeURIComponent(serverIndex)}`;
  return API_URL ? apiCall(path) : legacyFetch(path);
}

// ------------------------------------------------------------------
// Odaya girişi hızlandırma: sunucu bilgisi ve token bellek içinde önbelleğe alınır (aynı istek devam ediyorsa paylaşılır).
// Fare bir sesli odanın üstüne gelince `prefetchJoin` (src/lib/joinPrefetch.js) bunları ÖNCEDEN ısıtır; tıklayınca
// 2 ağ turu beklenmez. Hata ÖNBELLEĞE ALINMAZ. Token 6 sa geçerlidir; önbellek ömrü kısa tutulur.
// ------------------------------------------------------------------
const INFO_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_MS = 15 * 60 * 1000;
const infoCache = new Map();
const tokenCache = new Map();

function memo(map, key, ttl, loader) {
  const now = Date.now();
  const hit = map.get(key);
  if (hit && now - hit.at < ttl) return hit.p;
  // Süresi dolan girdileri at (üstüne gelinen her oda için bir girdi birikmesin)
  for (const [k, v] of map) if (now - v.at >= ttl) map.delete(k);
  const p = loader();
  map.set(key, { p, at: now });
  p.catch(() => map.delete(key));
  return p;
}

export function getLiveKitToken(room, identity, displayName, serverIndex = 0, serverId = null) {
  return memo(tokenCache, `${room}|${identity}|${displayName}|${serverIndex}|${serverId || ''}`, TOKEN_TTL_MS,
    () => fetchLiveKitToken(room, identity, displayName, serverIndex, serverId));
}

export function getLiveKitServerInfo(serverIndex = 0) {
  return memo(infoCache, String(serverIndex), INFO_TTL_MS, () => fetchLiveKitServerInfo(serverIndex));
}

/** Harici bağlantıyı sistem tarayıcısında açar. */
export function openExternalLink(url) {
  if (isElectron()) {
    window.netrex.openExternalLink(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/** Ayar kaydet (masaüstü: Rust ayar deposu, web: localStorage). */
export async function setSetting(key, value) {
  if (isElectron()) {
    return window.netrex.setSetting(key, value);
  }
  try {
    localStorage.setItem(`netrex_setting_${key}`, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Ayar oku (masaüstü: Rust ayar deposu, web: localStorage). */
export async function getSetting(key) {
  if (isElectron()) {
    return window.netrex.getSetting(key);
  }
  try {
    const val = localStorage.getItem(`netrex_setting_${key}`);
    return val !== null ? JSON.parse(val) : undefined;
  } catch {
    return undefined;
  }
}

/** Pencereyi öne getir. */
export function focusWindow() {
  if (isElectron()) {
    window.netrex.focusWindow();
  } else {
    window.focus();
  }
}

const platform = {
  isElectron,
  getLiveKitToken,
  getLiveKitServerInfo,
  openExternalLink,
  setSetting,
  getSetting,
  focusWindow,
};

export default platform;
