# Netrex - Secure Desktop Voice Chat Application 🚀
**Sürüm:** v7.2.0

Netrex, kullanıcıların kendi sunucularını oluşturup yönetebildikleri, metin, ses ve video tabanlı güvenli bir masaüstü iletişim platformudur. Discord benzeri bir kullanıcı deneyimini, modern web teknolojileri ve güçlü bir masaüstü entegrasyonu ile bir araya getirir.

## 📖 Proje Hakkında

Netrex, başlarda sadece bir iletişim aracı olarak tasarlanmış olsa da, zamanla oyun katmanı tespiti, gelişmiş gürültü engelleme, global kısayollar (Push-to-Talk) ve detaylı yetkilendirme sistemlerini barındıran tam teşekküllü bir **"Oyuncu ve Topluluk İletişim Platformu"** haline gelmiştir. Bu proje, toplulukların yüksek performanslı sesli görüşmeler yapabilmesini, düşük gecikmeli ekran paylaşımı yapmasını ve anlık olarak metin tabanlı etkileşimde bulunmasını hedefler.

---

## 🛠️ Kullanılan Teknolojiler (Tech Stack)

Netrex, hem masaüstü yeteneklerinden tam anlamıyla faydalanmak hem de modern web geliştirme süreçlerinin hızını kullanmak amacıyla **Next.js + Electron** hibrit yapısıyla inşa edilmiştir.

### 💻 Çekirdek (Core & Desktop)
- **Electron (latest):** Uygulamanın çapraz platform (Windows, macOS, Linux) bir masaüstü uygulaması olarak native (donanım hızlandırma destekli) çalışmasını sağlar. 
- **Next.js (v14.2) & React (v19):** Uygulamanın arayüz tasarımı, route yönetimi ve render sistemi için kullanıldı. Ağırlıklı olarak CSR (Client Side Rendering) ve verimli bundle yapısı için App Router mimarisi tercih edilmiştir.
- **uiohook-napi (v1.1.0):** C/C++ seviyesinde işletim sistemine bağlanarak (Native API) uygulamanın arka plandayken veya bir oyun tam ekranken bile klavye olaylarını dinleyebilmesini sağlar. (Global Keybinds, Push-to-Talk için kritik donanım düzeyinde iletişim).
- **electron-updater:** Uygulamanın kendi kendine otomatik güncellemelerini arka planda indirip kurmasını (OTA) sağlar. Kullanıcı deneyimini bölmeden güncelleme sunar.

### 🎙️ İletişim & Medya (LiveKit & WebRTC)
- **LiveKit (livekit-client, livekit-server-sdk):** Düşük gecikmeli WebRTC tabanlı ses, video gösterimi ve ekran paylaşımı altyapısı olarak LiveKit ekosistemi kullanıldı. LiveKit SFU (Selective Forwarding Unit) mimarisine sahip olduğu için, kullanıcıların sunucudaki videoyu veya sesi yüksek kalitede ancak düşük bant genişliği ile tüketmesini sağlar.
- **RNNoise (simple-rnnoise-wasm):** Arka plandaki klavye sesi, fan sesi gibi istenmeyen gürültüleri filtrelemek için entegre yapay zeka/derin öğrenme destekli Gürültü Engelleme (Noise Suppression) teknolojisi. WebAssembly destekli tarayıcı içi model çalıştırır.
- **Web Audio API & AudioWorklet:** Mikrofondan gelen ham ses verilerini işleyip (Örn: VAD - Voice Activity Detection, ses bariyeri belirleme, Yankı engelleme) gecikmesiz bir şekilde LiveKit sunucularına aktarmak için Native browser API'leri (`voice-processor.worklet.js`) entegre edildi.

### 🗄️ Veritabanı & Backend & Storage
- **Firebase (v11):** 
  - **Firestore (NoSQL):** Sunucuların, kanalların, kullanıcı profillerinin, ayarların ve sohbet mesajlarının anlık (real-time) senkronizasyonu için kullanıldı. Veri değiştiğinde WebSocket üzerinden tüm istemcilere saniyeden daha hızlı güncellemeler atar.
  - **Firebase Auth:** Güvenli Token (JWT) bazlı kullanıcı kayıt ve giriş işlemleri.
- **Cloudinary:** Kullanıcı avatarları, sunucu ikonları ve sohbet içindeki görsel paylaşımlarının bulutta depolanması ve CDN üzerinden (Next.js server'less mimarisindeki `route.js` destekleriyle) dağıtılması sağlandı.

### 🎨 Arayüz Tasarımı & UX
- **Tailwind CSS & Autoprefixer:** Hızlı, ölçeklenebilir ve modern bir UI katmanı kodlamak için.
- **Framer Motion:** Akıcı sayfa geçişleri, modal/pop-up animasyonları ve kullanıcı etkileşimini artırmak için sıvı görünümlü animasyonlar.
- **Zustand:** Uygulama çapındaki durum yönetimi (Oturum durumu, aktif sunucu `serverStore`, kullanıcı ses/medya durumları `participantVolumeStore`, ayarlamalar `settingsStore` vb.) için yüksek performanslı ve re-render'ı en aza indiren hook tabanlı yaklaşım.
- **@dnd-kit (Drag and Drop):** Kullanıcıların sürükle-bırak yöntemle kanal veya öğe sıralamalarını kolayca değiştirebilmeleri için eklendi.
- **React-Virtuoso & React-Window:** Binlerce mesajın bulunduğu büyük sohbet odalarında veya kalabalık katılımcı listelerinde bellek sızıntısını ve donmaları engellemek amacıyla sadece ekranda görünen öğeleri oluşturmayı (Windowing/Virtualization) ilke edindi.
- **Emoji Picker React & React Markdown:** Github Flavored Markdown (GFM) desteği, kod blokları ve emojiler içeren zengin metinleri derlemek için entegre edildi.

---

## 🌟 Öne Çıkan Özellikler ve İnovatif Modüller

Netrex, sadece standart sohbet mekaniklerine değil, kullanıcı deneyimini zirveye taşıyan bazı özgün (innovative) mühendislik çözümlerine sahiptir. İşte projedeki devasa özellik seti:

### 1. 🎤 Gelişmiş Ses ve Video Kontrolü
- **RNNoise (Yapay Zeka Destekli Gürültü Engelleme):** Derin öğrenme (Deep Learning) temelli bir gürültü kesici olan RNNoise, tarayıcı içinde (WebAssembly) çalıştırılır. Klavye, fan veya arka plan gürültülerini anında yalıtır.
- **Audio Worklet ile Gecikmesiz İşleme (VAD):** `voice-processor.worklet.js` sayesinde Ham ses verisi doğrudan tarayıcının ses işlemcisinde analiz edilir, Voice Activity Detection (Ses Algılama) gibi işlemler main thread'i tıkamadan, anında yapılır.
- **Dinamik Ses Bariyeri (Noise Gate / Threshold):** Kullanıcı, etraftaki arka plan gürültüsünü kesmek için mikrofonunun algılayacağı ses eşiğini (threshold) milimetrik olarak ayarlayabilir.
- **Kişiye Özel Ses Ayarı (Participant Volume):** Odadaki her bir katılımcının ses düzeyini bir kaydırıcı (slider) ile lokal olarak bağımsızca (+/-) ayarlama imkânı.
- **Çoklu Yayın Akışı (Multiple Streams):** Kullanıcı aynı anda hem kamerasını açabilir hem de düşük gecikmeli olarak ekranını paylaşabilir. *Local participant* yönetimi ile bunların birleşimi çakışmaz.
- **Dirençli Bağlantı (Robust Reconnection):** LiveKit altyapısıyla ağ koptuğunda ya da anlık dalgalanmalarda ses tünelinin otomatik (ve sessizce) yeniden ayağa kaldırılması.

### 2. 🎮 Zengin Aktivite ve Oyuncu Deneyimi (Presence Engine)
- **Idle Detection (Klavye/Mouse Dinleme):** İşletim seviyesindeki mouse/klavye hareketleri takip edilip, eğer XX dakika boyunca hareket yoksa (veya afk ise) statü otomatik olarak yarım ay sembolüne 🌙 (Idle) çeker. (Aynen Discord'un yaptığı gibi)
- **Game Activity Tracker:** `fastlist` vb. windows işlemlerinden (process) ve aktif pencerelerden veriler okunarak, oyun saptanır, profil üzerinde bir **Rich Presence** (Örn: "Şu an Valorant oynuyor - 1 saattir") kartı olarak tüm sunucuya yayınlanır. Üstelik bunun için eklenti gerekmez, Electron'un C++ native bindings yetenekleri kullanılır.
- **Sistem Çapı Kısayollar (Global Keybinds / PTT):** Pencereler arası geçişte veya oyun tam ekranken bile çalışan donanımsal araya girmeler (hooks). Bas-Konuş (Push-to-Talk) veya Sus/Aç (Toggle Mute) özelliği, odak başka bir programdayken kusursuz çalışır (`uiohook-napi`).
- **Sistem Sesiyle Birlikte Ekran Paylaşımı (Desktop Capturer):** Elektron üzerinden kullanıcının doğrudan tüm ekranını veya sadece spesifik bir uygulamasını (Discord benzeri) oyunun sesiyle birlikte odaya stream edebilmesi yeteneği.

### 3. 🌐 Dinamik Kullanıcı Bağlantısı ve Sunucu Yönetimi (LiveKit Pool)
- **Server Rotation (Aktif Sunucu Değişimi):** Yalnızca tek bir taşıyıcı sunucuya (Livekit) bağlı kalmak yerine, yük devretme (Failover) ve kotaların aşımı durumunda akıllı sistem `activeServerIndex` mantığıyla kullanıcıları koparmadan diğer ücretsiz/açık sunucu havuzlarına (`Pool`) anında dengeli şekilde kaydırır. (İnovatif *LiveKit Pool*)
- **Yetki, Rol ve Çözümleme Ağı (`useServerPermission`):** İstemci UI bileşenleri her saniye rolünü yeniden veritabanından sormaz, Zustand üzerinde depolanan cache ile anında (Örn: "Adamı Sunucudan At" butonu sadece admin/moderatörlerde görünür) hesaplama yapar.
- **Modüler Kanal Tasarımı:** Drag & Drop (Sürükle-Bırak) özelliğiyle kanal sırasında rahatlıkla oynamalar yapma (`@dnd-kit`).

### 4. 💬 Güçlü ve Responsive Mesajlaşma Altyapısı
- **Görsel Optimizasyonu:** Sunucu israfını engellemek için, kullanıcının yükleyeceği 5MB'lık kocaman logoları veya görselleri (`browser-image-compression`) ile istemcide (React tarafında) kalite kaybı hissettirmeden 200KB civarına çekip Cloudinary'e yollar.
- **Virtualization (React Virtuoso):** Çok büyük sohbet kanallarında on binlerce satır atıldığında DOM şişmesi ve kasma yaşanmaması için sadece ekranda o an o saniye gözüken mesaj bloklarını renderler. Sınırsız kaydırma (Infinite Scroll) pürüzsüz çalışır.
- **Özelleştirilmiş Mesaj Etkileşimleri:** İki tıklamayla Sağ tık (ContextMenu) düzenleme, emojiler (`EmojiPicker`) veya Markdown içerikli (Kod, Kalın, Italik vs) destekli mesajlaşma.
- **Picture-in-Picture (PiP) Grid:** Yüzen pencereler sayesinde seslideyken uygulamanın başka bir kanalında dolaşma imkânı. Mevcut konuşan kişiyi ön plana çıkaran (Active Speaker) algoritmik kamera düzenleri.

### 5. 🛡️ Güvenlik ve Mimari Kararlar
- **Tamamen Bağımsız Bridge (Preload Context Isolation):** Uygulama arayüzü, kullanıcıların PC'sine web üzerinden zarar gelmemesi için ana Node thread'inden `contextBridge` ile soyutlanmış olarak dizayn edilmiştir. Hiçbir bileşen işletim sistemine %100 doğrudan zararlı komut erimi yaratamaz. Sadece IPC (Inter-Process Communication) ile mesajlaşılır.
- **Gelişmiş Güncelleme Sistemi:** (OTA - Over The Air). Uygulama arka planda güncelleme geldiğinde yeni sürümü gizlice çeker, kullanıcı kapatıp açtığında splash screenden otomatik versiyon atlatır.
- **Dark/Light/Bespoke Temalar:** Sadece tailwind sınıfları değil, arayüzün bütünü kullanıcı profiline, renk kodlarına (Custom Badge, Custom Roles) uyum sağlayacak esnek değişkenlerle (`css variables`) programlanmıştır.

---

## 📂 Proje Çapı ve Sistem Dizini

Bu devasa ve karmaşık projenin yönetilebilir kalması için klasör yapısı kesin hatlarla ayrılmıştır:
- **/src/components:** React tabanlı UI bileşenlerinin her biri `/ui` (basit butonlar, modallar), `/layout` (uygulama iskeleti), `/server` (sunucu formları) ve `/active-room` (medya kontrol arayüzleri) olarak gruplanmıştır.
- **/src/store:** Zustand bazlı Singleton veri depoları uygulamanın her noktasından kolayca erişilen merkezi zeka birimidir.
- **/src/hooks:** Karmaşık iş mantıkları (`useVoiceProcessor.js`, `useSoundEffects.js`) sade ve çağrılabilir kancalar (hooks) halinde kodlanıp re-usability (tekrar kullanılabilirlik) maksimize edilmiştir.
- **/electron:** Uygulamayı Chromium penceresine hapsolmaktan kurtarıp `Node.js` gücünü arkasına alan çekirdek modüldür.
  
## 🎯 Sonuç: Nasıl Yapıldı?

Netrex, basit bir "React sohbet app'i" değildir. İstemcide *Audio Processing Worklet* yazmaktan tutun, Native C++ eklentilerini Node ile derlemeye ve SFU tabanlı WebRTC video sunucuları kurmaya kadar giden "Multi-Disipliner" (çok katmanlı) bir mimaridendir. Modern hook alışkanlıklarıyla state'i kontrol altında tutarken, kullanıcı deneyimini "Masaüstünde Native, Ekranda Süper Akıcı" felsefesiyle inşa etmiştir. Sürüm 7.x itibariyle profesyonel çapta kullanılabilecek, ölçeklenebilir ve geniş özelliklere sahip güvenli bir kapalı platform alternatifi sunmaktadır.
