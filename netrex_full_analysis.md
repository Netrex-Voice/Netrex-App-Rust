# 🔬 Netrex v8.0.0 — Kapsamlı Kod Analizi & Bug Raporu (Genişletilmiş v3)

> **Tarih:** 11 Nisan 2026  
> **Kapsam:** Tüm store'lar, hook'lar, bileşenler, Electron main/preload, servisler, utils  
> **Analiz Edilen Dosya Sayısı:** ~100+ dosya, ~25.000+ satır kod  
> **Geçişler:** v1 (Store'lar, hook'lar), v2 (BottomControls, StageManager, UserCard, windowManager, ipcHandlers), v3 (ActiveRoom, RoomList, ServerSidebar, UserProfileModal, PipGrid, FriendItem, RailItem)

---

## 📊 Genel Değerlendirme

| Kategori | Puan | Açıklama |
|----------|------|----------|
| **Mimari** | ⭐⭐⭐⭐ | Zustand store ayrımı, lazy loading, ref-based optimizasyonlar çok iyi |
| **Performans** | ⭐⭐⭐ | İyi optimizasyonlar var ama ciddi sızıntılar ve gereksiz render'lar mevcut |
| **Güvenlik** | ⭐⭐½ | Path traversal koruması zayıf, CSP `unsafe-eval` içeriyor |
| **Edge Cases** | ⭐⭐½ | Birçok edge case handle edilmemiş — aşağıda detaylandırılıyor |
| **Hata Yönetimi** | ⭐⭐⭐ | Çoğu yerde try/catch var ama bazı kritik yerlerde eksik |
| **Kod Kalitesi** | ⭐⭐⭐⭐ | Temiz, tutarlı, iyi yorumlanmış |

---

## 🔴 KRİTİK BUGLAR (Acil Düzeltilmesi Gereken)

### BUG-001: Anonim Kullanıcı Username Çakışması
**Dosya:** [authStore.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/store/authStore.js#L138-L178)  
**Ciddiyet:** 🔴 Yüksek

```javascript
// Satır 150 ve 162'de username İKİ KEZ farklı random ile üretiliyor!
username: `${(username || "user").toLowerCase()...}_${Math.floor(1000 + Math.random() * 9000)}`,
// Satır 150 → Firestore'a yazılan
// Satır 162 → State'e yazılan
// İKİSİ FARKLI RANDOM! → UI bir username gösterir, DB başka bir username tutar
```

**Etki:** Anonim kullanıcının gördüğü username ile Firestore'daki username farklı olacak. Kullanıcıyı ararken bulunamaz.

**Çözüm:** Random username'i bir kez üretip değişkende saklayıp iki yerde de kullanmak.

---

### BUG-002: `friendStore` — User Arama O(n) Full Collection Scan
**Dosya:** [friendStore.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/store/friendStore.js#L216-L273)  
**Ciddiyet:** 🔴 Yüksek (Ölçek arttıkça)

```javascript
// Satır 231-232: TÜM KULLANICILARI ÇEKİYOR!
const usersRef = collection(db, "users");
const snapshot = await getDocs(usersRef);
```

**Etki:** 10.000 kullanıcı olduğunda her arama tüm dökümanları indirecek → Firestore kotası tükenecek, UI donacak.

**Çözüm:** Firestore'da prefix search yapılabilir (`where >= && <=`) veya Algolia/Typesense gibi bir search servisi entegre edilmeli. En azından `limit(50)` eklenmeli.

---

### BUG-003: `dmStore.clearConversation` — 500+ Mesaj Batch Limiti
**Dosya:** [dmStore.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/store/dmStore.js#L629-L664)  
**Ciddiyet:** 🔴 Yüksek

```javascript
// Satır 642: Firestore batch limiti 500 döküman!
const batch = writeBatch(db);
snapshot.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
});
await batch.commit(); // ← 500'den fazla mesaj varsa HATA VERECEK!
```

**Etki:** 500'den fazla mesajı olan DM sohbetlerinde "Sohbeti Temizle" çalışmayacak ve hata verecek.

**Çözüm:** Batch'leri 500'erli gruplara bölüp sırayla commit etmek.

---

### BUG-004: `chatStore.sendMessage` — Message ID Collision Riski
**Dosya:** [chatStore.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/store/chatStore.js#L363-L364)  
**Ciddiyet:** 🟠 Orta-Yüksek

```javascript
id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
```

**Etki:** Aynı milisaniyede iki kullanıcı mesaj gönderirse ve `Math.random()` aynı seed üretirse (çok düşük ihtimal ama mümkün), mesaj ID çakışması → mesaj kaybı. Ayrıca `substr` deprecated, `substring` kullanılmalı.

**Çözüm:** `crypto.randomUUID()` veya Firestore'un auto-ID'sini `addDoc` ile kullanmak.

---

### BUG-005: `windowManager` — Static Server Path Traversal
**Dosya:** [windowManager.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/electron/managers/windowManager.js#L60-L67)  
**Ciddiyet:** 🔴 Yüksek (Güvenlik)

```javascript
const filePath = path.join(rootDir, urlPath);
// Güvenlik: rootDir dışına çıkmayı engelle
if (!filePath.startsWith(rootDir)) { ... }
```

**Sorun:** `path.join()` ile `..` segmentleri resolve edilir, ama **Windows'ta** `path.join('C:\\app\\out', '../../../etc/passwd')` → `C:\etc\passwd` oluyor ve `startsWith('C:\\app\\out')` kontrolü geçmiyor. AMA: `urlPath` zaten `decodeURIComponent` ile decode ediliyor ve path.join öncesinde normalleştirme yapılmıyor. `%2e%2e%2f` gibi encoded path traversal denenebilir.

**Çözüm:** `path.resolve` ile normalize edip sonra `startsWith` kontrolü yapmak:
```javascript
const filePath = path.resolve(rootDir, '.' + urlPath);
if (!filePath.startsWith(path.resolve(rootDir))) { ... }
```

---

## 🟠 ÖNEMLİ SORUNLAR

### BUG-006: `serverStore.selectServer` — Race Condition
**Dosya:** [serverStore.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/store/serverStore.js#L85-L266)  
**Ciddiyet:** 🟠 Orta

Sunucular arasında hızlıca geçiş yapıldığında:
1. Server A seçilir → listeners başlatılır → `getDoc` devam ediyor
2. Server B seçilir → A'nın listener'ları temizlenir → B'ninkiler başlatılır
3. A'nın `getDoc` cevabı gelir → `set({ currentServer: serverA })` → **YANLİŞ SUNUCU GÖSTERİLİR!**

**Çözüm:** Request ID veya AbortController ile eski istekleri iptal etmek.

---

### BUG-007: `useVoiceProcessor` — Settings Değişikliğinde Audio Graph Rebuild Yok
**Dosya:** [useVoiceProcessor.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/hooks/useVoiceProcessor.js#L536-L543)  
**Ciddiyet:** 🟠 Orta

Kullanıcı "Krisp" → "Standard" moduna geçince `noiseSettingsRef` güncellenir AMA audio graph REBUILD OLMAZ! Yeni mod ancak odadan çıkıp tekrar girince aktif olur.

---

### BUG-008: `chatStore.editMessage` — `MESSAGE_SEQUENCE_THRESHOLD` Karışıklığı
**Dosya:** [chatStore.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/store/chatStore.js#L513-L517)  
**Ciddiyet:** 🟠 Orta

`MESSAGE_SEQUENCE_THRESHOLD` (5 dakika) hem "mesaj gruplama" hem de "düzenleme süresi" için kullanılıyor. Bunlar farklı kavramlar, ayrı sabitler olmalı.

---

### BUG-009: `speakingStore` — Sınırsız Büyüme
**Dosya:** [speakingStore.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/store/speakingStore.js)  
**Ciddiyet:** 🟡 Düşük-Orta

`setSpeaking(userId, false)` → key hala objede kalıyor (value: false). Odadan çıkan katılımcıların entry'leri hiç temizlenmiyor. Uzun oturumlarda yüzlerce stale userId birikebilir.

---

### BUG-010: `DMConversation.blockUser` — Yanlış Parametre  
**Dosya:** [DMConversation.jsx](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/friends/DMConversation.jsx#L576-L579)  
**Ciddiyet:** 🟠 Orta

`blockUser(activeConversation.id)` → conversation ID gönderiliyor ama friendStore.blockUser friendship ID bekliyor! Engelleme çalışmaz.

---

### BUG-011: `BottomControls` — Metadata Effect Cleanup Return Yanlış Yerde
**Dosya:** [BottomControls.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/active-room/BottomControls.js#L297-L301)  
**Ciddiyet:** 🟠 Orta

Cleanup return `useEffect`'in en dış scope'u yerine `setTimeout` callback'inin içinde. Component unmount olduğunda timeout temizlenmez → ghost metadata güncellemesi.

---

### BUG-012: `BottomControls.toggleCamera` — Dependency Stale Closure
**Dosya:** [BottomControls.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/active-room/BottomControls.js#L781)  
**Ciddiyet:** 🟠 Orta

`videoCodec` dependency array'de yok ama callback içinde kullanılıyor! Codec değiştirip kamerayı açarsa, eski codec ile publish eder.

---

### BUG-013: `watchPartyService` — Track ID Collision
**Dosya:** [watchPartyService.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/services/watchPartyService.js#L14-L15)  
**Ciddiyet:** 🟡 Düşük-Orta

Aynı message ID collision riski (BUG-004). İki kullanıcı aynı anda şarkı eklerse aynı ID oluşabilir.

---

### BUG-014: `BottomControls` — Yanlış RoomEvent Kullanımı  
**Dosya:** [BottomControls.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/active-room/BottomControls.js#L353-L354)  
**Ciddiyet:** 🟡 Düşük-Orta

`localParticipant.on(RoomEvent.TrackPublished, ...)` — localParticipant'ta `ParticipantEvent.TrackPublished` olmalı. Şu an LiveKit internal forwarding sayesinde çalışıyor olabilir ama garanti değil.

---

### BUG-015: `DeafenManager` — MutationObserver Performans Bombası ⚠️ **YENİ**
**Dosya:** [ActiveRoom.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/ActiveRoom.js#L117-L130)  
**Ciddiyet:** 🟠 Orta-Yüksek

```javascript
function DeafenManager({ isDeafened, serverDeafened }) {
  useEffect(() => {
    const muteAll = () => {
      document.querySelectorAll("audio").forEach((el) => {
        el.muted = isDeafened || serverDeafened;
      });
    };
    muteAll();
    const obs = new MutationObserver(muteAll);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [isDeafened, serverDeafened]);
}
```

**Sorun:** `subtree: true` ile `document.body`'yi izleyen MutationObserver, **DOM'da her değişiklikte** `document.querySelectorAll("audio")` çağırıyor. Chat mesajı yazılması, tooltip gösterilmesi, dropdown açılması — HER ŞEY bu callback'i tetikliyor. Aktif bir chat odasında saniyede düzinelerce kez çağrılabilir.

**Çözüm:** MutationObserver'ı throttle etmek veya sadece `audio` elementi eklenme/çıkarılmasını kontrol etmek:
```javascript
const obs = new MutationObserver((mutations) => {
  const hasAudioChange = mutations.some(m => 
    [...m.addedNodes].some(n => n.nodeName === 'AUDIO') ||
    [...m.removedNodes].some(n => n.nodeName === 'AUDIO')
  );
  if (hasAudioChange) muteAll();
});
```

---

### BUG-016: `UserProfileModal` — Module-Level Cache Sınırsız Büyüme ⚠️ **YENİ**
**Dosya:** [UserProfileModal.jsx](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/server/UserProfileModal.jsx#L43-L44)  
**Ciddiyet:** 🟡 Düşük-Orta

```javascript
// Module-level - ASLA TEMİZLENMEZ!
const userProfileCache = new Map();
const activeListeners = new Map();
```

**Sorun:** Her profil tıklandığında cache'e ekleniyor ama hiç silinmiyor. 1000 farklı kullanıcının profiline bakılırsa, 1000 kullanıcının tüm profil verileri bellekte kalır. Hot module reload'da da sıfırlanmaz.

**Çözüm:** LRU cache (maks 50-100 entry) veya TTL ile otomatik temizleme.

---

### BUG-017: `RailItem` — `localStorage` Base64 Icon Depolama 💾 ⚠️ **YENİ**
**Dosya:** [RailItem.jsx](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/layout/server-rail/RailItem.jsx#L51-L66)  
**Ciddiyet:** 🟡 Düşük-Orta

```javascript
const reader = new FileReader();
reader.onload = (ev) => {
  try {
    localStorage.setItem(`server_icon_${serverId}`, ev.target.result);
    // ↑ Base64 encoded tam boyut resim! Sıkıştırma YOK!
  } catch (err) { 
    alert("Resim çok büyük."); 
  }
};
reader.readAsDataURL(file);
```

**Sorun:** Kullanıcı 5MB'lık bir PNG yüklerse, base64 kodlama ile **~6.7MB** string localStorage'a yazılır. localStorage limiti **5-10MB** (tarayıcıya göre değişir). 2-3 sunucu ikonu → localStorage dolu, tüm diğer persist verileri (settingsStore, vb.) KAYBOLUR!

**Çözüm:** `imageUpload.js`'teki sıkıştırma fonksiyonlarını kullanarak resmi önce küçültmek veya IndexedDB kullanmak.

---

### BUG-018: `RailItem` — Memo Custom Comparator Eksik Prop'lar ⚠️ **YENİ**
**Dosya:** [RailItem.jsx](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/layout/server-rail/RailItem.jsx#L177-L188)  
**Ciddiyet:** 🟡 Düşük

```javascript
}, (prevProps, nextProps) => {
  return (
    prevProps.label === nextProps.label &&
    prevProps.active === nextProps.active &&
    prevProps.iconUrl === nextProps.iconUrl &&
    prevProps.isOwner === nextProps.isOwner &&
    prevProps.canManage === nextProps.canManage &&
    prevProps.variant === nextProps.variant &&
    prevProps.isRoomActive === nextProps.isRoomActive &&
    prevProps.badgeCount === nextProps.badgeCount
    // ❌ onClick, onOpenSettings, onOpenInvite, onLeave → KARŞILAŞTIRILMIYOR!
  );
});
```

**Sorun:** `onClick` gibi callback'ler karşılaştırılmıyor. Eğer parent her render'da yeni callback oluşturursa (inline arrow fn), memo hiç bir işe yaramaz çünkü diğer prop'lar değişmese bile children re-render olmaz — AMA aslında burada tersine çalışır: callback DEĞİŞMİŞ olsa bile memo "değişmedi" der ve **eski callback** kullanılır → tıklama yanlış sunucuyu seçebilir!

**Çözüm:** Ya parent'ta `useCallback` kullanılmalı, ya da comparator'a `onClick` eklenmeli.

---

### BUG-019: `ActiveRoom.handleDisconnect` — Stale Closure `hasConnectedOnce` ⚠️ **YENİ**
**Dosya:** [ActiveRoom.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/ActiveRoom.js#L811-L901)  
**Ciddiyet:** 🟠 Orta

```javascript
const handleDisconnect = async (reason) => {
  // ...
  if (hasConnectedOnce) {  // ← STALE CLOSURE riski!
    setIsReconnecting(true);
  }
};
```

**Sorun:** `handleDisconnect` `useCallback` ile sarmallanmamış ve dependency array yok. Bu fonksiyon `LiveKitRoom`'un `onDisconnected` prop'una geçirilmiyor (satır 1274'te farklı bir inline handler var), AMA `RoomEventsHandler`'a geçiriliyor (satır 1299). Bu durumda `hasConnectedOnce` her zaman closure'daki ilk değeri okur.

`hasConnectedOnceRef` de kullanılıyor ama `handleDisconnect` içinde **state versiyonu** kullanılıyor, ref versiyonu DEĞİL.

**Çözüm:** `hasConnectedOnce` yerine `hasConnectedOnceRef.current` kullanmak.

---

### BUG-020: `ActiveRoom.handleError` — Aynı Stale Closure Sorunu ⚠️ **YENİ**
**Dosya:** [ActiveRoom.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/ActiveRoom.js#L906-L1088)  
**Ciddiyet:** 🟠 Orta

```javascript
const handleError = async (error) => {
  // ...
  if (hasConnectedOnce) {  // ← STALE CLOSURE!
    setConnectionError(...);
  }
};
```

`handleDisconnect` ile aynı sorun. `hasConnectedOnce` state'inin closure'daki değeri component mount anındaki değer.

**Çözüm:** `hasConnectedOnceRef.current` kullanmak.

---

### BUG-021: `FriendItem` — Global Click Listener Her Instance İçin ⚠️ **YENİ**
**Dosya:** [FriendItem.jsx](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/friends/FriendItem.jsx#L45-L49)  
**Ciddiyet:** 🟡 Düşük-Orta

```javascript
useEffect(() => {
  const handleGlobalClick = () => setContextMenu(null);
  window.addEventListener("click", handleGlobalClick);
  return () => window.removeEventListener("click", handleGlobalClick);
}, []);
```

**Sorun:** 50 arkadaşınız varsa, 50 adet global `click` listener ekleniyor. Context menu açık olmasa bile listener sürekli çalışıyor ve `setContextMenu(null)` çağırıyor (zaten null olsa bile → gereksiz render trigger'ı!).

**Çözüm:** Listener'ı sadece `contextMenu !== null` iken eklemek:
```javascript
useEffect(() => {
  if (!contextMenu) return;
  const handleGlobalClick = () => setContextMenu(null);
  window.addEventListener("click", handleGlobalClick);
  return () => window.removeEventListener("click", handleGlobalClick);
}, [contextMenu]);
```

---

### BUG-022: `FriendItem` — Context Menu Viewport Overflow ⚠️ **YENİ**
**Dosya:** [FriendItem.jsx](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/friends/FriendItem.jsx#L276-L278)  
**Ciddiyet:** 🟡 Düşük

```javascript
style={{ top: contextMenu.y, left: contextMenu.x }}
```

Context menü pozisyonu ekran sınırları kontrol edilmeden ayarlanıyor. Listenin altındaki bir arkadaşa sağ tıklanırsa, menü ekranın dışına taşar ve kullanıcı butonlara erişemez.

---

## 🟡 PERFORMANS SORUNLARI

### PERF-001: `ChatView` — Her Mesajda Full Re-render
**Dosya:** [ChatView/index.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/ChatView/index.js#L25-L43)  
**Ciddiyet:** 🟡 Orta

`useChatStore()` ile tüm store destructure ediliyor → messages array her yeni mesajda YENİ REFERANS → ChatView komple re-render.

---

### PERF-002: `friendStore.startFriendListener` — N+1 Query Problem
**Dosya:** [friendStore.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/store/friendStore.js#L74-L121)  
**Ciddiyet:** 🟡 Orta

Her listener snapshot'ında TÜM arkadaşların user doc'u tekrar çekiliyor. 50 arkadaş = 50 Firestore read per snapshot.

---

### PERF-003: `dmStore.startConversationListener` — Her Snapshot'ta getDoc Storm
**Dosya:** [dmStore.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/store/dmStore.js#L60-L113)  
**Ciddiyet:** 🟡 Orta

---

### PERF-004: `watchPartyStore.getSortedPlaylist` — findIndex İç İçe Döngü
**Dosya:** [watchPartyStore.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/store/watchPartyStore.js#L251-L264)  
**Ciddiyet:** 🟡 Düşük

O(n²) sort — her karşılaştırmada findIndex çağrılıyor.

---

### PERF-005: `StageManager.globalQualityBadgeInterval` — Module-Level Leak
**Dosya:** [StageManager.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/active-room/StageManager.js#L324-L343)  
**Ciddiyet:** 🟡 Orta

Hot reload veya crash durumunda cleanup çağrılmaz → zombie interval.

---

### PERF-006: `MessageList` — `members.find()` Her Mesaj İçin O(n)
**Dosya:** [MessageList.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/ChatView/MessageList.js#L155)  
**Ciddiyet:** 🟡 Düşük-Orta

500 mesaj + 100 üye = 50.000 karşılaştırma (her scroll'da). Map ile O(1) yapılmalı.

---

### PERF-007: `UserCard` — 100ms Audio Level Polling Her Katılımcı İçin
**Dosya:** [UserCard.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/active-room/UserCard.js#L24-L59)  
**Ciddiyet:** 🟡 Orta

20 kişilik odada = 20 × 10/saniye = 200 interval callback/saniye.

---

### PERF-008: `imageUpload` — Tekrarlanan Cloudinary Config Pattern
**Dosya:** [imageUpload.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/utils/imageUpload.js)  
**Ciddiyet:** 🟡 Düşük (Kod kalitesi)

4 upload fonksiyonu %90 copy-paste. Tek generic fonksiyon + presets ile ~200→~60 satıra düşer.

---

### PERF-009: `ServerSidebar` — Voice Channel Participants O(n) Member Lookup ⚠️ **YENİ**
**Dosya:** [ServerSidebar.jsx](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/server/ServerSidebar.jsx#L274-L286)  
**Ciddiyet:** 🟡 Düşük-Orta

```javascript
const participants = (voiceStates?.[channel.id] || []).map((p) => {
  const member = members.find((m) => m.id === p.userId || m.userId === p.userId);
  // ↑ Her katılımcı için TÜM members array'i taranıyor
  // 10 ses kanalı × 5 katılımcı × 200 üye = 10.000 karşılaştırma
});
```

Bu kod `voiceChannels.map()` içinde çağrılıyor → her kanal render'ında her katılımcı için O(n) arama.

**Çözüm:** `useMemo` ile `Map<userId, member>` oluşturmak.

---

### PERF-010: `ActiveRoom` — `dangerouslySetInnerHTML` Style Injection ⚠️ **YENİ**
**Dosya:** [ActiveRoom.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/ActiveRoom.js#L1382-L1384)  
**Ciddiyet:** 🟡 Düşük

```javascript
<style dangerouslySetInnerHTML={{ __html: styleInjection + criticalStyles }} />
```

Her render'da yeni string oluşturulup DOM'a inject ediliyor. `styleInjection` import edilmiş sabit ve `criticalStyles` de sabit — ama React her render'da yeni `__html` objesi oluşturur ve `<style>` elementini günceller.

**Çözüm:** `useMemo` ile memoize etmek veya bu stilleri CSS dosyasına taşımak.

---

## 🔵 EDGE CASES & DİĞER SORUNLAR

### EDGE-001: Server Silme — Subcollection Mesajları Silinmiyor
**Dosya:** [serverStore.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/store/serverStore.js#L510-L539)

---

### EDGE-002: Davet Kodu Expiry — `toMillis()` Guard Yok
**Dosya:** [serverStore.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/store/serverStore.js#L643)

---

### EDGE-003: `loadChannelMessages` — İlk Set Sonrası Üzerine Yazma
**Dosya:** [chatStore.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/store/chatStore.js#L194-L263)

---

### EDGE-004: `useIdleDetection` — `setIsAutoIdle` Stale Closure
**Dosya:** [useIdleDetection.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/hooks/useIdleDetection.js#L220)

---

### EDGE-005: `preload.js` — `onAppWillQuit` `once` Handler
**Dosya:** [preload.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/electron/preload.js#L131)

`once()` kullanılıyor — uygulama kapatılıp iptal edilirse ikinci kapanma denemesinde cleanup çalışmaz!

---

### EDGE-006: `serverStore.selectServer` — `_inviteListener` Tanımsız
**Dosya:** [serverStore.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/store/serverStore.js#L90-L95)

---

### EDGE-007: `serverStore.voiceStates` — 30+ Voice Channel Limiti
**Dosya:** [serverStore.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/store/serverStore.js#L151-L153)

---

### EDGE-008: `BottomControls.startScreenShare` — Audio Track Leak
**Dosya:** [BottomControls.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/active-room/BottomControls.js#L936-L948)

`onended` sadece OS düzeyinde paylaşımı durdurduğunda tetiklenir. `stopScreenShare()` fonksiyonu çağrılırsa `onended` tetiklenmez → ghost audio track.

---

### EDGE-009: `ipcHandlers` — Auth Server Port 0'a Bind
**Dosya:** [ipcHandlers.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/electron/managers/ipcHandlers.js#L227)

Hızlı OAuth retry'larda iki server aynı anda çalışabilir.

---

### EDGE-010: `livekitPool` — `initializePool` Race Condition
**Dosya:** [livekitPool.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/utils/livekitPool.js#L57-L113)

İki component aynı anda çağırırsa duplicate listener oluşur.

---

### EDGE-011: `windowManager` — Static Server Sabit Port Çakışması
**Dosya:** [windowManager.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/electron/managers/windowManager.js#L104)

Port 17760 meşgulse uygulama açılmaz. Fallback port mekanizması yok.

---

### EDGE-012: `DMConversation` — Typing Status Gönderilmiyor
**Dosya:** [DMConversation.jsx](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/friends/DMConversation.jsx#L470)

`sendTypingStatus` store'dan alınmış ama hiçbir yerde çağrılmıyor! DM'de "... yazıyor" göstergesi hiç çalışmaz.

---

### EDGE-013: `StageManager` — `onColorChange` Stability
**Dosya:** [StageManager.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/active-room/StageManager.js#L429-L453)

İleride inline callback geçilirse sonsuz döngü riski var.

---

### EDGE-014: `ActiveRoom` — Room Presence Cleanup Data Mismatch ⚠️ **YENİ**
**Dosya:** [ActiveRoom.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/ActiveRoom.js#L727-L747)  
**Ciddiyet:** 🟠 Orta

```javascript
// Unmount cleanup (satır 734):
arrayRemove({ userId, username, photoURL: user?.photoURL || null })

// handleConnected (satır 789):
arrayUnion({ userId, username, photoURL: user?.photoURL || null })
```

**Sorun:** `arrayRemove` Firestore'da **exact match** gerektirir. Eğer kullanıcı odadayken profil fotoğrafını değiştirirse, `arrayRemove`'daki `photoURL` (eski) ile Firestore'daki `photoURL` (yeni) farklı olur → cleanup **çalışmaz** → **ghost participant** kalır!

**Çözüm:** Presence data'sına `photoURL` eklemeyip sadece `userId/username` ile çalışmak, veya cleanup'ta `arrayRemove` yerine doğrudan `users` field'ını filter edip `updateDoc` yapmak.

---

### EDGE-015: `ActiveRoom` — `settingsStore` Doğrudan Referans ⚠️ **YENİ**
**Dosya:** [ActiveRoom.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/ActiveRoom.js#L559-L573)  
**Ciddiyet:** 🟡 Düşük

```javascript
const settingsStore = useSettingsStore;
// ...
settingsStore.setState({ isMuted: false, isDeafened: false });
```

`useSettingsStore` (hook) değil, store'un kendisi (`useSettingsStore`) doğrudan referans alınıp **hook dışı API** (`setState`) çağrılıyor. Şu an çalışıyor (Zustand buna izin verir) ama bu anti-pattern. Başkaları bu kodu görünce `settingsStore` bir değişken sanıp hook olmadan kullanmaya çalışabilir.

---

### EDGE-016: `Tooltip` Content Aynı — Dead Code ⚠️ **YENİ**
**Dosya:** [RailItem.jsx](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/layout/server-rail/RailItem.jsx#L118)  
**Ciddiyet:** 🟢 Bilgi

```javascript
content={isRoomActive && !active ? label : label}
// ↑ true ve false dalları AYNI SONUCU VERİYOR!
```

Bu ternary ifadesinin her iki dalı da aynı `label` değerini döndürüyor. Dead code, muhtemelen ileride farklılaştırılacaktı.

---

### EDGE-017: `PipGrid` — `captureStream()` FPS Kontrolü Yok ⚠️ **YENİ**
**Dosya:** [PipGrid.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/src/components/active-room/PipGrid.js#L203)  
**Ciddiyet:** 🟡 Düşük-Orta

```javascript
const stream = canvas.captureStream(); // Auto FPS → no FPS cap!
```

`captureStream()` parametresiz çağrıldığında her `requestAnimationFrame` draw'ı (60fps) bir frame üretir. PiP penceresi için 60fps gereksiz CPU kullanımı — 15-24fps yeterli.

**Çözüm:** `captureStream(24)` veya `captureStream(15)` ile FPS sınırlamak.

---

## 🔒 GÜVENLİK SORUNLARI

### SEC-001: CSP'de `unsafe-eval` — Production'da da Var
**Dosya:** [windowManager.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/electron/managers/windowManager.js#L184-L191)

Production CSP'de `unsafe-eval` var. XSS saldırılarına kapı açar.

---

### SEC-002: Firebase Config Client-Side'da Açık
**Dosya:** `ipcHandlers.js`

Firebase API key'leri public olarak tasarlanmıştır ama Firestore Security Rules test edilmemiş.

---

### SEC-003: `open-external-link` — URL Doğrulama Yetersiz
**Dosya:** [ipcHandlers.js](file:///c:/Users/ConsolAktif/Documents/GitHub/netrex-standalone/electron/managers/ipcHandlers.js#L263-L265)

`u.startsWith("http")` kontrolü çok gevşek. Daha sıkı URL parse gerekir.

---

## 📦 DEPENDENCY SORUNLARI

| Bağımlılık | Sorun |
|-----------|-------|
| `livekit-server-sdk: "latest"` | 🔴 **Tehlikeli!** Breaking change geldiğinde production kırılır. Pin'lenmeli. |
| `@livekit/components-react: "latest"` | 🔴 Aynı sorun. |
| `livekit-client: "latest"` | 🔴 Aynı sorun. |
| `electron: "latest"` | 🔴 Major versiyon atlayabilir! |
| `electron-builder: "latest"` | 🔴 Aynı sorun. |
| `firebase` → `devDependencies` | 🟡 Runtime bağımlılığı devDependencies'te. Build'de sorun çıkabilir. |
| `react: "^19.2.0"` | 🟡 React 19 ile Next.js 14 uyum sorunları olabilir. |
| `sonner` → doğrudan import | 🟡 Projenin geri kalanı `@/src/utils/toast` wrapper kullanırken `watchPartyService.js` doğrudan `sonner` import ediyor. İnkonsistans. |
| `sonner` → `ActiveRoom.js` | 🟡 `import { toast } from "sonner"` — aynı inkonsistans burada da var (satır 21). |

---

## 🏗️ MİMARİ ÖNERİLER

### 1. Store Boyutu Kontrolü
`settingsStore.js` 429 satır ve 60+ ayar barındırıyor. Bu store'u kategorilere böl.

### 2. Firestore Listener Yönetimi
Her store kendi listener'larını yönetiyor ama merkezi bir tracker yok. `ListenerManager` utility sınıfı oluşturulabilir.

### 3. Error Boundary Kapsamı
Şu an sadece `MainContent` etrafında tek bir `ErrorBoundary` var. Her major UI bölümü kendi ErrorBoundary'sine sahip olmalı.

### 4. Upload Fonksiyonları DRY Prensibi
`imageUpload.js`'teki 4 upload fonksiyonu %90 copy-paste. Tek generic fonksiyon + presets.

### 5. `url.parse` Deprecation
`ipcHandlers.js` satır 196 `url.parse(req.url, true)` kullanıyor. Node.js'te deprecated. `new URL()` ile değiştirilmeli.

### 6. ActiveRoom Fonksiyon Stabilitesi ⚠️ **YENİ**
`handleDisconnect` ve `handleError` fonksiyonları `useCallback` ile sarmallanmamış ve birçok state'e closure üzerinden erişiyor. Bu fonksiyonlar `RoomEventsHandler`'a prop olarak geçirildiklerinde, **her render'da yeni referans** oluşturuyor → RoomEventsHandler gereksiz yere re-mount oluyor → event listener'lar yeniden bağlanıyor.

**Önerilen:** Bu fonksiyonları `useCallback` ile sarmallamak ve state yerine ref kullanmak.

---

## 📋 ÖNCELİKLENDİRİLMİŞ EYLEM PLANI

### 🔴 Acil (Bu Hafta)
1. **BUG-001**: Anonim username çakışması düzelt
2. **BUG-003**: DM clear batch limitini 500'erli gruplara böl
3. **BUG-005**: Static server path traversal güvenlik açığı `path.resolve` ile düzelt
4. **BUG-010**: `blockUser` parametresini düzelt
5. **BUG-011**: BottomControls metadata effect cleanup'ı düzelt
6. **BUG-015**: DeafenManager MutationObserver'ı optimize et
7. **Dependencies**: Tüm `"latest"` versiyonları pin'le
8. **SEC-001**: Production CSP'den `unsafe-eval` kaldır

### 🟠 Kısa Vadede (2 Hafta)
9. **BUG-002**: User search'e limit ve prefix query ekle
10. **BUG-006**: `selectServer` race condition'ı düzelt
11. **BUG-007**: Noise mode değişiminde audio graph rebuild mekanizması ekle
12. **BUG-012**: `videoCodec` dependency'yi `toggleCamera`'ya ekle
13. **BUG-014**: `RoomEvent` → `ParticipantEvent` düzelt
14. **BUG-019/020**: ActiveRoom handler'larında stale closure'ları ref ile düzelt
15. **EDGE-010**: LiveKit pool init race condition'ı düzelt
16. **EDGE-012**: DM'de typing status'u aktifleştir
17. **EDGE-014**: Room presence cleanup data mismatch düzelt

### 🟡 Orta Vadede (1 Ay)
18. **PERF-001**: ChatView store subscription'larını optimize et
19. **PERF-002 & PERF-003**: Friend/DM listener'larda user data cache'le
20. **PERF-005 & PERF-007**: Global interval ile audio level optimizasyonu
21. **PERF-006 & PERF-009**: Member lookup'ları Map'e çevir
22. **BUG-016**: UserProfileModal cache'ine LRU/TTL ekle
23. **BUG-017**: RailItem localStorage base64 sıkıştırma veya IndexedDB'ye geçiş
24. **BUG-021**: FriendItem global click listener'ı koşullu yap
25. **EDGE-001**: Server silme'de mesaj subcollection'larını temizle
26. **EDGE-005**: `onAppWillQuit` handler'ını `once` yerine `on` yap
27. **EDGE-011**: Static server'a port fallback mekanizması ekle
28. **EDGE-017**: PipGrid `captureStream()` FPS sınırla

---

## ✅ İYİ YAPILANLAR

Eleştirmeden önce övgüyü hak eden şeyler:

| Alan | Neden İyi |
|------|-----------|
| **Ref-based optimizasyonlar** | `usePresence`, `useIdleDetection`, `useVoiceProcessor` — stale closure'ları ref ile çözmüşsün, bu çok profesyonel |
| **DOM manipülasyonu ile 0-render speaking** | `UserCard`'da `speakingIndicatorRef` ile React State yerine doğrudan DOM update — ciddi CPU tasarrufu |
| **Batched presence updates** | 3sn delay ile Firestore write'ları birleştirmek akıllıca |
| **Sound preloading** | AudioContext + RAM cache ile zero-latency ses efektleri |
| **Graceful exit** | Electron'da Promise-based cleanup, exit splash, timeout mekanizması |
| **Shallow compare** | WatchPartyStore'daki `setRemoteState` gerçekten iyi optimize edilmiş |
| **Guard patterns** | `micPublishedRef`, `hasRegisteredChatRef`, `isTogglingCameraRef` gibi duplicate prevention |
| **LiveKit pool rotation** | Ücretsiz hesap limitini birden fazla sunucu ile aşma çözümü yaratıcı |
| **Noise gate** | VAD analizi gate'den bağımsız yapılıyor → mute'tayken bile ses kalitesi korunuyor |
| **Global interval pattern** | `QualityBadge` için N adet `setInterval` yerine tek bir global interval |
| **Hotkey ref pattern** | BottomControls'da hotkey handler'ların ref üzerinden çalışması — IPC listener birikimi sıfır |
| **Static server for production** | `file://` CPU spike'ını HTTP ile çözmek yaratıcı bir Electron optimizasyonu |
| **TTS sanitization** | Türkçe kısaltma ve spam algılama — epey kapsamlı ve düşünülmüş |
| **Camera toggle retry** | Kamera açılamadığında otomatik retry mekanizması — UX açısından çok iyi |
| **PipGrid double-buffering** | Offscreen canvas → ana canvas blit → flicker-free PiP rendering |
| **UserProfileModal listener cache** | Module-level subscriber counting ile aynı user için duplicate listener önleme (ama LRU gerek) |
| **RoomList presence batching** | `setTimeout(0)` ile snapshot update'lerini tek bir setState'e toplama — N listener → 1 render |
| **VoiceProcessorHandler conditional** | `rawAudioMode=true` ise voice processor'ı devre dışı bırakma — hook ihlali olmadan yapılmış |
| **Loading splash CPU-friendly** | CSS `transform` only animation + `will-change` — composite-only render yok |
