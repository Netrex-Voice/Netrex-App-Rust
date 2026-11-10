//! Güç tasarrufu (EcoQoS / "verimlilik modu") yavaşlatmasından muafiyet.
//!
//! Windows 11 arka plandaki işlemleri/thread'leri düşük öncelik + zamanlayıcı birleştirme ile
//! yavaşlatabilir. Sesli sohbet (WebRTC sesi) ve global kısayol kancası bundan zarar görür:
//! kanca geri çağrısı geç dönerse Windows kancayı sessizce söker. Electron'da bunun karşılığı
//! `disable-renderer-backgrounding` bayraklarıydı. Windows dışında yapılacak bir şey yok.

#[cfg(windows)]
pub fn disable_throttling_for_process() {
    use windows_sys::Win32::System::Threading::{
        GetCurrentProcess, ProcessPowerThrottling, SetProcessInformation,
        PROCESS_POWER_THROTTLING_CURRENT_VERSION, PROCESS_POWER_THROTTLING_EXECUTION_SPEED,
        PROCESS_POWER_THROTTLING_STATE,
    };
    let mut state = PROCESS_POWER_THROTTLING_STATE {
        Version: PROCESS_POWER_THROTTLING_CURRENT_VERSION,
        ControlMask: PROCESS_POWER_THROTTLING_EXECUTION_SPEED,
        StateMask: 0, // 0 = yavaşlatmayı KAPAT
    };
    unsafe {
        SetProcessInformation(
            GetCurrentProcess(),
            ProcessPowerThrottling,
            &mut state as *mut _ as *mut core::ffi::c_void,
            core::mem::size_of::<PROCESS_POWER_THROTTLING_STATE>() as u32,
        );
    }
}

#[cfg(windows)]
pub fn disable_throttling_for_current_thread() {
    use windows_sys::Win32::System::Threading::{
        GetCurrentThread, SetThreadInformation, ThreadPowerThrottling,
        THREAD_POWER_THROTTLING_CURRENT_VERSION, THREAD_POWER_THROTTLING_EXECUTION_SPEED,
        THREAD_POWER_THROTTLING_STATE,
    };
    let mut state = THREAD_POWER_THROTTLING_STATE {
        Version: THREAD_POWER_THROTTLING_CURRENT_VERSION,
        ControlMask: THREAD_POWER_THROTTLING_EXECUTION_SPEED,
        StateMask: 0,
    };
    unsafe {
        SetThreadInformation(
            GetCurrentThread(),
            ThreadPowerThrottling,
            &mut state as *mut _ as *mut core::ffi::c_void,
            core::mem::size_of::<THREAD_POWER_THROTTLING_STATE>() as u32,
        );
    }
}

#[cfg(not(windows))]
pub fn disable_throttling_for_process() {}
#[cfg(not(windows))]
pub fn disable_throttling_for_current_thread() {}
