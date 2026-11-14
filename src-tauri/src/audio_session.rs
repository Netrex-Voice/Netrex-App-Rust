//! Windows ses karıştırıcısında (Volume Mixer) uygulamanın "Netrex" adı ve simgesiyle görünmesi.
//!
//! Sesi Netrex.exe değil, WebView2'nin alt süreçleri (msedgewebview2.exe) çalar; Windows da karıştırıcıda o sürecin
//! adını ("Microsoft Edge WebView2") gösterir. Burada, YALNIZCA bizim süreç ağacımıza ait ses oturumları bulunur ve
//! görünen adları/simgeleri ayarlanır (başka WebView2 uygulamalarının oturumlarına dokunulmaz).
//!
//! Ad kalıcı değildir: oturum nesnesi (`IAudioSessionControl`) yaşadığı sürece geçerlidir ve oturum yeniden
//! oluşunca (ses cihazı değişimi, ses motorunun yeniden başlaması) tekrar ayarlanmalıdır. Bu yüzden bir arka plan
//! iş parçacığı oturumları aralıklarla tarar ve ayarladığı nesneleri elinde tutar.

#[cfg(windows)]
mod imp {
    use std::{collections::HashMap, time::Duration};
    use windows::{
        core::{Interface, GUID, HSTRING},
        Win32::{
            Media::Audio::{
                eRender, AudioSessionStateExpired, IAudioSessionControl, IAudioSessionControl2,
                IAudioSessionManager2, IMMDeviceEnumerator, MMDeviceEnumerator, DEVICE_STATE_ACTIVE,
            },
            System::Com::{CoCreateInstance, CoInitializeEx, CoTaskMemFree, CLSCTX_ALL, COINIT_MULTITHREADED},
        },
    };

    const SCAN_INTERVAL: Duration = Duration::from_secs(4);

    /// Çalışan süreçlerin `pid -> üst süreç pid` eşlemesi.
    fn parent_map() -> HashMap<u32, u32> {
        use windows_sys::Win32::{
            Foundation::{CloseHandle, INVALID_HANDLE_VALUE},
            System::Diagnostics::ToolHelp::{
                CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
            },
        };
        let mut map = HashMap::new();
        unsafe {
            let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
            if snap == INVALID_HANDLE_VALUE {
                return map;
            }
            let mut e: PROCESSENTRY32W = std::mem::zeroed();
            e.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
            if Process32FirstW(snap, &mut e) != 0 {
                loop {
                    map.insert(e.th32ProcessID, e.th32ParentProcessID);
                    if Process32NextW(snap, &mut e) == 0 {
                        break;
                    }
                }
            }
            CloseHandle(snap);
        }
        map
    }

    /// `pid`, `root` sürecinin kendisi ya da torunu mu?
    pub(super) fn descends_from(parents: &HashMap<u32, u32>, mut pid: u32, root: u32) -> bool {
        for _ in 0..32 {
            if pid == root {
                return true;
            }
            match parents.get(&pid) {
                Some(&p) if p != 0 && p != pid => pid = p,
                _ => return false,
            }
        }
        false
    }

    /// Etkin tüm çıkış cihazlarındaki ses oturumları: (oturum kimliği, süreç, denetim nesnesi).
    unsafe fn sessions() -> windows::core::Result<Vec<(String, u32, IAudioSessionControl)>> {
        let mut out = Vec::new();
        let devices: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let collection = devices.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)?;
        for d in 0..collection.GetCount()? {
            let Ok(device) = collection.Item(d) else { continue };
            let Ok(manager) = device.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None) else { continue };
            let Ok(list) = manager.GetSessionEnumerator() else { continue };
            for i in 0..list.GetCount().unwrap_or(0) {
                let Ok(control) = list.GetSession(i) else { continue };
                let Ok(control2) = control.cast::<IAudioSessionControl2>() else { continue };
                let Ok(pid) = control2.GetProcessId() else { continue };
                let id = match control2.GetSessionInstanceIdentifier() {
                    Ok(p) => {
                        let s = p.to_string().unwrap_or_default();
                        CoTaskMemFree(Some(p.0 as _));
                        s
                    }
                    Err(_) => continue,
                };
                out.push((id, pid, control));
            }
        }
        Ok(out)
    }

    /// `root` süreç ağacına ait, henüz adlandırılmamış oturumları adlandırır. `held`: adı geçerli kalsın diye elde
    /// tutulan nesneler (süresi dolanlar atılır). Yeni adlandırılan oturum sayısını döner.
    pub(super) unsafe fn name_sessions(
        root: u32,
        name: &str,
        icon: &str,
        held: &mut HashMap<String, IAudioSessionControl>,
    ) -> usize {
        held.retain(|_, c| c.GetState().map(|s| s != AudioSessionStateExpired).unwrap_or(false));
        let Ok(all) = sessions() else { return 0 };
        let parents = parent_map();
        let mut named = 0;
        for (id, pid, control) in all {
            if held.contains_key(&id) || pid == 0 || !descends_from(&parents, pid, root) {
                continue;
            }
            // WebView2'nin ana (tarayıcı) süreci de bir oturum açar ama ses ÇALMAZ: karıştırıcıda ses düğmesi hiçbir
            // şeyi değiştirmeyen sahte bir giriş olur. Onu adlandırma; gerçek ses, onun ALT süreci olan ses
            // hizmetinden (audio.mojom.AudioService) çıkar.
            if pid == root || parents.get(&pid) == Some(&root) {
                continue;
            }
            let ctx = GUID::zeroed();
            if control.SetDisplayName(&HSTRING::from(name), &ctx).is_ok() {
                if !icon.is_empty() {
                    let _ = control.SetIconPath(&HSTRING::from(icon), &ctx);
                }
                held.insert(id, control);
                named += 1;
            }
        }
        named
    }

    pub fn start(app: tauri::AppHandle) {
        let root = std::process::id();
        // Simge: exe'nin kendi simgesi ("yol,0" biçimi)
        let icon = std::env::current_exe().map(|p| format!("{},0", p.display())).unwrap_or_default();
        let _ = std::thread::Builder::new().name("audio-session-name".into()).spawn(move || unsafe {
            if CoInitializeEx(None, COINIT_MULTITHREADED).is_err() {
                return;
            }
            let mut held = HashMap::new();
            let mut logged = false;
            loop {
                let n = name_sessions(root, "Netrex", &icon, &mut held);
                if n > 0 && !logged {
                    logged = true;
                    crate::lifecycle::trace(&app, "ses karıştırıcı: oturum adı 'Netrex' olarak ayarlandı");
                }
                std::thread::sleep(SCAN_INTERVAL);
            }
        });
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn descendant_check_walks_parent_chain_and_stops_on_loops() {
            let m: HashMap<u32, u32> = [(10, 5), (5, 2), (2, 0), (7, 7), (8, 9), (9, 8)].into_iter().collect();
            assert!(descends_from(&m, 10, 5));
            assert!(descends_from(&m, 10, 2));
            assert!(descends_from(&m, 2, 2));
            assert!(!descends_from(&m, 10, 99));
            assert!(!descends_from(&m, 7, 1)); // kendi kendinin üstü
            assert!(!descends_from(&m, 8, 1)); // döngü
        }

        /// Canlı deneme: ÇALIŞAN Netrex'in ses oturumlarını adlandırır ve adı bağımsız bir sorguyla geri okur.
        /// `cargo test live_rename -- --ignored --nocapture` (Netrex açık ve ses çalmış olmalı; 20 sn açık kalır ki
        /// ses karıştırıcısında gözle de bakılabilsin).
        #[test]
        #[ignore]
        fn live_rename_running_netrex() {
            use windows_sys::Win32::System::Diagnostics::ToolHelp::*;
            unsafe {
                CoInitializeEx(None, COINIT_MULTITHREADED).ok().unwrap();
                // Netrex.exe'yi bul
                let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
                let mut e: PROCESSENTRY32W = std::mem::zeroed();
                e.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
                let mut root = 0;
                let mut ok = Process32FirstW(snap, &mut e) != 0;
                while ok {
                    let len = e.szExeFile.iter().position(|&c| c == 0).unwrap_or(0);
                    if String::from_utf16_lossy(&e.szExeFile[..len]).eq_ignore_ascii_case("netrex.exe") {
                        root = e.th32ProcessID;
                    }
                    ok = Process32NextW(snap, &mut e) != 0;
                }
                assert!(root != 0, "çalışan Netrex.exe bulunamadı");
                let parents = parent_map();
                let before: Vec<_> = sessions().unwrap().into_iter()
                    .filter(|(_, pid, _)| descends_from(&parents, *pid, root)).collect();
                println!("Netrex ağacındaki oturum sayısı: {}", before.len());
                for (id, pid, c) in &before {
                    println!("  önce: pid={pid} ad={:?} id=...{}", c.GetDisplayName().map(|p| p.to_string().unwrap_or_default()), &id[id.len().saturating_sub(40)..]);
                }
                // Önceki denemenin tarayıcı sürecindeki boş oturuma yazdığı adı geri al (ad, oturum yaşadıkça kalıyor)
                for (_, pid, c) in &before {
                    if parents.get(pid) == Some(&root) {
                        let _ = c.SetDisplayName(&HSTRING::from(""), &GUID::zeroed());
                    }
                }
                let mut held = HashMap::new();
                let icon = std::env::var("NETREX_TEST_ICON").unwrap_or_default();
                let n = name_sessions(root, "Netrex", &icon, &mut held);
                println!("adlandırılan: {n}");
                // Bağımsız (yeni) sorgu: ad gerçekten oturuma yazıldı mı?
                for (_, pid, c) in sessions().unwrap() {
                    if descends_from(&parents, pid, root) {
                        let name = c.GetDisplayName().map(|p| p.to_string().unwrap_or_default()).unwrap_or_default();
                        let browser = parents.get(&pid) == Some(&root);
                        println!("  sonra: pid={pid} ad={name:?} tarayıcı süreci={browser} durum={:?}", c.GetState());
                        // Yalnızca gerçek sesi çalan süreç adlandırılır; tarayıcı sürecinin boş oturumu değil
                        assert_eq!(name, if browser { "" } else { "Netrex" });
                    }
                }
                // Başka süreçlerin oturumlarına dokunulmadı mı?
                for (_, pid, c) in sessions().unwrap() {
                    if !descends_from(&parents, pid, root) {
                        let name = c.GetDisplayName().map(|p| p.to_string().unwrap_or_default()).unwrap_or_default();
                        assert_ne!(name, "Netrex", "başka sürecin (pid {pid}) oturumu adlandırıldı");
                    }
                }
                assert!(n > 0, "adlandırılacak oturum bulunamadı (Netrex hiç ses çalmamış olabilir)");
                std::thread::sleep(Duration::from_secs(20));
            }
        }
    }
}

#[cfg(windows)]
pub fn setup(app: &tauri::AppHandle) {
    imp::start(app.clone());
}

#[cfg(not(windows))]
pub fn setup(_app: &tauri::AppHandle) {}
