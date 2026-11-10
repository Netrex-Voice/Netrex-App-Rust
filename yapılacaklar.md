# Netrex Performans ve Optimizasyon Planı

Aşağıdaki liste, gereksiz ağ (network) tüketimini önlemek ve uygulamanın arka planını olabildiğince CPU/Maliyet dostu hale getirmek için hazırlanmış optimizasyon hedeflerini içerir.

## Ağ (Network) ve Veritabanı (Firestore) Optimizasyonları

- [x] **AŞAMA 1: RoomList Dinleyici Konsolidasyonu** [ZATEN OPTİMİZE]
  - **Durum:** Oda başına ayrı `onSnapshot` dinleyicisi açılıyor, ancak batching mekanizması (`scheduleFlush`) zaten mevcut. Re-render cascade önlenmiş, cleanup düzgün. Oda sayısı genelde 5-15 arası ve Firestore SDK'sı bu tür `doc()` seviyesindeki dinleyicileri multiplexing ile optimize ediyor. Risk/kazanç oranı değişikliği gereksiz kılıyor.

- [x] **AŞAMA 2: Auto-Repair Chunking** [ZATEN DÜZELTİLMİŞ]
  - **Durum:** `serverStore.js` içindeki auto-repair zaten `autoRepairDone = true` flag'i ile **sadece ilk snapshot'ta bir kez** çalışıyor. `Promise.all` ile paralel, `await` etmeden fire-and-forget yapıyor. Çoğu üyenin adı zaten doğru olduğundan gerçek dünyada 1-2 `getDoc` atılıyor - chunk'lama gereksiz.

- [x] **AŞAMA 3: Heartbeat Optimizasyonu** [ZATEN OPTİMİZE]
  - **Durum:** İlk planda "60 saniye" yazılmıştı, ancak kod zaten **sesli sohbette 2 dakika, boşta 5 dakika** aralıklarında çalışıyor. İlk heartbeat 30 saniye geciktiriliyor. Offline/invisible durumda heartbeat gönderilmiyor. 3 saniyelik batch delay mevcut.

- [x] **AŞAMA 4: Typing Debounce** [SORUN YOK]
  - **Durum:** Typing bilgisi **Firestore'a DEĞİL**, LiveKit data channel üzerinden (`reliable: false`) gönderiliyor. Firestore yazma maliyeti sıfır. 3 saniyelik timeout zaten mevcut ve yeterli.

- [x] **AŞAMA 5: Main Process Boşta CPU Sızıntısı (Idle Spike) [ÇÖZÜLDÜ]**
  - **Sorun:** Uygulama `electron-pack` ile EXE olarak paketlendiğinde, kullanıcı hiçbir şeye dokunmasa bile `Netrex (Main Process)` %7-15 CPU'ya tırmanıyordu. Dev modunda ise %0'da kalıyordu.
  - **Teşhis:** `process.cpuUsage()` ile yapılan derinlemesine analizde, Node.js'in (bizim kodumuzun) 3 dakikada toplam sadece ~360ms CPU harcadığı (%0.2) - ancak Görev Yöneticisi'nin %15 gösterdiği kanıtlandı. Bu %99.8'lik fark, Chromium'un kendi C++ compositor thread'lerinden geliyordu.
  - **Kök Neden:** Paketlenmiş modda `mainWindow.loadFile()` → `file://` protokolü kullanılıyordu. Chromium'un browser process'i, `file://` protokolü üzerinden yüklenen sayfalarda HTTP'ye kıyasla farklı (ve çok daha masraflı) bir compositor/IPC davranışı sergiliyordu. Dev modda ise `http://localhost:3000` ile yüklendiğinden sorun yoktu.
  - **Çözüm:** Paketlenmiş modda `file://` protokolü yerine `127.0.0.1:17760` üzerinde bir mini HTTP static server başlatıldı. Uygulama artık dev moddaki gibi HTTP üzerinden yükleniyor. Ayrıca `backgroundThrottling: false`, `disable-background-timer-throttling`, `enable-gpu-rasterization`, `enable-zero-copy`, `AudioServiceOutOfProcess` gibi agresif Chromium bayrakları da kaldırıldı. Sonuç: **%0 CPU** (dev modu ile birebir aynı).

---
*(Zamanla keşfedilen veya aklımıza gelen ek performans açıkları buraya yazılacaktır.)*
