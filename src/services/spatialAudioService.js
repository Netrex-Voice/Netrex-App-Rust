import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useSpatialAudioStore } from '@/src/store/spatialAudioStore';

/**
 * 🎧 Spatial Audio Firebase Sync Service
 * 
 * Uygulama kapanırken pozisyon değişikliklerini Firebase'e yedekler.
 * Minimum yazma stratejisi:
 *   - Açılışta Local varsa → Firebase'e bakma
 *   - Açılışta Local yoksa → Firebase'den çek, Local'e kaydet
 *   - Kapanışta → Diff varsa sadece değişenleri yaz
 */

/**
 * Firebase'den spatial pozisyonları yükle (ilk açılışta, local yoksa)
 * @param {string} userId - Kullanıcı ID
 * @param {string} channelId - Kanal ID
 */
export async function loadSpatialFromFirebase(userId, channelId) {
  const store = useSpatialAudioStore.getState();
  const localPositions = store.positions[channelId];

  // Local'de veri varsa Firebase'e bakma
  if (localPositions && Object.keys(localPositions).length > 0) {
    if (process.env.NODE_ENV === 'development') {
      console.log('🎧 Spatial: Local pozisyonlar mevcut, Firebase atlanıyor');
    }
    return;
  }

  try {
    const docRef = doc(db, 'users', userId, 'spatialSettings', 'positions');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const channelPositions = data[channelId] || {};

      if (Object.keys(channelPositions).length > 0) {
        store.loadFromFirebase(channelId, channelPositions);
        if (process.env.NODE_ENV === 'development') {
          console.log(`🎧 Spatial: Firebase'den ${Object.keys(channelPositions).length} pozisyon yüklendi`);
        }
      }
    }
  } catch (error) {
    console.warn('🎧 Spatial: Firebase yükleme hatası:', error);
  }
}

/**
 * Spatial pozisyonları Firebase'e yedekle (uygulama kapanırken)
 * Sadece değişen pozisyonlar yazılır
 * @param {string} userId - Kullanıcı ID
 * @param {string} channelId - Kanal ID
 */
export async function saveSpatialToFirebase(userId, channelId) {
  const store = useSpatialAudioStore.getState();

  // Dirty değilse yazma
  if (!store._isDirty) {
    if (process.env.NODE_ENV === 'development') {
      console.log('🎧 Spatial: Değişiklik yok, Firebase yazma atlanıyor');
    }
    return;
  }

  const diff = store.getFirebaseDiff(channelId);
  if (!diff) {
    if (process.env.NODE_ENV === 'development') {
      console.log('🎧 Spatial: Diff yok, Firebase yazma atlanıyor');
    }
    return;
  }

  try {
    const docRef = doc(db, 'users', userId, 'spatialSettings', 'positions');
    await setDoc(docRef, {
      [channelId]: diff,
      lastUpdated: serverTimestamp()
    }, { merge: true });

    store.clearDirty();

    if (process.env.NODE_ENV === 'development') {
      console.log(`🎧 Spatial: ${Object.keys(diff).length} pozisyon Firebase'e yazıldı`);
    }
  } catch (error) {
    console.warn('🎧 Spatial: Firebase yazma hatası:', error);
  }
}

/**
 * Spatial ayarları Firebase'e kaydet (enabled, snapToGrid)
 * @param {string} userId - Kullanıcı ID
 */
export async function saveSpatialSettingsToFirebase(userId) {
  const store = useSpatialAudioStore.getState();

  try {
    const docRef = doc(db, 'users', userId, 'spatialSettings', 'config');
    await setDoc(docRef, {
      enabled: store.enabled,
      snapToGrid: store.snapToGrid,
      gridSize: store.gridSize,
      lastUpdated: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn('🎧 Spatial: Ayar kaydetme hatası:', error);
  }
}
