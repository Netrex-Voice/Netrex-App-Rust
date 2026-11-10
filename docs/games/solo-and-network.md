# Netrex Games — tek kişilik oyunlar ve ağ katmanı

Bu not, `netrex-games-v4/docs/games/README.md` içindeki mimari belgesini tamamlar. **Canlı kod `src/modules/games` içindedir**;
`netrex-games-v4/` eski (v8.1.3) ve eksik bir anlık görüntüdür, uygulama onu kullanmaz.

## Ağ: doğrudan (P2P) taşıyıcı

Oyun trafiği eskiden yalnızca LiveKit veri kanalından (SFU üzerinden) gidiyordu. Şimdi:

| Yol | Ne için |
|---|---|
| `RTCDataChannel` `rt` (sırasız, `maxRetransmits: 0`) | 60 Hz anlık görüntü, hareket, ping — kayıp paket beklenmez |
| `RTCDataChannel` `rel` (sıralı, güvenilir) | vuruş iddiası, komutlar, olaylı durumlar |
| LiveKit veri kanalı | sinyalleşme (`gm_sig`), lobi yayınları, **P2P kurulamazsa yedek** |

* Kod: `p2p.js` (`PeerLink`, `LinkRouter`), köprü `GamesHandler.jsx`. Sinyalleşme LiveKit'in imzaladığı kimlikle yapılır; bir P2P hattı
  yalnızca sinyali gönderen kimliğe bağlanır. Yalnızca host teklif (offer) kabul eder.
* STUN: Google. İsteğe bağlı TURN: `NEXT_PUBLIC_GAMES_TURN_URL/USER/CRED` (`env.example`). TURN yoksa simetrik NAT'ta hat kurulamaz ve
  oyun otomatik olarak LiveKit'ten sürer.
* Gizlilik: P2P'de karşı oyuncu IP adresini görür. Oyunlar → Görünüm ve ses → "Doğrudan bağlantı (P2P)" ile kapatılır.
* Oyun başlığında RTT'nin yanında `· P2P` görünüyorsa hat doğrudandır.
* Ping artık oyun trafiğiyle aynı yoldan (kayıplı kanal) gönderilir; RTT gerçek durum yolunu ölçer.

### Başlangıç titremesi (düzeltildi)
`Predictor.snapshot()` canlı olmayan fazlarda (geri sayım, gol arası) tüm yerel durumu host görüntüsüyle değiştiriyor ve kendi
raketi yalnızca canlı fazda koruyordu. Geri sayımda raket her karede işaretçiyi izlerken her anlık görüntüde host'un RTT kadar eski
kopyasına geri atılıyordu. Artık kendi raket (işaretçi varsa) her fazda yereldir. Regresyon testi: `netcode.test.js`.

## Tek kişilik oyunlar

Manifestte `solo: true`, `category: "solo"`, `engine` yok, yalnızca `view`. Ağ/LiveKit gerekmez.

* `SoloRoom.jsx`: kabuk (üst çubuk, ses, tam ekran, hata sınırı). Hub'daki "Oyna" düğmesi ve `SoloArcade.jsx` kullanır.
* `SoloArcade.jsx`: ses odası dışında, sol raydaki **Tek Kişilik Oyunlar** düğmesiyle açılır (ayarlardan oyunlar kapalıysa görünmez).
* Durum bu cihazda saklanır (localStorage): `chessStore.js`, `hillStore.js`.

### Satranç
* `engines/chess/core.js`: kurallar (rok, geçerken alma, terfi, pat, yetersiz materyal, 50 hamle, üçlü tekrar). **Perft** ile doğrulandı
  (başlangıç, Kiwipete, 3 ek pozisyon).
* `engines/chess/search.js`: alfa-beta, yinelemeli derinleştirme, TT, boş hamle, LMR, sakin arama. `worker.js` + `botClient.js` ile
  Web Worker'da çalışır; Worker açılamazsa ana iş parçacığında ≤700 ms ile döner.
* `engines/chess/bots.js`: 13 bot (250–2400). **Puanlar tahminidir**: komşu seviyeler birbirine karşı kısa turnuvalarla (2–4 maç) sıralandı;
  250→1600 arası ve 1800<2000<2200<2400 yönü ölçüldü, 2200/2400 son süre ayarıyla yeniden ölçülmedi. Gerçek bir Elo havuzuyla kalibre edilmedi.
  Yüksek botlar süreyle sınırlıdır: gücü CPU hızına bağlıdır, 2200+ botlar hamle başına birkaç saniye düşünür.
* `engines/chess/rating.js`: Elo, K=40 (ilk 30 maç) → 20 → 10 (2400+), alt sınır 100. Bullet / Blitz / Rapid ayrı puan.
* Puanlı maç = süreli maç. Yarım kalan oyun saat damgasıyla saklanır: oyundan çıkmak/uygulamayı kapatmak saati durdurmaz, süre bitince
  mağlubiyet yazılır (puan kasmak için kaçmak işe yaramaz). İki hamle yapılmadan vazgeçmek puansızdır.

### Tepe Tırmanışı
* `engines/hillclimb.js`: 240 Hz alt adımlı 2B araç fiziği — gövde + ışın izlemeli yay/sönümleyici süspansiyon + kayma (slip) modelli
  tekerlek. Havada gaz/fren burnu döndürür. Düşük yerçekiminde (Ay) motor ve tutuş ölçeklenir.
* Arazi tohumdan deterministik, mesafeyle zorlaşır; altın ve benzin bidonu parça başına üretilir.
* 3 araç, 4 bölüm (Kır, Çöl, Kutup, Ay), motor/süspansiyon/lastik/4x4 yükseltmeleri. Bölümler önceki bölümde istenen mesafeyle açılır.
* **Görseller ve sesler özgündür** (kodla çizilen vektörler ve WebAudio sentezi). Orijinal "Hill Climb Racing" oyununun varlıkları
  telifli olduğu için kullanılmaz/kopyalanmaz; mekanikler benzerdir, görsel kimlik değildir.

## Diğer tek kişilik oyunlar
`solo/kit.jsx` ortak arcade çatısıdır (hub ile aynı görsel dil: kalın renkli kenarlık, gölgeli `ArcadeBtn`, hap şeklinde skor kutuları, klavye/kaydırma/döngü yardımcıları, cihaz-yerel rekor deposu).
Saf motorlar `solo/engines/` altında ve `__tests__/solo.test.js` ile test edilir:

| Oyun | Motor | Not |
|---|---|---|
| 2048 | `g2048.js` | ok/WASD/kaydır |
| Yılan | (görünüm içinde) | hızlanma, altın elma |
| Mayın Tarlası | `minesweeper.js` | ilk tık güvenli, akor açma, bayrak modu, 3 boyut |
| Hafıza | (görünüm içinde) | 3 boyut, en az hamle |
| Tuğla Kırma | (görünüm içinde) | seviyeler, sağlam tuğla |
| Blok Yığma | `tetris.js` | 7'li torba, duvar tepmesi, gölge parça, kademeli hız |
| 4 Bağla | `connect4.js` | alfa-beta bot, 3 seviye |
| Kanatlı | (görünüm içinde) | |

Yeni tek kişilik oyun: `views/<Ad>View.jsx` yaz (`Frame`/`Overlay` kullan), `registry.js`'e `solo: true` manifest ekle, `covers.jsx`'e kapak ekle.
