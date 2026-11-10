mod audio_capture;
mod capture;
mod cloudinary;
mod envfile;
mod hotkeys;
mod input;
mod keys;
mod lifecycle;
mod livekit;
mod misc;
mod oauth;
mod overlay;
mod power;
mod sources;
mod store;
mod updater;
mod youtube;
mod webview_lock;

use tauri::Manager;

/// Yalnızca geliştirme: WebView'deki JS hatalarını terminale yazar.
#[cfg(debug_assertions)]
#[tauri::command]
fn dev_log(level: String, msg: String) {
    eprintln!("[webview:{level}] {msg}");
}
#[cfg(not(debug_assertions))]
#[tauri::command]
fn dev_log(_level: String, _msg: String) {}

#[cfg(debug_assertions)]
const DEV_CONSOLE_HOOK: &str = r#"
(function () {
  const send = (level, msg) => {
    try { window.__TAURI_INTERNALS__.invoke('dev_log', { level, msg: String(msg) }); } catch (_) {}
  };
  window.addEventListener('error', (e) =>
    send('error', `${e.message} @ ${e.filename}:${e.lineno}:${e.colno}\n${e.error && e.error.stack || ''}`));
  window.addEventListener('unhandledrejection', (e) =>
    send('unhandledrejection', (e.reason && (e.reason.stack || e.reason.message)) || e.reason));
  for (const lvl of ['error', 'warn']) {
    const orig = console[lvl].bind(console);
    console[lvl] = (...a) => { send(lvl, a.map(x => (x && x.stack) || (typeof x === 'object' ? JSON.stringify(x) : x)).join(' ')); orig(...a); };
  }
  send('info', 'dev console hook aktif: ' + location.href);
})();
"#;

pub fn run() {
    // Arka plandayken (oyun öndeyken) ses/kısayol thread'leri yavaşlatılmasın (Windows 11 EcoQoS).
    power::disable_throttling_for_process();
    let builder = tauri::Builder::default()
        // Electron'daki requestSingleInstanceLock karşılığı:
        // ikinci örnek açılırsa mevcut pencereyi öne getir.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            lifecycle::show_main(app);
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        // Ana pencerenin konum/boyut/büyütülmüş/tam ekran durumunu hatırla.
        // VISIBLE bilerek yok: gösterme kararı splash akışında (lifecycle.rs).
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(lifecycle::window_state_flags())
                .with_denylist(&["pointer-overlay", "ticker-overlay", "voice-overlay"])
                .build(),
        )
        .setup(|app| {
            let handle = app.handle().clone();
            app.manage(store::Store::load(&handle));
            app.manage(lifecycle::LifecycleState::default());
            app.manage(oauth::OAuthState::default());
            app.manage(misc::CurrentUser::default());
            livekit::setup(&handle);
            cloudinary::setup(&handle);
            input::setup(&handle);
            overlay::setup(&handle);
            updater::setup(&handle);
            lifecycle::setup(&handle)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            dev_log,
            store::set_setting,
            store::get_setting,
            lifecycle::splash_complete,
            lifecycle::focus_window,
            lifecycle::cleanup_complete,
            lifecycle::app_quit_force,
            oauth::start_oauth,
            misc::is_admin,
            misc::set_current_user_uid,
            misc::open_devtools,
            misc::get_app_path,
            misc::get_resources_path,
            misc::open_external_link,
            input::start_input_listener,
            input::stop_input_listener,
            input::set_recording_mode,
            input::get_hotkey,
            input::update_hotkey,
            input::trace_input,
            input::debug_inject_key,
            input::debug_hook_stats,
            sources::get_desktop_sources,
            capture::start_capture,
            capture::stop_capture,
            livekit::get_livekit_token,
            livekit::get_livekit_server_info,
            youtube::fetch_youtube_playlist,
            cloudinary::cloudinary_delete,
            overlay::overlay_ready,
            overlay::overlay_set_hit,
            overlay::set_overlay_interactive,
            overlay::update_pointer_overlay,
            overlay::close_pointer_overlay,
            overlay::send_pointer_overlay_event,
            overlay::pointer_overlay_notify_main,
            overlay::show_ticker_message,
            overlay::ticker_idle,
            overlay::ticker_close,
            overlay::ticker_set_geom,
            overlay::set_voice_overlay_enabled,
            overlay::update_voice_overlay,
            overlay::close_voice_overlay,
            overlay::voice_overlay_action,
            overlay::get_mouse_position,
            updater::quit_and_install,
            updater::update_last_status,
        ]);

    #[cfg(debug_assertions)]
    let builder = builder.on_page_load(|webview, _payload| {
        // Her sayfa yüklemesinde kancayı (tekrar kurulumu engelleyerek) ekle
        let _ = webview.eval(&format!(
            "if(!window.__devHook){{window.__devHook=1;{DEV_CONSOLE_HOOK}}}"
        ));
    });

    builder
        .build(tauri::generate_context!())
        .expect("Netrex başlatılamadı")
        .run(|app, event| lifecycle::on_run_event(app, &event));
}
