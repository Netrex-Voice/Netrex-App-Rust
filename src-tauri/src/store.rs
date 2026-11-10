//! Kalıcı ayar deposu (electron-store karşılığı).
//!
//! Faz 1'de yalnızca pencere davranışı için gereken minimum: düz bir JSON dosyası
//! (`<app_data>/settings.json`). Anahtarlar Electron'daki `settings.<key>` ile aynı
//! ada sahiptir (öneksiz). Faz 2'de genişletilir (hotkeys, kullanıcı verisi, taşıma).

use serde_json::{Map, Value};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager};

pub struct Store {
    path: PathBuf,
    data: Mutex<Map<String, Value>>,
}

impl Store {
    pub fn load(app: &AppHandle) -> Self {
        let dir = app
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| std::env::temp_dir().join("netrex"));
        let _ = fs::create_dir_all(&dir);
        let path = dir.join("settings.json");
        let first_run = !path.exists();
        let mut data = fs::read_to_string(&path)
            .ok()
            // Elle düzenlenen/PowerShell ile yazılan dosyalardaki UTF-8 BOM'u tolere et.
            .and_then(|s| serde_json::from_str::<Map<String, Value>>(s.trim_start_matches('\u{feff}')).ok())
            .unwrap_or_default();

        // İlk çalıştırma: eski Electron sürümünün ayarlarını (yalnızca okuyarak) içe aktar.
        if first_run {
            if let Ok(cfg) = app.path().config_dir() {
                if let Some(legacy) = read_legacy_electron_store(&cfg) {
                    data = legacy;
                }
            }
        }

        // Eski sayısal tuş kodlarını (uiohook) yeni `code` adlarına çevir.
        let migrated = migrate_legacy_hotkeys(&mut data);

        let store = Self {
            path,
            data: Mutex::new(data),
        };
        if first_run || migrated {
            store.flush(); // içe aktarılanı/taşınanı kalıcı yap: bir daha denenmesin
        }
        store
    }

    /// `prefix` ile başlayan tüm girdiler (ör. `hotkeys.`).
    pub fn entries_with_prefix(&self, prefix: &str) -> Vec<(String, Value)> {
        self.data
            .lock()
            .map(|d| {
                d.iter()
                    .filter(|(k, _)| k.starts_with(prefix))
                    .map(|(k, v)| (k.clone(), v.clone()))
                    .collect()
            })
            .unwrap_or_default()
    }

    pub fn remove(&self, key: &str) -> bool {
        let Ok(mut data) = self.data.lock() else {
            return false;
        };
        data.remove(key);
        self.write_locked(&data)
    }

    fn flush(&self) -> bool {
        let Ok(data) = self.data.lock() else { return false };
        self.write_locked(&data)
    }

    fn write_locked(&self, data: &Map<String, Value>) -> bool {
        // Önce geçici dosyaya yaz, sonra yeniden adlandır: yarım yazılmış dosya olmasın.
        let tmp = self.path.with_extension("json.tmp");
        match serde_json::to_string_pretty(data) {
            Ok(s) => fs::write(&tmp, s).and_then(|_| fs::rename(&tmp, &self.path)).is_ok(),
            Err(_) => false,
        }
    }

    pub fn get(&self, key: &str) -> Option<Value> {
        self.data.lock().ok()?.get(key).cloned()
    }

    pub fn get_bool(&self, key: &str, default: bool) -> bool {
        self.get(key).and_then(|v| v.as_bool()).unwrap_or(default)
    }

    pub fn set(&self, key: &str, value: Value) -> bool {
        let Ok(mut data) = self.data.lock() else {
            return false;
        };
        data.insert(key.to_string(), value);
        self.write_locked(&data)
    }
}

/// Eski electron-store dosyasını (`<config>/netrex/config.json`) okur ve düz anahtarlara çevirir.
fn read_legacy_electron_store(config_dir: &std::path::Path) -> Option<Map<String, Value>> {
    let text = fs::read_to_string(config_dir.join("netrex").join("config.json")).ok()?;
    let v: Value = serde_json::from_str(text.trim_start_matches('\u{feff}')).ok()?;
    Some(convert_legacy(&v))
}

/// `hotkeys.*` girdilerinde eski sayısal `keycode` (uiohook) varsa ve `code` yoksa, yeni
/// `code` adına çevirir (`keycode` alanı kaldırılır). Çevrilemeyen kod olduğu gibi bırakılır
/// (kullanıcı yeniden atayabilir). Değişiklik olduysa `true`. Tekrar çalıştırmak güvenlidir.
fn migrate_legacy_hotkeys(data: &mut Map<String, Value>) -> bool {
    let mut changed = false;
    for (key, value) in data.iter_mut() {
        if !key.starts_with("hotkeys.") {
            continue;
        }
        let Some(obj) = value.as_object_mut() else { continue };
        if obj.contains_key("code") {
            continue;
        }
        let Some(old) = obj.get("keycode").and_then(Value::as_u64) else { continue };
        let old = old as u32;
        if let Some(code) = crate::keys::legacy_uiohook_to_code(old)
            .or_else(|| crate::keys::legacy_alt_to_code(old))
        {
            obj.remove("keycode");
            obj.insert("code".into(), Value::String(code.into()));
            changed = true;
        }
    }
    changed
}

/// `{ settings: {k: v}, hotkeys: {a: v} }` → `{ k: v, "hotkeys.a": v }`
fn convert_legacy(v: &Value) -> Map<String, Value> {
    let mut out = Map::new();
    if let Some(s) = v.get("settings").and_then(|x| x.as_object()) {
        for (k, val) in s {
            out.insert(k.clone(), val.clone());
        }
    }
    if let Some(h) = v.get("hotkeys").and_then(|x| x.as_object()) {
        for (k, val) in h {
            out.insert(format!("hotkeys.{k}"), val.clone());
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn converts_electron_store_layout() {
        let m = convert_legacy(&json!({
            "settings": { "closeToTray": false, "sfxVolume": 40 },
            "hotkeys": { "pushToTalk": "KeyV" }
        }));
        assert_eq!(m.get("closeToTray"), Some(&json!(false)));
        assert_eq!(m.get("sfxVolume"), Some(&json!(40)));
        assert_eq!(m.get("hotkeys.pushToTalk"), Some(&json!("KeyV")));
    }

    #[test]
    fn migrates_real_legacy_hotkeys_to_code_names() {
        // Bu makinedeki gerçek eski veri biçimi
        let legacy = json!({
            "hotkeys": {
                "pushToTalk": null,
                "mute": {"type":"keyboard","keycode":54,"ctrlKey":false,"shiftKey":false,"altKey":false,"metaKey":false},
                "deafen": {"type":"keyboard","keycode":3653,"ctrlKey":false,"shiftKey":false,"altKey":false,"metaKey":false},
                "quick-status": {"type":"keyboard","keycode":3657,"ctrlKey":false,"shiftKey":false,"altKey":false,"metaKey":false}
            }
        });
        let mut m = convert_legacy(&legacy);
        assert!(migrate_legacy_hotkeys(&mut m));
        assert_eq!(m["hotkeys.mute"]["code"], json!("ShiftRight"));
        assert_eq!(m["hotkeys.deafen"]["code"], json!("Pause"));
        assert_eq!(m["hotkeys.quick-status"]["code"], json!("PageUp"));
        assert!(m["hotkeys.mute"].get("keycode").is_none());
        assert_eq!(m["hotkeys.mute"]["type"], json!("keyboard")); // diğer alanlar korunur
        assert!(m["hotkeys.pushToTalk"].is_null());
        // İkinci çalıştırma değişiklik yapmaz (idempotent)
        assert!(!migrate_legacy_hotkeys(&mut m));
    }

    #[test]
    fn unknown_legacy_code_is_left_untouched() {
        let mut m = convert_legacy(&json!({"hotkeys": {"mute": {"type":"keyboard","keycode":999999}}}));
        assert!(!migrate_legacy_hotkeys(&mut m));
        assert_eq!(m["hotkeys.mute"]["keycode"], json!(999999));
    }

    #[test]
    fn tolerates_missing_sections() {
        assert!(convert_legacy(&json!({})).is_empty());
        assert!(convert_legacy(&json!({ "settings": 5 })).is_empty());
    }
}

#[tauri::command]
pub fn set_setting(store: tauri::State<'_, Store>, key: String, value: Value) -> bool {
    store.set(&key, value)
}

#[tauri::command]
pub fn get_setting(store: tauri::State<'_, Store>, key: String) -> Option<Value> {
    store.get(&key)
}
