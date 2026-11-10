//! Ekran paylaşımı kaynak listesi (Electron `desktopCapturer.getSources` karşılığı).
//!
//! Eski arayüz (ScreenShareModal) `{ id, name, thumbnail, appIcon }` bekler:
//! * ekranlar: `screen:<n>:0`, pencereler: `window:<hwnd>:0`
//! * `thumbnail`: JPEG data URL (≈240 px), `appIcon`: PNG data URL
//!
//! Windows'ta GDI ile üretilir (ekran: StretchBlt, pencere: PrintWindow + PW_RENDERFULLCONTENT,
//! DWM ile birleşik pencereler dahil). macOS/Linux'ta şimdilik boş liste (Faz 7/8).

use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Source {
    pub id: String,
    pub name: String,
    pub thumbnail: String,
    pub app_icon: Option<String>,
}

/// Ekran listesi (yakalama modülü de aynı sırayı kullanır).
#[cfg(windows)]
pub fn monitor_rects() -> Vec<windows_sys::Win32::Foundation::RECT> {
    imp::monitor_rects()
}

#[tauri::command]
pub async fn get_desktop_sources() -> Result<Vec<Source>, String> {
    // GDI çağrıları yavaş olabilir (onlarca pencere): ana thread'i/arayüzü bloklamasın.
    tauri::async_runtime::spawn_blocking(list_sources)
        .await
        .map_err(|e| e.to_string())
}

#[cfg(windows)]
fn list_sources() -> Vec<Source> {
    imp::list_sources()
}

#[cfg(not(windows))]
fn list_sources() -> Vec<Source> {
    Vec::new()
}

#[cfg(windows)]
mod imp {
    use super::Source;
    use base64::{engine::general_purpose::STANDARD, Engine};
    use image::{ExtendedColorType, ImageEncoder};

    /// Win32 BOOL (windows-sys 0.61'de i32 değil `windows_core::BOOL`; burada yalnızca 0/1 döneriz).
    type BOOL = i32;
    use std::{ffi::c_void, mem::zeroed, ptr::null_mut};
    use windows_sys::Win32::{
        Foundation::{HWND, LPARAM, RECT},
        Graphics::{
            Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED},
            Gdi::{
                CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject,
                EnumDisplayMonitors, GetDC, GetDIBits, GetObjectW, ReleaseDC, SelectObject,
                SetStretchBltMode, StretchBlt, BITMAP, BITMAPINFO, BITMAPINFOHEADER, BI_RGB,
                DIB_RGB_COLORS, HALFTONE, HBITMAP, HDC, HMONITOR, SRCCOPY,
            },
        },
        Storage::Xps::PrintWindow,
        UI::WindowsAndMessaging::{
            EnumWindows, GetClassLongPtrW, GetIconInfo, GetWindow, GetWindowLongW, GetWindowRect,
            GetWindowTextLengthW, GetWindowTextW, IsWindowVisible, SendMessageTimeoutW, GCLP_HICON,
            GWL_EXSTYLE, GW_OWNER, HICON, ICONINFO, ICON_BIG, SMTO_ABORTIFHUNG, WM_GETICON,
            WS_EX_APPWINDOW, WS_EX_TOOLWINDOW,
        },
    };

    /// Önizleme için en uzun kenar (Electron 150 kullanıyordu; biraz daha net olsun).
    const THUMB_MAX: i32 = 240;
    const PW_RENDERFULLCONTENT: u32 = 2;

    fn fit(w: i32, h: i32) -> (i32, i32) {
        let s = (THUMB_MAX as f32 / w.max(h).max(1) as f32).min(1.0);
        (((w as f32 * s) as i32).max(1), ((h as f32 * s) as i32).max(1))
    }

    /// Bellekteki bitmap'i üstten-alta BGRA bayt dizisine okur. `bmp` hiçbir DC'ye seçili olmamalı.
    unsafe fn read_bgra(dc: HDC, bmp: HBITMAP, w: i32, h: i32) -> Vec<u8> {
        let mut bi: BITMAPINFO = zeroed();
        bi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bi.bmiHeader.biWidth = w;
        bi.bmiHeader.biHeight = -h; // negatif: üstten alta
        bi.bmiHeader.biPlanes = 1;
        bi.bmiHeader.biBitCount = 32;
        bi.bmiHeader.biCompression = BI_RGB;
        let mut buf = vec![0u8; (w as usize) * (h as usize) * 4];
        GetDIBits(dc, bmp, 0, h as u32, buf.as_mut_ptr() as *mut c_void, &mut bi, DIB_RGB_COLORS);
        buf
    }

    fn jpeg_data_url(bgra: &[u8], w: i32, h: i32) -> Option<String> {
        let mut rgb = Vec::with_capacity((w * h * 3) as usize);
        for px in bgra.chunks_exact(4) {
            rgb.extend_from_slice(&[px[2], px[1], px[0]]);
        }
        let mut out = Vec::new();
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 70)
            .encode(&rgb, w as u32, h as u32, ExtendedColorType::Rgb8)
            .ok()?;
        Some(format!("data:image/jpeg;base64,{}", STANDARD.encode(out)))
    }

    fn png_data_url(rgba: &[u8], w: i32, h: i32) -> Option<String> {
        let mut out = Vec::new();
        image::codecs::png::PngEncoder::new(&mut out)
            .write_image(rgba, w as u32, h as u32, ExtendedColorType::Rgba8)
            .ok()?;
        Some(format!("data:image/png;base64,{}", STANDARD.encode(out)))
    }

    // ------------------------------------------------------------------ ekranlar

    unsafe extern "system" fn monitor_cb(_m: HMONITOR, _dc: HDC, r: *mut RECT, lparam: LPARAM) -> BOOL {
        let list = &mut *(lparam as *mut Vec<RECT>);
        list.push(*r);
        1
    }

    pub fn monitor_rects() -> Vec<RECT> {
        let mut list: Vec<RECT> = Vec::new();
        unsafe {
            EnumDisplayMonitors(null_mut(), std::ptr::null(), Some(monitor_cb), &mut list as *mut _ as LPARAM);
        }
        list
    }

    unsafe fn screen_thumb(r: RECT) -> Option<String> {
        let (sw, sh) = (r.right - r.left, r.bottom - r.top);
        if sw <= 0 || sh <= 0 {
            return None;
        }
        let (tw, th) = fit(sw, sh);
        let sdc = GetDC(null_mut());
        let mdc = CreateCompatibleDC(sdc);
        let bmp = CreateCompatibleBitmap(sdc, tw, th);
        let old = SelectObject(mdc, bmp);
        SetStretchBltMode(mdc, HALFTONE);
        StretchBlt(mdc, 0, 0, tw, th, sdc, r.left, r.top, sw, sh, SRCCOPY);
        SelectObject(mdc, old);
        let px = read_bgra(mdc, bmp, tw, th);
        DeleteObject(bmp);
        DeleteDC(mdc);
        ReleaseDC(null_mut(), sdc);
        jpeg_data_url(&px, tw, th)
    }

    // ------------------------------------------------------------------ pencereler

    unsafe fn window_title(hwnd: HWND) -> String {
        let len = GetWindowTextLengthW(hwnd);
        if len <= 0 {
            return String::new();
        }
        let mut buf = vec![0u16; len as usize + 1];
        let n = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
        String::from_utf16_lossy(&buf[..n.max(0) as usize])
    }

    /// Kullanıcının gerçekten paylaşmak isteyebileceği üst düzey bir uygulama penceresi mi?
    unsafe fn is_shareable(hwnd: HWND) -> bool {
        if IsWindowVisible(hwnd) == 0 {
            return false;
        }
        // Sahipli pencereler (iletişim kutuları vb.) ve araç pencereleri listelenmez
        if !GetWindow(hwnd, GW_OWNER).is_null() {
            return false;
        }
        let ex = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
        if ex & WS_EX_TOOLWINDOW != 0 && ex & WS_EX_APPWINDOW == 0 {
            return false;
        }
        // Gizlenmiş (cloaked) pencereler: askıdaki UWP uygulamaları, diğer sanal masaüstleri
        let mut cloaked: u32 = 0;
        DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED as u32, &mut cloaked as *mut _ as *mut c_void, 4);
        if cloaked != 0 {
            return false;
        }
        let mut r: RECT = zeroed();
        GetWindowRect(hwnd, &mut r);
        r.right - r.left >= 80 && r.bottom - r.top >= 50
    }

    unsafe fn window_thumb(hwnd: HWND) -> Option<String> {
        let mut r: RECT = zeroed();
        GetWindowRect(hwnd, &mut r);
        let (w, h) = (r.right - r.left, r.bottom - r.top);
        if w <= 0 || h <= 0 {
            return None;
        }
        let sdc = GetDC(null_mut());
        // Pencerenin tam boyutlu görüntüsü
        let full = CreateCompatibleDC(sdc);
        let fbmp = CreateCompatibleBitmap(sdc, w, h);
        let fold = SelectObject(full, fbmp);
        PrintWindow(hwnd, full, PW_RENDERFULLCONTENT);
        // Küçültülmüş önizleme
        let (tw, th) = fit(w, h);
        let mdc = CreateCompatibleDC(sdc);
        let tbmp = CreateCompatibleBitmap(sdc, tw, th);
        let told = SelectObject(mdc, tbmp);
        SetStretchBltMode(mdc, HALFTONE);
        StretchBlt(mdc, 0, 0, tw, th, full, 0, 0, w, h, SRCCOPY);
        SelectObject(mdc, told);
        let px = read_bgra(mdc, tbmp, tw, th);
        DeleteObject(tbmp);
        DeleteDC(mdc);
        SelectObject(full, fold);
        DeleteObject(fbmp);
        DeleteDC(full);
        ReleaseDC(null_mut(), sdc);
        jpeg_data_url(&px, tw, th)
    }

    unsafe fn app_icon(hwnd: HWND) -> Option<String> {
        let mut res: usize = 0;
        SendMessageTimeoutW(hwnd, WM_GETICON, ICON_BIG as usize, 0, SMTO_ABORTIFHUNG, 100, &mut res);
        let mut hicon = res as HICON;
        if hicon.is_null() {
            hicon = GetClassLongPtrW(hwnd, GCLP_HICON) as HICON;
        }
        if hicon.is_null() {
            return None;
        }
        let mut ii: ICONINFO = zeroed();
        if GetIconInfo(hicon, &mut ii) == 0 {
            return None;
        }
        let result = (|| {
            if ii.hbmColor.is_null() {
                return None; // tek renkli (maskeli) ikon
            }
            let mut bm: BITMAP = zeroed();
            GetObjectW(ii.hbmColor, std::mem::size_of::<BITMAP>() as i32, &mut bm as *mut _ as *mut c_void);
            let (w, h) = (bm.bmWidth, bm.bmHeight);
            if w <= 0 || h <= 0 || w > 256 || h > 256 {
                return None;
            }
            let dc = GetDC(null_mut());
            let mut px = read_bgra(dc, ii.hbmColor, w, h);
            ReleaseDC(null_mut(), dc);
            // Alfa kanalı olmayan eski ikonlar: opak yap
            if px.chunks_exact(4).all(|c| c[3] == 0) {
                for c in px.chunks_exact_mut(4) {
                    c[3] = 255;
                }
            }
            for c in px.chunks_exact_mut(4) {
                c.swap(0, 2); // BGRA -> RGBA
            }
            png_data_url(&px, w, h)
        })();
        DeleteObject(ii.hbmColor);
        DeleteObject(ii.hbmMask);
        result
    }

    unsafe extern "system" fn window_cb(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let list = &mut *(lparam as *mut Vec<HWND>);
        if is_shareable(hwnd) && !window_title(hwnd).is_empty() {
            list.push(hwnd);
        }
        1
    }

    pub fn list_sources() -> Vec<Source> {
        let mut out = Vec::new();
        unsafe {
            for (i, r) in monitor_rects().into_iter().enumerate() {
                out.push(Source {
                    id: format!("screen:{i}:0"),
                    name: format!("Ekran {}", i + 1),
                    thumbnail: screen_thumb(r).unwrap_or_default(),
                    app_icon: None,
                });
            }
            let mut wins: Vec<HWND> = Vec::new();
            EnumWindows(Some(window_cb), &mut wins as *mut _ as LPARAM);
            for hwnd in wins {
                let title = window_title(hwnd);
                // Masaüstünün kendisi ve görev çubuğu paylaşılabilir "uygulama" değildir
                if title == "Program Manager" {
                    continue;
                }
                out.push(Source {
                    id: format!("window:{}:0", hwnd as usize),
                    name: title,
                    thumbnail: window_thumb(hwnd).unwrap_or_default(),
                    app_icon: app_icon(hwnd),
                });
            }
        }
        out
    }
}
