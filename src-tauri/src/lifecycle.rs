//! Pencere yaşam döngüsü (Faz 1).
//!
//! Electron karşılıkları: `windowManager.js` (ana pencere, kapatma
//! davranışı, pencere durumu olayları), `trayManager.js`, `main.js` (graceful exit).

use crate::store::Store;
use std::{
    sync::{
        atomic::{AtomicBool, Ordering::SeqCst},
        mpsc, Mutex,
    },
    time::Duration,
};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, RunEvent, WebviewWindow, WindowEvent,
};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

/// Yaşam döngüsü iz günlüğü: `<app_log_dir>/netrex.log` (electron-log karşılığı, Faz 1 sürümü).
/// Çıkış/splash gibi kullanıcıya görünen ama tekrarlaması zor akışları teşhis etmek için.
pub(crate) fn trace(app: &AppHandle, msg: &str) {
    use std::io::Write;
    let Ok(dir) = app.path().app_log_dir() else { return };
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join("netrex.log");
    // 512 KB'ı aşarsa sıfırla (basit döndürme).
    if std::fs::metadata(&path).map(|m| m.len() > 512 * 1024).unwrap_or(false) {
        let _ = std::fs::remove_file(&path);
    }
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| format!("{}.{:03}", d.as_secs(), d.subsec_millis()))
        .unwrap_or_default();
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(f, "[{now}] {msg}");
    }
}

/// WebView2 (Chromium) başlatma bayrakları. Electron'daki `disable-renderer-backgrounding`
/// karşılığı: pencere gizlenince/örtülünce sesli sohbet (WebRTC) kopmasın, sesli oda arka planda
/// çalışsın. ÖNEMLİ: Aynı kullanıcı verisi klasörünü paylaşan TÜM pencereler (ana pencere,
/// splash'lar) bu bayrakları birebir aynı vermelidir, yoksa WebView2 ikinci pencerede hata verir.
/// `tauri.conf.json` içindeki `additionalBrowserArgs` ile aynı olduğu testle denetlenir.
pub const WEBVIEW2_BROWSER_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,CalculateNativeWinOcclusion --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --autoplay-policy=no-user-gesture-required";

/// Hatırlanacak pencere özellikleri. VISIBLE bilerek yok: pencere, sayfa hazır olunca (`splash_complete`) gösterilir.
pub fn window_state_flags() -> StateFlags {
    StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED | StateFlags::FULLSCREEN
}

/// Eklenti diske yalnızca çıkışta yazar; tray'de günlerce açık kalan, Windows kapanışında
/// veya çökmeyle ölen bir uygulamada konum kaybolurdu. Bu yüzden taşıma/boyutlandırma
/// durulduktan sonra (debounce) ve tray'e gizlerken diske yazılır.
const STATE_SAVE_DEBOUNCE: Duration = Duration::from_millis(1500);

fn save_window_state_now(app: &AppHandle) {
    let _ = app.save_window_state(window_state_flags());
}

fn schedule_window_state_save(app: &AppHandle) {
    let gen = app
        .state::<LifecycleState>()
        .save_generation
        .fetch_add(1, SeqCst)
        + 1;
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(STATE_SAVE_DEBOUNCE);
        // Bu arada yeni bir taşıma/boyutlandırma olduysa o kendi kaydını yapacak.
        if app.state::<LifecycleState>().save_generation.load(SeqCst) == gen {
            save_window_state_now(&app);
        }
    });
}

/// Renderer hiç `splash-complete` (ana pencere hazır) göndermezse (ağ yavaş, hata) pencere bu süre sonra yine de gösterilir.
const SHOW_TIMEOUT: Duration = Duration::from_secs(8);
/// Renderer temizliği bitirmezse beklenecek en fazla süre (Electron: 3 sn).
const CLEANUP_TIMEOUT: Duration = Duration::from_secs(3);
/// Sürecin başladığı an: açılışın ne kadar sürdüğünü günlüğe yazmak için.
static START: std::sync::OnceLock<std::time::Instant> = std::sync::OnceLock::new();

#[derive(Default)]
pub struct LifecycleState {
    /// Kullanıcı gerçekten çıkmak istedi (close-to-tray'i atla).
    quitting: AtomicBool,
    /// Graceful çıkış akışı başladı (tekrar başlatma).
    exit_started: AtomicBool,
    /// Akış bitti; `exit` artık engellenmesin.
    exit_allowed: AtomicBool,
    /// Önceki Resized olayındaki küçültülmüş durum (minimize/restore ayrımı için).
    was_minimized: AtomicBool,
    /// Pencere durumu kaydı için debounce sayacı.
    save_generation: std::sync::atomic::AtomicU64,
    /// Renderer'ın `cleanup-complete` sinyalini bekleyen kanal.
    cleanup_tx: Mutex<Option<mpsc::Sender<()>>>,
}

// ---------------------------------------------------------------- pencereler


fn ensure_main_on_screen(main: &WebviewWindow) {
    let on_screen = match (main.outer_position(), main.available_monitors()) {
        (Ok(p), Ok(mons)) => mons.iter().any(|m| {
            let (mp, ms) = (m.position(), m.size());
            // Başlık çubuğunun tutulabilir bir kısmı bu monitörde olmalı.
            p.x + 100 > mp.x
                && p.x < mp.x + ms.width as i32 - 100
                && p.y >= mp.y - 16
                && p.y < mp.y + ms.height as i32 - 50
        }),
        _ => false,
    };
    if !on_screen {
        let _ = main.center();
    }
}

/// Ana pencereyi gösterir (Electron: `showMainWindow`). Açılışta splash YOK: pencere, sayfa tamamen hazır olana
/// kadar gizli tutulur (yoksa gri/boş ekran görünürdü) ve hazır olunca bir anda açılır.
pub fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        if !w.is_visible().unwrap_or(true) {
            if let Some(t0) = START.get() {
                trace(app, &format!("açılış: ana pencere gösterildi ({} ms)", t0.elapsed().as_millis()));
            }
        }
        if w.is_minimized().unwrap_or(false) {
            let _ = w.unminimize();
        }
        let _ = w.show();
        let _ = w.set_focus();
        let _ = app.emit_to("main", "window-state-changed", "shown");
    }
}

fn emit_state(app: &AppHandle, state: &str) {
    let _ = app.emit_to("main", "window-state-changed", state);
}

fn attach_main_window_events(app: &AppHandle, main: &WebviewWindow) {
    let handle = app.clone();
    main.on_window_event(move |event| match event {
        WindowEvent::CloseRequested { api, .. } => {
            if handle.state::<LifecycleState>().quitting.load(SeqCst) {
                return; // gerçek çıkış: kapanmaya izin ver
            }
            api.prevent_close();
            // Eklenti önbelleği bu olayda güncelledi; tray'de ölürsek kaybolmasın diye diske yaz.
            save_window_state_now(&handle);
            let close_to_tray = handle.state::<Store>().get_bool("closeToTray", true);
            if close_to_tray {
                if let Some(w) = handle.get_webview_window("main") {
                    let _ = w.hide();
                }
                emit_state(&handle, "hidden");
            } else {
                // Graceful çıkış: renderer onay/temizlik akışını yürütür.
                let _ = handle.emit_to("main", "request-exit", ());
                if let Some(w) = handle.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        }
        WindowEvent::Focused(true) => emit_state(&handle, "focused"),
        WindowEvent::Moved(_) => schedule_window_state_save(&handle),
        WindowEvent::Resized(_) => {
            schedule_window_state_save(&handle);
            // Tauri'de ayrı minimize/restore olayı yok; Resized'da durumu karşılaştır.
            if let Some(w) = handle.get_webview_window("main") {
                let now = w.is_minimized().unwrap_or(false);
                let was = handle
                    .state::<LifecycleState>()
                    .was_minimized
                    .swap(now, SeqCst);
                if now && !was {
                    emit_state(&handle, "minimized");
                } else if !now && was {
                    emit_state(&handle, "restored");
                }
            }
        }
        _ => {}
    });
}

// ---------------------------------------------------------------------- tray

fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "tray-show", "Netrex'i Göster", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "tray-quit", "Çıkış Yap", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &sep, &quit])?;

    let mut builder = TrayIconBuilder::with_id("main-tray")
        .tooltip("Netrex")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "tray-show" => show_main(app),
            "tray-quit" => {
                trace(app, "tray: Çıkış Yap -> request-exit");
                // Electron: renderer'a request-exit gönder, pencereyi öne getir.
                let _ = app.emit_to("main", "request-exit", ());
                show_main(app);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick {
                button: MouseButton::Left,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
            // Sol tek tık da pencereyi açsın (Windows/Linux'ta yaygın beklenti).
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

// ------------------------------------------------------------- kurulum / çıkış

pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    let _ = START.set(std::time::Instant::now());

    if let Some(main) = app.get_webview_window("main") {
        // window-state eklentisi konum/boyut/tam ekranı bu noktadan önce geri yükledi.
        ensure_main_on_screen(&main);
        crate::webview_lock::lock_down(&main);
        crate::webview_lock::allow_app_permissions(&main);
        attach_main_window_events(app, &main);
    }
    create_tray(app)?;

    // Pencere gizli yüklenir; sayfa hazır olunca `splash_complete` ile açılır. Hiç gelmezse güvenlik zamanlayıcısı açar.
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(SHOW_TIMEOUT);
        let visible = handle
            .get_webview_window("main")
            .and_then(|w| w.is_visible().ok())
            .unwrap_or(true);
        if !visible {
            trace(&handle, "açılış: sayfa hazır sinyali gelmedi, zaman aşımıyla gösteriliyor");
            show_main(&handle);
        }
    });
    Ok(())
}

/// `RunEvent` döngüsünden çağrılır: çıkış isteğini yakalayıp graceful akışı yürütür.
pub fn on_run_event(app: &AppHandle, event: &RunEvent) {
    if let RunEvent::ExitRequested { api, code, .. } = event {
        if code.is_none() {
            return; // "son pencere kapandı" kaynaklı örtük çıkış: tray uygulaması çalışmaya devam eder
        }
        let st = app.state::<LifecycleState>();
        if st.exit_allowed.load(SeqCst) {
            return;
        }
        api.prevent_exit();
        trace(app, &format!("ExitRequested yakalandı (code {code:?}), graceful akış"));
        if !st.exit_started.swap(true, SeqCst) {
            graceful_exit(app.clone());
        }
    }
}

/// Renderer'a `app-will-quit` gönderip temizliğin (odadan çıkış, durum güncelleme…) bitmesini bekler.
/// Çıkış ve güncelleme kurulumu öncesi ortak adım. `true`: renderer temizliği bildirdi, `false`: zaman aşımı.
pub(crate) fn renderer_cleanup(app: &AppHandle) -> bool {
    let (tx, rx) = mpsc::channel();
    if let Ok(mut slot) = app.state::<LifecycleState>().cleanup_tx.lock() {
        *slot = Some(tx);
    }
    let emitted = app.emit_to("main", "app-will-quit", ());
    trace(app, &format!("renderer_cleanup: emit sonucu {:?}", emitted.is_ok()));
    rx.recv_timeout(CLEANUP_TIMEOUT).is_ok()
}

/// Electron `before-quit`: renderer'a temizlik yaptır → pencereyi gizle → hemen çık (çıkış ekranı yok).
fn graceful_exit(app: AppHandle) {
    std::thread::spawn(move || {
        let t0 = std::time::Instant::now();
        trace(&app, "graceful_exit: başladı, renderer'a app-will-quit gönderiliyor");
        let got = renderer_cleanup(&app);
        trace(
            &app,
            &format!(
                "graceful_exit: temizlik {} ({} ms)",
                if got { "tamamlandı" } else { "ZAMAN AŞIMI" },
                t0.elapsed().as_millis()
            ),
        );

        // Çıkış ekranı YOK: temizlik bitince pencere kapanır ve süreç hemen sonlanır.
        crate::overlay::shutdown(&app);
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.hide();
        }

        trace(&app, "graceful_exit: çıkılıyor");
        app.state::<LifecycleState>().exit_allowed.store(true, SeqCst);
        app.exit(0);
    });
}

// ------------------------------------------------------------------ komutlar

/// Renderer "ana pencere hazır" dediğinde çağrılır: bekletmeden hemen gösterilir (splash yok).
#[tauri::command]
pub fn splash_complete(app: AppHandle) {
    show_main(&app);
}

#[tauri::command]
pub fn focus_window(app: AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        if w.is_minimized().unwrap_or(false) {
            let _ = w.unminimize();
        }
        let _ = w.show();
        let _ = w.set_focus();
    }
}

#[tauri::command]
pub fn cleanup_complete(state: tauri::State<'_, LifecycleState>) {
    if let Ok(mut slot) = state.cleanup_tx.lock() {
        if let Some(tx) = slot.take() {
            let _ = tx.send(());
        }
    }
}

#[tauri::command]
pub fn app_quit_force(app: AppHandle, state: tauri::State<'_, LifecycleState>) {
    trace(&app, "app_quit_force çağrıldı (renderer çıkış istedi)");
    state.quitting.store(true, SeqCst);
    app.exit(0);
}

#[cfg(test)]
mod conf_tests {
    /// Ana pencerenin yapılandırma bayrakları ile kodda splash pencerelerine verilenler aynı olmalı.
    #[test]
    fn browser_args_match_tauri_conf() {
        let conf: serde_json::Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let args = conf["app"]["windows"][0]["additionalBrowserArgs"].as_str().unwrap_or("");
        assert_eq!(args, super::WEBVIEW2_BROWSER_ARGS);
    }
}
