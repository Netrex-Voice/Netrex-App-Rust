//! Overlay pencereleri (Faz 5): işaretçi, kayan mesaj (ticker) ve oyun içi ses overlay'i.
//!
//! Electron sürümünde üç overlay da kendi durum değişkenleri ve zamanlayıcılarıyla ayrı ayrı yazılmıştı
//! (ayar değişince pencere güncellenmiyor, anti-cheat sonrası overlay yeniden beliriyor, "tıklanabilir mi"
//! kararı üç yerde üç yöntemle veriliyordu). Burada tek bir motor var:
//!
//! * **Pencere**: şeffaf, çerçevesiz, her zaman üstte, odak almaz (`WS_EX_NOACTIVATE`), görev çubuğunda yok.
//! * **Tıklama geçirgenliği**: pencere varsayılanda tıklamayı geçirir. Sayfa yalnızca "tıklanabilir
//!   dikdörtgenlerini" bildirir (`overlay_set_hit`); imleç bunların üstündeyken TEK bir yoklama thread'i
//!   pencereyi tıklanabilir yapar. (WebView2'de tıklama geçirgen pencereye fare olayı iletilmez, bu yüzden
//!   `mouseenter` ile karar vermek mümkün değil.)
//! * **Sayfa hazır olmadan veri kaybolmaz**: sayfa dinleyicilerini kurunca `overlay_ready` der; o ana kadar
//!   gelen olaylar sırayla (durum olaylarında yalnızca sonuncusu) iletilir.
//! * **Anti-cheat**: işlem listesi `ToolHelp` ile okunur (harici `tasklist` süreci yok); tespit sonrası
//!   ses overlay'i bir sonraki kontrole kadar ENGELLİ kalır (yeniden belirmez).

use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use serde::Deserialize;
use serde_json::{json, Value};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};

pub const POINTER: &str = "pointer-overlay";
pub const TICKER: &str = "ticker-overlay";
pub const VOICE: &str = "voice-overlay";
const LABELS: [&str; 3] = [POINTER, TICKER, VOICE];

const TICKER_HEIGHT: f64 = 76.0;
const VOICE_W: f64 = 350.0;
const VOICE_H: f64 = 600.0;
/// Tıklanabilir alanın çevresindeki pay (CSS px)
const HIT_PAD: f64 = 6.0;
const ANTICHEAT_PROCESSES: [&str; 5] =
    ["vgc.exe", "beservice.exe", "easyanticheat.exe", "easyanticheat_eos.exe", "mhyprot2.sys"];
const ANTICHEAT_CACHE: Duration = Duration::from_secs(20);
const ANTICHEAT_INTERVAL_SECS: u64 = 30;

fn label_of(s: &str) -> Option<&'static str> {
    LABELS.iter().copied().find(|l| *l == s)
}

// ------------------------------------------------------------------ durum

#[derive(Clone, Copy, Default)]
struct Rect {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

impl Rect {
    fn contains(&self, px: f64, py: f64, pad: f64) -> bool {
        self.w > 0.0
            && self.h > 0.0
            && px >= self.x - pad
            && px <= self.x + self.w + pad
            && py >= self.y - pad
            && py <= self.y + self.h + pad
    }
}

/// Sayfadan gelen dikdörtgen (JS `NaN` → JSON `null` olabilir, bu yüzden `Option`).
#[derive(Deserialize, Default, Clone)]
pub struct RectIn {
    x: Option<f64>,
    y: Option<f64>,
    width: Option<f64>,
    height: Option<f64>,
}

impl RectIn {
    fn clean(&self) -> Rect {
        let n = |v: Option<f64>| v.filter(|f| f.is_finite()).unwrap_or(0.0);
        Rect { x: n(self.x), y: n(self.y), w: n(self.width).max(0.0), h: n(self.height).max(0.0) }
    }
}

/// Ticker mesajının hareketi: sağdan sola sabit hızla kayar, konum zamandan hesaplanır.
#[derive(Deserialize, Default, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub struct Geom {
    started_at: Option<f64>,
    from: Option<f64>,
    speed: Option<f64>,
    width: Option<f64>,
    top: Option<f64>,
    height: Option<f64>,
}

#[derive(Default)]
struct Slot {
    visible: bool,
    ready: bool,
    /// Sayfa hazır olmadan gelen olaylar: (olay, veri, sadece-sonuncusu-önemli)
    pending: Vec<(String, Value, bool)>,
    /// Pencerenin sol-üst köşesi (fiziksel px) ve ölçek: imleç → CSS px çevirisi için
    origin: (f64, f64),
    scale: f64,
    rects: Vec<Rect>,
    hover_rects: Vec<Rect>,
    dragging: bool,
    forced: bool,
    interactive: bool,
    hovering: bool,
    geom: Option<Geom>,
}

#[derive(Default)]
struct AntiCheat {
    checked: Option<Instant>,
    detected: bool,
    /// Ses overlay'i engelli mi (tespit sonrası yeniden belirmesin)
    voice_blocked: bool,
}

pub struct OverlayState {
    slots: Mutex<HashMap<&'static str, Slot>>,
    anticheat: Mutex<AntiCheat>,
    /// Ses overlay'i anti-cheat döngüsünün kuşağı: değişince eski döngü kendiliğinden biter
    ac_generation: AtomicU64,
}

impl Default for OverlayState {
    fn default() -> Self {
        Self { slots: Mutex::new(HashMap::new()), anticheat: Mutex::new(AntiCheat::default()), ac_generation: AtomicU64::new(0) }
    }
}

fn with_slot<R>(app: &AppHandle, label: &'static str, f: impl FnOnce(&mut Slot) -> R) -> Option<R> {
    let st = app.state::<OverlayState>();
    let mut g = st.slots.lock().ok()?;
    g.get_mut(label).map(f)
}

// ------------------------------------------------------------------ pencere

#[cfg(windows)]
fn no_activate(win: &WebviewWindow) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
    };
    if let Ok(h) = win.hwnd() {
        unsafe {
            let hwnd = h.0 as _;
            let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex | (WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW) as isize);
        }
    }
}
#[cfg(not(windows))]
fn no_activate(_win: &WebviewWindow) {}

/// Birincil monitör: (x, y, genişlik, yükseklik) fiziksel px + ölçek.
fn primary(app: &AppHandle) -> Option<(f64, f64, f64, f64, f64)> {
    let m = app.primary_monitor().ok().flatten()?;
    let p = m.position();
    let s = m.size();
    Some((p.x as f64, p.y as f64, s.width as f64, s.height as f64, m.scale_factor()))
}

fn build_window(app: &AppHandle, label: &'static str, page: &str) -> Result<WebviewWindow, String> {
    let builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App(page.into()))
        .title("Netrex Overlay")
        .inner_size(VOICE_W, VOICE_H)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .focused(false)
        .focusable(false)
        // Ekran yakalamaya DAHİL OLMASIN (Windows: WDA_EXCLUDEFROMCAPTURE). İşaretçi overlay'i birincil monitörün
        // tamamını kaplayan şeffaf bir penceredir; Windows Graphics Capture bazı sistemlerde şeffaf WebView2
        // penceresini saydam değil koyu/gri bir katman olarak yakalıyor ve birincil ekranın yayını siyah/gri çıkıyordu
        // (ikinci ekranda overlay olmadığı için sorun yoktu). Ayrıca izleyiciler overlay'i yayında görmemeli.
        .content_protected(true)
        .visible(false);
    #[cfg(windows)]
    let builder = builder.additional_browser_args(crate::lifecycle::WEBVIEW2_BROWSER_ARGS);
    let win = builder.build().map_err(|e| format!("overlay penceresi açılamadı: {e}"))?;
    no_activate(&win);
    crate::webview_lock::lock_down(&win);
    crate::webview_lock::allow_app_permissions(&win);
    let _ = win.set_ignore_cursor_events(true); // varsayılan: tıklamayı geçir
    Ok(win)
}

/// Pencereyi getirir; yoksa oluşturur ve durumunu sıfırlar.
fn ensure(app: &AppHandle, label: &'static str, page: &str) -> Result<WebviewWindow, String> {
    if let Some(w) = app.get_webview_window(label) {
        return Ok(w);
    }
    let win = build_window(app, label, page)?;
    {
        let st = app.state::<OverlayState>();
        let mut g = st.slots.lock().unwrap_or_else(|e| e.into_inner());
        g.insert(label, Slot { scale: 1.0, ..Slot::default() });
    }
    let handle = app.clone();
    win.on_window_event(move |e| {
        if matches!(e, WindowEvent::Destroyed) {
            if let Ok(mut g) = handle.state::<OverlayState>().slots.lock() {
                g.remove(label);
            }
        }
    });
    Ok(win)
}

/// Pencereyi fiziksel koordinatlarla yerleştirir ve yoklama için konumu kaydeder.
fn place(app: &AppHandle, win: &WebviewWindow, label: &'static str, x: f64, y: f64, w: f64, h: f64, scale: f64) {
    let _ = win.set_size(PhysicalSize::new(w.round().max(1.0) as u32, h.round().max(1.0) as u32));
    let _ = win.set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32));
    with_slot(app, label, |s| {
        s.origin = (x, y);
        s.scale = scale;
    });
}

fn show(app: &AppHandle, win: &WebviewWindow, label: &'static str) {
    let _ = win.show(); // WS_EX_NOACTIVATE: odağı çalmaz
    let _ = win.set_always_on_top(true);
    no_activate(win); // gösterme sırasında pencere stilleri sıfırlanabiliyor (ölçüldü: TOOLWINDOW kayboluyordu)
    with_slot(app, label, |s| s.visible = true);
}

fn hide(app: &AppHandle, label: &'static str) {
    if let Some(w) = app.get_webview_window(label) {
        let _ = w.hide();
    }
    with_slot(app, label, |s| {
        s.visible = false;
        s.interactive = false;
        s.hovering = false;
    });
}

fn destroy(app: &AppHandle, label: &'static str) {
    if let Some(w) = app.get_webview_window(label) {
        let _ = w.destroy();
    }
    if let Ok(mut g) = app.state::<OverlayState>().slots.lock() {
        g.remove(label);
    }
}

/// Olayı overlay sayfasına iletir; sayfa hazır değilse sıraya alır.
/// `latest`: durum olayı — sırada aynı adlı eski olay varsa atılır (yalnızca sonuncusu anlamlı).
fn emit(app: &AppHandle, label: &'static str, event: &str, payload: Value, latest: bool) {
    let ready = with_slot(app, label, |s| {
        if !s.ready {
            if latest {
                s.pending.retain(|(e, _, _)| e != event);
            }
            s.pending.push((event.to_string(), payload.clone(), latest));
        }
        s.ready
    });
    if ready == Some(true) {
        let _ = app.emit_to(label, event, payload);
    }
}

// ------------------------------------------------------------------ tıklama yoklaması

#[cfg(windows)]
fn cursor_physical(_app: &AppHandle) -> Option<(f64, f64)> {
    use windows_sys::Win32::{Foundation::POINT, UI::WindowsAndMessaging::GetCursorPos};
    let mut p = POINT { x: 0, y: 0 };
    if unsafe { GetCursorPos(&mut p) } != 0 {
        Some((p.x as f64, p.y as f64))
    } else {
        None
    }
}
#[cfg(not(windows))]
fn cursor_physical(app: &AppHandle) -> Option<(f64, f64)> {
    app.cursor_position().ok().map(|p| (p.x, p.y))
}

fn now_ms() -> f64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as f64).unwrap_or(0.0)
}

fn inside_interactive(s: &Slot, lx: f64, ly: f64, now: f64) -> bool {
    if s.forced || s.dragging {
        return true;
    }
    if s.rects.iter().any(|r| r.contains(lx, ly, HIT_PAD)) {
        return true;
    }
    if let Some(g) = s.geom {
        let n = |v: Option<f64>| v.filter(|f| f.is_finite()).unwrap_or(0.0);
        let x = n(g.from) - ((now - n(g.started_at)) / 1000.0) * n(g.speed);
        let r = Rect { x, y: n(g.top), w: n(g.width), h: n(g.height) };
        if r.contains(lx, ly, HIT_PAD) {
            return true;
        }
    }
    false
}

/// Tek yoklama thread'i: tüm overlay'ler için "tıklanabilir mi" kararı + üstte tutma.
fn start_poller(app: AppHandle) {
    std::thread::Builder::new()
        .name("overlay-poll".into())
        .spawn(move || {
            let mut last_top = Instant::now();
            loop {
                let any_visible = app
                    .state::<OverlayState>()
                    .slots
                    .lock()
                    .map(|g| g.values().any(|s| s.visible))
                    .unwrap_or(false);
                std::thread::sleep(Duration::from_millis(if any_visible { 40 } else { 250 }));
                if !any_visible {
                    continue;
                }
                let Some((cx, cy)) = cursor_physical(&app) else { continue };
                let now = now_ms();

                // Karar: kilit altında hesapla, pencere çağrılarını kilitsiz yap
                let mut changes: Vec<(&'static str, Option<bool>, Option<bool>)> = Vec::new();
                if let Ok(mut g) = app.state::<OverlayState>().slots.lock() {
                    for (label, s) in g.iter_mut() {
                        if !s.visible {
                            continue;
                        }
                        let sc = if s.scale > 0.0 { s.scale } else { 1.0 };
                        let (lx, ly) = ((cx - s.origin.0) / sc, (cy - s.origin.1) / sc);
                        let inter = inside_interactive(s, lx, ly, now);
                        let hover = inter || s.hover_rects.iter().any(|r| r.contains(lx, ly, 0.0));
                        let ci = (inter != s.interactive).then(|| {
                            s.interactive = inter;
                            inter
                        });
                        let ch = (hover != s.hovering).then(|| {
                            s.hovering = hover;
                            hover
                        });
                        if ci.is_some() || ch.is_some() {
                            changes.push((*label, ci, ch));
                        }
                    }
                }
                for (label, ci, ch) in changes {
                    if let Some(w) = app.get_webview_window(label) {
                        if let Some(i) = ci {
                            let _ = w.set_ignore_cursor_events(!i);
                        }
                    }
                    if let Some(h) = ch {
                        let _ = app.emit_to(label, "overlay-hover", h);
                    }
                }

                // Oyunlar/tam ekran uygulamalar öne geçerse tekrar en üste al
                if last_top.elapsed() >= Duration::from_millis(2500) {
                    last_top = Instant::now();
                    for l in LABELS {
                        let vis = with_slot(&app, l, |s| s.visible).unwrap_or(false);
                        if vis {
                            if let Some(w) = app.get_webview_window(l) {
                                let _ = w.set_always_on_top(true);
                            }
                        }
                    }
                }
            }
        })
        .ok();
}

pub fn setup(app: &AppHandle) {
    app.manage(OverlayState::default());
    start_poller(app.clone());
}

/// Uygulama çıkarken tüm overlay'leri kapat.
pub fn shutdown(app: &AppHandle) {
    app.state::<OverlayState>().ac_generation.fetch_add(1, Ordering::SeqCst);
    for l in LABELS {
        destroy(app, l);
    }
}

// ------------------------------------------------------------------ anti-cheat

#[cfg(windows)]
fn running_processes() -> Vec<String> {
    use windows_sys::Win32::{
        Foundation::{CloseHandle, INVALID_HANDLE_VALUE},
        System::Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
        },
    };
    let mut out = Vec::new();
    unsafe {
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snap == INVALID_HANDLE_VALUE {
            return out;
        }
        let mut e: PROCESSENTRY32W = std::mem::zeroed();
        e.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
        if Process32FirstW(snap, &mut e) != 0 {
            loop {
                let len = e.szExeFile.iter().position(|&c| c == 0).unwrap_or(e.szExeFile.len());
                out.push(String::from_utf16_lossy(&e.szExeFile[..len]).to_lowercase());
                if Process32NextW(snap, &mut e) == 0 {
                    break;
                }
            }
        }
        CloseHandle(snap);
    }
    out
}
#[cfg(not(windows))]
fn running_processes() -> Vec<String> {
    Vec::new()
}

/// Anti-cheat süreci çalışıyor mu? (`max_age` kadar önbellekli)
fn anticheat_detected(app: &AppHandle, max_age: Duration) -> bool {
    let st = app.state::<OverlayState>();
    if let Ok(g) = st.anticheat.lock() {
        if let Some(t) = g.checked {
            if t.elapsed() < max_age {
                return g.detected;
            }
        }
    }
    let procs = running_processes();
    let detected = ANTICHEAT_PROCESSES.iter().any(|p| procs.iter().any(|n| n == p));
    if let Ok(mut g) = st.anticheat.lock() {
        g.checked = Some(Instant::now());
        g.detected = detected;
    }
    detected
}

fn voice_blocked(app: &AppHandle) -> bool {
    app.state::<OverlayState>().anticheat.lock().map(|g| g.voice_blocked).unwrap_or(false)
}

fn set_voice_blocked(app: &AppHandle, v: bool) {
    if let Ok(mut g) = app.state::<OverlayState>().anticheat.lock() {
        g.voice_blocked = v;
    }
}

/// Anti-cheat tespit edildi: ses overlay'ini gizle, engelle, ana pencereyi bilgilendir.
fn block_voice(app: &AppHandle) {
    if !voice_blocked(app) {
        crate::lifecycle::trace(app, "overlay: anti-cheat tespit edildi, ses overlay'i gizlendi");
        let _ = app.emit_to("main", "voice-overlay-anticheat", true);
    }
    set_voice_blocked(app, true);
    hide(app, VOICE);
}

fn start_anticheat_loop(app: &AppHandle) {
    let gen = app.state::<OverlayState>().ac_generation.fetch_add(1, Ordering::SeqCst) + 1;
    let app = app.clone();
    std::thread::Builder::new()
        .name("overlay-anticheat".into())
        .spawn(move || loop {
            for _ in 0..ANTICHEAT_INTERVAL_SECS {
                std::thread::sleep(Duration::from_secs(1));
                if app.state::<OverlayState>().ac_generation.load(Ordering::SeqCst) != gen {
                    return;
                }
            }
            if anticheat_detected(&app, Duration::ZERO) {
                block_voice(&app);
            } else if voice_blocked(&app) {
                // Anti-cheat kapandı: engeli kaldır; overlay bir sonraki güncellemede kendiliğinden görünür
                set_voice_blocked(&app, false);
                let _ = app.emit_to("main", "voice-overlay-anticheat", false);
            }
        })
        .ok();
}

// ------------------------------------------------------------------ ortak komutlar

/// Overlay sayfası dinleyicilerini kurdu: bekleyen olayları sırayla ilet.
#[tauri::command]
pub fn overlay_ready(app: AppHandle, label: String) {
    let Some(label) = label_of(&label) else { return };
    let pending = with_slot(&app, label, |s| {
        s.ready = true;
        std::mem::take(&mut s.pending)
    })
    .unwrap_or_default();
    for (ev, payload, _) in pending {
        let _ = app.emit_to(label, &ev, payload);
    }
}

/// Sayfanın tıklanabilir (ve yalnızca üzerine gelinince haber verilecek) alanları — CSS px, pencereye göre.
#[tauri::command]
pub fn overlay_set_hit(
    app: AppHandle,
    label: String,
    rects: Vec<RectIn>,
    hover_rects: Option<Vec<RectIn>>,
    dragging: Option<bool>,
) {
    let Some(label) = label_of(&label) else { return };
    with_slot(&app, label, |s| {
        s.rects = rects.iter().map(RectIn::clean).filter(|r| r.w > 0.0 && r.h > 0.0).collect();
        s.hover_rects = hover_rects
            .unwrap_or_default()
            .iter()
            .map(RectIn::clean)
            .filter(|r| r.w > 0.0 && r.h > 0.0)
            .collect();
        s.dragging = dragging.unwrap_or(false);
    });
}

/// Elle zorla: true iken pencere her zaman tıklanabilir.
#[tauri::command]
pub fn set_overlay_interactive(app: AppHandle, interactive: bool) {
    with_slot(&app, POINTER, |s| s.forced = interactive);
}

// ------------------------------------------------------------------ işaretçi overlay'i

fn fit_full_screen(app: &AppHandle, win: &WebviewWindow, label: &'static str) {
    if let Some((x, y, w, h, sc)) = primary(app) {
        place(app, win, label, x, y, w, h, sc);
    }
}

/// Eski biçim: yalnızca dizi. Yeni biçim: { pointers, requests }.
#[tauri::command]
pub async fn update_pointer_overlay(app: AppHandle, payload: Value, force_show: Option<bool>) -> Result<(), String> {
    let (pointers, requests) = match &payload {
        Value::Array(_) => (payload.clone(), json!([])),
        _ => (
            payload.get("pointers").cloned().unwrap_or_else(|| json!([])),
            payload.get("requests").cloned().unwrap_or_else(|| json!([])),
        ),
    };
    let has_content = pointers.as_array().map_or(false, |a| !a.is_empty())
        || requests.as_array().map_or(false, |a| !a.is_empty());
    let exists = app.get_webview_window(POINTER).is_some();
    if !has_content && !force_show.unwrap_or(false) && !exists {
        return Ok(());
    }
    let win = ensure(&app, POINTER, "overlays/pointer.html")?;
    if !with_slot(&app, POINTER, |s| s.visible).unwrap_or(false) {
        fit_full_screen(&app, &win, POINTER);
        show(&app, &win, POINTER);
    }
    emit(&app, POINTER, "update-pointer-overlay-data", json!({ "pointers": pointers, "requests": requests }), true);
    Ok(())
}

#[tauri::command]
pub fn close_pointer_overlay(app: AppHandle) {
    destroy(&app, POINTER);
}

/// Yayıncının uygulamasından overlay'e tıklama dalgası / çizim olayı (sayfa hazır değilse atılır: eski olay anlamsız).
#[tauri::command]
pub fn send_pointer_overlay_event(app: AppHandle, evt: Value) {
    if with_slot(&app, POINTER, |s| s.ready) == Some(true) {
        let _ = app.emit_to(POINTER, "pointer-overlay-event-data", evt);
    }
}

/// Overlay sayfasından ana pencereye: izin ver / reddet / kaldır / hepsini kaldır.
#[tauri::command]
pub fn pointer_overlay_notify_main(app: AppHandle, kind: String, id: Option<Value>) {
    let event = match kind.as_str() {
        "granted" => "pointer-overlay-granted",
        "denied" => "pointer-overlay-denied",
        "revoked" => "pointer-overlay-revoked",
        "revoke-all" => "pointer-overlay-revoke-all",
        _ => return,
    };
    let _ = app.emit_to("main", event, id.unwrap_or(Value::Null));
}

// ------------------------------------------------------------------ ticker

fn clean_ticker_text(s: &str) -> String {
    let flat: String = s.chars().map(|c| if c.is_control() { ' ' } else { c }).collect();
    flat.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(200).collect()
}

/// Kayan mesajı gösterir. `{ shown, reason? }`: shown=false ise arayüz kendi bildirimine düşer.
#[tauri::command]
pub async fn show_ticker_message(app: AppHandle, msg: Value) -> Result<Value, String> {
    let text = clean_ticker_text(msg.get("text").and_then(Value::as_str).unwrap_or(""));
    if text.is_empty() {
        return Ok(json!({ "shown": false, "reason": "empty" }));
    }
    let check = msg.get("antiCheatProtection").and_then(Value::as_bool) != Some(false);
    if check && anticheat_detected(&app, ANTICHEAT_CACHE) {
        return Ok(json!({ "shown": false, "reason": "anticheat" }));
    }
    let opacity = msg.get("opacity").and_then(Value::as_f64).filter(|f| f.is_finite()).unwrap_or(0.8).clamp(0.3, 1.0);
    let name: String = msg.get("name").and_then(Value::as_str).unwrap_or("").chars().take(40).collect();

    let win = ensure(&app, TICKER, "overlays/ticker.html")?;
    if !with_slot(&app, TICKER, |s| s.visible).unwrap_or(false) {
        if let Some((x, y, w, h, sc)) = primary(&app) {
            place(&app, &win, TICKER, x, y + (h * 0.06).round(), w, TICKER_HEIGHT * sc, sc);
        }
        show(&app, &win, TICKER);
    }
    emit(&app, TICKER, "ticker-message-data", json!({ "text": text, "name": name, "opacity": opacity }), false);
    Ok(json!({ "shown": true }))
}

/// Sıra bitti: pencereyi gizle (yok etme; sonraki mesaj hızlı açılsın).
#[tauri::command]
pub fn ticker_idle(app: AppHandle) {
    with_slot(&app, TICKER, |s| s.geom = None);
    hide(&app, TICKER);
}

/// Kullanıcı ✕ ile kapattı: sırayı temizle ve gizle.
#[tauri::command]
pub fn ticker_close(app: AppHandle) {
    with_slot(&app, TICKER, |s| {
        s.pending.clear();
        s.geom = None;
    });
    if with_slot(&app, TICKER, |s| s.ready) == Some(true) {
        let _ = app.emit_to(TICKER, "ticker-clear", ());
    }
    hide(&app, TICKER);
}

#[tauri::command]
pub fn ticker_set_geom(app: AppHandle, geom: Option<Geom>) {
    with_slot(&app, TICKER, |s| s.geom = geom);
}

// ------------------------------------------------------------------ ses overlay'i

fn voice_start_position(app: &AppHandle, settings: &Value) -> Option<(f64, f64, f64)> {
    let (mx, my, mw, mh, sc) = primary(app)?;
    let (sw, sh) = (mw / sc, mh / sc);
    let preset = match settings.get("position").and_then(Value::as_str).unwrap_or("top-right") {
        "top-left" => (12.0, 28.0),
        "bottom-right" => (sw - VOICE_W - 12.0, sh - VOICE_H - 48.0),
        "bottom-left" => (12.0, sh - VOICE_H - 48.0),
        "custom" => {
            let c = settings.get("customPosition");
            let g = |k: &str| c.and_then(|c| c.get(k)).and_then(Value::as_f64).filter(|f| f.is_finite());
            match (g("x"), g("y")) {
                (Some(x), Some(y)) => (x, y),
                _ => (sw - VOICE_W - 12.0, 28.0),
            }
        }
        _ => (sw - VOICE_W - 12.0, 28.0),
    };
    Some((mx + preset.0 * sc, my + preset.1 * sc, sc))
}

/// Ses overlay'ini aç/kapat. Açıkken tekrar çağrılırsa AYARLAR UYGULANIR (konum + düğmeler);
/// Electron'da yalnızca ilk oluşturmada uygulanıyordu.
#[tauri::command]
pub async fn set_voice_overlay_enabled(app: AppHandle, enabled: bool, settings: Option<Value>) -> Result<(), String> {
    if !enabled {
        app.state::<OverlayState>().ac_generation.fetch_add(1, Ordering::SeqCst);
        set_voice_blocked(&app, false);
        destroy(&app, VOICE);
        return Ok(());
    }
    let settings = settings.unwrap_or_else(|| json!({}));
    let win = ensure(&app, VOICE, "overlays/voice.html")?;
    if let Some((x, y, sc)) = voice_start_position(&app, &settings) {
        place(&app, &win, VOICE, x, y, VOICE_W * sc, VOICE_H * sc, sc);
    }
    let flag = |k: &str, d: bool| settings.get(k).and_then(Value::as_bool).unwrap_or(d);
    emit(
        &app,
        VOICE,
        "voice-overlay-config",
        json!({
            "controlMute": flag("controlMute", true),
            "controlDeafen": flag("controlDeafen", false),
            "controlLeave": flag("controlLeave", true),
        }),
        true,
    );

    if flag("antiCheatProtection", true) {
        if anticheat_detected(&app, Duration::ZERO) {
            block_voice(&app);
        } else if voice_blocked(&app) {
            set_voice_blocked(&app, false);
        }
        start_anticheat_loop(&app);
    } else {
        app.state::<OverlayState>().ac_generation.fetch_add(1, Ordering::SeqCst);
        set_voice_blocked(&app, false);
    }
    Ok(())
}

#[tauri::command]
pub async fn update_voice_overlay(app: AppHandle, data: Value) -> Result<(), String> {
    let Some(win) = app.get_webview_window(VOICE) else { return Ok(()) };
    if voice_blocked(&app) {
        return Ok(()); // anti-cheat: yeniden belirme
    }
    if !with_slot(&app, VOICE, |s| s.visible).unwrap_or(false) {
        show(&app, &win, VOICE);
    }
    emit(&app, VOICE, "voice-overlay-data", data, true);
    Ok(())
}

/// Odadan ayrılma vb.: overlay'i gizle (pencere kalır; ayarlar korunur).
#[tauri::command]
pub fn close_voice_overlay(app: AppHandle) {
    hide(&app, VOICE);
}

/// Overlay sayfasından gelen eylemler: ana pencereye ilet veya pencereyi taşı.
#[tauri::command]
pub fn voice_overlay_action(app: AppHandle, action: String, payload: Option<Value>) {
    let payload = payload.unwrap_or(Value::Null);
    match action.as_str() {
        "toggle-mute" | "toggle-deafen" | "leave" => {
            let _ = app.emit_to("main", "voice-overlay-action-response", json!({ "action": action, "payload": payload }));
        }
        "drag" => {
            let g = |k: &str| payload.get(k).and_then(Value::as_f64).filter(|f| f.is_finite()).unwrap_or(0.0);
            let (dx, dy) = (g("dx"), g("dy"));
            if let (Some(win), Some((ox, oy, sc))) =
                (app.get_webview_window(VOICE), with_slot(&app, VOICE, |s| (s.origin.0, s.origin.1, s.scale.max(0.1))))
            {
                let (nx, ny) = (ox + dx * sc, oy + dy * sc);
                let _ = win.set_position(PhysicalPosition::new(nx.round() as i32, ny.round() as i32));
                with_slot(&app, VOICE, |s| s.origin = (nx, ny));
            }
        }
        "save-position" => {
            if let (Some((ox, oy, sc)), Some((mx, my, ..))) =
                (with_slot(&app, VOICE, |s| (s.origin.0, s.origin.1, s.scale.max(0.1))), primary(&app))
            {
                // Ayarlarda mantıksal px (birincil monitöre göre) saklanır: DPI/çözünürlük değişse de aynı yer
                let pos = json!({ "x": ((ox - mx) / sc).round(), "y": ((oy - my) / sc).round() });
                let _ = app.emit_to("main", "voice-overlay-action-response", json!({ "action": "position-saved", "payload": pos }));
            }
        }
        _ => {}
    }
}

// ------------------------------------------------------------------ fare konumu (ekran paylaşımı imleci)

/// Birincil monitörün TAM sınırlarına göre imleç konumu (mantıksal px): paylaşılan görüntü ve işaretçi
/// overlay'i ile aynı alan.
#[tauri::command]
pub fn get_mouse_position(app: AppHandle) -> Option<Value> {
    let (cx, cy) = cursor_physical(&app)?;
    let (mx, my, mw, mh, sc) = primary(&app)?;
    Some(json!({
        "x": (cx - mx) / sc,
        "y": (cy - my) / sc,
        "screenWidth": mw / sc,
        "screenHeight": mh / sc,
    }))
}

// ------------------------------------------------------------------ testler

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ticker_text_is_flattened_and_capped() {
        assert_eq!(clean_ticker_text("  a\n\tb   c\u{7}d "), "a b c d");
        assert_eq!(clean_ticker_text(&"x".repeat(500)).chars().count(), 200);
        assert_eq!(clean_ticker_text("\n\t "), "");
    }

    #[test]
    fn rect_contains_with_pad_and_empty_rects() {
        let r = Rect { x: 10.0, y: 10.0, w: 20.0, h: 20.0 };
        assert!(r.contains(10.0, 10.0, 0.0));
        assert!(r.contains(5.0, 5.0, 6.0));
        assert!(!r.contains(3.0, 3.0, 6.0));
        assert!(!Rect::default().contains(0.0, 0.0, 6.0)); // boş dikdörtgen asla tıklanabilir yapmaz
    }

    #[test]
    fn rect_in_survives_null_and_nan() {
        let r: RectIn = serde_json::from_str(r#"{"x":null,"y":5,"width":-3,"height":7}"#).unwrap();
        let c = r.clean();
        assert_eq!((c.x, c.y, c.w, c.h), (0.0, 5.0, 0.0, 7.0));
    }

    #[test]
    fn moving_message_hit_follows_time() {
        let s = Slot {
            visible: true,
            geom: Some(Geom {
                started_at: Some(0.0),
                from: Some(1000.0),
                speed: Some(200.0),
                width: Some(100.0),
                top: Some(10.0),
                height: Some(30.0),
            }),
            ..Slot::default()
        };
        // t=0: x=1000 → içinde; t=2s: x=600 → 1000 artık dışarıda, 650 içeride
        assert!(inside_interactive(&s, 1050.0, 20.0, 0.0));
        assert!(!inside_interactive(&s, 1050.0, 20.0, 2000.0));
        assert!(inside_interactive(&s, 650.0, 20.0, 2000.0));
        assert!(!inside_interactive(&s, 650.0, 80.0, 2000.0)); // dikeyde dışarıda
    }

    #[test]
    fn forced_and_dragging_are_always_interactive() {
        let s = Slot { forced: true, ..Slot::default() };
        assert!(inside_interactive(&s, -500.0, -500.0, 0.0));
        let d = Slot { dragging: true, ..Slot::default() };
        assert!(inside_interactive(&d, -500.0, -500.0, 0.0));
    }

    #[test]
    fn unknown_labels_are_rejected() {
        assert_eq!(label_of("pointer-overlay"), Some(POINTER));
        assert_eq!(label_of("main"), None);
    }
}
