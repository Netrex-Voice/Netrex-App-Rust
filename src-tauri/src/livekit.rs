//! LiveKit sunucu havuzu + erişim token'ı üretimi (Electron `get-livekit-token` /
//! `get-livekit-server-info` ve `livekit-server-sdk` `AccessToken` karşılığı).
//!
//! Token, LiveKit'in standart HS256 JWT'sidir: başlık `{"alg":"HS256"}`, yük
//! `iss/sub/name/exp/nbf/attributes/video{…}`. Resmi Node SDK çıktısıyla alan alan karşılaştırıldı.
//!
//! Güvenlik notu: API secret'ları `.env.local` ile istemciye gönderilir (Electron sürümüyle aynı
//! model). Uygulamayı ele geçiren biri secret'ı çıkarıp kendi token'ını üretebilir; kalıcı çözüm
//! token üretimini bir sunucuya taşımaktır (bkz. PORT_PLAN.md).

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use hmac::{Hmac, Mac};
use serde::Serialize;
use serde_json::json;
use sha2::Sha256;
use tauri::{AppHandle, Manager, State};

const MAX_SERVERS: usize = 20;
const TOKEN_TTL_SECS: u64 = 24 * 60 * 60;
const MAX_FIELD_LEN: usize = 256;

#[derive(Clone, Debug, PartialEq)]
pub struct Server {
    pub url: String,
    pub key: String,
    pub secret: String,
}

pub struct LiveKit {
    servers: Vec<Server>,
}

/// `LIVEKIT_SERVERS_<i>_URL/KEY/SECRET` havuzunu okur; yoksa tek sunucu yedeği
/// (`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `NEXT_PUBLIC_LIVEKIT_URL`).
pub fn load_servers(var: &dyn Fn(&str) -> Option<String>) -> Vec<Server> {
    let mut servers = Vec::new();
    for i in 0..MAX_SERVERS {
        let Some(url) = var(&format!("LIVEKIT_SERVERS_{i}_URL")).filter(|s| !s.is_empty()) else {
            break;
        };
        servers.push(Server {
            url,
            key: var(&format!("LIVEKIT_SERVERS_{i}_KEY")).unwrap_or_default(),
            secret: var(&format!("LIVEKIT_SERVERS_{i}_SECRET")).unwrap_or_default(),
        });
    }
    if servers.is_empty() {
        let key = var("LIVEKIT_API_KEY").unwrap_or_default();
        let secret = var("LIVEKIT_API_SECRET").unwrap_or_default();
        if !key.is_empty() && !secret.is_empty() {
            servers.push(Server {
                url: var("NEXT_PUBLIC_LIVEKIT_URL").unwrap_or_default(),
                key,
                secret,
            });
        }
    }
    servers
}

impl LiveKit {
    pub fn load(app: &AppHandle) -> Self {
        let (file_vars, path) = crate::envfile::load(app);
        // Gerçek ortam değişkenleri `.env.local`'e üstün gelir.
        let lookup = |k: &str| -> Option<String> {
            std::env::var(k)
                .ok()
                .filter(|v| !v.is_empty())
                .or_else(|| file_vars.get(k).cloned())
        };
        let servers = load_servers(&lookup);
        // Yalnızca sayı ve dosya yolu günlüğe yazılır; anahtarlar/secret'lar ASLA.
        crate::lifecycle::trace(
            app,
            &format!(
                "livekit: {} sunucu yüklendi (env: {})",
                servers.len(),
                path.map(|p| p.display().to_string()).unwrap_or_else(|| if servers.is_empty() { "bulunamadı".into() } else { "gömülü (şifreli)".into() })
            ),
        );
        Self { servers }
    }

    fn pick(&self, index: i64) -> Result<(usize, &Server), String> {
        if self.servers.is_empty() {
            return Err("LiveKit credentials not configured. Please add LIVEKIT_SERVERS_0_* or LIVEKIT_API_KEY/SECRET to .env.local".into());
        }
        // Electron ile aynı: sınır dışı indeks en yakın geçerli sunucuya sıkıştırılır.
        let i = index.clamp(0, self.servers.len() as i64 - 1) as usize;
        Ok((i, &self.servers[i]))
    }
}

fn b64(bytes: &[u8]) -> String {
    URL_SAFE_NO_PAD.encode(bytes)
}

/// LiveKit erişim token'ı (HS256 JWT). `now`: unix saniye (test edilebilirlik için dışarıdan).
pub fn make_token(
    server: &Server,
    room: &str,
    identity: &str,
    name: &str,
    now: u64,
) -> Result<String, String> {
    if server.key.is_empty() || server.secret.is_empty() {
        return Err("Server credentials missing. Check .env.local".into());
    }
    let header = json!({ "alg": "HS256" });
    let claims = json!({
        "iss": server.key,
        "sub": identity,
        "name": name,
        "exp": now + TOKEN_TTL_SECS,
        "nbf": 0,
        // Katılımcı odaya girer girmez diğerleri "bağlanıyor" görsün (mikrofon hazır olunca
        // istemci temizler). Anahtar adı: src/utils/micConnectingAttr.js ile aynı olmalı.
        "attributes": { "netrexMicConnecting": "1" },
        "video": {
            "roomJoin": true,
            "room": room,
            "canPublish": true,
            "canSubscribe": true,
            "canPublishData": true,
            "canUpdateOwnMetadata": true,
        },
    });
    let signing_input = format!("{}.{}", b64(header.to_string().as_bytes()), b64(claims.to_string().as_bytes()));
    let mut mac = Hmac::<Sha256>::new_from_slice(server.secret.as_bytes())
        .map_err(|e| e.to_string())?;
    mac.update(signing_input.as_bytes());
    let sig = mac.finalize().into_bytes();
    Ok(format!("{signing_input}.{}", b64(&sig)))
}

fn check_field(label: &str, v: &str) -> Result<(), String> {
    if v.is_empty() || v.len() > MAX_FIELD_LEN {
        return Err(format!("{label} is required (max {MAX_FIELD_LEN} characters)"));
    }
    Ok(())
}

#[tauri::command]
pub fn get_livekit_token(
    state: State<'_, LiveKit>,
    room: String,
    identity: String,
    display_name: Option<String>,
    server_index: Option<i64>,
) -> Result<String, String> {
    check_field("room", &room)?;
    check_field("identity", &identity)?;
    let name = display_name.filter(|n| !n.is_empty()).unwrap_or_else(|| identity.clone());
    if name.len() > MAX_FIELD_LEN {
        return Err(format!("displayName is too long (max {MAX_FIELD_LEN} characters)"));
    }
    let (_, server) = state.pick(server_index.unwrap_or(0))?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    make_token(server, &room, &identity, &name, now)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerInfo {
    url: String,
    server_count: usize,
    server_index: usize,
    pool_mode: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[tauri::command]
pub fn get_livekit_server_info(
    state: State<'_, LiveKit>,
    server_index: Option<i64>,
) -> ServerInfo {
    match state.pick(server_index.unwrap_or(0)) {
        Ok((i, s)) => ServerInfo {
            url: s.url.clone(),
            server_count: state.servers.len(),
            server_index: i,
            pool_mode: state.servers.len() > 1,
            error: None,
        },
        Err(_) => ServerInfo {
            url: String::new(),
            server_count: 0,
            server_index: 0,
            pool_mode: false,
            error: Some("No LiveKit servers configured".into()),
        },
    }
}

/// Havuz için `app.manage` yardımcısı.
pub fn setup(app: &AppHandle) {
    app.manage(LiveKit::load(app));
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn vars(pairs: &[(&str, &str)]) -> impl Fn(&str) -> Option<String> {
        let m: HashMap<String, String> =
            pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
        move |k| m.get(k).cloned()
    }

    #[test]
    fn loads_pool_in_order_and_stops_at_first_gap() {
        let v = vars(&[
            ("LIVEKIT_SERVERS_0_URL", "wss://a"),
            ("LIVEKIT_SERVERS_0_KEY", "ka"),
            ("LIVEKIT_SERVERS_0_SECRET", "sa"),
            ("LIVEKIT_SERVERS_1_URL", "wss://b"),
            ("LIVEKIT_SERVERS_1_KEY", "kb"),
            ("LIVEKIT_SERVERS_1_SECRET", "sb"),
            ("LIVEKIT_SERVERS_3_URL", "wss://boşluktan-sonra"),
        ]);
        let s = load_servers(&v);
        assert_eq!(s.len(), 2);
        assert_eq!(s[1], Server { url: "wss://b".into(), key: "kb".into(), secret: "sb".into() });
    }

    #[test]
    fn falls_back_to_single_server_vars() {
        let v = vars(&[
            ("LIVEKIT_API_KEY", "k"),
            ("LIVEKIT_API_SECRET", "s"),
            ("NEXT_PUBLIC_LIVEKIT_URL", "wss://tek"),
        ]);
        let s = load_servers(&v);
        assert_eq!(s, vec![Server { url: "wss://tek".into(), key: "k".into(), secret: "s".into() }]);
        assert!(load_servers(&vars(&[])).is_empty());
    }

    #[test]
    fn index_is_clamped_like_electron() {
        let lk = LiveKit {
            servers: vec![
                Server { url: "a".into(), key: "k".into(), secret: "s".into() },
                Server { url: "b".into(), key: "k".into(), secret: "s".into() },
            ],
        };
        assert_eq!(lk.pick(-5).unwrap().0, 0);
        assert_eq!(lk.pick(1).unwrap().0, 1);
        assert_eq!(lk.pick(99).unwrap().0, 1);
        assert!(LiveKit { servers: vec![] }.pick(0).is_err());
    }

    fn test_server() -> Server {
        Server {
            url: "wss://x".into(),
            key: "APIkeyTEST".into(),
            secret: "secretTEST-secretTEST-secretTEST-1234".into(),
        }
    }

    #[test]
    fn token_structure_matches_livekit_sdk() {
        let t = make_token(&test_server(), "oda-1", "uid-123", "Murat G", 1_000_000).unwrap();
        let parts: Vec<&str> = t.split('.').collect();
        assert_eq!(parts.len(), 3);
        let dec = |p: &str| -> serde_json::Value {
            serde_json::from_slice(&URL_SAFE_NO_PAD.decode(p).unwrap()).unwrap()
        };
        assert_eq!(dec(parts[0]), json!({"alg":"HS256"}));
        let c = dec(parts[1]);
        assert_eq!(c["iss"], "APIkeyTEST");
        assert_eq!(c["sub"], "uid-123");
        assert_eq!(c["name"], "Murat G");
        assert_eq!(c["exp"], 1_000_000 + 86_400);
        assert_eq!(c["nbf"], 0);
        assert_eq!(c["attributes"]["netrexMicConnecting"], "1");
        assert_eq!(c["video"]["room"], "oda-1");
        assert_eq!(c["video"]["roomJoin"], true);
        assert_eq!(c["video"]["canPublish"], true);
        assert_eq!(c["video"]["canSubscribe"], true);
        assert_eq!(c["video"]["canPublishData"], true);
        assert_eq!(c["video"]["canUpdateOwnMetadata"], true);
    }

    #[test]
    fn signature_verifies_and_tampering_is_detected() {
        let s = test_server();
        let t = make_token(&s, "r", "i", "n", 5).unwrap();
        let (input, sig) = t.rsplit_once('.').unwrap();
        let verify = |input: &str, sig: &str, secret: &str| {
            let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).unwrap();
            mac.update(input.as_bytes());
            mac.verify_slice(&URL_SAFE_NO_PAD.decode(sig).unwrap()).is_ok()
        };
        assert!(verify(input, sig, &s.secret));
        assert!(!verify(input, sig, "yanlis-secret"));
        assert!(!verify(&format!("{input}x"), sig, &s.secret));
    }

    #[test]
    fn missing_credentials_are_reported() {
        let s = Server { url: "u".into(), key: "".into(), secret: "x".into() };
        assert!(make_token(&s, "r", "i", "n", 1).is_err());
    }

    /// Resmi Node SDK ile çapraz doğrulama için sabit bir token yazdırır:
    /// `cargo test print_reference -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn print_reference_token() {
        println!("RUSTJWT={}", make_token(&test_server(), "oda-1", "uid-123", "Murat G", 1_793_910_000).unwrap());
    }
}
