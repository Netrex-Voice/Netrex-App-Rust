//! Küçük IPC komutları: kaynak yolu, dış bağlantı, (geliştirmede) devtools.

use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

/// Derleme zamanında `build.rs` tarafından gömülür (boş olabilir).
const ADMIN_UID: &str = env!("NETREX_ADMIN_UID");

fn is_admin_uid(uid: &str) -> bool {
    !ADMIN_UID.is_empty() && uid == ADMIN_UID
}

#[derive(Serialize)]
pub struct OpResult {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

impl OpResult {
    pub(crate) fn ok() -> Self {
        Self { success: true, error: None }
    }
    pub(crate) fn err(msg: &str) -> Self {
        Self { success: false, error: Some(msg.to_string()) }
    }
}

/// Admin kimliği doğrulandıysa WebView geliştirici araçlarını açar.
///
/// Not: Tauri release derlemelerinde devtools varsayılan olarak kapalıdır (açmak için
/// `devtools` özelliği tüm kullanıcılara F12/"İncele" de açardı). Bu yüzden şimdilik yalnızca
/// geliştirme derlemesinde çalışır; release için seçici açma Faz 8'de (güvenlik) ele alınacak.
#[tauri::command]
pub fn open_devtools(app: AppHandle, uid: Option<String>) -> OpResult {
    if !uid.as_deref().map(is_admin_uid).unwrap_or(false) {
        return OpResult::err("Unauthorized");
    }
    #[cfg(debug_assertions)]
    {
        return match app.get_webview_window("main") {
            Some(w) => {
                w.open_devtools();
                OpResult::ok()
            }
            None => OpResult::err("Window not found"),
        };
    }
    #[cfg(not(debug_assertions))]
    {
        let _ = app;
        OpResult::err("Devtools bu sürümde kapalı")
    }
}

/// Electron'da worklet dosyalarını `file:///` ile yüklemek için kaynak klasörü döndürüyordu.
/// Tauri'de statik dosyalar aynı origin'den (`/rnnoise-suppressor.worklet.js`) sunulur; boş
/// dönmek `getResourcePath()`'in göreli `/dosya` yoluna düşmesini sağlar. (macOS/Linux'ta
/// protokol `tauri:` olduğundan, dolu bir yol `file:///` yoluna yönlendirip worklet'i kırardı.)
#[tauri::command]
pub fn get_resources_path() -> String {
    String::new()
}

/// Yalnızca http(s) bağlantıları sistem tarayıcısında açar (Electron ile aynı kural).
#[tauri::command]
pub fn open_external_link(app: AppHandle, url: String) -> Result<(), String> {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("Yalnızca http/https bağlantıları açılabilir".into());
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_uid_is_never_admin() {
        assert!(!is_admin_uid(""));
    }
}
