import { create } from "zustand";
import { toast } from "@/src/utils/toast";
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInAnonymously,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  signOut,
  deleteUser,
  updateProfile,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/src/lib/firebase";
import { useServerStore } from "@/src/store/serverStore";
import { resetAvatarStore } from "@/src/store/avatarStore";

export const useAuthStore = create((set) => ({
  user: null,
  isAuth: false,
  isLoading: true,

  initializeAuth: () => {
    // 🌐 Web: Ensure browser persistence and handle redirect result
    if (typeof window !== "undefined") {
      setPersistence(auth, browserLocalPersistence).catch((err) => {
        console.warn("Auth persistence warning:", err);
      });

      getRedirectResult(auth)
        .then((result) => {
          if (result?.user) {
            toast.success("Giriş başarılı!");
          }
        })
        .catch((err) => {
          if (err.code === "auth/missing-initial-state" || err.code === "auth/popup-closed-by-user") return;
          console.warn("Redirect result error:", err);
        });
    }

    if (typeof window !== "undefined" && window.netrex?.onOAuthSuccess) {
      window.netrex.onOAuthSuccess(async (token) => {
        try {
          const credential = GoogleAuthProvider.credential(token);
          await signInWithCredential(auth, credential);
          toast.success("Google ile giriş başarılı!");
        } catch (error) {
          console.error("OAuth login error:", error);
          toast.error("Google ile giriş başarısız: " + error.message);
        }
      });
    }

    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        resetAvatarStore(); // önceki oturumun fotoğraf dinleyicileri/önbelleği sızmasın
        set({ user: null, isAuth: false, isLoading: false });
        return;
      }

      try {
        const userRef = doc(db, "users", firebaseUser.uid);

        // ── 1. Önce Firestore'daki mevcut dokümanı oku ──────────────
        const existingDoc = await getDoc(userRef);
        const existingData = existingDoc.exists() ? existingDoc.data() : null;

        // ── 2. photoURL kaynağı ─────────────────────────────────────
        // Google fotoğrafı: Auth'un üst düzey photoURL'si özel resim yüklenince updateProfile ile ezilir; Google'ın
        // kendi adresi YALNIZCA providerData'da kalır, bu yüzden oradan okunur.
        const googlePhoto =
          firebaseUser.providerData?.find((p) => p.providerId === "google.com")?.photoURL || null;
        const existingPhoto = existingData?.photoURL || null; // null / "" / yok → null
        const prevGooglePhoto = existingData?.googlePhotoURL || null;

        // Özel resim = Firestore'daki fotoğraf var VE Google'ınkinden farklı. Bu durumda dokunma.
        // Aksi halde (hiç yok, null, ya da eski Google adresi) güncel Google fotoğrafını kullan.
        // ⚠️ Eskiden Google fotoğrafı Firestore'a HİÇ yazılmıyordu: kullanıcı kendi ekranında görüyor (Auth'tan),
        // diğer herkes Firestore'dan okuduğu için (üye listesi, DM, arkadaşlar, arama) göremiyordu. Ayrıca resmi
        // silip Google'a dönemeyen eski kayıtlar null'da kalıyordu; burada kendiliğinden iyileşir.
        const usingCustom =
          !!existingPhoto && existingPhoto !== prevGooglePhoto && existingPhoto !== googlePhoto;
        const photoURL = usingCustom
          ? existingPhoto
          : googlePhoto || existingPhoto || (!existingData ? firebaseUser.photoURL : null) || null;

        // ── 3. displayName - Firestore'daki güncelse onu kullan ─────
        const displayName =
          existingData?.displayName && existingData.displayName !== "User"
            ? existingData.displayName
            : firebaseUser.displayName || "User";

        // MIGRATION: Eğer kullanıcı adı yoksa, otomatik isimden türetilmiş rastgele unique bir username bas
        let generatedUsername = existingData?.username || null;
        let needsUsernameUpdate = false;
        
        if (!generatedUsername) {
          const baseName = displayName.toLowerCase().replace(/[^a-z0-9]/g, '');
          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          generatedUsername = `${baseName || "user"}_${randomSuffix}`;
          needsUsernameUpdate = true;
        }

        // ── 4. State'e Firestore'dan gelen photoURL'yi yaz ──────────
        // ✅ FIX: Önce UI state'i hemen set et - setDoc'u bekleme
        // Eski: await setDoc(...) → sonra set({ isAuth: true }) → splash 1-2sn daha açık kalıyor
        // Yeni: set() anında, setDoc arka planda - startup CPU baskısını azaltır
        const user = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName,
          username: generatedUsername,
          photoURL,
          googlePhotoURL: googlePhoto, // özel resim kaldırılınca bu adrese dönülür
          isAnonymous: firebaseUser.isAnonymous,
          emailVerified: firebaseUser.emailVerified,
        };

        set({ user, isAuth: true, isLoading: false });

        // Firestore yazımını arka planda yap (non-blocking)
        // ✅ lastSeen KALDIRILDI - usePresence zaten 3sn sonra yazıyor (duplicate write önlendi)
        const syncData = {
          uid: firebaseUser.uid,
          displayName,
          email: firebaseUser.email,
        };

        if (needsUsernameUpdate) {
          syncData.username = generatedUsername;
        }

        // Fotoğrafı herkesin okuduğu kaynağa (Firestore) yaz; yalnızca değiştiyse (gereksiz yazma olmasın)
        if (photoURL !== existingPhoto) syncData.photoURL = photoURL;
        if (googlePhoto !== prevGooglePhoto) syncData.googlePhotoURL = googlePhoto;

        setDoc(
          userRef,
          syncData,
          { merge: true },
        ).catch(err => {
          console.warn("Background user sync failed:", err);
        });
      } catch (error) {
        console.error("Error syncing user to Firestore:", error);
        await signOut(auth).catch(() => {});
        set({ user: null, isAuth: false, isLoading: false });
        toast.error("Oturum süresi doldu. Lütfen tekrar giriş yapın.");
      }
    });
  },

  loginWithGoogleToken: async (idToken) => {
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
    } catch (error) {
      console.error("Google Token Login Error:", error);
      toast.error("Giriş yapılamadı: " + error.message);
    }
  },

  // 🌐 Web Google Login — signInWithPopup (Electron'da kullanılmaz)
  loginWithGooglePopup: async () => {
    try {
      if (typeof window !== "undefined") {
        await setPersistence(auth, browserLocalPersistence).catch(() => {});
      }
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      toast.success("Google ile giriş başarılı!");
    } catch (error) {
      // Kullanıcı popup'ı kapattıysa veya missing initial state oluştuysa sessizce geç
      if (error.code === 'auth/popup-closed-by-user') return;
      if (error.code === 'auth/cancelled-popup-request') return;
      if (error.code === 'auth/missing-initial-state') return;

      // Popup engellendiyse redirect'e yönlendir
      if (error.code === 'auth/popup-blocked') {
        try {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr) {
          console.error("Redirect auth error:", redirectErr);
        }
      }

      console.error("Google Popup Login Error:", error);
      toast.error("Google ile giriş başarısız: " + (error.message || "Lütfen tekrar deneyin."));
    }
  },

  loginAnonymously: async (username) => {
    try {
      const result = await signInAnonymously(auth);
      if (username) {
        await updateProfile(result.user, { displayName: username });

        try {
          const cleanName = (username || "user").toLowerCase().replace(/[^a-z0-9]/g, '');
          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          const finalUsername = `${cleanName}_${randomSuffix}`;

          await setDoc(
            doc(db, "users", result.user.uid),
            {
              uid: result.user.uid,
              displayName: username,
              username: finalUsername,
              email: result.user.email,
              photoURL: null, // anonim kullanıcı → başlangıçta null
              lastSeen: serverTimestamp(),
            },
            { merge: true },
          );

          const generatedUserObj = {
            uid: result.user.uid,
            email: result.user.email,
            displayName: username,
            username: finalUsername,
            photoURL: null,
            isAnonymous: true,
            emailVerified: false,
          };
          set({ user: generatedUserObj, isAuth: true });
        } catch (firestoreError) {
          console.error("Error saving anonymous user:", firestoreError);
          toast.error("Kullanıcı oluşturulamadı. Lütfen tekrar deneyin.");
          await deleteUser(result.user).catch(() => {});
        }
      } else {
        set({ user: result.user, isAuth: true });
      }
    } catch (error) {
      console.error("Anon Signin Error:", error);
    }
  },

  logout: async () => {
    try {
      try {
        const { useSettingsStore } = require("./settingsStore");
        useSettingsStore.getState().setSettingsOpen(false);
      } catch (e) {
        console.warn("Settings modal kapatılamadı:", e);
      }

      const currentUser = auth.currentUser;

      if (currentUser) {
        const { servers } = useServerStore.getState();

        if (currentUser.isAnonymous) {
          if (servers && servers.length > 0) {
            const deletePromises = servers.map((server) =>
              deleteDoc(
                doc(db, "servers", server.id, "members", currentUser.uid),
              ).catch((err) =>
                console.warn(`Üyelik silme hatası (${server.id}):`, err),
              ),
            );
            await Promise.allSettled(deletePromises);
          }

          try {
            await deleteDoc(doc(db, "users", currentUser.uid));
          } catch (err) {
            console.warn("Kullanıcı dökümanı silinemedi:", err);
          }

          try {
            await deleteUser(currentUser);
          } catch (err) {
            console.error("Auth kullanıcısı silinemedi:", err);
            await signOut(auth).catch(() => {});
          }
        } else {
          try {
            if (servers && servers.length > 0) {
              const updatePromises = servers.map((server) =>
                updateDoc(
                  doc(db, "servers", server.id, "members", currentUser.uid),
                  { presence: "offline", lastSeen: serverTimestamp() },
                ).catch(() => {}),
              );
              await Promise.allSettled(updatePromises);
            }

            await updateDoc(doc(db, "users", currentUser.uid), {
              presence: "offline",
              lastSeen: serverTimestamp(),
            }).catch(() => {});
          } catch (e) {
            console.warn("Offline durumu ayarlanamadı:", e);
          }

          await signOut(auth);
        }
      }
    } catch (error) {
      console.error("Logout Genel Hatası:", error);
      await signOut(auth).catch(() => {});
    } finally {
      try {
        useServerStore.getState().reset();
        set({ user: null, isAuth: false });
      } catch (e) {
        console.warn("Store reset hatası:", e);
      }
    }
  },
}));
