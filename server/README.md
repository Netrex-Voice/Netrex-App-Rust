# Netrex sunucusu (Vercel)

Masaüstü uygulamanın ihtiyaç duyduğu, **secret gerektiren** işleri yapar; böylece LiveKit ve Cloudinary anahtarları
uygulamanın içinde durmaz.

| Uç nokta | Yöntem | Ne yapar |
|---|---|---|
| `/api/livekit-token` | POST | Giriş yapmış kullanıcıya KENDİ kimliği için 24 saatlik oda token'ı verir |
| `/api/livekit-server-info` | GET | Seçili LiveKit sunucusunun URL'sini ve havuz bilgisini verir (key/secret asla) |
| `/api/cloudinary-delete` | POST | Cloudinary'den resim siler |
| `/api/health` | GET | Dağıtım ayakta mı, ortam değişkenleri tanımlı mı (değerleri göstermez) |

**Kimlik doğrulama:** `health` dışındaki her istek `Authorization: Bearer <Firebase ID token>` ister. Sunucu token'ı
Google'ın açık anahtarlarıyla doğrular (imza, süre, `iss`, `aud`). Token yalnızca kullanıcının kendi kimliği
(`identity === uid`) için verilir.

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

## Bilinen sınır
Token, oda adının kullanıcıya ait olup olmadığına bakmaz (eski davranışla aynı). Üyelik kontrolü Firestore'dan
yapılabilir; ayrı bir iş.
