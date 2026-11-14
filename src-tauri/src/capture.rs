//! Ekran/pencere yakalama (Electron `chromeMediaSource:"desktop"` karşılığı).
//!
//! WebView2'de belirli bir ekran/pencereyi seçerek yakalamanın (Electron'daki gibi) yolu yok;
//! tarayıcının kendi seçici penceresi çıkar. Eski Netrex arayüzünü korumak için yakalamayı
//! Rust yapar ve görüntüyü sayfaya SIFIR KOPYA ile aktarır:
//!
//!   Windows Graphics Capture (GPU) ──BGRA──▶ WebView2 paylaşımlı bellek ──▶ sayfa (WebGL)
//!                                                                          └▶ canvas.captureStream() ▶ LiveKit
//!
//! Paylaşımlı bellek düzeni: `[0..4)` kare sayacı (u32, EN SON yazılır), `[4..8)` genişlik,
//! `[8..12)` yükseklik, `[12..16)` ayrılmış, `[16..)` üstten-alta BGRA pikseller.
//! Sistem sesi şimdilik yok (Faz 7'nin sonraki adımı).

#[cfg(windows)]
mod imp {
    use serde::Serialize;
    use std::{
        ptr::null_mut,
        sync::{
            atomic::{AtomicBool, AtomicU32, Ordering},
            mpsc, Arc, Mutex,
        },
        time::{Duration, Instant},
    };
    use tauri::{ipc::{Channel, InvokeResponseBody}, AppHandle, Manager};
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2SharedBuffer, ICoreWebView2_17, ICoreWebView2Environment12,
        COREWEBVIEW2_SHARED_BUFFER_ACCESS_READ_ONLY,
    };
    use windows_capture::{
        capture::{CaptureControl, Context, GraphicsCaptureApiHandler},
        frame::Frame,
        graphics_capture_api::InternalCaptureControl,
        monitor::Monitor,
        settings::{
            ColorFormat, CursorCaptureSettings, DirtyRegionSettings, DrawBorderSettings,
            GraphicsCaptureItemType, MinimumUpdateIntervalSettings, SecondaryWindowSettings, Settings,
        },
        window::Window,
    };
    use windows_core::{Interface, HSTRING};

    const HEADER: usize = 16;
    /// 4K'ya kadar sabit kapasite (≈33 MB); daha büyük ekranlarda ekran boyutu kullanılır.
    const MIN_CAPACITY_PIXELS: usize = 3840 * 2160;

    type BoxErr = Box<dyn std::error::Error + Send + Sync>;

    /// COM nesnelerini thread'ler arasında taşımak için (paylaşımlı bellek serbest iş parçacıklıdır).
    struct SendBox<T>(T);
    unsafe impl<T> Send for SendBox<T> {}

    struct Shared {
        ptr: *mut u8,
        capacity: usize,
        stop: AtomicBool,
        /// İstenen kare hızı sınırı (Windows Graphics Capture'ın kendi sınırı bu sürümde yok)
        min_interval: Duration,
    }
    unsafe impl Send for Shared {}
    unsafe impl Sync for Shared {}

    struct Handler {
        shared: Arc<Shared>,
        scratch: Vec<u8>,
        counter: u32,
        last_frame: Option<Instant>,
    }

    impl GraphicsCaptureApiHandler for Handler {
        type Flags = Arc<Shared>;
        type Error = BoxErr;

        fn new(ctx: Context<Self::Flags>) -> Result<Self, Self::Error> {
            Ok(Self { shared: ctx.flags, scratch: Vec::new(), counter: 0, last_frame: None })
        }

        fn on_frame_arrived(
            &mut self,
            frame: &mut Frame,
            control: InternalCaptureControl,
        ) -> Result<(), Self::Error> {
            if self.shared.stop.load(Ordering::Relaxed) {
                control.stop();
                return Ok(());
            }
            // FPS sınırı: çok sık gelen kareleri at (küçük bir tolerans payıyla)
            let now = Instant::now();
            if let Some(last) = self.last_frame {
                if now.duration_since(last) + Duration::from_millis(2) < self.shared.min_interval {
                    return Ok(());
                }
            }
            self.last_frame = Some(now);
            let (w, h) = (frame.width() as usize, frame.height() as usize);
            let bytes = w * h * 4;
            if HEADER + bytes > self.shared.capacity {
                return Ok(()); // kapasiteyi aşan kare: atla
            }
            let fb = frame.buffer()?;
            let data = fb.as_nopadding_buffer(&mut self.scratch);
            let n = bytes.min(data.len());
            unsafe {
                std::ptr::copy_nonoverlapping(data.as_ptr(), self.shared.ptr.add(HEADER), n);
                let hdr = self.shared.ptr as *mut u32;
                hdr.add(1).write(w as u32);
                hdr.add(2).write(h as u32);
                // Sayaç EN SON ve Release ile yazılır: okuyucu sayacı görünce pikseller tamamdır.
                self.counter = self.counter.wrapping_add(1);
                AtomicU32::from_ptr(hdr).store(self.counter, Ordering::Release);
            }
            Ok(())
        }

        fn on_closed(&mut self) -> Result<(), Self::Error> {
            // Pencere kapandı: sayfa sayaç durunca zaten son kareyi gösterir; stop komutu temizler.
            Ok(())
        }
    }

    struct Active {
        audio: Option<crate::audio_capture::imp::AudioHandle>,
        shared: Arc<Shared>,
        control: Option<CaptureControl<Handler, BoxErr>>,
        buffer: SendBox<ICoreWebView2SharedBuffer>,
    }

    static ACTIVE: Mutex<Option<Active>> = Mutex::new(None);

    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    pub struct StartInfo {
        capacity: usize,
        /// Ses yakalama çalışıyor mu (istenmediyse/başarısızsa false)
        audio: bool,
        audio_error: Option<String>,
    }

    enum Item {
        Monitor(Monitor),
        Window(Window),
    }

    /// Pencereyi oluşturan sürecin kimliği (uygulama sesi için hedef).
    fn window_pid(hwnd: *mut std::ffi::c_void) -> u32 {
        let mut pid: u32 = 0;
        unsafe {
            windows_sys::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId(hwnd, &mut pid);
        }
        pid
    }

    fn parse_source(id: &str) -> Result<Item, String> {
        let mut parts = id.split(':');
        let kind = parts.next().unwrap_or("");
        let n = parts.next().and_then(|s| s.parse::<usize>().ok()).ok_or("geçersiz kaynak kimliği")?;
        match kind {
            "screen" => Monitor::from_index(n + 1).map(Item::Monitor).map_err(|e| format!("ekran bulunamadı: {e}")),
            "window" => {
                let hwnd = n as *mut std::ffi::c_void;
                Ok(Item::Window(Window::from_raw_hwnd(hwnd)))
            }
            _ => Err("bilinmeyen kaynak türü".into()),
        }
    }

    fn start_item<T>(item: T, shared: Arc<Shared>, cursor: bool) -> Result<CaptureControl<Handler, BoxErr>, String>
    where
        T: TryInto<GraphicsCaptureItemType> + Send + 'static,
    {
        let settings = Settings::new(
            item,
            // İmleçli yakalama bazı oyunlarda oyunun kendi imlecini gizleyebiliyor: kullanıcı kapatabilir
            if cursor { CursorCaptureSettings::WithCursor } else { CursorCaptureSettings::WithoutCursor },
            DrawBorderSettings::WithoutBorder, // sarı çerçeve çıkmasın
            SecondaryWindowSettings::Default,
            MinimumUpdateIntervalSettings::Default,
            DirtyRegionSettings::Default,
            ColorFormat::Bgra8,
            shared,
        );
        Handler::start_free_threaded(settings).map_err(|e| format!("yakalama başlatılamadı: {e}"))
    }

    fn stop_active() {
        let taken = ACTIVE.lock().ok().and_then(|mut g| g.take());
        if let Some(mut a) = taken {
            a.shared.stop.store(true, Ordering::Relaxed);
            if let Some(au) = a.audio.take() {
                au.stop();
            }
            if let Some(c) = a.control.take() {
                let _ = c.stop();
            }
            unsafe {
                let _ = a.buffer.0.Close();
            }
        }
    }

    pub async fn start(
        app: AppHandle,
        source_id: String,
        fps: Option<u32>,
        audio: Option<String>,
        cursor: bool,
        on_audio: Channel<InvokeResponseBody>,
    ) -> Result<StartInfo, String> {
        let fps = fps.unwrap_or(30);
        let item = parse_source(&source_id)?;

        // Kapasite: en az 4K, daha büyük ekran varsa ona göre
        let screen_pixels = crate::sources::monitor_rects()
            .iter()
            .map(|r| ((r.right - r.left).max(0) as usize) * ((r.bottom - r.top).max(0) as usize))
            .max()
            .unwrap_or(0);
        let capacity = HEADER + 4 * MIN_CAPACITY_PIXELS.max(screen_pixels);

        stop_active();

        // Paylaşımlı belleği ana thread'de oluştur ve sayfaya gönder.
        let win = app.get_webview_window("main").ok_or("ana pencere yok")?;
        let (tx, rx) = mpsc::channel::<Result<(SendBox<ICoreWebView2SharedBuffer>, usize, u32), String>>();
        win.with_webview(move |wv| unsafe {
            let result = (|| -> Result<(SendBox<ICoreWebView2SharedBuffer>, usize, u32), String> {
                let env: ICoreWebView2Environment12 =
                    wv.environment().cast().map_err(|e| format!("ortam: {e}"))?;
                let sb = env.CreateSharedBuffer(capacity as u64).map_err(|e| format!("tampon: {e}"))?;
                let mut ptr: *mut u8 = null_mut();
                sb.Buffer(&mut ptr).map_err(|e| format!("tampon işaretçisi: {e}"))?;
                if ptr.is_null() {
                    return Err("tampon işaretçisi boş".into());
                }
                let core = wv.controller().CoreWebView2().map_err(|e| format!("webview: {e}"))?;
                let c17: ICoreWebView2_17 = core.cast().map_err(|e| format!("webview17: {e}"))?;
                // Netrex'in kendi sesi (odadaki insanlar) WebView2 tarayıcı sürecinden çıkar; sistem sesi
                // yakalanırken HARİÇ tutulacak hedef bu süreçtir (Netrex sürecinin kendisi değil: WASAPI
                // süreç ağacı hesabında WebView2'nin sesi Netrex ağacında sayılmıyor, ölçümle doğrulandı).
                let mut browser_pid: u32 = 0;
                let _ = core.BrowserProcessId(&mut browser_pid);
                let json = HSTRING::from(r#"{"kind":"netrex-capture"}"#);
                c17.PostSharedBufferToScript(&sb, COREWEBVIEW2_SHARED_BUFFER_ACCESS_READ_ONLY, &json)
                    .map_err(|e| format!("tampon gönderilemedi: {e}"))?;
                Ok((SendBox(sb), ptr as usize, browser_pid))
            })();
            let _ = tx.send(result);
        })
        .map_err(|e| e.to_string())?;

        let (sb, ptr, browser_pid) = tauri::async_runtime::spawn_blocking(move || rx.recv_timeout(Duration::from_secs(5)))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|_| "paylaşımlı bellek zamanında oluşturulamadı".to_string())??;

        // Ses hedefi: pencere → o uygulamanın sesi; ekran → Netrex HARİÇ her şey
        let (audio_pid, audio_include_tree) = match &item {
            // Deney/teşhis: "include:<pid>" / "exclude:<pid>" hedef süreci elle verir
            _ if audio.as_deref().map_or(false, |m| m.starts_with("include:") || m.starts_with("exclude:")) => {
                let m = audio.as_deref().unwrap_or("");
                let (kind, pid) = m.split_once(':').unwrap_or(("exclude", "0"));
                (pid.parse().unwrap_or(0), kind == "include")
            }
            Item::Window(w) if audio.as_deref() == Some("app") => (window_pid(w.as_raw_hwnd()), true),
            _ => (if browser_pid != 0 { browser_pid } else { std::process::id() }, false),
        };
        let min_interval = Duration::from_micros(1_000_000 / u64::from(fps.clamp(1, 120)));
        let shared = Arc::new(Shared { ptr: ptr as *mut u8, capacity, stop: AtomicBool::new(false), min_interval });
        let started = match item {
            Item::Monitor(m) => start_item(m, shared.clone(), cursor),
            Item::Window(w) => start_item(w, shared.clone(), cursor),
        };
        match started {
            Ok(control) => {
                // Ses (istenmişse): başarısız olursa video yine devam eder
                let (audio_handle, audio_error) = if audio.is_some() {
                    match crate::audio_capture::imp::start(audio_pid, audio_include_tree, on_audio) {
                        Ok(h) => (Some(h), None),
                        Err(e) => (None, Some(e)),
                    }
                } else {
                    (None, None)
                };
                let has_audio = audio_handle.is_some();
                if let Ok(mut g) = ACTIVE.lock() {
                    *g = Some(Active { audio: audio_handle, shared, control: Some(control), buffer: sb });
                }
                crate::lifecycle::trace(
                    &app,
                    &format!(
                        "capture: başladı ({source_id}, {fps} fps, imleç: {cursor}, ses: {})",
                        match (&audio, has_audio, &audio_error) {
                            (None, _, _) => "yok".to_string(),
                            (Some(m), true, _) => format!("{m} (pid {audio_pid}, ağaç dahil: {audio_include_tree})"),
                            (Some(_), false, e) => format!("BAŞARISIZ: {}", e.clone().unwrap_or_default()),
                        }
                    ),
                );
                Ok(StartInfo { capacity, audio: has_audio, audio_error })
            }
            Err(e) => {
                unsafe {
                    let _ = sb.0.Close();
                }
                crate::lifecycle::trace(&app, &format!("capture: HATA {e}"));
                Err(e)
            }
        }
    }

    pub async fn stop(app: AppHandle) -> Result<(), String> {
        tauri::async_runtime::spawn_blocking(stop_active).await.map_err(|e| e.to_string())?;
        crate::lifecycle::trace(&app, "capture: durduruldu");
        Ok(())
    }
}

#[cfg(windows)]
#[tauri::command]
pub async fn start_capture(
    app: tauri::AppHandle,
    source_id: String,
    fps: Option<u32>,
    audio: Option<String>,
    cursor: Option<bool>,
    on_audio: tauri::ipc::Channel<tauri::ipc::InvokeResponseBody>,
) -> Result<imp::StartInfo, String> {
    imp::start(app, source_id, fps, audio, cursor.unwrap_or(true), on_audio).await
}

#[cfg(windows)]
#[tauri::command]
pub async fn stop_capture(app: tauri::AppHandle) -> Result<(), String> {
    imp::stop(app).await
}

#[cfg(not(windows))]
#[tauri::command]
pub async fn start_capture(_source_id: String, _fps: Option<u32>) -> Result<(), String> {
    Err("Ekran yakalama bu platformda henüz desteklenmiyor".into())
}

#[cfg(not(windows))]
#[tauri::command]
pub async fn stop_capture() -> Result<(), String> {
    Ok(())
}
