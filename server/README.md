# Netrex sunucusu (Vercel)

Masaüstü uygulamanın ihtiyaç duyduğu, **secret gerektiren** işleri yapar; böylece LiveKit ve Cloudinary anahtarları
uygulamanın içinde durmaz.

| Uç nokta | Yöntem | Ne yapar |
|---|---|---|
| `/api/livekit-token` | POST | Giriş yapmış kullanıcıya KENDİ kimliği ve GİRMEYE YETKİLİ olduğu oda için 6 saatlik token verir |
| `/api/livekit-server-info` | GET | Seçili LiveKit sunucusunun URL'sini ve havuz bilgisini verir (key/secret asla) |
| `/api/cloudinary-sign` | POST | İmzalı yükleme parametreleri verir; klasörü sunucu belirler (kullanıcının ya da üyesi olduğu sunucunun klasörü) |
| `/api/cloudinary-delete` | POST | Resmi siler: yalnızca sahibi (kendi klasörü) ya da sunucunun yöneticisi |
| `/api/health` | GET | Dağıtım ayakta mı, ortam değişkenleri tanımlı mı (değerleri göstermez) |

**Kimlik doğrulama:** `health` dışındaki her istek `Authorization: Bearer <Firebase ID token>` ister. Sunucu token'ı
Google'ın açık anahtarlarıyla doğrular (imza, süre, `iss`, `aud`).

**Yetki:** Sunucu, Firestore'u kullanıcının KENDİ token'ıyla okur (servis hesabı yok). Bir belgeyi okuyabilmek,
depodaki güvenlik kurallarına (`firestore.rules`) göre yetkili olmak demektir:

- Sunucu kanalı odası → istek `serverId` taşır ve kullanıcı `servers/{serverId}/channels/{oda}` belgesini
  okuyabilmelidir (yani o sunucunun üyesidir; atılan/yasaklanan kişi okuyamaz).
- DM araması (`dm_call_<konuşmaId>`) → kullanıcı `dm_conversations/{konuşmaId}` belgesini okuyabilmelidir.
- Sunucu resmi silme → sahibi ya da `MANAGE_SERVER` izni olan üye (`servers/{id}/meta/perms`).

Bu yüzden **güvenlik kurallarının yayınlanmış olması şarttır**: kurallar eskiyse yetki kontrolü de eski kurallara göre yapılır.

**Hız sınırı:** kullanıcı başına dakikada 40 token, 30 yükleme imzası, 30 silme (örnek başına, en iyi çaba).

**Eski istemciler:** `serverId` göndermeyen (güncellenmemiş) uygulamalar varsayılan olarak reddedilir. Geçiş süresince
Vercel'de `ALLOW_LEGACY_CLIENTS=1` tanımlanırsa kabul edilirler (ve sahibi bilinmeyen eski resimler silinebilir).
Herkes güncellendikten sonra bu değişkeni kaldırın.

## Kurulum (Vercel)
1. Vercel > Add New > Project > bu GitHub deposunu seç.
2. **Root Directory: `server`**, Framework Preset: **Other**.
3. Environment Variables: `.env.example` içindeki değişkenleri gir (gerçek değerler yalnızca burada).
4. Deploy. `https://<proje>.vercel.app/api/health` açılınca `ok: true` ve sayıları görmelisin.
5. Uygulamayı derlerken `.env.local` içine `NEXT_PUBLIC_NETREX_API_URL=https://<proje>.vercel.app` ekle.

## Test
```
cd server
npm install
npm test
```

## Bilinen sınırlar
- Hız sınırı sunucusuz örnekler arasında paylaşılmaz; kesin bir kota değildir.
- Kanal bazlı "bağlanma" izinleri (permissionOverwrites) sunucuda denetlenmez; üyelik denetlenir.
- Yeni klasör düzeninden (netrex/u/..., netrex/s/...) önce yüklenmiş resimlerin sahibi bilinmez; yalnızca geçiş modunda silinebilir.
