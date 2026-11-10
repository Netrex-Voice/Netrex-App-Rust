//! Global kısayollar: arka uçlar + yönetici + IPC komutları (Faz 3).
//!
//! Electron karşılıkları: `inputManager.js` (uiohook) ve `ipcHandlers.js`
//! (update-hotkey, get-hotkey, set-recording-mode, start/stop-input-listener).
//!
//! Mimari:
//!   arka uç (OS kancası)  ──Msg::Input──▶  işleme thread'i (Engine)  ──olay──▶  renderer
//!   komutlar (IPC)        ──Msg::*──────▶  (motor yalnızca bu thread'de yaşar → kilit yok)
//!
//! Windows arka ucu `WH_KEYBOARD_LL`/`WH_MOUSE_LL` kancasını doğrudan kurar ve `stop` ile
//! GERÇEKTEN söker (rdev bunu yapamaz; ayrıca rdev her tuşta `ToUnicodeEx` çağırıp ölü tuşlu
//! klavye düzenlerinde sistem genelinde yazmayı bozabilir). Tuşlar fiziksel tarama kodundan
//! tanınır → klavye düzeninden bağımsız. macOS/Linux'ta rdev kullanılır.

use crate::hotkeys::{Binding, Engine, InputEvent, Out};
use crate::misc::OpResult;
use crate::store::Store;
use serde_json::Value;
use std::sync::{mpsc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

pub enum Msg {
    Input(InputEvent),
    /// Yalnızca teşhis modunda: kancanın ham değerleri (modifier ve eşlenemeyen tuşlar)
    Diag(String),
    SetBinding(String, Option<Binding>),
    SetRecording(bool),
    ReleaseAll,
}

pub struct InputManager {
    tx: mpsc::Sender<Msg>,
    backend: Mutex<Option<backend::Handle>>,
}

impl InputManager {
    fn start(&self, app: &AppHandle) -> Result<(), String> {
        let mut slot = self.backend.lock().map_err(|_| "kilit hatası".to_string())?;
        if slot.is_some() {
            crate::lifecycle::trace(app, "input: start (zaten çalışıyor)");
            return Ok(());
        }
        match backend::start(self.tx.clone()) {
            Ok(h) => {
                *slot = Some(h);
                crate::lifecycle::trace(app, "input: kanca kuruldu");
                Ok(())
            }
            Err(e) => {
                crate::lifecycle::trace(app, &format!("input: kanca KURULAMADI: {e}"));
                Err(e)
            }
        }
    }

    fn stop(&self, app: &AppHandle) {
        if let Ok(mut slot) = self.backend.lock() {
            if let Some(h) = slot.take() {
                backend::stop(h);
                crate::lifecycle::trace(app, "input: kanca söküldü");
            }
        }
        // Basılı kalan bas-konuşlar bırakılsın (Electron: stop → releaseAllHeld)
        let _ = self.tx.send(Msg::ReleaseAll);
    }
}

/// Motor thread'ini kurar, kayıtlı kısayolları yükler, yöneticiyi uygulama durumuna ekler.
pub fn setup(app: &AppHandle) {
    let (tx, rx) = mpsc::channel::<Msg>();

    let mut engine = Engine::new();
    for (key, value) in app.state::<Store>().entries_with_prefix("hotkeys.") {
        let action = key.trim_start_matches("hotkeys.");
        if let Some(b) = Binding::from_json(&value) {
            engine.set_binding(action, Some(b));
        }
    }

    let handle = app.clone();
    std::thread::Builder::new()
        .name("netrex-hotkeys".into())
        .spawn(move || {
            let mut engine = engine;
            // Kanal tüm göndericiler düşünce kapanır (uygulama çıkışı) → döngü biter.
            let mut input_events: u64 = 0;
            let diag = std::env::var_os("NETREX_INPUT_TRACE").is_some();
            for msg in rx {
                let outs = match msg {
                    Msg::Input(ev) => {
                        input_events += 1;
                        if input_events == 1 {
                            crate::lifecycle::trace(&handle, "input: ilk ham olay alındı");
                        }
                        // İsteğe bağlı teşhis (NETREX_INPUT_TRACE=1): yalnızca modifier ve kısayol
                        // tuşları günlüğe yazılır; normal yazı tuşları ASLA.
                        if diag {
                            if let InputEvent::Key { code, down } = &ev {
                                if engine.watches(code) {
                                    crate::lifecycle::trace(&handle, &format!("input[teşhis]: {code} {}", if *down { "aşağı" } else { "yukarı" }));
                                }
                            }
                        }
                        engine.on_event(&ev)
                    }
                    Msg::Diag(line) => {
                        if diag {
                            crate::lifecycle::trace(&handle, &line);
                        }
                        continue;
                    }
                    Msg::SetBinding(action, b) => engine.set_binding(&action, b),
                    Msg::SetRecording(on) => {
                        crate::lifecycle::trace(&handle, &format!("input: kayıt modu {on}"));
                        engine.set_recording(on)
                    }
                    Msg::ReleaseAll => engine.release_all(),
                };
                for out in outs {
                    match out {
                        Out::Hotkey(action) => {
                            // Yalnızca eylem adı günlüğe yazılır (ham tuşlar ASLA).
                            crate::lifecycle::trace(&handle, &format!("hotkey: {action}"));
                            let _ = handle.emit_to("main", "hotkey-triggered", action);
                        }
                        Out::Raw(v) => {
                            // Hangi tuş olduğu ASLA yazılmaz; yalnızca olayın iletildiği.
                            let ok = handle.emit_to("main", "raw-keydown", v).is_ok();
                            crate::lifecycle::trace(&handle, &format!("input: raw-keydown iletildi (ok={ok})"));
                        }
                    }
                }
            }
        })
        .expect("hotkey thread başlatılamadı");

    app.manage(InputManager {
        tx,
        backend: Mutex::new(None),
    });
}

// ------------------------------------------------------------------ komutlar

fn valid_action(action: &str) -> bool {
    !action.is_empty()
        && action.len() <= 64
        && action
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

/// Yalnızca teşhis modunda: kanca sayaçları.
#[tauri::command]
pub fn debug_hook_stats() -> String {
    if std::env::var_os("NETREX_INPUT_TRACE").is_none() {
        return String::new();
    }
    #[cfg(windows)]
    {
        use std::sync::atomic::Ordering::Relaxed;
        return format!(
            "kancaCagrisi={} dongu={} yenileme={} sonBekleme={} kurulu={}",
            backend::KB_CALLS.load(Relaxed),
            backend::LOOPS.load(Relaxed),
            backend::REINSTALLS.load(Relaxed),
            backend::LAST_WAIT.load(Relaxed),
            backend::HOOK_INSTALLED.load(Relaxed)
        );
    }
    #[cfg(not(windows))]
    String::new()
}

/// Yalnızca teşhis modunda: bu SÜREÇ içinden bir tuş basışı enjekte eder (kancanın canlı uygulamada
/// çalıştığını, çapraz-süreç enjeksiyon güvenilmezliğine takılmadan sınamak için).
#[tauri::command]
pub fn debug_inject_key(scan: u16, extended: bool) -> bool {
    if std::env::var_os("NETREX_INPUT_TRACE").is_none() {
        return false;
    }
    #[cfg(windows)]
    unsafe {
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
            SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_EXTENDEDKEY,
            KEYEVENTF_KEYUP, KEYEVENTF_SCANCODE,
        };
        for up in [false, true] {
            let mut flags = KEYEVENTF_SCANCODE;
            if extended {
                flags |= KEYEVENTF_EXTENDEDKEY;
            }
            if up {
                flags |= KEYEVENTF_KEYUP;
            }
            let input = INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 { ki: KEYBDINPUT { wVk: 0, wScan: scan, dwFlags: flags, time: 0, dwExtraInfo: 0 } },
            };
            SendInput(1, &input, std::mem::size_of::<INPUT>() as i32);
            std::thread::sleep(std::time::Duration::from_millis(40));
        }
    }
    let _ = (scan, extended);
    true
}

/// Yalnızca teşhis modunda (NETREX_INPUT_TRACE): arayüzün gördüğü atama tuşlarını günlüğe yazar.
/// Arayüz bunu yalnızca tuş ATAMA modundayken çağırır (normal yazı tuşları gönderilmez).
#[tauri::command]
pub fn trace_input(app: AppHandle, line: String) {
    if std::env::var_os("NETREX_INPUT_TRACE").is_some() && line.len() < 120 {
        crate::lifecycle::trace(&app, &format!("input[sayfa]: {line}"));
    }
}

#[tauri::command]
pub fn start_input_listener(app: AppHandle, mgr: State<'_, InputManager>) -> OpResult {
    match mgr.start(&app) {
        Ok(()) => OpResult::ok(),
        Err(e) => OpResult::err(&e),
    }
}

#[tauri::command]
pub fn stop_input_listener(app: AppHandle, mgr: State<'_, InputManager>) -> OpResult {
    mgr.stop(&app);
    OpResult::ok()
}

#[tauri::command]
pub fn set_recording_mode(mgr: State<'_, InputManager>, enabled: bool) -> OpResult {
    let _ = mgr.tx.send(Msg::SetRecording(enabled));
    OpResult::ok()
}

#[tauri::command]
pub fn get_hotkey(store: State<'_, Store>, action: String) -> Value {
    store
        .get(&format!("hotkeys.{action}"))
        .unwrap_or(Value::Null)
}

/// `keybinding` null ise kısayol silinir (Electron: `store.delete`).
#[tauri::command]
pub fn update_hotkey(
    store: State<'_, Store>,
    mgr: State<'_, InputManager>,
    action: String,
    keybinding: Option<Value>,
) -> OpResult {
    if !valid_action(&action) {
        return OpResult::err("Geçersiz eylem adı");
    }
    let key = format!("hotkeys.{action}");
    match keybinding.filter(|v| !v.is_null()) {
        None => {
            store.remove(&key);
            let _ = mgr.tx.send(Msg::SetBinding(action, None));
        }
        Some(v) => {
            let Some(binding) = Binding::from_json(&v) else {
                return OpResult::err("Geçersiz tuş ataması");
            };
            // Bilinmeyen alanları atıp kanonik biçimi sakla.
            store.set(&key, binding.to_json());
            let _ = mgr.tx.send(Msg::SetBinding(action, Some(binding)));
        }
    }
    OpResult::ok()
}

// ----------------------------------------------------------------- arka uçlar

/// Windows: doğrudan düşük seviyeli kanca, gerçekten sökülebilir.
#[cfg(windows)]
mod backend {
    use super::Msg;
    use crate::hotkeys::InputEvent;
    use std::{
        ptr::null_mut,
        sync::{mpsc, Mutex},
        thread,
        time::Duration,
    };
    use windows_sys::Win32::{
        Foundation::{GetLastError, LPARAM, LRESULT, WAIT_TIMEOUT, WPARAM},
        System::{
            LibraryLoader::GetModuleHandleW,
            Threading::{
                GetCurrentThread, GetCurrentThreadId, SetThreadPriority,
                THREAD_PRIORITY_TIME_CRITICAL,
            },
        },
        UI::WindowsAndMessaging::{
            CallNextHookEx, DispatchMessageW, MsgWaitForMultipleObjects, PeekMessageW,
            PostThreadMessageW, SetWindowsHookExW, TranslateMessage, UnhookWindowsHookEx,
            KBDLLHOOKSTRUCT, LLKHF_EXTENDED, MSG, PM_NOREMOVE, PM_REMOVE,
            QS_ALLINPUT, WH_KEYBOARD_LL, WM_KEYDOWN, WM_KEYUP, WM_QUIT,
            WM_SYSKEYDOWN, WM_SYSKEYUP,
        },
    };

    /// Kanca geri çağrıları çıplak `extern "system" fn`'dir; olay kanalına bu global üzerinden ulaşır.
    static TX: Mutex<Option<mpsc::Sender<Msg>>> = Mutex::new(None);
    /// Teşhis modu (NETREX_INPUT_TRACE): kanca ham değerleri de gönderir.
    static DIAG: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
    /// Teşhis sayaçları (debug_hook_stats): kanca çağrısı, bekçi yenilemesi, döngü turu, son bekleme sonucu
    pub static KB_CALLS: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    pub static REINSTALLS: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    pub static LOOPS: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    pub static LAST_WAIT: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
    pub static HOOK_INSTALLED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

    pub struct Handle {
        thread_id: u32,
        join: thread::JoinHandle<()>,
        poller: Poller,
    }

    /// İKİNCİ, bağımsız algılama yolu: tuş durumunu doğrudan sorgular (`GetAsyncKeyState`).
    /// Windows düşük seviyeli kancayı bazı oturumlarda sebepsiz yere hiç çağırmıyor (ölçüldü: kurulu
    /// görünüyor, sayaç 0). Kanca ölse bile bu yol kısayolları yakalar; motor çift olayı (aynı tuş
    /// iki yoldan) tekrar basış saymaz.
    struct Poller {
        stop: std::sync::Arc<std::sync::atomic::AtomicBool>,
        join: thread::JoinHandle<()>,
    }

    fn start_poller() -> Result<Poller, String> {
        use std::sync::{
            atomic::{AtomicBool, Ordering},
            Arc,
        };
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
        let stop = Arc::new(AtomicBool::new(false));
        let stop2 = stop.clone();
        let join = thread::Builder::new()
            .name("netrex-input-poll".into())
            .spawn(move || {
                crate::power::disable_throttling_for_current_thread();
                let keys = crate::keys::vk_table();
                // Fare: orta (3), geri (4), ileri (5)
                let mouse: [(u8, i32); 3] = [(3, 0x04), (4, 0x05), (5, 0x06)];
                let down = |vk: i32| unsafe { (GetAsyncKeyState(vk) as u16) & 0x8000 != 0 };
                // Başlangıçta zaten basılı olanlar "yeni basış" sayılmasın
                let mut prev: Vec<bool> = keys.iter().map(|(_, vk)| down(*vk as i32)).collect();
                let mut mprev: Vec<bool> = mouse.iter().map(|(_, vk)| down(*vk)).collect();
                while !stop2.load(Ordering::Relaxed) {
                    for (i, (code, vk)) in keys.iter().enumerate() {
                        let d = down(*vk as i32);
                        if d != prev[i] {
                            prev[i] = d;
                            send(InputEvent::Key { code: code.to_string(), down: d });
                        }
                    }
                    for (i, (button, vk)) in mouse.iter().enumerate() {
                        let d = down(*vk);
                        if d != mprev[i] {
                            mprev[i] = d;
                            send(InputEvent::Mouse { button: *button, down: d });
                        }
                    }
                    thread::sleep(Duration::from_millis(8));
                }
            })
            .map_err(|e| e.to_string())?;
        Ok(Poller { stop, join })
    }

    fn send_msg(m: Msg) {
        if let Ok(g) = TX.lock() {
            if let Some(tx) = g.as_ref() {
                let _ = tx.send(m);
            }
        }
    }

    fn send(ev: InputEvent) {
        send_msg(Msg::Input(ev));
    }

    // ÖNEMLİ: Düşük seviyeli kanca geri çağrıları ~300 ms içinde dönmezse Windows kancayı sessizce
    // söker. Bu yüzden burada yalnızca kanala gönderilir; asıl iş işleme thread'indedir.
    unsafe extern "system" fn kb_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code >= 0 {
            KB_CALLS.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            let k = &*(lparam as *const KBDLLHOOKSTRUCT);
            let msg = wparam as u32;
            let down = msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN;
            let up = msg == WM_KEYUP || msg == WM_SYSKEYUP;
            if down || up {
                let extended = k.flags & LLKHF_EXTENDED != 0;
                let mapped = crate::keys::windows_to_code(k.scanCode, extended, k.vkCode);
                if let Some(c) = mapped {
                    send(InputEvent::Key { code: c.to_string(), down });
                }
                // Teşhis: modifier tuşları (Shift/Ctrl/Alt) ve eşlenemeyen her tuş HAM değerleriyle
                if DIAG.load(std::sync::atomic::Ordering::Relaxed)
                    && (mapped.is_none() || matches!(k.vkCode, 0x10..=0x12 | 0xA0..=0xA5))
                {
                    send_msg(Msg::Diag(format!(
                        "input[ham]: vk=0x{:X} scan=0x{:X} bayrak=0x{:X} {} -> {}",
                        k.vkCode,
                        k.scanCode,
                        k.flags,
                        if down { "aşağı" } else { "yukarı" },
                        mapped.unwrap_or("EŞLENEMEDİ")
                    )));
                }
            }
        }
        CallNextHookEx(null_mut(), code, wparam, lparam)
    }

    pub fn start(tx: mpsc::Sender<Msg>) -> Result<Handle, String> {
        DIAG.store(
            std::env::var_os("NETREX_INPUT_TRACE").is_some(),
            std::sync::atomic::Ordering::Relaxed,
        );
        let (ready_tx, ready_rx) = mpsc::channel::<Result<u32, String>>();
        if let Ok(mut g) = TX.lock() {
            *g = Some(tx);
        }
        let join = thread::Builder::new()
            .name("netrex-input-hook".into())
            .spawn(move || unsafe {
                // Kanca geri çağrısı ~300 ms içinde dönmezse Windows kancayı SESSİZCE söker. Uygulama
                // arka plandayken (oyun öndeyken) işletim sistemi bu thread'i yavaşlatabilir; bu yüzden
                // güç tasarrufu yavaşlatmasından muaf tut ve yüksek öncelik ver.
                // Teşhis varyantları (NETREX_HOOK_VARIANT, bit maskesi): 1=hmod NULL, 2=öncelik/güç ayarı yok, 4=düz GetMessage döngüsü
                let variant: u32 = std::env::var("NETREX_HOOK_VARIANT").ok().and_then(|v| v.parse().ok()).unwrap_or(0);
                if variant & 2 == 0 {
                    crate::power::disable_throttling_for_current_thread();
                    SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_TIME_CRITICAL);
                }

                let hmod = if variant & 1 != 0 { std::ptr::null_mut() } else { GetModuleHandleW(std::ptr::null()) };
                // Yalnızca KLAVYE kancası. Fare kancası kaldırıldı: her fare hareketinde (oyuncu farelerinde
                // saniyede 1000 kez) bu thread'i uyandırıyor ve sistem genelinde gecikme ekliyordu; fare
                // yan/orta tuşları zaten aşağıdaki yoklayıcıyla (GetAsyncKeyState) algılanıyor.
                let install = || (SetWindowsHookExW(WH_KEYBOARD_LL, Some(kb_proc), hmod, 0), null_mut::<std::ffi::c_void>());
                // Teşhis varyantı 8: kancayı HİÇ kurma (yalnızca yoklama çalışsın)
                let (mut kb, mut ms) = if variant & 8 != 0 { (null_mut(), null_mut()) } else { install() };
                if variant & 8 == 0 && kb.is_null() {
                    let err = GetLastError();
                    if !kb.is_null() {
                        UnhookWindowsHookEx(kb);
                    }
                    if !ms.is_null() {
                        UnhookWindowsHookEx(ms);
                    }
                    let _ = ready_tx.send(Err(format!("Klavye kancası kurulamadı (hata {err})")));
                    return;
                }
                // PostThreadMessage'ın çalışması için bu thread'in mesaj kuyruğu önce oluşmalı.
                let mut msg: MSG = std::mem::zeroed();
                PeekMessageW(&mut msg, null_mut(), 0, 0, PM_NOREMOVE);
                HOOK_INSTALLED.store(true, std::sync::atomic::Ordering::Relaxed);
                let _ = ready_tx.send(Ok(GetCurrentThreadId()));

                // Kancalar bu thread'in mesaj döngüsü üzerinden çalışır. BEKÇİ: 5 sn boyunca hiç
                // mesaj (yani hiç kanca çağrısı) gelmediyse kancayı söküp yeniden kurarız. Windows
                // kancayı sessizce söktüyse bu kendini onarır; sağlam kancada zararsızdır (boştayken
                // mikrosaniyelik yenileme). Aktif yazarken mesajlar aktığı için tetiklenmez.
                if variant & 4 != 0 {
                    // Düz döngü (ilk sürüm): bekçi yok
                    while windows_sys::Win32::UI::WindowsAndMessaging::GetMessageW(&mut msg, null_mut(), 0, 0) > 0 {
                        TranslateMessage(&msg);
                        DispatchMessageW(&msg);
                    }
                    if !kb.is_null() { UnhookWindowsHookEx(kb); }
                    if !ms.is_null() { UnhookWindowsHookEx(ms); }
                    return;
                }
                'pump: loop {
                    let r = MsgWaitForMultipleObjects(0, std::ptr::null(), 0, 5000, QS_ALLINPUT);
                    LOOPS.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    LAST_WAIT.store(r, std::sync::atomic::Ordering::Relaxed);
                    while PeekMessageW(&mut msg, null_mut(), 0, 0, PM_REMOVE) != 0 {
                        if msg.message == WM_QUIT {
                            break 'pump;
                        }
                        TranslateMessage(&msg);
                        DispatchMessageW(&msg);
                    }
                    if r == WAIT_TIMEOUT {
                        if !kb.is_null() {
                            UnhookWindowsHookEx(kb);
                        }
                        if !ms.is_null() {
                            UnhookWindowsHookEx(ms);
                        }
                        (kb, ms) = install(); // başarısızsa (null) bir sonraki turda yeniden denenir
                        REINSTALLS.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                        HOOK_INSTALLED.store(!kb.is_null(), std::sync::atomic::Ordering::Relaxed);
                    }
                }
                if !kb.is_null() {
                    UnhookWindowsHookEx(kb);
                }
                if !ms.is_null() {
                    UnhookWindowsHookEx(ms);
                }
            })
            .map_err(|e| e.to_string())?;

        match ready_rx.recv_timeout(Duration::from_secs(3)) {
            Ok(Ok(thread_id)) => {
                let poller = start_poller()?;
                Ok(Handle { thread_id, join, poller })
            }
            Ok(Err(e)) => {
                clear_tx();
                Err(e)
            }
            Err(_) => {
                clear_tx();
                Err("Klavye kancası zamanında başlamadı".into())
            }
        }
    }

    fn clear_tx() {
        if let Ok(mut g) = TX.lock() {
            *g = None;
        }
    }

    pub fn stop(h: Handle) {
        h.poller.stop.store(true, std::sync::atomic::Ordering::Relaxed);
        let _ = h.poller.join.join();
        unsafe {
            PostThreadMessageW(h.thread_id, WM_QUIT, 0, 0);
        }
        let _ = h.join.join(); // thread kancaları söküp çıkar
        clear_tx();
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use std::time::Duration;
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
            SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_EXTENDEDKEY,
            KEYEVENTF_KEYUP, KEYEVENTF_SCANCODE,
        };

        fn tap(scan: u16, extended: bool) {
            for up in [false, true] {
                let mut flags = KEYEVENTF_SCANCODE;
                if extended {
                    flags |= KEYEVENTF_EXTENDEDKEY;
                }
                if up {
                    flags |= KEYEVENTF_KEYUP;
                }
                let input = INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: INPUT_0 {
                        ki: KEYBDINPUT { wVk: 0, wScan: scan, dwFlags: flags, time: 0, dwExtraInfo: 0 },
                    },
                };
                unsafe {
                    SendInput(1, &input, std::mem::size_of::<INPUT>() as i32);
                }
                thread::sleep(Duration::from_millis(30));
            }
        }

        fn drain(rx: &mpsc::Receiver<Msg>) -> Vec<(String, bool)> {
            let mut got = Vec::new();
            while let Ok(Msg::Input(InputEvent::Key { code, down })) =
                rx.recv_timeout(Duration::from_millis(250))
            {
                got.push((code, down));
            }
            got
        }

        /// Kullanıcının GERÇEK ayar dosyasındaki kısayollarla, gerçek kanca → gerçek motor zinciri.
        /// `cargo test real_chain -- --ignored --nocapture`
        #[test]
        #[ignore]
        fn real_chain_with_user_bindings() {
            use crate::hotkeys::{Binding, Engine, Out};
            let appdata = std::env::var("APPDATA").unwrap();
            let settings_path = std::path::Path::new(&appdata)
                .join("com.netrex.app")
                .join("settings.json");
            let txt = std::fs::read_to_string(settings_path).unwrap();
            let map: serde_json::Map<String, serde_json::Value> =
                serde_json::from_str(txt.trim_start_matches('\u{feff}')).unwrap();
            let mut engine = Engine::new();
            let mut loaded = Vec::new();
            for (k, v) in &map {
                if let Some(a) = k.strip_prefix("hotkeys.") {
                    match Binding::from_json(v) {
                        Some(b) => {
                            loaded.push(format!("{a}={b:?}"));
                            engine.set_binding(a, Some(b));
                        }
                        None => loaded.push(format!("{a}=<geçersiz/boş: {v}>")),
                    }
                }
            }
            println!("YÜKLENEN KISAYOLLAR:
  {}", loaded.join("
  "));

            let (tx, rx) = mpsc::channel();
            let h = start(tx.clone()).expect("kanca kurulmalı");
            tap(0x36, false); // Sağ Shift (genişletilmemiş enjeksiyon)
            tap(0x36, true); // Sağ Shift (E0 bayraklı enjeksiyon)
            let mut outs = Vec::new();
            let mut raw = Vec::new();
            while let Ok(Msg::Input(ev)) = rx.recv_timeout(Duration::from_millis(300)) {
                raw.push(format!("{ev:?}"));
                outs.extend(engine.on_event(&ev));
            }
            stop(h);
            println!("HAM OLAYLAR: {raw:?}");
            println!("MOTOR ÇIKTILARI: {outs:?}");
            assert!(
                outs.contains(&Out::Hotkey("toggle-mute".into())),
                "Sağ Shift toggle-mute üretmedi"
            );
        }

        /// Bekçi: kanca 5 sn boştan sonra söküp yeniden kurulur; bundan sonra da olaylar gelmeli.
        /// Üç tur (her biri bir bekçi yenilemesi aşar) boyunca olayların akmaya devam ettiğini doğrular.
        /// `cargo test real_hook_survives -- --ignored --nocapture` (≈20 sn)
        #[test]
        #[ignore]
        fn real_hook_survives_watchdog_reinstall() {
            let (tx, rx) = mpsc::channel();
            let h = start(tx.clone()).expect("kanca kurulmalı");
            for round in 1..=3 {
                tap(0x64, false); // F13
                let got = drain(&rx);
                assert!(
                    got.contains(&("F13".into(), true)),
                    "tur {round}: olay gelmedi (kanca söküldü ve geri kurulmadı): {got:?}"
                );
                // 5 sn sessizlik: bekçi kancayı yeniden kurar
                thread::sleep(Duration::from_millis(5600));
            }
            stop(h);
        }

        /// Gerçek Windows kancası + SendInput ile uçtan uca: tarama kodu → `code` adı, ve
        /// `stop` sonrası kancanın GERÇEKTEN sökülmüş olması. Masaüstü oturumu gerekir;
        /// bu yüzden varsayılan testlerde yok: `cargo test -- --ignored real_hook`.
        #[test]
        #[ignore]
        fn real_hook_end_to_end() {
            // Uygulamadaki süreç-geneli güç ayarı da uygulanmış olsun (canlı uygulamayla aynı koşul)
            crate::power::disable_throttling_for_process();
            let (tx, rx) = mpsc::channel();
            let h = start(tx.clone()).expect("kanca kurulmalı");

            tap(0x64, false); // F13
            tap(0x76, false); // F24
            tap(0x36, false); // ShiftRight
            let got = drain(&rx);
            assert!(got.contains(&("F13".into(), true)), "F13 down yok: {got:?}");
            assert!(got.contains(&("F13".into(), false)), "F13 up yok: {got:?}");
            assert!(got.contains(&("F24".into(), true)), "{got:?}");
            assert!(got.contains(&("ShiftRight".into(), true)), "{got:?}");

            stop(h);
            tap(0x64, false); // kanca sökülmüş olmalı → hiçbir olay gelmemeli
            assert!(drain(&rx).is_empty(), "stop sonrası olay geldi: kanca sökülmemiş");
        }
    }
}

/// macOS / Linux: rdev. rdev dinlemeyi durduramaz; `ACTIVE` bayrağı olayları kapatır.
#[cfg(not(windows))]
mod backend {
    use super::Msg;
    use crate::hotkeys::InputEvent;
    use std::{
        sync::{
            atomic::{AtomicBool, Ordering::SeqCst},
            mpsc,
        },
        thread,
        time::Duration,
    };

    static ACTIVE: AtomicBool = AtomicBool::new(false);
    static STARTED: AtomicBool = AtomicBool::new(false);

    pub struct Handle;

    pub fn start(tx: mpsc::Sender<Msg>) -> Result<Handle, String> {
        ACTIVE.store(true, SeqCst);
        if STARTED.swap(true, SeqCst) {
            return Ok(Handle);
        }
        let (err_tx, err_rx) = mpsc::channel::<String>();
        thread::Builder::new()
            .name("netrex-input-hook".into())
            .spawn(move || {
                let res = rdev::listen(move |ev| {
                    if !ACTIVE.load(SeqCst) {
                        return;
                    }
                    let key = |k: &rdev::Key, down: bool| {
                        if let Some(c) = crate::keys::rdev_key_to_code(k) {
                            let _ = tx.send(Msg::Input(InputEvent::Key { code: c.into(), down }));
                        }
                    };
                    let mouse = |b: &rdev::Button, down: bool| {
                        let button = match b {
                            rdev::Button::Middle => 3,
                            // X11: 8 = geri, 9 = ileri
                            rdev::Button::Unknown(8) => 4,
                            rdev::Button::Unknown(9) => 5,
                            _ => return,
                        };
                        let _ = tx.send(Msg::Input(InputEvent::Mouse { button, down }));
                    };
                    match &ev.event_type {
                        rdev::EventType::KeyPress(k) => key(k, true),
                        rdev::EventType::KeyRelease(k) => key(k, false),
                        rdev::EventType::ButtonPress(b) => mouse(b, true),
                        rdev::EventType::ButtonRelease(b) => mouse(b, false),
                        _ => {}
                    }
                });
                if let Err(e) = res {
                    let _ = err_tx.send(format!("{e:?}"));
                }
            })
            .map_err(|e| e.to_string())?;

        // listen() başarılıysa dönmez; hızlı hata döndüyse izin eksiktir.
        match err_rx.recv_timeout(Duration::from_millis(600)) {
            Ok(e) => {
                STARTED.store(false, SeqCst);
                ACTIVE.store(false, SeqCst);
                if cfg!(target_os = "macos") {
                    Err("accessibility-permission-required".into())
                } else {
                    Err(e)
                }
            }
            Err(_) => Ok(Handle),
        }
    }

    pub fn stop(_h: Handle) {
        ACTIVE.store(false, SeqCst);
    }
}
