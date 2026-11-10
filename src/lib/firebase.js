import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { initializeFirestore, getFirestore, memoryLocalCache, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

// Singleton pattern to avoid re-initialization errors in Next.js hot-reload
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// ✅ PERFORMANCE FIX: Memory-only cache - IndexedDB persistence KAPALI
// Varsayılan getFirestore() her onSnapshot update'inde IndexedDB'ye yazıyordu
// → Sürekli disk I/O → CPU spike (idle'da bile %10-17)
// memoryLocalCache ile: sıfır disk yazması, sıfır IndexedDB overhead
let db;
try {
  db = initializeFirestore(app, {
    localCache: memoryLocalCache(),
    experimentalForceLongPolling: false,
    experimentalAutoDetectLongPolling: false,
  });
} catch (e) {
  // Hot-reload durumunda Firestore zaten initialize edilmiş olabilir
  db = getFirestore(app);
}

const storage = getStorage(app);
const rtdb = getDatabase(app);

// Otomatik testler (e2e/): yerel Firebase emülatörlerine bağlan. Yalnızca derleme zamanında
// NEXT_PUBLIC_USE_EMULATORS=1 verilirse çalışır; üretim derlemesinde bu değişken YOKTUR, hiçbir etkisi olmaz.
if (process.env.NEXT_PUBLIC_USE_EMULATORS === "1") {
  try {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectDatabaseEmulator(rtdb, "127.0.0.1", 9000);
  } catch (_) {
    // Hot-reload: zaten bağlanmış
  }
}

export { auth, db, storage, rtdb };
