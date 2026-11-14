# Netrex

**Netrex**, Discord benzeri bir masaüstü (ve web) sesli sohbet / mesajlaşma uygulamasıdır. Sunucular, sesli ve yazılı kanallar, arkadaşlar ve DM, ekran paylaşımı, birlikte izleme (Watch Party), uzamsal ses ve yerleşik 3B oyunlar içerir.

![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)
![Tauri](https://img.shields.io/badge/tauri-2-24c8db.svg)
![Next.js](https://img.shields.io/badge/next.js-14-black.svg)

## İçindekiler

- [Özellikler](#özellikler)
- [Teknoloji Yığını](#teknoloji-yığını)
- [Kurulum](#kurulum)
- [Çalıştırma ve Build](#çalıştırma-ve-build)
- [Proje Yapısı](#proje-yapısı)
- [Mimari](#mimari)
- [Netrex Games](#netrex-games)
- [Sürüm Yayınlama](#sürüm-yayınlama)
- [Sorun Giderme](#sorun-giderme)
- [Notlar](#notlar)

---

## Özellikler

### Sunucular ve Kanallar
- Çoklu sunucu (kullanıcı başına en fazla 10), davet kodlarıyla katılım, sunucu ayarları ve üye listesi
- Sesli ve yazılı kanallar, kanal bağlam menüsü / ayarları
- Roller (`@everyone` dahil) ve izin sistemi, üye yasaklama (ban), moderasyon paneli
- Yetkili kullanıcılar için sesli kanalda üye taşıma / kanaldan atma komutları
- Sahne (Stage) yönetimi

### Sesli İletişim
- LiveKit (WebRTC) üzerinden düşük gecikmeli ses
- **RNNoise** tabanlı gürültü bastırma, yankı engelleme, otomatik kazanç, ses eşiği (noise gate) için özel `voice-processor` worklet'i
- Mikrofon / hoparlör / kamera seçimi, kullanıcı başına ses seviyesi
- **Mic Guard**: mikrofon kapalıyken konuşursanız uyarır (ses yalnızca yerelde analiz edilir, gönderilmez)
- **Uzamsal ses (Spatial Audio)**: kullanıcıları 2B alanda konumlandırarak mesafeye göre duyma
- **Ses grupları**: oda içinde alt gruplar oluşturma
- Uyarlanabilir bant genişliği ve gecikme optimizasyonu
- Global kısayollar (mute / deafen / bas-konuş) — klavye ve fare tuşları, uygulama arka plandayken de çalışır
- Bağlantı durumu göstergesi, otomatik LiveKit sunucu yedeklemesi (sunucu havuzu)

### Görüntü ve Paylaşım
- Kamera ve **ekran paylaşımı** (kaynak seçici, izleyici sayısı)
- **İşaretçi (pointer) paylaşımı**: imlecinizi odadakilere gösterme, masaüstü overlay'i ile
- Oyun içi **overlay** (ticker mesajları, sesli kanal overlay'i)

### Watch Party
- Senkronize video / müzik izleme (YouTube, SoundCloud ve genel oynatıcılar)
- Ortak çalma listesi, oylama ile sıralama, YouTube playlist içe aktarma
- Gecikme (drift) düzeltmeli senkronizasyon, klavye / fare kısayolları, sürüklenebilir pencere

### Mesajlaşma
- Sunucu kanalı mesajları, arkadaşlık sistemi ve **DM** konuşmaları
- Sesli / görüntülü arama daveti (gelen / giden arama ekranları)
- Markdown, emoji seçici, görsel yükleme (Cloudinary) ve görüntüleyici, link güvenlik onayı
- Sanal liste ile uzun mesaj geçmişi, sayfalama, spam koruması
- Yazıyor göstergesi, okunmamış sayacı, hızlı mesajlar

### Hesap ve Kişiselleştirme
- Google ile giriş (sistem tarayıcısı üzerinden) ve anonim giriş
- Profil fotoğrafı / arka planı, profil teması, hazır ve özel gradyanlar
- Çevrimiçi durum (presence), boşta algılama, oyun etkinliği, hızlı durum
- Ayarlar: Hesabım, Mikrofon ve Ses, Kamera, Sesler, Görünüm, Bildirimler, Kısayollar, Overlay, Performans, Genel, Hakkında (+ macOS kurulumu); ayarlar içinde arama

### Netrex Games
Sesli odadayken oynanan, tarayıcı içi 3B oyunlar (Air Hockey, Ping Pong, Bilardo, Tabu, Emlak, Okey) ve ses odası gerektirmeyen **tek kişilik** oyunlar: Elo'lu Satranç (13 botluk merdiven) ve Tepe Tırmanışı. Ayrıntılar [aşağıda](#netrex-games).

### Uygulama
- İmzalı otomatik güncelleme (GitHub Releases), güncelleme ekranı
- Sistem tepsisi, özel başlık çubuğu, kapanışta temizlik (cleanup) akışı
- Aynı kod tabanından **web** sürümü (Vercel vb.)

---

## Teknoloji Yığını

| Katman | Teknoloji |
| --- | --- |
| Masaüstü | Tauri 2 (Rust): pencere/tepsi, global kısayollar, overlay pencereleri, ekran ve uygulama sesi yakalama (Windows Graphics Capture + WASAPI), imzalı otomatik güncelleme |
| Arayüz | Next.js 14 (App Router, statik export), React 19, Tailwind CSS, Framer Motion, Lucide, Sonner |
| State | Zustand (+ persist), Immer |
| Gerçek zamanlı ses/video | LiveKit (`livekit-client`, `@livekit/components-react`) |
| Veri / kimlik | Firebase Auth, Firestore, Realtime Database (varlık, ses durumu, komutlar) |
| Sunucu | Vercel serverless (`server/`): LiveKit token, Cloudinary imzalı yükleme ve silme |
| Ses işleme | Web Audio API, RNNoise (WASM), AudioWorklet |
| Medya | `react-player`, Cloudinary |
| Oyunlar | Three.js, Rapier3D (`@dimforge/rapier3d-compat`) |
| Testler | `node --test` (birim), Firebase emülatörü (güvenlik kuralları), Playwright (uçtan uca), `cargo test` |
| CI/CD | GitHub Actions: `ci.yml` (lint + testler), `release.yml` (Windows kurucusu) |

---

## Kurulum

### Gereksinimler
- Node.js 20+ ve npm
- Rust (stable) ve Tauri 2 önkoşulları (Windows: WebView2 + MSVC derleme araçları)
- Bir **Firebase** projesi (Authentication, Firestore, Realtime Database)
- Bir **LiveKit** sunucusu veya LiveKit Cloud hesabı
- (Opsiyonel) Görsel yükleme için Cloudinary hesabı

### 1. Projeyi klonla ve bağımlılıkları yükle

```bash
git clone https://github.com/Netrex-Voice/Netrex-App-Rust.git
cd Netrex-App-Rust
npm install
```

### 2. Ortam değişkenleri

`.env.local.example` dosyasını `.env.local` olarak kopyalayıp doldurun. İki tür değer vardır:

- **Herkese açık** (`NEXT_PUBLIC_*`): Firebase ayarları, Cloudinary bulut adı, Netrex sunucu adresi. Uygulamaya gömülür.
- **Gizli** (LiveKit / Cloudinary anahtarları): yalnızca **Netrex sunucusunda** (`server/`, Vercel ortam değişkenleri) durur.
  Yerel `.env.local` içinde bulunsalar bile derlenen uygulamaya **gömülmezler** (`src-tauri/build.rs` yalnızca
  `NEXT_PUBLIC_*` satırlarını alır).

`NEXT_PUBLIC_NETREX_API_URL` tanımlıysa uygulama token/yükleme/silme için Netrex sunucusunu kullanır (önerilen).
Tanımsızsa yerel geliştirme yoluna düşer: Rust, `.env.local` içindeki LiveKit anahtarlarıyla token üretir.

### 3. Netrex sunucusu (Vercel)

Kurulum ve uç noktalar: [server/README.md](server/README.md).

### 4. Firebase

1. **Authentication**: Google sağlayıcısını etkinleştirin (isterseniz anonim girişi de).
2. **Firestore** ve **Realtime Database** oluşturun.
3. Güvenlik kurallarını repodaki dosyalardan yayınlayın:
   ```bash
   npx firebase deploy --only firestore:rules,database --project <proje-kimliği>
   ```
   Kurallar `npm run test:rules` ile yerel emülatörde test edilir (Java gerekir).

---

## Çalıştırma ve Build

| Komut | Açıklama |
| --- | --- |
| `npm run tauri:dev` | Masaüstü geliştirme (Next dev sunucusu + Tauri) |
| `npm run dev` | Yalnızca Next.js dev sunucusu (`localhost:3100`) |
| `npm run dev:web` | Web hedefi ile dev (`NEXT_PUBLIC_BUILD_TARGET=web`) |
| `npm run build` | Statik export (`out/`) |
| `npm run tauri:build` | Kurucu üretimi (Windows: NSIS) |
| `npm run lint` | ESLint |
| `npm test` | Birim testleri (sohbet toplu yazma + oyun motorları) |
| `npm run test:rules` | Firestore / Realtime Database kural testleri (emülatör) |
| `npx playwright test` | Uçtan uca testler (emülatörler + yerel LiveKit; bkz. `e2e/`) |
| `cd server && npm test` | Sunucu testleri |
| `cd src-tauri && cargo test` | Rust testleri |

**İki hedef, tek kod tabanı:** `next.config.js` varsayılanda masaüstü için `output: "export"` (statik) üretir;
`NEXT_PUBLIC_BUILD_TARGET=web` veya `VERCEL=1` iken web sürümü olarak derler. Web sürümü de token/yükleme/silme için
aynı Netrex sunucusunu kullanır.

---

## Proje Yapısı

```
├── app/                      # Next.js App Router (ana uygulama, /view görsel görüntüleyici)
├── src/
│   ├── components/           # layout, server, active-room, ChatView, friends, watch-party, settings, ui
│   ├── modules/games/        # Netrex Games (motorlar, görünümler, Three.js sahneleri, testler)
│   ├── store/                # Zustand store'ları (auth, server, chat, dm, friend, settings, …)
│   ├── hooks/                # Varlık, ses işleme, mic guard, uzamsal ses, watch party, ses grupları, …
│   ├── audio/                # Paylaşılan AudioContext, voiceProcessor, spatialEngine
│   ├── services/             # spatialAudioService, watchPartyService
│   ├── lib/                  # firebase, rtdbPresence, tauriBridge (window.netrex), platformBridge, netrexApi
│   └── utils/                # imageUpload, keyMap, voiceCommands, cleanup, …
├── src-tauri/                # Rust: pencere yaşam döngüsü, kısayollar, overlay, yakalama, güncelleme, OAuth
├── server/                   # Vercel serverless: LiveKit token, Cloudinary imzalı yükleme/silme
├── public/                   # sesler, overlay sayfaları, AudioWorklet'ler
├── rules-tests/              # Güvenlik kuralı testleri
├── e2e/                      # Playwright testleri ve yerel test ortamı (emülatörler + LiveKit)
├── firestore.rules           # Firestore güvenlik kuralları
├── database.rules.json       # Realtime Database kuralları
└── .github/workflows/        # ci.yml, release.yml
```

---

## Mimari

```
┌──────────────────────────┐
│ Tauri / Rust             │  pencere, tepsi, güncelleme, global kısayollar,
│ src-tauri/               │  OAuth, overlay pencereleri, ekran/ses yakalama
└────────────┬─────────────┘
             │ komutlar + olaylar (src/lib/tauriBridge.js → window.netrex)
┌────────────▼─────────────┐
│ Next.js arayüzü (React)  │  UI, Zustand store'ları, Web Audio, oyunlar
└───┬──────────┬───────┬───┘
    │          │       │
 Firebase   LiveKit   Netrex sunucusu (Vercel)
 (Auth, Firestore,    (token, imzalı yükleme, silme:
  Realtime DB)         secret'lar yalnızca burada)
```

- **Veri dağılımı:**
  - *Firestore*: kullanıcılar, sunucular (üyeler, yasaklar, kanallar, roller), davetler, arkadaşlıklar, DM, mesajlar
  - *Realtime Database*: anlık varlık bilgisi (`user_presence`, `room_presence`, `user_voice_state`) ve tek kullanımlık
    sesli kanal komutları (`voice_commands`)
  - *LiveKit*: ses/video/ekran, sohbet mesajlarının canlı iletimi, yazıyor bilgisi ve oyun trafiği
- **Güvenlik:** yetkiler Firestore kurallarında denetlenir (rol izinleri `servers/{id}/meta/perms` dizininden okunur);
  token sunucusu, kullanıcının odaya girme yetkisini aynı kurallar üzerinden doğrular. Ayrıntı: `firestore.rules`.
- **Maliyet bilinci:**
  - Sunucu kanalı mesajları LiveKit ile anında iletilir, Firestore'a **toplu** yazılır: bir yazarın ~20 sn içindeki
    mesajları tek belge = tek yazma (`src/store/chatBatch.js`). Firestore'da canlı mesaj dinleyicisi yoktur.
  - "Şu an bağlı mı?" bilgisi Realtime Database'den gelir; Firestore heartbeat'i yalnızca yedektir (30 dk).
  - Profil fotoğrafları kullanıcı başına bir kez okunup önbelleğe alınır.

### Netrex Games

Oyunlar `src/modules/games` altında, **isteğe bağlı ve izole** bir modüldür; bir motor + bir görünüm + `registry.js` içinde bir manifest ile tanımlanır. Motor yalnızca **host**'ta çalışır ve durumun tek otoritesidir, görünüm herkeste çalışır; ikisi de oyun açılınca dinamik import edilir. Yalnızca bu repodaki birinci taraf modüller kaydedilir.

| Oyun | Oyuncu | Bot | Not |
| --- | --- | --- | --- |
| Air Hockey | 2 | ✓ | Gerçek ölçülü masa, falsolu disk |
| Ping Pong | 2 | ✓ | Topspin / kesme / Magnus etkisi |
| Bilardo | 2 | ✓ | 8 top, falso, deterministik fizik |
| Tabu | 4–12 | – | Takım tabanlı kelime oyunu |
| Emlak | 2–6 | ✓ | İstanbul temalı mülk oyunu |
| Okey | 1–4 | ✓ | Klasik Türk Okey'i, eksik koltuklara bot |
| Satranç | 1 | ✓ | Tek kişilik; Bullet/Blitz/Rapid Elo, botlar 250–2400 (tahmini) |
| Tepe Tırmanışı | 1 | – | Tek kişilik; fizik tabanlı araç tırmanışı, garaj ve yükseltmeler |

Oyun trafiği host ile oyuncular arasında doğrudan WebRTC DataChannel (P2P) üzerinden gider; kurulamazsa LiveKit'e döner. Tek kişilik oyunlar sol raydaki **Tek Kişilik Oyunlar** düğmesinden açılır. Ayrıntı: [docs/games/solo-and-network.md](docs/games/solo-and-network.md).

Testler: `npm run test:games`.

---

## Sürüm Yayınlama

1. `package.json`, `src-tauri/tauri.conf.json` ve `src-tauri/Cargo.toml` içindeki sürümü yükseltin; `release_vX.Y.Z.md` notunu yazın.
2. GitHub > Actions > **Windows sürümü** > *Run workflow*. Kurucu ve güncelleme imzaları derlenir, GitHub Release'e
   (varsayılan: taslak) yüklenir. Gerekli depo gizlileri `release.yml` başında yazılıdır.
3. Kurulu uygulamalar yeni sürümü kendisi bulur, indirir ve imzasını doğrulayıp kurar.

> Güvenlik kuralları ya da sunucu, eski istemcilerle uyumsuz biçimde değiştiyse önce yeni istemciyi yayınlayın;
> geçiş süresince sunucuda `ALLOW_LEGACY_CLIENTS=1` kullanılabilir (bkz. `server/README.md`).

---

## Sorun Giderme

**LiveKit bağlanamıyor** — `https://<sunucu>/api/health` çıktısında `livekitServers` 0'dan büyük mü? Uygulama
`NEXT_PUBLIC_NETREX_API_URL` ile mi derlendi? "you do not have access to this room" hatası, kullanıcının o sunucunun
üyesi olmadığını (ya da güvenlik kurallarının yayınlanmadığını) gösterir.

**Global kısayollar çalışmıyor** — Yalnızca masaüstü uygulamasında çalışır; Ayarlar → Kısayollar'dan atama yapın.

**Kullanıcılar sol listeden kayboluyor / "Bağlanıyor" takılıyor** — Realtime Database kurallarının
(`database.rules.json`) yayınlandığından emin olun.

**Yetkili üye atamıyor / kanal düzenleyemiyor ("permission-denied")** — Rol izinleri `servers/{id}/meta/perms`
dizininden okunur. Bu belge, sunucu sahibi (ya da Rolleri Yönet izni olan biri) güncel sürümle sunucuyu açtığında
kendiliğinden yazılır.

**Günlük dosyası** — `%LOCALAPPDATA%\com.netrex.app\logs\netrex.log`

---

## Notlar

- `.env.local`, API anahtarları ve Firebase/LiveKit sırlarını asla commit etmeyin.
- Üretim öncesi `firestore.rules` ve `database.rules.json` dosyalarını kendi projenize yayınlayın.
- Sürüm notları için `release_v*.md` dosyalarına bakın.
- Repoda henüz bir `LICENSE` dosyası bulunmuyor.
