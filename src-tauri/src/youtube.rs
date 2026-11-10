//! YouTube çalma listesi okuyucu (Electron `youtubePlaylist.js` karşılığı).
//!
//! YouTube Data API anahtarı gerektirmeden, herkese açık bir listenin parçalarını okur: liste sayfasındaki
//! `ytInitialData` JSON'unu ayrıştırır, devam sayfalarını `youtubei/v1/browse` ile alır.
//! WebView'den doğrudan istek CORS'a takılacağı için istek Rust'ta yapılır.
//!
//! NOT: YouTube'un sayfa yapısı değişebilir; okuma başarısız olursa anlaşılır bir hata döner, tek video
//! ekleme etkilenmez. Hem eski (`playlistVideoRenderer`) hem yeni (`lockupViewModel`) düzen tanınır.

use serde::Serialize;
use serde_json::{json, Value};
use std::{collections::HashSet, time::Duration};

const MAX_TRACKS: usize = 200; // Firestore belge boyutunu (1MB) ve ekranı şişirmemek için üst sınır
const MAX_CONTINUATION_PAGES: usize = 5; // ilk sayfa ~100 parça; devamı sayfa sayfa
const REQUEST_TIMEOUT: Duration = Duration::from_secs(15);

const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
// Avrupa'da çıkan "çerezleri kabul et" ara sayfasını atlar
const CONSENT_COOKIE: &str = "SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg; CONSENT=PENDING+987";

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub video_id: String,
    pub title: String,
    pub thumbnail: String,
    pub duration: u64,
}

pub struct Playlist {
    pub title: String,
    pub tracks: Vec<Track>,
    pub truncated: bool,
}

// ------------------------------------------------------------------ JSON yardımcıları

/// `marker` adlı değişkenin atandığı JSON nesnesini (süslü parantez eşleştirerek) çıkarır.
/// `{` `}` `"` `\` ASCII olduğundan bayt bazlı tarama UTF-8 için güvenlidir.
fn extract_balanced_json(text: &str, marker: &str) -> Option<Value> {
    let at = text.find(marker)?;
    let start = at + text[at..].find('{')?;
    let bytes = text.as_bytes();
    let (mut depth, mut in_string, mut escaped) = (0i32, false, false);
    for (i, &ch) in bytes.iter().enumerate().skip(start) {
        if in_string {
            if escaped {
                escaped = false;
            } else if ch == b'\\' {
                escaped = true;
            } else if ch == b'"' {
                in_string = false;
            }
            continue;
        }
        match ch {
            b'"' => in_string = true,
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    return serde_json::from_str(&text[start..=i]).ok();
                }
            }
            _ => {}
        }
    }
    None
}

/// Ağaçta `key` anahtarının ilk değerini bulur (yapı değişse de dayanıklı olsun diye).
/// JS sürümüyle aynı sıra: diziler baştan sona, nesneler son anahtardan başa.
fn find_first_by_key<'a>(root: &'a Value, key: &str) -> Option<&'a Value> {
    match root {
        Value::Object(map) => {
            if let Some(v) = map.get(key) {
                return Some(v);
            }
            map.values().rev().find_map(|v| find_first_by_key(v, key))
        }
        Value::Array(items) => items.iter().find_map(|v| find_first_by_key(v, key)),
        _ => None,
    }
}

fn text_of(t: &Value) -> String {
    if let Some(runs) = t.get("runs").and_then(Value::as_array) {
        return runs
            .iter()
            .filter_map(|r| r.get("text").and_then(Value::as_str))
            .collect::<Vec<_>>()
            .join("");
    }
    t.get("simpleText").and_then(Value::as_str).unwrap_or("").to_string()
}

/// "3:53" / "1:02:03" → saniye (geçersizse 0)
fn parse_clock(text: &str) -> u64 {
    let t = text.trim();
    let parts: Vec<&str> = t.split(':').collect();
    let ok = (2..=3).contains(&parts.len())
        && parts.iter().enumerate().all(|(i, p)| {
            p.chars().all(|c| c.is_ascii_digit())
                && if i == 0 { (1..=2).contains(&p.len()) } else { p.len() == 2 }
        });
    if !ok {
        return 0;
    }
    parts.iter().fold(0u64, |acc, p| acc * 60 + p.parse::<u64>().unwrap_or(0))
}

fn is_video_id(s: &str) -> bool {
    s.len() == 11 && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

fn make_track(video_id: &str, title: &str, duration: u64) -> Track {
    Track {
        video_id: video_id.to_string(),
        title: if title.is_empty() { video_id.to_string() } else { title.to_string() },
        thumbnail: format!("https://img.youtube.com/vi/{video_id}/mqdefault.jpg"),
        duration,
    }
}

/// Yeni YouTube düzeni: lockupViewModel (parça kartı)
fn parse_lockup(lockup: &Value) -> Option<Track> {
    let id = lockup.get("contentId").and_then(Value::as_str)?;
    if !is_video_id(id) {
        return None;
    }
    if let Some(ct) = lockup.get("contentType").and_then(Value::as_str) {
        if ct != "LOCKUP_CONTENT_TYPE_VIDEO" {
            return None;
        }
    }
    let title = lockup
        .pointer("/metadata/lockupMetadataViewModel/title/content")
        .and_then(Value::as_str)
        .unwrap_or("");
    // Süre, küçük resmin alt köşesindeki rozet metninde ("3:53")
    let mut duration = 0;
    if let Some(overlays) = lockup.pointer("/contentImage/thumbnailViewModel/overlays").and_then(Value::as_array) {
        for o in overlays {
            if let Some(badges) = o.pointer("/thumbnailBottomOverlayViewModel/badges").and_then(Value::as_array) {
                for b in badges {
                    if duration == 0 {
                        if let Some(t) = b.pointer("/thumbnailBadgeViewModel/text").and_then(Value::as_str) {
                            duration = parse_clock(t);
                        }
                    }
                }
            }
        }
    }
    Some(make_track(id, title, duration))
}

/// Bir sayfadaki öğeleri parçalara çevirir; varsa devam belirtecini (continuation token) de döndürür.
fn parse_items(items: &[Value]) -> (Vec<Track>, Option<String>) {
    let mut tracks = Vec::new();
    let mut token: Option<String> = None;
    for item in items {
        if let Some(v) = item.get("playlistVideoRenderer") {
            // Eski düzen
            let id = v.get("videoId").and_then(Value::as_str).unwrap_or("");
            if id.is_empty() || v.get("isPlayable").and_then(Value::as_bool) == Some(false) {
                continue; // silinmiş / özel / bölge kısıtlı
            }
            let secs = v
                .get("lengthSeconds")
                .and_then(|x| x.as_str().and_then(|s| s.parse::<u64>().ok()).or_else(|| x.as_u64()))
                .unwrap_or(0);
            tracks.push(make_track(id, &v.get("title").map(text_of).unwrap_or_default(), secs));
        } else if let Some(l) = item.get("lockupViewModel") {
            if let Some(t) = parse_lockup(l) {
                tracks.push(t);
            }
        } else if let Some(c) = item.get("continuationItemRenderer") {
            if let Some(t) = c.pointer("/continuationEndpoint/continuationCommand/token").and_then(Value::as_str) {
                token = Some(t.to_string());
            }
        } else if let Some(c) = item.get("continuationItemViewModel") {
            let t = c
                .pointer("/continuationCommand/innertubeCommand/continuationCommand/token")
                .or_else(|| c.pointer("/continuationCommand/token"))
                .and_then(Value::as_str);
            if let Some(t) = t {
                token = Some(t.to_string());
            }
        }
    }
    (tracks, token)
}

/// Parça kartlarını içeren diziyi bulur (iki düzeni de tanır).
fn find_items_array(root: &Value) -> Option<&Vec<Value>> {
    match root {
        Value::Array(items) => {
            if items.iter().any(|x| x.get("lockupViewModel").is_some() || x.get("playlistVideoRenderer").is_some()) {
                return Some(items);
            }
            items.iter().find_map(find_items_array)
        }
        Value::Object(map) => map.values().find_map(find_items_array),
        _ => None,
    }
}

/// Sayfanın ilk yüklemesindeki devam belirteci (yeni düzende parça dizisinin DIŞINDA durur).
fn find_initial_token(root: &Value) -> Option<String> {
    if let Some(vm) = find_first_by_key(root, "continuationItemViewModel") {
        return parse_items(&[json!({ "continuationItemViewModel": vm })]).1;
    }
    if let Some(r) = find_first_by_key(root, "continuationItemRenderer") {
        return parse_items(&[json!({ "continuationItemRenderer": r })]).1;
    }
    None
}

// ------------------------------------------------------------------ ağ

fn get_page(url: &str) -> Result<String, String> {
    let resp = ureq::get(url)
        .timeout(REQUEST_TIMEOUT)
        .set("User-Agent", USER_AGENT)
        .set("Accept-Language", "en-US,en;q=0.9")
        .set("Cookie", CONSENT_COOKIE)
        .call()
        .map_err(|e| match e {
            ureq::Error::Status(code, _) => format!("YouTube listeyi vermedi (HTTP {code})."),
            other => format!("YouTube'a bağlanılamadı: {other}"),
        })?;
    resp.into_string().map_err(|e| format!("YouTube yanıtı okunamadı: {e}"))
}

/// Çalma listesi kimliğini doğrular (enjeksiyon ve gereksiz istek önlemi).
pub fn validate_list_id(list_id: &str) -> Result<(), String> {
    let ok = (10..=64).contains(&list_id.len())
        && list_id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
    if !ok {
        return Err("Geçersiz çalma listesi bağlantısı.".into());
    }
    // "RD…" karışımlar (mix/radio) sonsuzdur, kişiselleştirilmiştir ve oynatılamaz
    if ["RD", "UL", "LL", "WL"].iter().any(|p| list_id.starts_with(p)) {
        return Err("Bu bir YouTube karışımı/kişisel liste; eklenemez. Herkese açık bir çalma listesi bağlantısı kullanın.".into());
    }
    Ok(())
}

pub fn fetch_playlist(list_id: &str) -> Result<Playlist, String> {
    validate_list_id(list_id)?;
    let html = get_page(&format!("https://www.youtube.com/playlist?list={list_id}&hl=en"))?;

    let data = extract_balanced_json(&html, "ytInitialData")
        .ok_or("YouTube sayfası okunamadı (beklenmeyen biçim).")?;
    let first_items = find_items_array(&data).ok_or(
        "Liste bulunamadı. Gizli, silinmiş veya boş olabilir; \"Herkese açık\" ya da \"Liste dışı\" olmalı.",
    )?;

    let title = data
        .pointer("/metadata/playlistMetadataRenderer/title")
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| {
            find_first_by_key(&data, "playlistHeaderRenderer")
                .and_then(|h| h.get("title"))
                .map(text_of)
                .filter(|s| !s.is_empty())
        })
        .unwrap_or_else(|| "YouTube Çalma Listesi".to_string());

    let (mut tracks, first_token) = parse_items(first_items);
    let mut token = first_token.or_else(|| find_initial_token(&data));

    // Devam sayfaları (ilk sayfada ~100 parça var)
    let capture = |re_prefix: &str| -> Option<String> {
        let at = html.find(re_prefix)? + re_prefix.len();
        let end = html[at..].find('"')? + at;
        Some(html[at..end].to_string())
    };
    let api_key = capture("\"INNERTUBE_API_KEY\":\"");
    let client_version = capture("\"INNERTUBE_CONTEXT_CLIENT_VERSION\":\"");
    let mut pages = 0;
    while let (Some(tok), Some(key)) = (token.clone(), api_key.as_ref()) {
        if tracks.len() >= MAX_TRACKS || pages >= MAX_CONTINUATION_PAGES {
            break;
        }
        pages += 1;
        let body = json!({
            "context": { "client": {
                "clientName": "WEB",
                "clientVersion": client_version.clone().unwrap_or_else(|| "2.20240101.00.00".into()),
                "hl": "en", "gl": "US"
            }},
            "continuation": tok,
        });
        let resp = ureq::post(&format!("https://www.youtube.com/youtubei/v1/browse?key={key}&prettyPrint=false"))
            .timeout(REQUEST_TIMEOUT)
            .set("User-Agent", USER_AGENT)
            .set("Accept-Language", "en-US,en;q=0.9")
            .set("Cookie", CONSENT_COOKIE)
            .send_json(body);
        let json: Value = match resp.ok().and_then(|r| r.into_json().ok()) {
            Some(j) => j,
            None => break, // devam sayfası alınamazsa elimizdekilerle devam et
        };
        let items: Vec<Value> = json
            .pointer("/onResponseReceivedActions/0/appendContinuationItemsAction/continuationItems")
            .and_then(Value::as_array)
            .cloned()
            .or_else(|| find_first_by_key(&json, "continuationItems").and_then(Value::as_array).cloned())
            .or_else(|| find_items_array(&json).cloned())
            .unwrap_or_default();
        let (page_tracks, page_token) = parse_items(&items);
        if page_tracks.is_empty() && page_token.is_none() {
            token = None; // boş devam sayfası = liste bitti ("kısaltıldı" sayılmasın)
            break;
        }
        tracks.extend(page_tracks);
        token = page_token;
    }

    // Aynı video listede birden çok kez varsa tekilleştir
    let mut seen = HashSet::new();
    tracks.retain(|t| seen.insert(t.video_id.clone()));

    let truncated = tracks.len() > MAX_TRACKS || token.is_some();
    tracks.truncate(MAX_TRACKS);
    Ok(Playlist { title, tracks, truncated })
}

/// Arayüzün beklediği biçim: `{ ok: true, title, tracks, truncated }` veya `{ ok: false, error }`.
#[tauri::command]
pub async fn fetch_youtube_playlist(list_id: String) -> Value {
    let res = tauri::async_runtime::spawn_blocking(move || fetch_playlist(&list_id)).await;
    match res {
        Ok(Ok(p)) => json!({ "ok": true, "title": p.title, "tracks": p.tracks, "truncated": p.truncated }),
        Ok(Err(e)) => json!({ "ok": false, "error": e }),
        Err(_) => json!({ "ok": false, "error": "Liste alınamadı." }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_json_with_braces_and_quotes_inside_strings() {
        let html = r#"<script>var ytInitialData = {"a":"}{\"x\"","b":{"c":[1,2,{"d":"é}"}]}};</script><x>"#;
        let v = extract_balanced_json(html, "ytInitialData").unwrap();
        assert_eq!(v["a"], "}{\"x\"");
        assert_eq!(v["b"]["c"][2]["d"], "é}");
        assert!(extract_balanced_json("yok", "ytInitialData").is_none());
    }

    #[test]
    fn clock_parsing() {
        assert_eq!(parse_clock("3:53"), 233);
        assert_eq!(parse_clock("1:02:03"), 3723);
        assert_eq!(parse_clock(" 0:09 "), 9);
        for bad in ["", "abc", "3", "3:5", "1:2:3:4", "100:00", "3:533"] {
            assert_eq!(parse_clock(bad), 0, "{bad}");
        }
    }

    #[test]
    fn video_id_validation() {
        assert!(is_video_id("dQw4w9WgXcQ"));
        assert!(!is_video_id("kısa"));
        assert!(!is_video_id("dQw4w9WgXc!"));
    }

    #[test]
    fn list_id_validation() {
        assert!(validate_list_id("PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI").is_ok());
        assert!(validate_list_id("kisa").is_err());
        assert!(validate_list_id("PLxxxxxxxx/../etc").is_err());
        assert!(validate_list_id("RDdQw4w9WgXcQ_mix").unwrap_err().contains("karışım"));
    }

    #[test]
    fn parses_old_layout_and_skips_unplayable() {
        let items = vec![
            json!({"playlistVideoRenderer": {"videoId":"AAAAAAAAAAA","title":{"runs":[{"text":"Bir "},{"text":"Şarkı"}]},"lengthSeconds":"233"}}),
            json!({"playlistVideoRenderer": {"videoId":"BBBBBBBBBBB","isPlayable":false,"title":{"simpleText":"Silinmiş"}}}),
            json!({"continuationItemRenderer": {"continuationEndpoint":{"continuationCommand":{"token":"TOK1"}}}}),
        ];
        let (tracks, token) = parse_items(&items);
        assert_eq!(tracks.len(), 1);
        assert_eq!(tracks[0].title, "Bir Şarkı");
        assert_eq!(tracks[0].duration, 233);
        assert_eq!(tracks[0].thumbnail, "https://img.youtube.com/vi/AAAAAAAAAAA/mqdefault.jpg");
        assert_eq!(token.as_deref(), Some("TOK1"));
    }

    #[test]
    fn parses_new_lockup_layout_with_duration_badge_and_token() {
        let items = vec![
            json!({"lockupViewModel": {
                "contentId": "CCCCCCCCCCC", "contentType": "LOCKUP_CONTENT_TYPE_VIDEO",
                "metadata": {"lockupMetadataViewModel": {"title": {"content": "Yeni Düzen"}}},
                "contentImage": {"thumbnailViewModel": {"overlays": [
                    {"thumbnailBottomOverlayViewModel": {"badges": [{"thumbnailBadgeViewModel": {"text": "1:02:03"}}]}}
                ]}}
            }}),
            // video olmayan kart (ör. kanal) atlanır
            json!({"lockupViewModel": {"contentId": "DDDDDDDDDDD", "contentType": "LOCKUP_CONTENT_TYPE_PLAYLIST"}}),
            json!({"continuationItemViewModel": {"continuationCommand": {"innertubeCommand": {"continuationCommand": {"token": "TOK2"}}}}}),
        ];
        let (tracks, token) = parse_items(&items);
        assert_eq!(tracks.len(), 1);
        assert_eq!(tracks[0].video_id, "CCCCCCCCCCC");
        assert_eq!(tracks[0].title, "Yeni Düzen");
        assert_eq!(tracks[0].duration, 3723);
        assert_eq!(token.as_deref(), Some("TOK2"));
    }

    #[test]
    fn finds_items_array_and_initial_token_anywhere() {
        let data = json!({"x": {"y": [{"lockupViewModel": {"contentId":"EEEEEEEEEEE"}}]},
                          "z": {"continuationItemViewModel": {"continuationCommand": {"token": "TOKX"}}}});
        assert!(find_items_array(&data).is_some());
        assert_eq!(find_initial_token(&data).as_deref(), Some("TOKX"));
        assert!(find_items_array(&json!({"a": 1})).is_none());
    }

    #[test]
    fn serializes_track_camel_case() {
        let t = make_track("AAAAAAAAAAA", "", 5);
        let v = serde_json::to_value(&t).unwrap();
        assert_eq!(v["videoId"], "AAAAAAAAAAA");
        assert_eq!(v["title"], "AAAAAAAAAAA"); // başlık yoksa kimlik
    }

    /// Gerçek YouTube ile uçtan uca (ağ gerekir): `YT_LIST=<kimlik> cargo test live_playlist -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn live_playlist() {
        let id = std::env::var("YT_LIST").unwrap_or_else(|_| "PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI".into());
        let p = fetch_playlist(&id).expect("liste alınmalı");
        println!("BAŞLIK: {}", p.title);
        println!("PARÇA SAYISI: {} (kısaltıldı: {})", p.tracks.len(), p.truncated);
        for t in p.tracks.iter().take(3) {
            println!("  {} | {} | {} sn", t.video_id, t.title, t.duration);
        }
        assert!(!p.tracks.is_empty());
    }
}
