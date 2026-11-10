NPM'in içinde versiyonu otomatik artıran harika bir araç var. Dosyayı açıp düzenlemek yerine terminale şu komutlardan birini yazabilirsin:

- **Ufak düzeltmeler için (1.0.0 -> 1.0.1):**
  ```powershell
  npm version patch
  ```
- **Yeni özellikler eklediysen (1.0.0 -> 1.1.0):**
  ```powershell
  npm version minor
  ```
- **Çok büyük değişiklikler yaptıysan (1.0.0 -> 2.0.0):**
  ```powershell
  npm version major
  ```

**Bu komutu yazdığında:**

1.  `package.json` dosyasındaki sayıyı otomatik artırır.
2.  `package-lock.json` dosyasını günceller.
3.  Otomatik olarak bir Git commit'i oluşturur (Git kullanıyorsan).

---

### Özet: Güncelleme Yayınlama Rutinin Şöyle Olmalı

Bundan sonra bir güncelleme yapacağın zaman sırasıyla şu 3 adımı yapacaksın:

1.  Kodlarında değişikliklerini yap ve kaydet.
2.  Versiyonu yükselt:
    ```powershell
    npm version patch
    ```
3.  Paketle ve GitHub'a gönder:
    ```powershell
    npm run release
    ```

Bu kadar! Yeni sürüm GitHub'a düştüğünde, uygulamayı kullanan herkeste "Güncelleme Var" bildirimi çıkacaktır.
