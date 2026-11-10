//! Otomatik güncelleme (Faz 6): Electron `updateManager.js` karşılığı, `tauri-plugin-updater` üzerinde.
//!
//! Akış (Electron ile aynı olaylar, arayüz değişmedi): `checking` → `available` (sürüm bilgisiyle) →
//! `update-progress` (yüzde) → `downloaded`; sorun olursa `error`; yenilik yoksa `not-available`.
//! İndirme otomatik başlar. Kurulum kullanıcı "yeniden başlat" deyince yapılır (`quit_and_install`).
//!
//! **Güncelleme adresi** koda gömülü değildir (sunucu henüz belli değil): `NETREX_UPDATE_URL` ortam
//! değişkeni / `.env.local` / derleme zamanı `NETREX_UPDATE_URL`. Tanımsızsa kontrol sessizce atlanır ve
//! `not-available` bildirilir (arayüzdeki açılış ekranı bu olayı bekler; olay gelmezse 5 sn takılır).
//! Adres, Tauri güncelleme JSON'unu (`version`, `platforms.<hedef>.url/signature`) döndürmelidir; paketler
//! `~/.tauri/netrex-updater.key` ile imzalanır, doğrulama anahtarı `tauri.conf.json > plugins.updater.pubkey`.
//! Paketlenmiş (release) derlemede çalışır; geliştirmede kontrol edilmez.

use std::{
    sync::Mutex,
    time::{Duration, Instant},
};

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

/// Periyodik kontrol aralığı (Electron: 30 dk; uygulama günlerce açık kalabilir).
const CHECK_INTERVAL: Duration = Duration::from_secs(30 * 60);
/// Açılışta ilk kontrolden önce kısa bekleme: ağ ve pencere hazır olsun.
const FIRST_CHECK_DELAY: Duration = Duration::from_millis(800);
/// "Yeniden başlat" tıklanınca kurulum öncesi bekleme (arayüz kurulum ekranını göstersin).
const RESTART_UI_DELAY: Duration = Duration::from_millis(1500);

#[derive(Default, PartialEq, Clone, Copy, Debug)]
enum Phase {
    #[default]
    Idle,
    Checking,
    Downloading,
    Downloaded,
}

#[derive(Default)]
pub struct UpdaterState {
    phase: Mutex<Phase>,
    /// İndirilmiş, kurulmaya hazır güncelleme: (güncelleme, paket baytları)
    ready: Mutex<Option<(Update, Vec<u8>)>>,
    /// Son bildirilen durum: arayüz dinleyicisini olaydan SONRA kurarsa (açılış yarışı) buradan alır.
    last: Mutex<Option<Value>>,
}

fn set_phase(app: &AppHandle, p: Phase) {
    if let Ok(mut g) = app.state::<UpdaterState>().phase.lock() {
        *g = p;
    }
}

fn phase(app: &AppHandle) -> Phase {
    app.state::<UpdaterState>().phase.lock().map(|g| *g).unwrap_or_default()
}

fn status(app: &AppHandle, s: &str, info: Option<Value>) {
    let payload = match info {
        Some(i) => json!([s, i]),
        None => json!([s]),
    };
    if let Ok(mut l) = app.state::<UpdaterState>().last.lock() {
        *l = Some(payload.clone());
    }
    let _ = app.emit_to("main", "update-status", payload);
}

/// Son güncelleme durumu `[durum, bilgi?]` (henüz yoksa `null`). Köprü, yeni abonelere bunu tekrar verir.
#[tauri::command]
pub fn update_last_status(app: AppHandle) -> Option<Value> {
    app.state::<UpdaterState>().last.lock().ok().and_then(|l| l.clone())
}

/// Güncelleme adresi: ortam değişkeni > `.env.local` > derleme zamanı değeri. Yalnızca https (veya yerel test).
fn endpoint(app: &AppHandle) -> Option<url::Url> {
    let raw = std::env::var("NETREX_UPDATE_URL")
        .ok()
        .or_else(|| crate::envfile::load(app).0.get("NETREX_UPDATE_URL").cloned())
        .or_else(|| option_env!("NETREX_UPDATE_URL").map(str::to_string))?;
    parse_endpoint(&raw)
}

fn parse_endpoint(raw: &str) -> Option<url::Url> {
    let u = url::Url::parse(raw.trim()).ok()?;
    let local = matches!(u.host_str(), Some("localhost") | Some("127.0.0.1"));
    (u.scheme() == "https" || (u.scheme() == "http" && local)).then_some(u)
}

fn info_of(u: &Update) -> Value {
    json!({
        "version": u.version,
        "releaseDate": u.date.map(|d| d.to_string()),
        "releaseNotes": u.body,
    })
}

/// Bir kontrol + (varsa) otomatik indirme. Hata `error` olayı olarak bildirilir, yutulmaz.
async fn check_and_download(app: &AppHandle) {
    if matches!(phase(app), Phase::Checking | Phase::Downloading | Phase::Downloaded) {
        return; // zaten sürüyor / hazır
    }
    let Some(url) = endpoint(app) else {
        status(app, "not-available", None);
        return;
    };
    set_phase(app, Phase::Checking);
    status(app, "checking", None);
    crate::lifecycle::trace(app, "updater: kontrol ediliyor");

    let result: Result<Option<Update>, String> = async {
        let updater = app
            .updater_builder()
            .endpoints(vec![url])
            .map_err(|e| e.to_string())?
            .build()
            .map_err(|e| e.to_string())?;
        updater.check().await.map_err(|e| e.to_string())
    }
    .await;

    let update = match result {
        Ok(Some(u)) => u,
        Ok(None) => {
            set_phase(app, Phase::Idle);
            status(app, "not-available", None);
            return;
        }
        Err(e) => {
            set_phase(app, Phase::Idle);
            crate::lifecycle::trace(app, &format!("updater: kontrol HATA {e}"));
            status(app, "error", Some(Value::String(e)));
            return;
        }
    };

    crate::lifecycle::trace(app, &format!("updater: yeni sürüm {}", update.version));
    status(app, "available", Some(info_of(&update)));
    set_phase(app, Phase::Downloading);

    let mut got: u64 = 0;
    let mut last_pct: i64 = -1;
    let mut last_emit = Instant::now() - Duration::from_secs(1);
    let app2 = app.clone();
    let bytes = update
        .download(
            move |chunk, total| {
                got += chunk as u64;
                if let Some(t) = total.filter(|t| *t > 0) {
                    let pct = ((got as f64 / t as f64) * 100.0).round() as i64;
                    // Yüzde değiştiğinde ve en çok 10 kez/sn bildir
                    if pct != last_pct && last_emit.elapsed() >= Duration::from_millis(100) {
                        last_pct = pct;
                        last_emit = Instant::now();
                        let _ = app2.emit_to("main", "update-progress", pct.clamp(0, 100));
                    }
                }
            },
            || {},
        )
        .await;

    match bytes {
        Ok(b) => {
            let _ = app.emit_to("main", "update-progress", 100);
            let info = info_of(&update);
            if let Ok(mut r) = app.state::<UpdaterState>().ready.lock() {
                *r = Some((update, b));
            }
            set_phase(app, Phase::Downloaded);
            crate::lifecycle::trace(app, "updater: indirildi, kurulmaya hazır");
            status(app, "downloaded", Some(info));
        }
        Err(e) => {
            set_phase(app, Phase::Idle);
            crate::lifecycle::trace(app, &format!("updater: indirme HATA {e}"));
            status(app, "error", Some(Value::String(e.to_string())));
        }
    }
}

pub fn setup(app: &AppHandle) {
    app.manage(UpdaterState::default());
    if cfg!(debug_assertions) {
        // Electron: paketlenmemişte kontrol yok. Açılış ekranı beklemesin diye yine de bildir.
        let app = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(FIRST_CHECK_DELAY);
            status(&app, "not-available", None);
        });
        return;
    }
    let app = app.clone();
    std::thread::Builder::new()
        .name("updater".into())
        .spawn(move || {
            std::thread::sleep(FIRST_CHECK_DELAY);
            loop {
                tauri::async_runtime::block_on(check_and_download(&app));
                std::thread::sleep(CHECK_INTERVAL);
            }
        })
        .ok();
}

/// Arayüz "yeniden başlat" dedi: renderer temizliği → kurulum. Başarısızlıkta `update-restart-failed`.
#[tauri::command]
pub fn quit_and_install(app: AppHandle) {
    let _ = app.emit_to("main", "update-restarting", ());
    std::thread::spawn(move || {
        std::thread::sleep(RESTART_UI_DELAY);
        let fail = |msg: String| {
            crate::lifecycle::trace(&app, &format!("updater: kurulum HATA {msg}"));
            let _ = app.emit_to("main", "update-restart-failed", msg);
        };
        if cfg!(debug_assertions) {
            return fail("Geliştirme modunda gerçek güncelleme yapılamaz.".into());
        }
        let ready = app.state::<UpdaterState>().ready.lock().ok().and_then(|mut r| r.take());
        let Some((update, bytes)) = ready else {
            return fail("İndirilmiş güncelleme bulunamadı.".into());
        };
        // Odadan çık, durumu güncelle… (normal çıkıştaki temizlik), sonra overlay'leri kapat ve kur.
        let cleaned = crate::lifecycle::renderer_cleanup(&app);
        crate::lifecycle::trace(&app, &format!("updater: temizlik {}", if cleaned { "tamam" } else { "ZAMAN AŞIMI" }));
        crate::overlay::shutdown(&app);
        match update.install(bytes) {
            // Windows'ta kurucu başlatılır ve süreç kapanır; diğer platformlarda yeniden başlat
            Ok(()) => app.restart(),
            Err(e) => {
                // Paket bellekte kalmadı (install tükettiyse): yeniden indirilsin
                set_phase(&app, Phase::Idle);
                fail(e.to_string());
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::parse_endpoint;

    #[test]
    fn endpoint_accepts_https_and_local_http_only() {
        assert!(parse_endpoint("https://updates.example.com/latest.json").is_some());
        assert!(parse_endpoint("  https://x.y/z  ").is_some());
        assert!(parse_endpoint("http://localhost:8080/latest.json").is_some());
        assert!(parse_endpoint("http://127.0.0.1/x").is_some());
        assert!(parse_endpoint("http://updates.example.com/x").is_none()); // düz http: MITM
        assert!(parse_endpoint("file:///C:/x").is_none());
        assert!(parse_endpoint("").is_none());
        assert!(parse_endpoint("not a url").is_none());
    }
}
