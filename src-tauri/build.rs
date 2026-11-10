use std::{env, fs, path::{Path, PathBuf}};

use chacha20poly1305::{aead::{Aead, KeyInit}, ChaCha20Poly1305, Key, Nonce};

/// `.env.local` içinden tek bir anahtarı okur (tırnak/boşlukları temizleyerek).
fn read_env_local(key: &str) -> Option<String> {
    let path = Path::new("..").join(".env.local");
    let text = fs::read_to_string(path).ok()?;
    text.lines().find_map(|line| {
        let line = line.trim();
        if line.starts_with('#') {
            return None;
        }
        let (k, v) = line.split_once('=')?;
        (k.trim() == key).then(|| v.trim().trim_matches(|c| c == '"' || c == '\'').to_string())
    })
}


/// `.env.local` içeriğini her derlemede rastgele bir anahtarla şifreleyip exe'ye gömer (`src/envfile.rs` bellekte çözer).
/// Amaç: kurulum klasöründe düz metin gizli dosya bırakmamak ve `strings` ile okunamaması. Anahtar da exe içinde
/// olduğundan bu BİR GİZLEME katmanıdır, kararlı bir tersine mühendislik karşısında koruma sağlamaz; asıl çözüm
/// anahtarları istemciden çıkarıp token üretimini sunucuya taşımaktır.
fn embed_env() {
    let out = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR"));
    let plain = fs::read(Path::new("..").join(".env.local")).unwrap_or_default();
    let (blob, mask, share) = if plain.is_empty() {
        (Vec::new(), [0u8; 32], [0u8; 32])
    } else {
        let mut key = [0u8; 32];
        let mut nonce = [0u8; 12];
        let mut mask = [0u8; 32];
        getrandom::getrandom(&mut key).expect("rastgele anahtar");
        getrandom::getrandom(&mut nonce).expect("rastgele nonce");
        getrandom::getrandom(&mut mask).expect("rastgele maske");
        let ct = ChaCha20Poly1305::new(Key::from_slice(&key))
            .encrypt(Nonce::from_slice(&nonce), plain.as_ref())
            .expect("şifreleme");
        let mut blob = nonce.to_vec();
        blob.extend(ct);
        let mut share = [0u8; 32];
        for i in 0..32 {
            share[i] = key[i] ^ mask[i];
        }
        (blob, mask, share)
    };
    fs::write(out.join("env.bin"), blob).expect("env.bin");
    fs::write(
        out.join("env_key.rs"),
        format!("const MASK: [u8; 32] = {mask:?};\nconst SHARE: [u8; 32] = {share:?};\n"),
    )
    .expect("env_key.rs");
}

fn main() {
    embed_env();
    // Admin UID: Electron'da `process.env.NEXT_PUBLIC_ADMIN_UID` ile çalışma anında okunuyordu.
    // Bu değer zaten NEXT_PUBLIC_ (arayüze gömülü, gizli değil); Rust'a derleme zamanında gömülür.
    println!("cargo:rerun-if-changed=../.env.local");
    println!("cargo:rerun-if-env-changed=NEXT_PUBLIC_ADMIN_UID");
    let admin = env::var("NEXT_PUBLIC_ADMIN_UID")
        .ok()
        .or_else(|| read_env_local("NEXT_PUBLIC_ADMIN_UID"))
        .unwrap_or_default();
    println!("cargo:rustc-env=NETREX_ADMIN_UID={}", admin.trim());

    tauri_build::build()
}
