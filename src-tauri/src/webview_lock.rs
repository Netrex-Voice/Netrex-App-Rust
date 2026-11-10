//! Release derlemesinde WebView'in "tarayıcı" özelliklerini kapatır.
//!
//! Electron sürümünde paketlenmiş uygulamada menü kapalıydı (`setMenu(null)`): sağ tık menüsü,
//! F12/Ctrl+Shift+I, Ctrl+R/F5 (yenileme), Ctrl+P (yazdır), Ctrl+U (kaynağı göster) yoktu.
//! WebView2 varsayılanda hepsini açar ("Back / Refresh / Save as / Print / More tools"), bu da
//! hem geliştirici araçlarına kapı açar hem de yenileme ile oturum durumunu bozabilir.
//!
//! Geliştirme derlemesinde (`debug_assertions`) dokunulmaz: DevTools gerekli.
//! Windows dışında ayar yoktur; oradaki karşılığı arayüzdeki `contextmenu` engelidir
//! (`src/lib/tauriBridge.js`).

use tauri::WebviewWindow;

#[cfg(all(windows, not(debug_assertions)))]
pub fn lock_down(win: &WebviewWindow) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2Settings3, ICoreWebView2Settings6,
    };
    use windows_core::Interface;

    let _ = win.with_webview(|wv| unsafe {
        let Ok(core) = wv.controller().CoreWebView2() else {
            return;
        };
        let Ok(s) = core.Settings() else {
            return;
        };
        let _ = s.SetAreDefaultContextMenusEnabled(false); // sağ tık menüsü
        let _ = s.SetAreDevToolsEnabled(false); // geliştirici araçları
        let _ = s.SetIsStatusBarEnabled(false); // bağlantı üzerinde beliren URL çubuğu
        let _ = s.SetIsZoomControlEnabled(false); // Ctrl+tekerlek yakınlaştırma
        // Ctrl+R / F5 / Ctrl+P / Ctrl+U / F12 / Ctrl+Shift+I …
        if let Ok(s3) = s.cast::<ICoreWebView2Settings3>() {
            let _ = s3.SetAreBrowserAcceleratorKeysEnabled(false);
        }
        // Dokunmatik: kenardan kaydırarak geri gitme / çimdik yakınlaştırma
        if let Ok(s6) = s.cast::<ICoreWebView2Settings6>() {
            let _ = s6.SetIsSwipeNavigationEnabled(false);
            let _ = s6.SetIsPinchZoomEnabled(false);
        }
    });
}

#[cfg(not(all(windows, not(debug_assertions))))]
pub fn lock_down(_win: &WebviewWindow) {}

// ------------------------------------------------------------------ izinler

/// Yalnızca uygulamanın KENDİ sayfası için sormadan verilen izinler. Electron izinleri
/// varsayılan olarak sormadan verir; masaüstü uygulamasında "mikrofonunu kullanmak istiyor"
/// gibi tarayıcı pencereleri çıkmamalı.
#[cfg(windows)]
const APP_ORIGINS: [&str; 4] = [
    "http://tauri.localhost", // Windows'ta Tauri'nin sunduğu origin
    "https://tauri.localhost",
    "tauri://localhost",
    "http://localhost:3100", // geliştirme sunucusu
];

#[cfg(windows)]
fn is_app_origin(uri: &str) -> bool {
    APP_ORIGINS
        .iter()
        .any(|o| uri == *o || uri.starts_with(&format!("{o}/")))
}

/// Sesli sohbet için gereken izinler. Konum, MIDI, dosya sistemi, çoklu indirme gibi
/// kullanılmayanlar (ve gömülü üçüncü taraf sayfaların istekleri) sessizce reddedilir.
#[cfg(windows)]
fn app_permission_allowed(
    kind: webview2_com::Microsoft::Web::WebView2::Win32::COREWEBVIEW2_PERMISSION_KIND,
) -> bool {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_PERMISSION_KIND_CAMERA, COREWEBVIEW2_PERMISSION_KIND_CLIPBOARD_READ,
        COREWEBVIEW2_PERMISSION_KIND_LOCAL_FONTS, COREWEBVIEW2_PERMISSION_KIND_MICROPHONE,
        COREWEBVIEW2_PERMISSION_KIND_NOTIFICATIONS, COREWEBVIEW2_PERMISSION_KIND_WINDOW_MANAGEMENT,
    };
    kind == COREWEBVIEW2_PERMISSION_KIND_MICROPHONE
        || kind == COREWEBVIEW2_PERMISSION_KIND_CAMERA
        || kind == COREWEBVIEW2_PERMISSION_KIND_NOTIFICATIONS
        || kind == COREWEBVIEW2_PERMISSION_KIND_CLIPBOARD_READ
        || kind == COREWEBVIEW2_PERMISSION_KIND_LOCAL_FONTS // fontDetector.js
        || kind == COREWEBVIEW2_PERMISSION_KIND_WINDOW_MANAGEMENT // çoklu monitör bilgisi
}

#[cfg(windows)]
pub fn allow_app_permissions(win: &WebviewWindow) {
    use webview2_com::{
        take_pwstr,
        Microsoft::Web::WebView2::Win32::{
            COREWEBVIEW2_PERMISSION_KIND_UNKNOWN_PERMISSION, COREWEBVIEW2_PERMISSION_STATE_ALLOW,
            COREWEBVIEW2_PERMISSION_STATE_DENY,
        },
        PermissionRequestedEventHandler,
    };
    use windows_core::PWSTR;

    let _ = win.with_webview(|wv| unsafe {
        let Ok(core) = wv.controller().CoreWebView2() else {
            return;
        };
        let handler = PermissionRequestedEventHandler::create(Box::new(|_, args| {
            if let Some(args) = args {
                let mut kind = COREWEBVIEW2_PERMISSION_KIND_UNKNOWN_PERMISSION;
                args.PermissionKind(&mut kind)?;
                let mut uri = PWSTR::null();
                args.Uri(&mut uri)?;
                let uri = take_pwstr(uri);
                let allow = is_app_origin(&uri) && app_permission_allowed(kind);
                args.SetState(if allow {
                    COREWEBVIEW2_PERMISSION_STATE_ALLOW
                } else {
                    COREWEBVIEW2_PERMISSION_STATE_DENY
                })?;
            }
            Ok(())
        }));
        let mut token = 0i64;
        let _ = core.add_PermissionRequested(&handler, &mut token);

        // Kalıcı ALLOW: profilde daha önce kaydedilmiş bir "engelle" kararı (ör. eski bir izin
        // penceresinde "Engelle"ye basılmış) olay hiç tetiklenmeden isteği reddeder; bunu ezmek için
        // uygulamanın kendi origin'ine izinleri açıkça yaz. (WebView2 çalışma zamanı ≥ 1.0.2088)
        set_persistent_permissions(&core);
    });
}

#[cfg(windows)]
unsafe fn set_persistent_permissions(core: &webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2) {
    use webview2_com::{
        Microsoft::Web::WebView2::Win32::{
            ICoreWebView2Profile4, ICoreWebView2_13, COREWEBVIEW2_PERMISSION_KIND_CAMERA,
            COREWEBVIEW2_PERMISSION_KIND_CLIPBOARD_READ, COREWEBVIEW2_PERMISSION_KIND_LOCAL_FONTS,
            COREWEBVIEW2_PERMISSION_KIND_MICROPHONE, COREWEBVIEW2_PERMISSION_KIND_NOTIFICATIONS,
            COREWEBVIEW2_PERMISSION_STATE_ALLOW,
        },
        SetPermissionStateCompletedHandler,
    };
    use windows_core::{Interface, HSTRING};

    let Ok(c13) = core.cast::<ICoreWebView2_13>() else { return };
    let Ok(profile) = c13.Profile() else { return };
    let Ok(profile4) = profile.cast::<ICoreWebView2Profile4>() else { return };

    let kinds = [
        COREWEBVIEW2_PERMISSION_KIND_MICROPHONE,
        COREWEBVIEW2_PERMISSION_KIND_CAMERA,
        COREWEBVIEW2_PERMISSION_KIND_NOTIFICATIONS,
        COREWEBVIEW2_PERMISSION_KIND_CLIPBOARD_READ,
        COREWEBVIEW2_PERMISSION_KIND_LOCAL_FONTS,
    ];
    for origin in APP_ORIGINS {
        let origin = HSTRING::from(origin);
        for kind in kinds {
            let done = SetPermissionStateCompletedHandler::create(Box::new(|_| Ok(())));
            let _ = profile4.SetPermissionState(
                kind,
                &origin,
                COREWEBVIEW2_PERMISSION_STATE_ALLOW,
                &done,
            );
        }
    }
}

#[cfg(not(windows))]
pub fn allow_app_permissions(_win: &WebviewWindow) {}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn only_the_apps_own_origin_is_trusted() {
        assert!(is_app_origin("http://tauri.localhost/"));
        assert!(is_app_origin("http://tauri.localhost/view"));
        assert!(is_app_origin("tauri://localhost"));
        assert!(is_app_origin("http://localhost:3100/"));
        // Gömülü üçüncü taraf ve benzer görünümlü adresler güvenilmez
        assert!(!is_app_origin("https://www.youtube.com/embed/x"));
        assert!(!is_app_origin("http://tauri.localhost.evil.com/"));
        assert!(!is_app_origin("http://evil.com/http://tauri.localhost/"));
        assert!(!is_app_origin(""));
    }
}
