// ============================================
// 🌐 PLATFORM BRIDGE — Electron ↔ Web Abstraction
// ============================================
//
// Bu modül, Electron IPC ve Web API route'ları arasında
// şeffaf bir köprü sağlar. Uygulama kodu her zaman
// `platform.*` kullanır — altta Electron mu yoksa
// Web mi olduğunu bilmesine gerek yok.
//
// Electron'da:  window.netrex.getLiveKitToken(...)
// Web'de:       fetch('/api/livekit-token', ...)
//
// ============================================

/**
 * Platform'un Electron olup olmadığını kontrol eder
 */
export function isElectron() {
  return typeof window !== 'undefined' && !!window.netrex;
}

/**
 * LiveKit access token üretir
 * @param {string} room - Oda adı
 * @param {string} identity - Kullanıcı kimliği
 * @param {string} displayName - Görünen isim
 * @param {number} serverIndex - Sunucu index'i (pool mode)
 * @returns {Promise<string>} JWT token
 */
export async function getLiveKitToken(room, identity, displayName, serverIndex = 0) {
  if (isElectron()) {
    return window.netrex.getLiveKitToken(room, identity, displayName, serverIndex);
  }
  
  const res = await fetch('/api/livekit-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room, identity, displayName, serverIndex }),
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Token request failed' }));
    throw new Error(err.error || 'Token request failed');
  }
  
  const data = await res.json();
  return data.token;
}

/**
 * LiveKit sunucu bilgisini getirir
 * @param {number} serverIndex - Sunucu index'i
 * @returns {Promise<{url: string, serverCount: number, serverIndex: number, poolMode: boolean}>}
 */
export async function getLiveKitServerInfo(serverIndex = 0) {
  if (isElectron()) {
    return window.netrex.getLiveKitServerInfo(serverIndex);
  }
  
  const res = await fetch(`/api/livekit-server-info?serverIndex=${serverIndex}`);
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Server info request failed' }));
    throw new Error(err.error || 'Server info request failed');
  }
  
  return res.json();
}

/**
 * Harici bağlantı açar
 * Electron: shell.openExternal
 * Web: window.open
 */
export function openExternalLink(url) {
  if (isElectron()) {
    window.netrex.openExternalLink(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Ayar kaydet
 * Electron: electron-store
 * Web: localStorage
 */
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

/**
 * Ayar oku
 * Electron: electron-store
 * Web: localStorage
 */
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

/**
 * Pencereyi odakla
 * Electron: BrowserWindow.focus()
 * Web: window.focus()
 */
export function focusWindow() {
  if (isElectron()) {
    window.netrex.focusWindow();
  } else {
    window.focus();
  }
}

/**
 * Admin kontrolü
 * Electron: ipcMain handler
 * Web: env var karşılaştırması
 */
export async function isAdmin(userUid) {
  if (isElectron()) {
    return window.netrex.isAdmin(userUid);
  }
  const adminUid = process.env.NEXT_PUBLIC_ADMIN_UID;
  return adminUid && userUid === adminUid;
}

/**
 * Platform bridge'i default export olarak da erişilebilir
 */
const platform = {
  isElectron,
  getLiveKitToken,
  getLiveKitServerInfo,
  openExternalLink,
  setSetting,
  getSetting,
  focusWindow,
  isAdmin,
};

export default platform;
