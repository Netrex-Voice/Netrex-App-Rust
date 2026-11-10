# Netrex

**Netrex**, Discord benzeri bir masaüstü (ve web) sesli sohbet / mesajlaşma uygulamasıdır. Sunucular, sesli ve yazılı kanallar, arkadaşlar ve DM, ekran paylaşımı, birlikte izleme (Watch Party), uzamsal ses ve yerleşik 3B oyunlar içerir.

![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
![Electron](https://img.shields.io/badge/electron-39-47848f.svg)
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
- Google OAuth (Electron içinde) ve anonim giriş
- Profil fotoğrafı / arka planı, profil teması, hazır ve özel gradyanlar
- Çevrimiçi durum (presence), boşta algılama, oyun etkinliği, hızlı durum
- Ayarlar: Hesabım, Mikrofon ve Ses, Kamera, Sesler, Görünüm, Bildirimler, Kısayollar, Overlay, Performans, Genel, Hakkında (+ macOS kurulumu); ayarlar içinde arama

### Netrex Games
Sesli odadayken oynanan, tarayıcı içi 3B oyunlar (Air Hockey, Ping Pong, Bilardo, Tabu, Emlak, Okey) ve ses odası gerektirmeyen **tek kişilik** oyunlar: Elo'lu Satranç (13 botluk merdiven) ve Tepe Tırmanışı. Ayrıntılar [aşağıda](#netrex-games).

### Uygulama
- Otomatik güncelleme (`electron-updater`, GitHub Releases), güncelleme splash ekranı
- Sistem tepsisi, özel başlık çubuğu, kapanışta temizlik (cleanup) akışı
- Aynı kod tabanından **web** sürümü (Vercel vb.)

---

## Teknoloji Yığını

| Katman | Teknoloji |
| --- | --- |
| Masaüstü | Electron 39, electron-builder, electron-updater, electron-store, `uiohook-napi` |
| Arayüz | Next.js 14 (App Router), React 19, Tailwind CSS, Framer Motion, Lucide, Sonner |
| State | Zustand (+ persist), Immer |
| Gerçek zamanlı ses/video | LiveKit (`livekit-client`, `livekit-server-sdk`, track-processors) |
| Veri / kimlik | Firebase Auth, Firestore, Realtime Database (presence, ses durumu, komutlar) |
| Ses işleme | Web Audio API, RNNoise (WASM), AudioWorklet |
| Medya | `react-player`, Cloudinary (görsel yükleme) |
| Oyunlar | Three.js, Rapier3D (`@dimforge/rapier3d-compat`) |
| Liste performansı | `react-virtuoso`, `react-window`, `@dnd-kit` |
| CI/CD | GitHub Actions (Windows / macOS / Linux build + release) |

---

## Kurulum

### Gereksinimler
- Node.js 18+ ve npm
- Bir **Firebase** projesi (Authentication, Firestore, Realtime Database)
- Bir **LiveKit** sunucusu veya LiveKit Cloud hesabı
- (Opsiyonel) Görsel yükleme için Cloudinary hesabı

### 1. Projeyi klonla ve bağımlılıkları yükle

```bash
git clone https://github.com/MuratGuelr/netrex-standalone.git
cd netrex-standalone
npm install
```

### 2. Ortam değişkenleri

`env.example` (veya `.env.local.example`) dosyasını `.env.local` olarak kopyalayıp doldurun:

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# LiveKit (tek sunucu)
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-server.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

# LiveKit (sunucu havuzu — opsiyonel, en fazla 20)
# LIVEKIT_SERVERS_0_URL= / LIVEKIT_SERVERS_0_KEY= / LIVEKIT_SERVERS_0_SECRET=
# LIVEKIT_SERVERS_1_URL= ...

# Cloudinary (opsiyonel)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=
CLOUDINARY_API_SECRET=
```

> `.env.local` git'e eklenmez. `npm run electron-dev` ve paketleme öncesi `scripts/copy-env.js` bu dosyayı `electron/` altına kopyalar (Electron ana süreci LiveKit token üretimi için kullanır).

**LiveKit sunucu havuzu:** Ücretsiz plan dakika limitini aşmak için birden fazla LiveKit hesabı tanımlayabilirsiniz; sistem sunucular arasında otomatik geçiş yapar.

### 3. Firebase

1. **Authentication**: Google sağlayıcısını etkinleştirin (anonim girişi de açın).
2. **Firestore** ve **Realtime Database** oluşturun.
3. Güvenlik kurallarını repodaki dosyalardan yayınlayın:
   - `firestore.rules` → Firestore
   - `database.rules.json` → Realtime Database (`room_presence`, `user_voice_state`, `user_presence`, `voice_commands`)

---

## Çalıştırma ve Build

| Komut | Açıklama |
| --- | --- |
| `npm run electron-dev` | Next dev sunucusu + Electron (masaüstü geliştirme) |
| `npm run dev` | Yalnızca Next.js dev sunucusu (`localhost:3000`) |
| `npm run dev:web` | Web hedefi ile dev (`NEXT_PUBLIC_BUILD_TARGET=web`) |
| `npm run build` | Static export (`out/`) + `postbuild` ile Electron yol düzeltmeleri |
| `npm run build:web` | Web (sunucu modlu) build — API route'ları çalışır |
| `npm run electron-pack` | Build + installer üretimi (`dist/`) |
| `npm run release` | Build + GitHub Releases'a yayınlama |
| `npm run test:games` | Oyun motoru testleri (`node --test`) |
| `npm run lint` | Next lint |

**İki hedef, tek kod tabanı:** `next.config.js` varsayılanda Electron için `output: "export"` (statik) üretir; `NEXT_PUBLIC_BUILD_TARGET=web` veya `VERCEL=1` iken normal Next.js sunucu modunda derler (LiveKit token, YouTube playlist, Cloudinary silme gibi `app/api/*` route'ları yalnızca bu modda çalışır).

**Çıktılar:** Windows → NSIS (`Netrex-Setup-<sürüm>.exe`), macOS → dmg + zip (x64 / arm64), Linux → AppImage.

---

## Proje Yapısı

```
netrex-standalone/
├── app/                      # Next.js App Router
│   ├── page.js               # Ana uygulama (giriş / ana ekran)
│   ├── view/                 # Bağımsız görsel görüntüleyici sayfası
│   └── api/                  # livekit-token, livekit-server-info, youtube-playlist, cloudinary-delete
├── electron/
│   ├── main.js               # Ana süreç girişi
│   ├── preload.js            # IPC köprüsü (window.netrex)
│   ├── managers/             # window, tray, update, input (global hotkey), ipcHandlers, youtubePlaylist
│   └── overlays/             # pointer-overlay.html, ticker-overlay.html
├── src/
│   ├── components/
│   │   ├── layout/           # AppShell, ServerRail, Sidebar, Titlebar, mobil bileşenler
│   │   ├── server/           # Sunucu / kanal / üye / davet modalları
│   │   ├── active-room/      # Aktif sesli oda: katılımcılar, ekran paylaşımı, stage, ses grupları, overlay köprüsü
│   │   ├── ChatView/         # Mesaj listesi, girdi, bağlam menüsü, görsel overlay
│   │   ├── friends/          # Arkadaşlar, DM, arama modalları
│   │   ├── watch-party/      # Oynatıcı, çalma listesi, kontroller
│   │   ├── settings/         # Ayarlar sekmeleri ve arama
│   │   ├── pages/ ui/        # Giriş/yükleme ekranları, ortak UI bileşenleri
│   │   └── …                 # Splash, güncelleme, moderasyon vb.
│   ├── modules/games/        # Netrex Games (motorlar, görünümler, Three.js sahneleri, testler)
│   ├── store/                # Zustand store'ları (auth, server, chat, dm, friend, settings, watchParty, spatialAudio, …)
│   ├── hooks/                # Presence, ses işleme, mic guard, spatial audio, watch party, ses grupları, …
│   ├── audio/                # Paylaşılan AudioContext, voiceProcessor, spatialEngine
│   ├── services/             # spatialAudioService, watchPartyService
│   ├── lib/                  # firebase, rtdbPresence, platformBridge (Electron/web ayrımı)
│   ├── constants/            # appConfig (limitler), watchPartyConstants
│   └── utils/                # keyMap, livekitPool, micConstraints, pointerFx, cleanup, …
├── public/
│   ├── sounds/               # Uygulama ses efektleri
│   ├── rnnoise-suppressor.worklet.js
│   └── voice-processor.worklet.js
├── scripts/                  # copy-env, fix-electron-paths, bundle-rnnoise-worklet, mac-fix.command
├── build-resources/          # macOS entitlements
├── .github/workflows/        # release.yml (çok platformlu build & release)
├── firestore.rules           # Firestore güvenlik kuralları
├── database.rules.json       # Realtime Database kuralları
└── release_v*.md             # Sürüm notları
```

---

## Mimari

```
┌──────────────────────────┐
│ Electron ana süreç       │  pencere, tray, güncelleme, global hotkey (uiohook),
│ electron/main.js         │  OAuth, overlay pencereleri, LiveKit token
└────────────┬─────────────┘
             │ IPC (preload.js → window.netrex)
┌────────────▼─────────────┐
│ Next.js renderer (React) │  UI, Zustand store'ları, Web Audio, oyunlar
└───────┬──────────┬───────┘
        │          │
   Firebase      LiveKit
 (Auth, Firestore, (ses/video/ekran, data channel,
  Realtime DB)      participant metadata)
```

- **Paketlenmiş uygulama HTTP üzerinden yüklenir.** `file://` yerine `127.0.0.1:17760` üzerinde küçük bir statik sunucu kullanılır; `file://` altında Chromium compositor'ı boşta bile yüksek CPU harcıyordu.
- **Platform ayrımı:** `src/lib/platformBridge.js` Electron'a özgü özellikleri (hotkey, overlay, güncelleme) web'de güvenle devre dışı bırakır.
- **Veri dağılımı:**
  - *Firestore*: kullanıcılar, sunucular (üyeler, banlar, kanallar), davetler, arkadaşlıklar, DM, mesajlar
  - *Realtime Database*: anlık varlık bilgisi (`user_presence`, `room_presence`, `user_voice_state`) ve tek kullanımlık sesli kanal komutları (`voice_commands`)
  - *LiveKit*: ses/video/ekran, yazıyor bilgisi ve oyun trafiği gibi anlık veri
- **Maliyet bilinci:** heartbeat aralıkları (sesteyken 2 dk, boşta 5 dk), toplu yazma (batch), sayfalı mesaj yükleme, ücretsiz katmanlara göre ayarlanmış dinleyiciler.

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

1. `package.json` sürümünü yükseltin (`npm version patch|minor|major`) ve `release_vX.Y.Z.md` notunu yazın.
2. `vX.Y.Z` etiketini push edin → **GitHub Actions** (`.github/workflows/release.yml`) Windows, macOS (x64 + arm64) ve Linux paketlerini derleyip GitHub Release'e yükler. Workflow elle de (`workflow_dispatch`) platform seçerek çalıştırılabilir.
3. Kurulu uygulamalar `electron-updater` ile yeni sürümü otomatik bulur.

Yerelden yayınlamak için: `npm run release` (GitHub token gerekir).

---

## Sorun Giderme

**Electron açılmıyor / LiveKit bağlanamıyor** — `.env.local` var mı ve `electron/.env.local` olarak kopyalandı mı (`node scripts/copy-env.js`)? `NEXT_PUBLIC_LIVEKIT_URL` `wss://` ile başlamalı.

**Build sonrası `/_next/` yolları bozuk** — `node scripts/fix-electron-paths.js` (normalde `postbuild` çalıştırır).

**Global kısayollar çalışmıyor** — Yalnızca Electron'da çalışır; Ayarlar → Kısayollar'dan atama yapın. macOS'ta Erişilebilirlik izni gerekir.

**Kullanıcılar sol listeden kayboluyor / "Bağlanıyor" takılıyor** — Realtime Database kurallarının (`database.rules.json`) yayınlandığından emin olun.

**macOS: "Netrex zarar görmüş, açılamıyor"** — Uygulama ad-hoc imzalıdır (Apple notarization yok). `Applications`'a taşıdıktan sonra:

```bash
xattr -cr /Applications/Netrex.app
```

(Repodaki `scripts/mac-fix.command` aynı işi yapar; Ayarlar → macOS Kurulumu'nda da yönergeler vardır.)

**macOS: Ekran paylaşımı / mikrofon / kamera izni sürekli isteniyor** — Her yeni sürümde imza değiştiği için eski izin kaydı geçersiz kalır:

```bash
tccutil reset ScreenCapture com.netrex.app
tccutil reset Camera com.netrex.app
tccutil reset Microphone com.netrex.app
tccutil reset Accessibility com.netrex.app
```

Netrex'i tamamen kapatıp (Cmd+Q) açın, izinleri verin ve **bir kez daha kapatıp açın**; ekran kaydı izni yeniden başlatmadan devreye girmez. macOS'ta ekran paylaşımında sistem sesi desteklenmez.

---

## Notlar

- `.env.local`, API anahtarları ve Firebase/LiveKit sırlarını asla commit etmeyin.
- Üretim öncesi `firestore.rules` ve `database.rules.json` dosyalarını kendi projenize yayınlayın.
- Sürüm notları için `release_v*.md` dosyalarına bakın.
- Repoda henüz bir `LICENSE` dosyası bulunmuyor.
