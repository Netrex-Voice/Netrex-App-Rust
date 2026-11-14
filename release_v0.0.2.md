# Netrex v0.0.2: güvenlik ve performans sürümü

Bu sürüm yeni özellikten çok **sağlamlaştırma** içeriyor: hesap ve sunucu güvenliği, daha az veri kullanımı ve birkaç
can sıkıcı hatanın düzeltilmesi. Kurulu uygulama kendiliğinden güncellenir; "yeniden başlat" demen yeterli.

## Düzeltilen hatalar

- **Konuşma animasyonu:** yayın izlerken kimin konuştuğunu gösteren animasyon her yerde (sol liste, küçük oda kutusu,
  oyun içi overlay) duruyordu. Artık yayın açıkken de çalışıyor.
- **Bildirimler:** uygulama öndeyken gelen mesajlar "tauri.localhost" adlı Windows bildirimi olarak çıkıyordu. Artık
  uygulamanın kendi bildirimi gösteriliyor; Windows bildirimi yalnızca uygulama arka plandayken gidiyor. Özel mesaj
  bildirimine tıklayınca o konuşma açılıyor.
- **Ekran paylaşımı:** birincil ekran paylaşılırken görüntünün siyah/gri çıkmasına yol açtığını düşündüğümüz durum
  giderildi (overlay pencereleri artık yakalamaya dahil edilmiyor). Sorun sürerse bildir.
- **Kişileri fareyle taşıma:** sol listede kişileri sürükleyip başka kanala bırakma çalışmıyordu; düzeltildi.
- **Tam ekran:** yayını çift tıklayıp tam ekrana alırken/çıkarken görüntünün griye dönmesi giderildi.
- **Ses karıştırıcı:** Windows ses karıştırıcısında uygulama artık "WebView2" değil, "Netrex" adı ve simgesiyle görünüyor.
- **Oyunda imleç:** ekran paylaşırken oyunda imlecin kaybolduğu durumlar için paylaşım penceresine "İmleci Yayında Göster" seçeneği eklendi (kapatınca düzelmesi bekleniyor).
- **Resim indirme:** sohbetten resim indirince artık "indirildi" bildirimi çıkıyor.
- **Sunucu değiştirme:** sunucular arasında hızlı geçişte bazen önceki sunucunun geri gelmesi düzeltildi.
- **Sunucu silme:** silinen sunucunun mesajları, rozetleri ve davet kodları artık geride kalmıyor.
- Tarayıcıdan ekran paylaşımı denenirken oluşan bir çökme ve çıkış yaparken ayarlar ekranında oluşabilen bir hata giderildi.

## Güvenlik

- Sunucuya katılmak artık yalnızca **geçerli davetle** mümkün; yasaklanan kişi geri giremez, kimse kendine rol veremez.
- Kanal, rol, atma, yasaklama, susturma gibi işlemler artık sunucu tarafında **rol iznine göre** denetleniyor.
- Sesli odaya yalnızca o sunucunun üyeleri (özel aramalarda yalnızca konuşmanın tarafları) girebiliyor.
- Başkası adına mesaj gönderilemiyor; oda içi sustur/at komutlarında gönderenin yetkisi doğrulanıyor.
- E-posta adresin artık diğer kullanıcıların okuyabildiği profil kaydında tutulmuyor.
- Yüklediğin resimleri yalnızca sen (sunucu resimlerini yalnızca yöneticiler) silebiliyor.
- Bildirime tıklamak artık mesajdaki bağlantıyı kendiliğinden açmıyor.

## Performans

- Sohbet mesajları anında iletilmeye devam ediyor ama kalıcı kayıt **toplu** yapılıyor (daha az veri trafiği).
- Çevrimiçi durumu ve profil fotoğrafları için arka plandaki veri okuma belirgin biçimde azaltıldı.
- Kalabalık odalarda konuşma göstergesi ve ekran paylaşımı daha az işlemci kullanıyor.

## Bilinmesi gerekenler

- **Sunucu sahipleri:** yetkililerinin (rolle yetki verdiğin kişilerin) atma/kanal düzenleme gibi işlemleri
  yapabilmesi için güncellemeden sonra sunucunu **bir kez açman** yeterli. O ana kadar bu işlemler yalnızca sende çalışır.
- **Güncellemeyenler:** eski sürümde kalanlar bir süre sonra sunucuya katılamaz ve sesli odalara giremez; güncellemeleri gerekir.
- Uygulama arka plandayken gelen Windows bildirimi hâlâ "tauri.localhost" etiketiyle görünür.
- Bu sürümden önce yüklenmiş eski resimler silinince sunucuda kalabilir (yeni yüklenenlerde sorun yok).
- Kurucu hâlâ kod imzalama sertifikasıyla imzalı değil; ilk kurulumda Windows uyarısı çıkar.

## Doğrulama (SHA-256)

Kurucu derlendikten sonra buraya yazılacak.
