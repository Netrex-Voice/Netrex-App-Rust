/**
 * 🔄 LiveKit Server Pool Manager
 * 
 * Ücretsiz LiveKit hesaplarının dakika sınırını aşmak için
 * birden fazla sunucu arasında otomatik geçiş yapar.
 * 
 * Özellikler:
 * - Firebase'de aktif sunucu takibi
 * - Hata durumunda otomatik rotation
 * - Tüm kullanıcılar aynı sunucuya yönlendirilir
 * 
 * Kullanım:
 * 1. .env.local'da LIVEKIT_SERVERS array olarak tanımlanır
 * 2. Firebase'de /system/livekitPool aktif sunucu indeksini tutar
 * 3. Client bağlantı hatası alınca rotateServer() çağrılır
 */

import { db } from '@/src/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';

// LiveKit sunucu listesi - .env.local'dan parse edilir
// Format: LIVEKIT_SERVERS=url1,key1,secret1|url2,key2,secret2|...
const parseServers = () => {
  const serversStr = process.env.NEXT_PUBLIC_LIVEKIT_SERVERS || '';
  if (!serversStr) {
    // Fallback: Tek sunucu modu (geriye uyumluluk)
    return [{
      url: process.env.NEXT_PUBLIC_LIVEKIT_URL || '',
      apiKey: '', // Server-side only
      apiSecret: '', // Server-side only
    }];
  }
  
  return serversStr.split('|').map(server => {
    const [url] = server.split(',');
    return { url: url.trim() };
  });
};

// Varsayılan sunucu listesi
let servers = [];
let currentServerIndex = 0;
let poolDocRef = null;
let unsubscribe = null;

// Pool durumu
const poolState = {
  initialized: false,
  activeServerIndex: 0,
  lastRotation: null,
  servers: [],
};

/**
 * Pool'u başlat ve Firebase'i dinle
 */
export const initializePool = async () => {
  if (poolState.initialized) return poolState;
  
  try {
    servers = parseServers();
    poolDocRef = doc(db, 'system', 'livekitPool');
    
    // Firebase'den mevcut durumu al
    const poolDoc = await getDoc(poolDocRef);
    
    if (poolDoc.exists()) {
      const data = poolDoc.data();
      poolState.activeServerIndex = data.activeServerIndex || 0;
      poolState.lastRotation = data.lastRotation;
      currentServerIndex = poolState.activeServerIndex;
    } else {
      // İlk kez oluştur
      await setDoc(poolDocRef, {
        activeServerIndex: 0,
        lastRotation: serverTimestamp(),
        serverCount: servers.length,
        createdAt: serverTimestamp(),
      });
    }
    
    // Real-time dinleme başlat
    unsubscribe = onSnapshot(poolDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const newIndex = data.activeServerIndex || 0;
        
        if (newIndex !== currentServerIndex) {
          console.log(`🔄 LiveKit server değişti: ${currentServerIndex} → ${newIndex}`);
          currentServerIndex = newIndex;
          poolState.activeServerIndex = newIndex;
          
          // Event dispatch et (UI güncellemesi için)
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('livekit-server-changed', {
              detail: { serverIndex: newIndex, serverUrl: getActiveServerUrl() }
            }));
          }
        }
      }
    });
    
    poolState.initialized = true;
    poolState.servers = servers;
    console.log(`✅ LiveKit Pool initialized: ${servers.length} servers, active: ${currentServerIndex}`);
    
    return poolState;
  } catch (error) {
    console.error('❌ LiveKit Pool initialization failed:', error);
    // Fallback: İlk sunucuyu kullan
    poolState.initialized = true;
    return poolState;
  }
};

/**
 * Aktif sunucu URL'sini al
 */
export const getActiveServerUrl = () => {
  if (servers.length === 0) {
    servers = parseServers();
  }
  
  const index = Math.min(currentServerIndex, servers.length - 1);
  return servers[index]?.url || process.env.NEXT_PUBLIC_LIVEKIT_URL || '';
};

/**
 * Aktif sunucu indeksini al
 */
export const getActiveServerIndex = () => {
  return currentServerIndex;
};

/**
 * Sonraki sunucuya geç (hata durumunda çağrılır)
 * @param {string} errorReason - Hata nedeni (log için)
 * @returns {Promise<{success: boolean, newIndex: number, newUrl: string}>}
 */
export const rotateServer = async (errorReason = 'unknown') => {
  if (servers.length <= 1) {
    console.warn('⚠️ Sadece 1 LiveKit sunucusu var, rotation yapılamaz');
    return { success: false, newIndex: 0, newUrl: getActiveServerUrl() };
  }
  
  try {
    const newIndex = (currentServerIndex + 1) % servers.length;
    
    // Firebase'i güncelle (tüm kullanıcılar görsün)
    if (poolDocRef) {
      await updateDoc(poolDocRef, {
        activeServerIndex: newIndex,
        lastRotation: serverTimestamp(),
        lastError: errorReason,
        lastErrorTime: serverTimestamp(),
      });
    }
    
    currentServerIndex = newIndex;
    poolState.activeServerIndex = newIndex;
    
    console.log(`🔄 LiveKit server rotated: ${newIndex} (reason: ${errorReason})`);
    console.log(`   New URL: ${servers[newIndex]?.url}`);
    
    return {
      success: true,
      newIndex,
      newUrl: servers[newIndex]?.url || '',
    };
  } catch (error) {
    console.error('❌ Server rotation failed:', error);
    return { success: false, newIndex: currentServerIndex, newUrl: getActiveServerUrl() };
  }
};

/**
 * Bağlantı hatasını kontrol et ve gerekirse rotation yap
 * @param {Error} error - LiveKit connection error
 * @returns {Promise<boolean>} - Rotation yapıldı mı?
 */
export const handleConnectionError = async (error) => {
  const errorMessage = error?.message || '';
  
  // Dakika sınırı aşıldı hataları
  const quotaErrors = [
    'quota exceeded',
    'rate limit',
    'limit reached',
    'connection limit',
    'participant limit',
    'minutes exceeded',
    'free tier',
    '429',
    '503',
  ];
  
  const isQuotaError = quotaErrors.some(q => 
    errorMessage.toLowerCase().includes(q.toLowerCase())
  );
  
  if (isQuotaError) {
    console.warn('⚠️ LiveKit quota hatası algılandı, sunucu değiştiriliyor...');
    const result = await rotateServer(errorMessage);
    return result.success;
  }
  
  // Bağlantı hataları (sunucu down olabilir)
  const connectionErrors = [
    'connection failed',
    'could not connect',
    'websocket error',
    'timeout',
    'network error',
  ];
  
  const isConnectionError = connectionErrors.some(c =>
    errorMessage.toLowerCase().includes(c.toLowerCase())
  );
  
  if (isConnectionError) {
    console.warn('⚠️ LiveKit bağlantı hatası algılandı, sunucu değiştiriliyor...');
    const result = await rotateServer(errorMessage);
    return result.success;
  }
  
  return false;
};

/**
 * Pool'u temizle (cleanup)
 */
export const cleanupPool = () => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  poolState.initialized = false;
};

/**
 * Sunucu sayısını al
 */
export const getServerCount = () => {
  if (servers.length === 0) {
    servers = parseServers();
  }
  return servers.length;
};

/**
 * Pool durumunu al
 */
export const getPoolState = () => ({
  ...poolState,
  currentServerIndex,
  currentServerUrl: getActiveServerUrl(),
  serverCount: servers.length,
});

export default {
  initializePool,
  getActiveServerUrl,
  getActiveServerIndex,
  rotateServer,
  handleConnectionError,
  cleanupPool,
  getServerCount,
  getPoolState,
};
