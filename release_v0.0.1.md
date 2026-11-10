# Netrex v0.0.1: Rust sürümünün ilk yayını

Netrex, Discord benzeri bir sesli sohbet ve mesajlaşma uygulamasıdır. Bu sürüm, uygulamanın **Electron'dan Tauri (Rust) altyapısına taşınmış ilk halidir**. Arayüz ve özellikler aynı kaldı, altyapı baştan yazıldı. Rust sürümü bu yüzden **0.0.1'den** başlıyor.

## İndirme ve kurulum

1. Aşağıdaki **`Netrex_0.0.1_x64-setup.exe`** dosyasını indir ve çalıştır.
2. Kurulum **yönetici izni istemez**, yalnızca senin kullanıcın için kurulur.
3. Windows "bilgisayarınızı korudu" uyarısı gösterirse **Daha fazla bilgi → Yine de çalıştır** de. (Bkz. [Bilinen sınırlar](#bilinen-sınırlar))

**Gereksinim:** Windows 10 veya 11 (64 bit). WebView2 Windows 11'de yerleşiktir, Windows 10'da kurucu gerekirse kendisi indirir.

**Doğrulama (SHA-256):** `9c9940bbb2f8df83c8233dd1365d583930e587d8c1d38ca2901ad6e4e4c2ec7e`
PowerShell'de `Get-FileHash .\Netrex_0.0.1_x64-setup.exe` çıktısı bununla aynı olmalı.

**Eski Electron sürümünü kullanıyorsan:** Önce onu **Ayarlar → Uygulamalar**'dan kaldırmanı öneririz. İkisi de aynı klasöre kurulmaya çalışır. Eski sürümdeki ayarların (kısayollar vb.) ilk açılışta otomatik içe aktarılması hedeflendi. İlk açılışta bir kez yeniden giriş yapman gerekebilir.

## Neler var?

**Sunucular ve kanallar**
- Çoklu sunucu (en fazla 10), davet kodlarıyla katılım, üye listesi
- Sesli ve yazılı kanallar, roller ve izinler, yasaklama, moderasyon paneli
- Sesli kanalda üye taşıma ve atma komutları, Sahne (Stage) yönetimi

**Sesli iletişim**
- LiveKit (WebRTC) üzerinden düşük gecikmeli ses
- Gürültü bastırma (RNNoise), yankı engelleme, otomatik kazanç, ses eşiği
- Mikrofon / hoparlör / kamera seçimi, kullanıcı başına ses seviyesi
- **Mic Guard:** mikrofon kapalıyken konuşursan uyarır (ses yalnızca yerelde analiz edilir)
- **Uzamsal ses:** kullanıcıları 2B alanda konumlandırıp mesafeye göre duyma
- Ses grupları, global kısayollar (sustur / sağırlaştır / bas-konuş), uygulama arka plandayken de çalışır
- Otomatik LiveKit sunucu yedeklemesi

**Görüntü ve paylaşım**
- Kamera ve **ekran paylaşımı** (ekran veya tek pencere seçimi, uygulamaya özel ses)
- **İşaretçi paylaşımı:** imlecini odadakilere göster
- Oyun içi **overlay'ler:** sesli kanal overlay'i, kayan mesaj (ticker), işaretçi

**Watch Party**
- Senkronize video / müzik izleme (YouTube, SoundCloud, genel oynatıcılar)
- Ortak çalma listesi, oylama, YouTube playlist içe aktarma

**Mesajlaşma ve hesap**
- Sunucu mesajları, arkadaşlar, DM, sesli/görüntülü arama daveti
- Markdown, emoji, görsel yükleme, yazıyor göstergesi, okunmamış sayacı
- Google ile giriş ve misafir girişi, profil fotoğrafı ve teması, çevrimiçi durum

**Netrex Games**
- Air Hockey, Ping Pong, Bilardo, Tabu, Emlak, Okey (sesli odada)
- Tek kişilik: Elo'lu Satranç (13 botluk merdiven), Tepe Tırmanışı

## Bu sürümde değişenler (altyapı)

- **Çok daha küçük kurulum:** ~9,8 MB kurucu (Electron sürümünün ana programı tek başına ~210 MB idi).
- **Sunucu tarafı token:** LiveKit ve Cloudinary anahtarları artık uygulamanın içinde **değil**, ayrı bir sunucuda duruyor. Sesli odaya girmek için Firebase girişin sunucu tarafından doğrulanıyor ve token yalnızca kendi kimliğin için veriliyor.
- **Ekran paylaşımı yeniden yazıldı:** Windows Graphics Capture ile GPU üzerinden yakalama; pencere paylaşımında yalnızca o uygulamanın sesi, ekran paylaşımında Netrex'in kendi sesi karışmadan sistem sesi.
- **Overlay'ler baştan yazıldı:** oyunun üstünde kalır, odağı çalmaz, yalnızca düğmelerin üstündeyken tıklanabilir, altındaki oyunu engellemez. Anti-cheat yazılımı (Vanguard, BattlEye, EasyAntiCheat) çalışıyorsa overlay otomatik gizlenir.
- **Global kısayollar** iki bağımsız yolla izleniyor; biri sessizce devre dışı kalsa bile kısayol çalışır.
- **Otomatik güncelleme:** yeni sürüm çıkınca uygulama kendisi indirir, "yeniden başlat" deyince kurar. Güncellemeler imzalıdır, imzası doğrulanmayan paket kurulmaz.
- **Daha güvenli uygulama:** katı içerik güvenlik ilkesi (CSP), yayın sürümünde geliştirici araçlarının ve sağ tık menüsünün kapalı olması, mikrofon/kamera izninin yalnızca uygulamanın kendisine verilmesi.
- Tepsiye küçülme, tek örnek (ikinci kez açınca mevcut pencere öne gelir), düzgün kapanış akışı.

## Düzeltilen hatalar

- **Bellek sızıntısı:** Her ekran paylaşımı açıp kapatmada yaklaşık **90 MB** bellek geri verilmiyordu. Giderildi: yayın başına yaklaşık 93 MB artış, yaklaşık 2 MB'a düştü (ilk birkaç yayındaki tek seferlik ısınma hariç).
- **Resim silme:** Silinen resimler Cloudinary'de artık dosya olarak kalıyordu (Electron'da bu özellik hiç çalışmıyordu). Artık çalışıyor.
- **Kısayol atama:** tuş atama ve ayar penceresi açıkken kısayolların kaybolması düzeltildi; Sağ Shift gibi tuşlar doğru ayırt ediliyor.
- **Ses overlay'i:** ayarlar değişince overlay'in kaybolup geri gelmemesi, anti-cheat sonrası yeniden belirmesi ve kullanıcı adlarının sayfaya ham HTML olarak girmesi düzeltildi.
- Açılışta iki ayrı yükleme ekranının üst üste gelmesi giderildi.

## Bilinen sınırlar

- **Yalnızca Windows 10/11 (64 bit).** macOS ve Linux sürümleri henüz yok.
- **Windows uyarısı çıkar.** Kurucu henüz bir kod imzalama sertifikasıyla imzalanmadı, bu yüzden SmartScreen "bilinmeyen yayıncı" der. Yukarıdaki SHA-256 ile dosyayı doğrulayabilirsin.
- **Overlay'ler** Başlat menüsünün ve görev çubuğu açılırlarının **altında** kalır. Gerçek **özel tam ekran** (exclusive fullscreen) oyunların üstünde görünmez; kenarlıksız/pencereli tam ekranda görünür.
- **Sistem sesi paylaşımı** Windows 10 sürüm 2004 ve sonrası gerektirir.
- Oyun içinde kısayol ve overlay davranışı çok sayıda farklı oyunla denenmedi; sorun görürsen bildir.
- Birden fazla monitörde işaretçi overlay'i yalnızca ana monitörü kaplar.
- İlk sürüm olduğu için **güncelleme akışı gerçek bir ikinci sürümle henüz denenmedi.**

## Sorun bildirme

Bir hata görürsen [Issues](https://github.com/Netrex-Voice/Netrex-App-Rust/issues) sayfasından yaz. Windows sürümünü ve ne yaptığını ekle.
