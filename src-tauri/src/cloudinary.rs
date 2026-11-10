//! Cloudinary resim silme (`app/api/cloudinary-delete/route.js` karşılığı).
//!
//! Electron sürümünde bu çağrı `window.location.origin + /api/cloudinary-delete` adresine gidiyordu; paketli
//! uygulamanın statik sunucusunda API yoktu, yani silme hiç çalışmıyordu (çağrı yerleri hatayı yutuyor,
//! resimler Cloudinary'de artık dosya olarak kalıyordu). Burada istek Rust'ta imzalanıp doğrudan Cloudinary'ye gider.
//!
//! İmza: SHA-1( "public_id=<id>&timestamp=<ts>" + API secret ) — parametreler alfabetik, `api_key` hariç.
//! Güvenlik notu: API secret istemcide (LiveKit ile aynı model; kalıcı çözüm silmeyi sunucuya taşımak).

use serde_json::{json, Value};
use sha1::{Digest, Sha1};
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

pub struct Cloudinary {
    cloud_name: String,
    api_key: String,
    api_secret: String,
}

impl Cloudinary {
    pub fn load(app: &AppHandle) -> Self {
        let (file_vars, _) = crate::envfile::load(app);
        // Gerçek ortam değişkenleri `.env.local`'e üstün gelir.
        let get = |k: &str| {
            std::env::var(k)
                .ok()
                .filter(|v| !v.is_empty())
                .or_else(|| file_vars.get(k).cloned())
                .unwrap_or_default()
        };
        Self {
            cloud_name: get("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"),
            api_key: get("CLOUDINARY_API_KEY"),
            api_secret: get("CLOUDINARY_API_SECRET"),
        }
    }

    fn configured(&self) -> bool {
        !self.cloud_name.is_empty() && !self.api_key.is_empty() && !self.api_secret.is_empty()
    }
}

/// İmza dizesi: parametreler anahtara göre sıralı `k=v&k=v` + secret, SHA-1 (küçük harf hex).
fn sign(params: &[(&str, &str)], secret: &str) -> String {
    let mut sorted: Vec<&(&str, &str)> = params.iter().collect();
    sorted.sort_by_key(|(k, _)| *k);
    let joined = sorted.iter().map(|(k, v)| format!("{k}={v}")).collect::<Vec<_>>().join("&");
    let digest = Sha1::digest(format!("{joined}{secret}").as_bytes());
    digest.iter().map(|b| format!("{b:02x}")).collect()
}

/// `public_id` yalnızca harf, rakam ve `/ _ - . ` içerir; `..` ve boş değer reddedilir.
fn valid_public_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 255
        && !id.contains("..")
        && id.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '/' | '_' | '-' | '.'))
}

fn destroy(cfg: &Cloudinary, public_id: &str, timestamp: u64) -> Result<Value, String> {
    if !cfg.configured() {
        return Err("Cloudinary yapılandırılmamış (.env.local: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)".into());
    }
    let ts = timestamp.to_string();
    let signature = sign(&[("public_id", public_id), ("timestamp", &ts)], &cfg.api_secret);
    let url = format!("https://api.cloudinary.com/v1_1/{}/image/destroy", cfg.cloud_name);
    match ureq::post(&url).timeout(Duration::from_secs(15)).send_form(&[
        ("public_id", public_id),
        ("timestamp", &ts),
        ("api_key", &cfg.api_key),
        ("signature", &signature),
    ]) {
        Ok(resp) => resp.into_json::<Value>().map_err(|e| format!("Cloudinary yanıtı okunamadı: {e}")),
        Err(ureq::Error::Status(code, resp)) => {
            let msg = resp
                .into_json::<Value>()
                .ok()
                .and_then(|v| v.pointer("/error/message").and_then(Value::as_str).map(str::to_string))
                .unwrap_or_else(|| format!("HTTP {code}"));
            Err(msg)
        }
        Err(e) => Err(format!("Cloudinary'ye bağlanılamadı: {e}")),
    }
}

/// Arayüzün beklediği biçim (eski route ile aynı): `{ success: true, result: { result: "ok" | "not found" } }`
#[tauri::command]
pub async fn cloudinary_delete(state: State<'_, Cloudinary>, public_id: String) -> Result<Value, String> {
    if !valid_public_id(&public_id) {
        return Err("Public ID required".into());
    }
    let cfg = Cloudinary {
        cloud_name: state.cloud_name.clone(),
        api_key: state.api_key.clone(),
        api_secret: state.api_secret.clone(),
    };
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    let result = tauri::async_runtime::spawn_blocking(move || destroy(&cfg, &public_id, now))
        .await
        .map_err(|e| e.to_string())??;
    Ok(json!({ "success": true, "result": result }))
}

pub fn setup(app: &AppHandle) {
    app.manage(Cloudinary::load(app));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signature_matches_independent_sha1() {
        // Beklenen değer Node.js `crypto` ile bağımsız hesaplandı
        assert_eq!(
            sign(&[("timestamp", "1315060510"), ("public_id", "sample")], "abcd"), // sırası karışık verilir
            "c3470533147774275dd37996cc4d0e68fd03cd4f"
        );
    }

    #[test]
    fn sha1_known_vector() {
        let d = Sha1::digest(b"abc");
        let hex: String = d.iter().map(|b| format!("{b:02x}")).collect();
        assert_eq!(hex, "a9993e364706816aba3e25717850c26c9cd0d89d");
    }

    #[test]
    fn public_id_validation() {
        assert!(valid_public_id("netrex/badges/abc123"));
        assert!(valid_public_id("sample_image-1"));
        for bad in ["", "../etc/passwd", "a b", "a;b", "a\"b", "a&timestamp=1"] {
            assert!(!valid_public_id(bad), "{bad:?}");
        }
    }

    #[test]
    fn unconfigured_is_reported() {
        let cfg = Cloudinary { cloud_name: String::new(), api_key: String::new(), api_secret: String::new() };
        assert!(destroy(&cfg, "x", 1).unwrap_err().contains("yapılandırılmamış"));
    }

    /// Gerçek Cloudinary ile imza doğrulaması: VAR OLMAYAN bir kimliği silmeyi dener (hiçbir şey silinmez).
    /// Geçerli imza → `{"result":"not found"}`; hatalı imza → 401. `cargo test live_signature -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn live_signature_is_accepted() {
        let text = std::fs::read_to_string("../.env.local").expect(".env.local");
        let vars = crate::envfile::parse(&text);
        let cfg = Cloudinary {
            cloud_name: vars.get("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME").cloned().unwrap_or_default(),
            api_key: vars.get("CLOUDINARY_API_KEY").cloned().unwrap_or_default(),
            api_secret: vars.get("CLOUDINARY_API_SECRET").cloned().unwrap_or_default(),
        };
        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
        let ok = destroy(&cfg, "netrex-imza-testi-var-olmayan-kimlik-0000", now);
        println!("GEÇERLİ İMZA: {ok:?}");
        assert_eq!(ok.unwrap()["result"], "not found");
        let bad_cfg = Cloudinary { api_secret: "yanlis".into(), ..cfg };
        let bad = destroy(&bad_cfg, "netrex-imza-testi-var-olmayan-kimlik-0000", now);
        println!("HATALI İMZA: {bad:?}");
        assert!(bad.is_err());
    }
}
