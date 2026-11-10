//! Pencere yaşam döngüsü (Faz 1).
//!
//! Electron karşılıkları: `windowManager.js` (splash, ana pencere, kapatma
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
    window::Color,
    AppHandle, Emitter, Manager, Monitor, PhysicalPosition, RunEvent, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
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

/// Hatırlanacak pencere özellikleri. VISIBLE bilerek yok: gösterme kararı splash akışında.
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

/// Splash en az bu kadar görünür (animasyon yanıp sönmesin), renderer erken hazır olsa bile.
const SPLASH_MIN: Duration = Duration::from_millis(1200);
/// Renderer hiç `splash-complete` göndermezse (ağ yavaş, hata) ana pencere bu süre sonra yine de gösterilir.
const SPLASH_MAX: Duration = Duration::from_secs(10);
/// Renderer temizliği bitirmezse beklenecek en fazla süre (Electron: 3 sn).
const CLEANUP_TIMEOUT: Duration = Duration::from_secs(3);
/// Çıkış splash'ının ekranda kalma süresi (Electron: 2,5 sn).
const EXIT_SPLASH_TIME: Duration = Duration::from_millis(2500);

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
    /// Splash'ın açıldığı an (en az görünme süresi için)
    splash_started: Mutex<Option<std::time::Instant>>,
    /// Pencere durumu kaydı için debounce sayacı.
    save_generation: std::sync::atomic::AtomicU64,
    /// Renderer'ın `cleanup-complete` sinyalini bekleyen kanal.
    cleanup_tx: Mutex<Option<mpsc::Sender<()>>>,
}

// ---------------------------------------------------------------- pencereler

/// Pencereyi verilen monitörün tam ortasına koyar. Önce hedef monitöre taşınır
/// (DPI ölçeği o monitöre göre oturur), sonra gerçek dış boyuta göre ortalanır.
fn center_on_monitor(win: &WebviewWindow, mon: &Monitor) {
    let mp = mon.position();
    let ms = mon.size();
    let _ = win.set_position(PhysicalPosition::new(mp.x, mp.y));
    if let Ok(sz) = win.outer_size() {
        let x = mp.x + (ms.width as i32 - sz.width as i32) / 2;
        let y = mp.y + (ms.height as i32 - sz.height as i32) / 2;
        let _ = win.set_position(PhysicalPosition::new(x, y));
    }
}

/// Ana pencerenin (geri yüklenmiş konumuyla) bulunduğu monitör.
fn main_monitor(app: &AppHandle) -> Option<Monitor> {
    app.get_webview_window("main")
        .and_then(|w| w.current_monitor().ok().flatten())
}

/// Kayıtlı konum artık geçerli değilse (monitör çıkarılmış, çözünürlük değişmiş,
/// başlık çubuğu ekran dışında kalmış) pencereyi ortala.
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

fn splash_window(
    app: &AppHandle,
    label: &str,
    page: &str,
    w: f64,
    h: f64,
    bg: (u8, u8, u8),
    always_on_top: bool,
) -> tauri::Result<WebviewWindow> {
    let builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App(page.into()))
        .title("Netrex")
        .inner_size(w, h)
        .decorations(false)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .always_on_top(always_on_top)
        .skip_taskbar(always_on_top)
        .background_color(Color(bg.0, bg.1, bg.2, 255))
        .visible(false); // konumlandıktan sonra göster: yanlış monitörde "parlama" olmasın
    #[cfg(windows)]
    let builder = builder.additional_browser_args(WEBVIEW2_BROWSER_ARGS);
    let win = builder.build()?;
    crate::webview_lock::lock_down(&win);
    // Ana pencerenin açılacağı monitörün ortası; bilinmiyorsa birincil monitör.
    match main_monitor(app) {
        Some(mon) => center_on_monitor(&win, &mon),
        None => {
            let _ = win.center();
        }
    }
    win.show()?;
    Ok(win)
}

fn create_splash(app: &AppHandle) {
    let _ = splash_window(app, "splash", "native/splash.html", 360.0, 480.0, (15, 15, 17), false);
}

fn create_exit_splash(app: &AppHandle) {
    if app.get_webview_window("exit-splash").is_none() {
        match splash_window(
            app,
            "exit-splash",
            "native/exit-splash.html",
            320.0,
            400.0,
            (10, 10, 15),
            true,
        ) {
            Ok(_) => trace(app, "exit-splash: oluşturuldu"),
            Err(e) => trace(app, &format!("exit-splash: HATA {e}")),
        }
    }
}

/// Splash'ı kapatıp ana pencereyi gösterir (Electron: `showMainWindow`).
pub fn show_main(app: &AppHandle) {
    if let Some(s) = app.get_webview_window("splash") {
        let _ = s.destroy();
    }
    if let Some(w) = app.get_webview_window("main") {
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
    let check_updates = app
        .state::<Store>()
        .get_bool("checkUpdatesOnStartup", true);

    if let Some(main) = app.get_webview_window("main") {
        // window-state eklentisi konum/boyut/tam ekranı bu noktadan önce geri yükledi.
        ensure_main_on_screen(&main);
        crate::webview_lock::lock_down(&main);
        crate::webview_lock::allow_app_permissions(&main);
        attach_main_window_events(app, &main);
    }
    create_tray(app)?;

    if check_updates {
        create_splash(app);
        if let Ok(mut t) = app.state::<LifecycleState>().splash_started.lock() {
            *t = Some(std::time::Instant::now());
        }
        // Üst sınır: renderer splash-complete göndermezse yine de göster.
        let handle = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(SPLASH_MAX);
            let visible = handle
                .get_webview_window("main")
                .and_then(|w| w.is_visible().ok())
                .unwrap_or(true);
            if !visible {
                show_main(&handle);
            }
        });
    } else {
        show_main(app);
    }
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

/// Electron `before-quit`: renderer'a temizlik yaptır → exit splash → çık.
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

        crate::overlay::shutdown(&app);
        create_exit_splash(&app);
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.hide();
        }
        std::thread::sleep(EXIT_SPLASH_TIME);

        trace(&app, "graceful_exit: çıkılıyor");
        app.state::<LifecycleState>().exit_allowed.store(true, SeqCst);
        app.exit(0);
    });
}

// ------------------------------------------------------------------ komutlar

/// Renderer "ana pencere hazır" dediğinde çağrılır: splash en az `SPLASH_MIN` görünsün, sonra ana pencere açılsın.
#[tauri::command]
pub fn splash_complete(app: AppHandle, state: tauri::State<'_, LifecycleState>) {
    let remaining = state
        .splash_started
        .lock()
        .ok()
        .and_then(|t| *t)
        .map(|t0| SPLASH_MIN.saturating_sub(t0.elapsed()))
        .unwrap_or(Duration::ZERO);
    if remaining.is_zero() {
        show_main(&app);
    } else {
        // Komut thread'ini (ana thread) bloklamadan kalan süreyi bekle
        std::thread::spawn(move || {
            std::thread::sleep(remaining);
            show_main(&app);
        });
    }
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
