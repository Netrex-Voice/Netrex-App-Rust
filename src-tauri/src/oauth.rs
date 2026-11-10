//! Google girişi için yerel OAuth sunucusu (Electron `startLocalAuthServer` karşılığı).
//!
//! Akış: uygulama `127.0.0.1:<rastgele port>` üzerinde küçük bir HTTP sunucusu açar,
//! sistem tarayıcısında `/login` sayfasını açar; sayfa Firebase ile Google girişini
//! yapıp `/oauth/callback`'e idToken'ı gönderir; token `oauth-success` olayıyla
//! renderer'a iletilir. Giriş uygulamanın kendi origin'inde yapılmadığı için Tauri'nin
//! farklı origin'i bu akışı etkilemez (`127.0.0.1` Firebase'de zaten yetkili alan).
//!
//! Electron sürümüne ek güvenlik: her başlatmada tek kullanımlık `nonce`. Callback bu
//! nonce olmadan reddedilir; böylece başka bir yerel web sayfası, kullanıcıyı saldırganın
//! hesabına giriş yaptırmak için callback'i tetikleyemez (login CSRF).

use std::{
    collections::hash_map::RandomState,
    hash::{BuildHasher, Hasher},
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    sync::{
        atomic::{AtomicBool, Ordering::SeqCst},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_opener::OpenerExt;

const LOGIN_HTML: &str = include_str!("../assets/oauth-login.html");
const SUCCESS_HTML: &str = include_str!("../assets/oauth-success.html");
/// Kullanıcı giriş yapmazsa sunucu bu süre sonra kendini kapatır.
const SERVER_LIFETIME: Duration = Duration::from_secs(10 * 60);

#[derive(Default)]
pub struct OAuthState {
    /// Çalışan sunucunun durdurma bayrağı (yeni giriş denemesi eskisini kapatır).
    stop: Mutex<Option<Arc<AtomicBool>>>,
}

/// Rastgele 128 bit (hex). Dış crate'e gerek kalmadan: işletim sisteminden tohumlanan
/// `RandomState` + zaman damgası.
fn random_nonce() -> String {
    let mut out = String::with_capacity(32);
    for i in 0..2u64 {
        let mut h = RandomState::new().build_hasher();
        h.write_u64(i);
        h.write_u128(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0),
        );
        out.push_str(&format!("{:016x}", h.finish()));
    }
    out
}

/// HTML/JS'e enjekte edilecek değerler yalnızca güvenli karakterler içerebilir.
fn is_safe_config_value(s: &str) -> bool {
    !s.is_empty()
        && s.len() < 256
        && s.chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | ':'))
}

fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        match b[i] {
            b'%' if i + 2 < b.len() => {
                // Bayt üzerinden çöz: `str` dilimleme, UTF-8 sınırında panik edebilir.
                let hex = std::str::from_utf8(&b[i + 1..i + 3])
                    .ok()
                    .and_then(|h| u8::from_str_radix(h, 16).ok());
                match hex {
                    Some(v) => {
                        out.push(v);
                        i += 3;
                    }
                    None => {
                        out.push(b'%');
                        i += 1;
                    }
                }
            }
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            c => {
                out.push(c);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn query_param(query: &str, key: &str) -> Option<String> {
    query.split('&').find_map(|kv| {
        let (k, v) = kv.split_once('=')?;
        (k == key).then(|| percent_decode(v))
    })
}

fn respond(stream: &mut TcpStream, status: &str, content_type: &str, body: &str) {
    let resp = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\n\
         Cache-Control: no-store\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(resp.as_bytes());
}

/// Tek bir isteği işler. `true` dönerse giriş tamamlandı (sunucu kapanabilir).
fn handle(
    mut stream: TcpStream,
    on_token: &dyn Fn(String),
    login_html: &str,
    nonce: &str,
) -> bool {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let mut buf = [0u8; 16 * 1024];
    let mut len = 0;
    // Başlıkların sonuna kadar (en çok 16 KB) oku; JWT'li callback URL'si birkaç KB olabilir.
    while len < buf.len() {
        match stream.read(&mut buf[len..]) {
            Ok(0) | Err(_) => break,
            Ok(n) => {
                len += n;
                if buf[..len].windows(4).any(|w| w == b"\r\n\r\n") {
                    break;
                }
            }
        }
    }
    let req = String::from_utf8_lossy(&buf[..len]);
    let first = req.lines().next().unwrap_or("");
    let mut parts = first.split_whitespace();
    let (method, target) = (parts.next().unwrap_or(""), parts.next().unwrap_or(""));
    if method != "GET" {
        respond(&mut stream, "405 Method Not Allowed", "text/plain", "405");
        return false;
    }
    let (path, query) = target.split_once('?').unwrap_or((target, ""));

    match path {
        "/login" => {
            respond(&mut stream, "200 OK", "text/html; charset=utf-8", login_html);
            false
        }
        "/oauth/callback" => {
            let ok_nonce = query_param(query, "n").as_deref() == Some(nonce);
            match (ok_nonce, query_param(query, "token")) {
                (true, Some(token)) if !token.is_empty() => {
                    on_token(token);
                    respond(&mut stream, "200 OK", "text/html; charset=utf-8", SUCCESS_HTML);
                    true
                }
                _ => {
                    respond(&mut stream, "403 Forbidden", "text/plain", "403");
                    false
                }
            }
        }
        _ => {
            respond(&mut stream, "404 Not Found", "text/plain", "Not Found");
            false
        }
    }
}

#[tauri::command]
pub fn start_oauth(
    app: AppHandle,
    state: State<'_, OAuthState>,
    api_key: String,
    auth_domain: String,
) -> Result<(), String> {
    if !is_safe_config_value(&api_key) || !is_safe_config_value(&auth_domain) {
        return Err("Firebase yapılandırması eksik veya geçersiz".into());
    }
    let login_html = LOGIN_HTML
        .replace("__API_KEY__", &api_key)
        .replace("__AUTH_DOMAIN__", &auth_domain);

    // Önceki deneme varsa kapat.
    let stop = Arc::new(AtomicBool::new(false));
    if let Ok(mut slot) = state.stop.lock() {
        if let Some(old) = slot.replace(stop.clone()) {
            old.store(true, SeqCst);
        }
    }

    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let nonce = random_nonce();

    let app_thread = app.clone();
    let nonce_thread = nonce.clone();
    std::thread::spawn(move || {
        let started = Instant::now();
        while !stop.load(SeqCst) && started.elapsed() < SERVER_LIFETIME {
            match listener.accept() {
                Ok((stream, _)) => {
                    let _ = stream.set_nonblocking(false);
                    let emit = |token: String| {
                        // Token günlüğe YAZILMAZ; yalnızca uzunluğu.
                        crate::lifecycle::trace(
                            &app_thread,
                            &format!("oauth: callback token alındı ({} karakter), renderer'a iletiliyor", token.len()),
                        );
                        let _ = app_thread.emit_to("main", "oauth-success", token);
                    };
                    if handle(stream, &emit, &login_html, &nonce_thread) {
                        crate::lifecycle::trace(&app_thread, "oauth: giriş tamamlandı, sunucu kapandı");
                        break;
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(50));
                }
                Err(_) => break,
            }
        }
    });

    crate::lifecycle::trace(&app, &format!("oauth: sunucu 127.0.0.1:{port} üzerinde, tarayıcı açılıyor"));
    let res = app
        .opener()
        .open_url(format!("http://127.0.0.1:{port}/login?n={nonce}"), None::<&str>)
        .map_err(|e| e.to_string());
    if let Err(e) = &res {
        crate::lifecycle::trace(&app, &format!("oauth: tarayıcı açılamadı: {e}"));
    }
    res
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_percent_and_plus() {
        assert_eq!(percent_decode("a%20b+c"), "a b c");
        assert_eq!(percent_decode("abc%"), "abc%");
        assert_eq!(percent_decode("abc%4"), "abc%4");
        assert_eq!(percent_decode("%41%42"), "AB");
    }

    #[test]
    fn query_params() {
        assert_eq!(query_param("n=abc&token=x.y.z", "token").as_deref(), Some("x.y.z"));
        assert_eq!(query_param("n=abc", "token"), None);
    }

    #[test]
    fn config_value_validation() {
        assert!(is_safe_config_value("AIzaSyD-abc_123"));
        assert!(is_safe_config_value("proj.firebaseapp.com"));
        assert!(!is_safe_config_value("a\";alert(1);//"));
        assert!(!is_safe_config_value(""));
    }

    /// Gerçek bir TCP bağlantısıyla tek isteği `handle`'a verir; (durum satırı, gövde, token, bitti mi) döner.
    fn roundtrip(request_target: &str, nonce: &str) -> (String, String, Option<String>, bool) {
        use std::cell::RefCell;
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let target = request_target.to_string();
        let client = std::thread::spawn(move || {
            let mut c = TcpStream::connect(("127.0.0.1", port)).unwrap();
            write!(c, "GET {target} HTTP/1.1\r\nHost: x\r\n\r\n").unwrap();
            let mut resp = String::new();
            c.read_to_string(&mut resp).unwrap();
            resp
        });
        let (stream, _) = listener.accept().unwrap();
        let got = RefCell::new(None);
        let done = handle(stream, &|t| *got.borrow_mut() = Some(t), "LOGIN-PAGE api=KEY", nonce);
        let resp = client.join().unwrap();
        let (head, body) = resp.split_once("\r\n\r\n").unwrap();
        (head.lines().next().unwrap().to_string(), body.to_string(), got.into_inner(), done)
    }

    #[test]
    fn serves_login_page() {
        let (status, body, token, done) = roundtrip("/login?n=abc", "abc");
        assert_eq!(status, "HTTP/1.1 200 OK");
        assert_eq!(body, "LOGIN-PAGE api=KEY");
        assert!(token.is_none() && !done);
    }

    #[test]
    fn callback_with_valid_nonce_delivers_long_jwt() {
        // ~3 KB'lık gerçekçi bir JWT (header.payload.signature, base64url)
        let jwt = format!("eyJhbGciOiJSUzI1NiJ9.{}.{}", "a".repeat(1800), "b-_".repeat(400));
        let (status, _, token, done) =
            roundtrip(&format!("/oauth/callback?n=secret&token={jwt}"), "secret");
        assert_eq!(status, "HTTP/1.1 200 OK");
        assert_eq!(token.as_deref(), Some(jwt.as_str()));
        assert!(done, "başarılı girişten sonra sunucu kapanmalı");
    }

    #[test]
    fn callback_with_wrong_or_missing_nonce_is_rejected() {
        for target in [
            "/oauth/callback?n=wrong&token=evil",
            "/oauth/callback?token=evil",
            "/oauth/callback?n=secret",
            "/oauth/callback?n=secret&token=",
        ] {
            let (status, _, token, done) = roundtrip(target, "secret");
            assert_eq!(status, "HTTP/1.1 403 Forbidden", "{target}");
            assert!(token.is_none() && !done, "{target}");
        }
    }

    #[test]
    fn unknown_paths_and_methods() {
        let (status, ..) = roundtrip("/etc/passwd", "n");
        assert_eq!(status, "HTTP/1.1 404 Not Found");
    }

    #[test]
    fn nonces_differ() {
        assert_ne!(random_nonce(), random_nonce());
        assert_eq!(random_nonce().len(), 32);
    }
}
