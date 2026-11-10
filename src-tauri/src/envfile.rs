//! `.env.local` okuyucu (Electron'daki `dotenv` karşılığı).
//!
//! Electron paketlenmiş uygulamada `.env.local`'i exe'nin yanındaki `resources/` klasöründen
//! okuyordu. Burada sırayla aranır: gerçek ortam değişkenleri (öncelikli), kaynak klasörü,
//! exe klasörü ve üst klasörleri (geliştirme/derleme ağacında çalıştırma), çalışma klasörü.

use std::{collections::HashMap, path::PathBuf, sync::OnceLock};

use chacha20poly1305::{aead::{Aead, KeyInit}, ChaCha20Poly1305, Key, Nonce};
use tauri::{AppHandle, Manager};

// Derleme zamanında `build.rs` üretir: şifreli `.env.local` (nonce ‖ şifreli metin ‖ etiket) + bölünmüş anahtar.
static EMBEDDED: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/env.bin"));
include!(concat!(env!("OUT_DIR"), "/env_key.rs"));

/// Basit dotenv ayrıştırıcı: `ANAHTAR=değer`, `#` yorum, tırnak ve `export ` öneki tolere edilir.
pub fn parse(text: &str) -> HashMap<String, String> {
    let mut out = HashMap::new();
    for line in text.trim_start_matches('\u{feff}').lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let line = line.strip_prefix("export ").unwrap_or(line);
        let Some((k, v)) = line.split_once('=') else { continue };
        let key = k.trim();
        if key.is_empty() {
            continue;
        }
        let mut val = v.trim();
        // Tırnaksız değerde satır sonu yorumunu at (` # ...`)
        if !(val.starts_with('"') || val.starts_with('\'')) {
            if let Some(i) = val.find(" #") {
                val = val[..i].trim_end();
            }
        }
        let val = val
            .trim_matches(|c| c == '"' || c == '\'')
            .to_string();
        out.insert(key.to_string(), val);
    }
    out
}

/// `nonce(12) ‖ şifreli metin ‖ etiket` → düz metin. Anahtar/etiket yanlışsa veya veri bozuksa `None`.
fn decrypt(blob: &[u8], key: &[u8; 32]) -> Option<Vec<u8>> {
    if blob.len() <= 12 + 16 {
        return None;
    }
    let (nonce, ct) = blob.split_at(12);
    ChaCha20Poly1305::new(Key::from_slice(key)).decrypt(Nonce::from_slice(nonce), ct).ok()
}

/// Exe'ye gömülü (şifreli) `.env.local`; derleme sırasında dosya yoksa boş. Çözülmüş içerik yalnızca bellekte tutulur.
fn embedded() -> HashMap<String, String> {
    static CACHE: OnceLock<HashMap<String, String>> = OnceLock::new();
    CACHE
        .get_or_init(|| {
            let mut key = [0u8; 32];
            for i in 0..32 {
                key[i] = MASK[i] ^ SHARE[i];
            }
            decrypt(EMBEDDED, &key)
                .and_then(|b| String::from_utf8(b).ok())
                .map(|t| parse(&t))
                .unwrap_or_default()
        })
        .clone()
}

/// `restrict`: yalnızca kaynak klasörü ve exe klasörü (üst klasörlere/çalışma klasörüne bakma).
fn candidates(app: &AppHandle, restrict: bool) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Ok(r) = app.path().resource_dir() {
        dirs.push(r);
    }
    if restrict {
        if let Some(d) = std::env::current_exe().ok().and_then(|e| e.parent().map(|p| p.to_path_buf())) {
            dirs.push(d);
        }
        return dirs.into_iter().map(|d| d.join(".env.local")).collect();
    }
    if let Ok(exe) = std::env::current_exe() {
        // exe klasörü ve en çok 6 üst klasör (target/release → src-tauri → proje kökü)
        let mut cur = exe.parent().map(|p| p.to_path_buf());
        for _ in 0..7 {
            let Some(d) = cur else { break };
            cur = d.parent().map(|p| p.to_path_buf());
            dirs.push(d);
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        dirs.push(cwd);
    }
    dirs.into_iter().map(|d| d.join(".env.local")).collect()
}

/// `.env.local` içeriği (bulunamazsa boş) + hangi dosyadan geldiği.
///
/// Sıra: yanındaki/kaynak klasöründeki gerçek dosya (taşınabilir sürüm, geliştirme: üstün gelir) →
/// exe'ye gömülü şifreli kopya (kurulu sürüm; dosya yolu `None`). Gömülü kopya varken release'te
/// üst klasörlere ve çalışma klasörüne bakılmaz (rastgele bir `.env.local` yapılandırmayı ezemesin).
pub fn load(app: &AppHandle) -> (HashMap<String, String>, Option<PathBuf>) {
    let emb = embedded();
    let restrict = !cfg!(debug_assertions) && !emb.is_empty();
    for path in candidates(app, restrict) {
        if let Ok(text) = std::fs::read_to_string(&path) {
            return (parse(&text), Some(path));
        }
    }
    (emb, None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_typical_env_file() {
        let m = parse(
            "# yorum\n\nA=1\nB = \"iki\"\nexport C='üç'\nD=dört # satır sonu yorumu\nE=https://x.y/z?a=b#frag\n=bos\nYOK\n",
        );
        assert_eq!(m["A"], "1");
        assert_eq!(m["B"], "iki");
        assert_eq!(m["C"], "üç");
        assert_eq!(m["D"], "dört");
        // URL içindeki # boşluksuz olduğundan korunur
        assert_eq!(m["E"], "https://x.y/z?a=b#frag");
        assert!(!m.contains_key("YOK"));
    }

    #[test]
    fn embedded_blob_roundtrip_and_tamper_detection() {
        let key = [7u8; 32];
        let nonce = [3u8; 12];
        let ct = ChaCha20Poly1305::new(Key::from_slice(&key))
            .encrypt(Nonce::from_slice(&nonce), b"A=1\nB=iki".as_ref())
            .unwrap();
        let mut blob = nonce.to_vec();
        blob.extend(&ct);
        assert_eq!(decrypt(&blob, &key).unwrap(), b"A=1\nB=iki");
        assert!(decrypt(&blob, &[8u8; 32]).is_none(), "yanlış anahtar çözmemeli");
        let mut bad = blob.clone();
        *bad.last_mut().unwrap() ^= 1;
        assert!(decrypt(&bad, &key).is_none(), "oynanmış veri reddedilmeli");
        assert!(decrypt(&[], &key).is_none());
        assert!(decrypt(&blob[..20], &key).is_none());
    }

    #[test]
    fn build_embedded_blob_decrypts_with_split_key() {
        // build.rs'in ürettiği blob + bölünmüş anahtar uçtan uca tutarlı olmalı (.env.local yoksa boş: geçerli).
        let mut key = [0u8; 32];
        for i in 0..32 {
            key[i] = MASK[i] ^ SHARE[i];
        }
        if EMBEDDED.is_empty() {
            return;
        }
        let plain = decrypt(EMBEDDED, &key).expect("gömülü blob çözülemedi");
        assert!(String::from_utf8(plain).is_ok());
    }

    #[test]
    fn tolerates_bom_and_crlf() {
        let m = parse("\u{feff}X=1\r\nY=2\r\n");
        assert_eq!(m["X"], "1");
        assert_eq!(m["Y"], "2");
    }
}
