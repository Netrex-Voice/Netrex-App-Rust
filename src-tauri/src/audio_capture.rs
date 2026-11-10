//! Uygulama-bazlı ses yakalama (ekran paylaşımı sesi).
//!
//! Windows'un "process loopback" yakalaması (WASAPI, Windows 10 2004+): tek bir uygulamanın sesini
//! (ve alt süreçlerini) AYIRARAK yakalar.
//! * Pencere paylaşılırken: yalnızca o uygulamanın sesi (`include_tree = true`, hedef = pencerenin süreci)
//! * Ekran paylaşılırken: sistemdeki her şey, ama NETREX'in kendi sesi hariç
//!   (`include_tree = false`, hedef = Netrex süreci) → odadaki insanların sesi yayına karışmaz.
//!
//! Ses 48 kHz, stereo, 32-bit float; 10 ms'lik (3840 bayt) parçalar hâlinde Tauri kanalıyla
//! sayfaya (AudioWorklet'e) gönderilir.

#[cfg(windows)]
pub mod imp {
    use std::{
        collections::VecDeque,
        sync::{
            atomic::{AtomicBool, Ordering},
            mpsc, Arc,
        },
        thread::{self, JoinHandle},
        time::Duration,
    };
    use tauri::ipc::{Channel, InvokeResponseBody};
    use wasapi::{initialize_mta, AudioClient, Direction, SampleType, StreamMode, WaveFormat};

    /// 10 ms: 480 kare × 2 kanal × 4 bayt
    const CHUNK_BYTES: usize = 480 * 2 * 4;

    pub struct AudioHandle {
        stop: Arc<AtomicBool>,
        join: Option<JoinHandle<()>>,
    }

    impl AudioHandle {
        pub fn stop(mut self) {
            self.stop.store(true, Ordering::Relaxed);
            if let Some(j) = self.join.take() {
                let _ = j.join();
            }
        }
    }

    pub fn start(pid: u32, include_tree: bool, channel: Channel<InvokeResponseBody>) -> Result<AudioHandle, String> {
        let stop = Arc::new(AtomicBool::new(false));
        let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();
        let stop_thread = stop.clone();

        let join = thread::Builder::new()
            .name("netrex-audio-capture".into())
            .spawn(move || {
                let run = || -> Result<(), Box<dyn std::error::Error>> {
                    initialize_mta().ok()?;
                    let format = WaveFormat::new(32, 32, &SampleType::Float, 48000, 2, None);
                    let mut client = AudioClient::new_application_loopback_client(pid, include_tree)?;
                    client.initialize_client(
                        &format,
                        &Direction::Capture,
                        &StreamMode::EventsShared { autoconvert: true, buffer_duration_hns: 0 },
                    )?;
                    let event = client.set_get_eventhandle()?;
                    let capture = client.get_audiocaptureclient()?;
                    client.start_stream()?;
                    let _ = ready_tx.send(Ok(()));

                    let mut queue: VecDeque<u8> = VecDeque::new();
                    while !stop_thread.load(Ordering::Relaxed) {
                        let frames = capture.get_next_packet_size()?.unwrap_or(0);
                        if frames > 0 {
                            capture.read_from_device_to_deque(&mut queue)?;
                        }
                        while queue.len() >= CHUNK_BYTES {
                            let chunk: Vec<u8> = queue.drain(..CHUNK_BYTES).collect();
                            if channel.send(InvokeResponseBody::Raw(chunk)).is_err() {
                                client.stop_stream()?;
                                return Ok(()); // sayfa kapandı
                            }
                        }
                        // Zaman aşımı HATA DEĞİL: kaynak sessizken olay gelmeyebilir.
                        let _ = event.wait_for_event(100);
                    }
                    client.stop_stream()?;
                    Ok(())
                };
                if let Err(e) = run() {
                    // Başlatma sırasında hata olduysa çağıran bekliyordur; sonradan olduysa yok sayılır.
                    let _ = ready_tx.send(Err(e.to_string()));
                }
            })
            .map_err(|e| e.to_string())?;

        match ready_rx.recv_timeout(Duration::from_secs(4)) {
            Ok(Ok(())) => Ok(AudioHandle { stop, join: Some(join) }),
            Ok(Err(e)) => Err(e),
            Err(_) => {
                stop.store(true, Ordering::Relaxed);
                Err("ses yakalama zamanında başlamadı".into())
            }
        }
    }
}
