//! Tuş kimlikleri.
//!
//! Kısayollar artık sayısal `uiohook` kodlarıyla DEĞİL, tarayıcı standardındaki
//! `KeyboardEvent.code` adlarıyla (`"KeyV"`, `"ControlLeft"`, `"F13"`, `"Numpad0"` …) saklanır:
//! tek anlamlı (eski tabloda 82 hem Insert hem Numpad0, 87 hem F11 hem End gibi çakışmalar
//! vardı), okunur, platformlar arası aynı ve klavye düzeninden bağımsız (fiziksel tuş).
//!
//! Bu modül saf eşleme tablolarıdır; işletim sistemi çağrısı yoktur, bu yüzden birim testlidir.

/// Windows düşük seviyeli klavye kancasından gelen tuşu `code` adına çevirir.
///
/// * `scan`/`extended`: donanım tarama kodu ve E0 öneki (fiziksel konum → düzenden bağımsız)
/// * `vk`: yalnızca tarama kodunun güvenilmez olduğu tuşlar için (Pause, NumLock, PrintScreen)
///
/// `None` dönerse olay yok sayılır (ör. Windows'un numpad için uydurduğu sahte Shift).
pub fn windows_to_code(scan: u32, extended: bool, vk: u32) -> Option<&'static str> {
    // Önce tarama kodunun yanıltıcı olduğu tuşlar (VK ile)
    match vk {
        0x13 => return Some("Pause"),       // VK_PAUSE (E1 1D 45 dizisi)
        0x90 => return Some("NumLock"),     // VK_NUMLOCK (bazı sürümlerde 0x45 + E0)
        0x2C => return Some("PrintScreen"), // VK_SNAPSHOT (Alt ile 0x54 olur)
        _ => {}
    }
    // Numpad yön/bölme tuşları kullanılırken Windows sahte bir LShift (E0 2A) enjekte eder.
    // Gerçek sol Shift ASLA E0 önekli değildir. (Sağ Shift ise kancada 0x36 + E0 olarak GELİR —
    // gerçek cihazda ölçüldü — bu yüzden 0x36 elenmez.)
    if extended && scan == 0x2A {
        return None;
    }
    if extended {
        Some(match scan {
            0x1C => "NumpadEnter",
            0x1D => "ControlRight",
            0x35 => "NumpadDivide",
            0x36 => "ShiftRight", // kancada Sağ Shift E0 bayrağıyla gelir
            0x37 => "PrintScreen",
            0x38 => "AltRight",
            0x47 => "Home",
            0x48 => "ArrowUp",
            0x49 => "PageUp",
            0x4B => "ArrowLeft",
            0x4D => "ArrowRight",
            0x4F => "End",
            0x50 => "ArrowDown",
            0x51 => "PageDown",
            0x52 => "Insert",
            0x53 => "Delete",
            0x5B => "MetaLeft",
            0x5C => "MetaRight",
            0x5D => "ContextMenu",
            // Medya / tarayıcı / uygulama tuşları
            0x10 => "MediaTrackPrevious",
            0x19 => "MediaTrackNext",
            0x20 => "AudioVolumeMute",
            0x21 => "LaunchApp2",
            0x22 => "MediaPlayPause",
            0x24 => "MediaStop",
            0x2E => "AudioVolumeDown",
            0x30 => "AudioVolumeUp",
            0x32 => "BrowserHome",
            0x65 => "BrowserSearch",
            0x66 => "BrowserFavorites",
            0x67 => "BrowserRefresh",
            0x68 => "BrowserStop",
            0x69 => "BrowserForward",
            0x6A => "BrowserBack",
            0x6B => "LaunchApp1",
            0x6C => "LaunchMail",
            0x6D => "MediaSelect",
            _ => return None,
        })
    } else {
        Some(match scan {
            0x01 => "Escape",
            0x02 => "Digit1",
            0x03 => "Digit2",
            0x04 => "Digit3",
            0x05 => "Digit4",
            0x06 => "Digit5",
            0x07 => "Digit6",
            0x08 => "Digit7",
            0x09 => "Digit8",
            0x0A => "Digit9",
            0x0B => "Digit0",
            0x0C => "Minus",
            0x0D => "Equal",
            0x0E => "Backspace",
            0x0F => "Tab",
            0x10 => "KeyQ",
            0x11 => "KeyW",
            0x12 => "KeyE",
            0x13 => "KeyR",
            0x14 => "KeyT",
            0x15 => "KeyY",
            0x16 => "KeyU",
            0x17 => "KeyI",
            0x18 => "KeyO",
            0x19 => "KeyP",
            0x1A => "BracketLeft",
            0x1B => "BracketRight",
            0x1C => "Enter",
            0x1D => "ControlLeft",
            0x1E => "KeyA",
            0x1F => "KeyS",
            0x20 => "KeyD",
            0x21 => "KeyF",
            0x22 => "KeyG",
            0x23 => "KeyH",
            0x24 => "KeyJ",
            0x25 => "KeyK",
            0x26 => "KeyL",
            0x27 => "Semicolon",
            0x28 => "Quote",
            0x29 => "Backquote",
            0x2A => "ShiftLeft",
            0x2B => "Backslash",
            0x2C => "KeyZ",
            0x2D => "KeyX",
            0x2E => "KeyC",
            0x2F => "KeyV",
            0x30 => "KeyB",
            0x31 => "KeyN",
            0x32 => "KeyM",
            0x33 => "Comma",
            0x34 => "Period",
            0x35 => "Slash",
            0x36 => "ShiftRight",
            0x37 => "NumpadMultiply",
            0x38 => "AltLeft",
            0x39 => "Space",
            0x3A => "CapsLock",
            0x3B => "F1",
            0x3C => "F2",
            0x3D => "F3",
            0x3E => "F4",
            0x3F => "F5",
            0x40 => "F6",
            0x41 => "F7",
            0x42 => "F8",
            0x43 => "F9",
            0x44 => "F10",
            0x45 => "NumLock",
            0x46 => "ScrollLock",
            0x47 => "Numpad7",
            0x48 => "Numpad8",
            0x49 => "Numpad9",
            0x4A => "NumpadSubtract",
            0x4B => "Numpad4",
            0x4C => "Numpad5",
            0x4D => "Numpad6",
            0x4E => "NumpadAdd",
            0x4F => "Numpad1",
            0x50 => "Numpad2",
            0x51 => "Numpad3",
            0x52 => "Numpad0",
            0x53 => "NumpadDecimal",
            0x54 => "PrintScreen", // Alt+PrintScreen (SysRq)
            0x56 => "IntlBackslash",
            0x57 => "F11",
            0x58 => "F12",
            // F13–F24: oyuncu fareleri / makro klavyeler genelde bunları gönderir
            0x64 => "F13",
            0x65 => "F14",
            0x66 => "F15",
            0x67 => "F16",
            0x68 => "F17",
            0x69 => "F18",
            0x6A => "F19",
            0x6B => "F20",
            0x6C => "F21",
            0x6D => "F22",
            0x6E => "F23",
            0x76 => "F24",
            _ => return None,
        })
    }
}

/// Eski Electron sürümünün (`uiohook-napi`, Windows) sayısal tuş kodunu yeni `code` adına çevirir.
/// Kullanıcıların kayıtlı kısayollarını ilk açılışta otomatik taşımak için.
pub fn legacy_uiohook_to_code(k: u32) -> Option<&'static str> {
    // F13–F24: libuiohook kendi numaralarını kullanır (tarama kodu DEĞİL) → önce bunlar.
    match k {
        91 => return Some("F13"),
        92 => return Some("F14"),
        93 => return Some("F15"),
        99 => return Some("F16"),
        100 => return Some("F17"),
        101 => return Some("F18"),
        102 => return Some("F19"),
        103 => return Some("F20"),
        104 => return Some("F21"),
        105 => return Some("F22"),
        106 => return Some("F23"),
        107 => return Some("F24"),
        _ => {}
    }
    // Diğer genişletilmemiş (0x00xx) kodlar: Windows tarama koduyla aynı.
    if k < 0x100 {
        return windows_to_code(k, false, 0);
    }
    Some(match k {
        // uiohook'un 0x0Exx ön ekli genişletilmiş tuşları
        3612 => "NumpadEnter",
        3613 => "ControlRight",
        3637 => "NumpadDivide",
        3639 => "PrintScreen",
        3640 => "AltRight",
        3653 | 3654 | 3656 => "Pause",
        3655 => "Home",
        3657 => "PageUp",
        3663 => "End",
        3665 => "PageDown",
        3666 => "Insert",
        3667 => "Delete",
        3675 => "MetaLeft",
        3676 => "MetaRight",
        3677 => "ContextMenu",
        // 0xE0xx ön ekli ok tuşları
        57416 => "ArrowUp",
        57419 => "ArrowLeft",
        57421 => "ArrowRight",
        57424 => "ArrowDown",
        _ => return None,
    })
}

/// Eski tablodaki Linux alternatif kodları (yalnızca eski Linux kullanıcılarının verisi için).
pub fn legacy_alt_to_code(k: u32) -> Option<&'static str> {
    match k {
        97 => Some("ControlRight"),
        125 => Some("MetaLeft"),
        126 => Some("MetaRight"),
        _ => None,
    }
}

/// Windows sanal tuş kodları (VK) — `GetAsyncKeyState` yoklaması için. Sol/sağ ayrımı VK_L*/VK_R*
/// kodlarıyla korunur. NumpadEnter, VK_RETURN'u Enter ile paylaştığı için yoklamada yoktur (kancada var).
pub fn vk_table() -> Vec<(&'static str, u16)> {
    let mut t: Vec<(&'static str, u16)> = Vec::new();
    const LETTERS: [&str; 26] = [
        "KeyA", "KeyB", "KeyC", "KeyD", "KeyE", "KeyF", "KeyG", "KeyH", "KeyI", "KeyJ", "KeyK", "KeyL", "KeyM",
        "KeyN", "KeyO", "KeyP", "KeyQ", "KeyR", "KeyS", "KeyT", "KeyU", "KeyV", "KeyW", "KeyX", "KeyY", "KeyZ",
    ];
    for (i, c) in LETTERS.iter().enumerate() {
        t.push((c, 0x41 + i as u16));
    }
    const DIGITS: [&str; 10] = [
        "Digit0", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9",
    ];
    for (i, c) in DIGITS.iter().enumerate() {
        t.push((c, 0x30 + i as u16));
    }
    const FKEYS: [&str; 24] = [
        "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "F13", "F14", "F15", "F16",
        "F17", "F18", "F19", "F20", "F21", "F22", "F23", "F24",
    ];
    for (i, c) in FKEYS.iter().enumerate() {
        t.push((c, 0x70 + i as u16));
    }
    const NUMPAD: [&str; 10] = [
        "Numpad0", "Numpad1", "Numpad2", "Numpad3", "Numpad4", "Numpad5", "Numpad6", "Numpad7", "Numpad8", "Numpad9",
    ];
    for (i, c) in NUMPAD.iter().enumerate() {
        t.push((c, 0x60 + i as u16));
    }
    t.extend_from_slice(&[
        ("ShiftLeft", 0xA0), ("ShiftRight", 0xA1), ("ControlLeft", 0xA2), ("ControlRight", 0xA3),
        ("AltLeft", 0xA4), ("AltRight", 0xA5), ("MetaLeft", 0x5B), ("MetaRight", 0x5C),
        ("Space", 0x20), ("Enter", 0x0D), ("Escape", 0x1B), ("Tab", 0x09), ("Backspace", 0x08),
        ("CapsLock", 0x14), ("Pause", 0x13), ("PrintScreen", 0x2C), ("ScrollLock", 0x91), ("NumLock", 0x90),
        ("Insert", 0x2D), ("Delete", 0x2E), ("Home", 0x24), ("End", 0x23), ("PageUp", 0x21), ("PageDown", 0x22),
        ("ArrowLeft", 0x25), ("ArrowUp", 0x26), ("ArrowRight", 0x27), ("ArrowDown", 0x28),
        ("NumpadMultiply", 0x6A), ("NumpadAdd", 0x6B), ("NumpadSubtract", 0x6D), ("NumpadDecimal", 0x6E),
        ("NumpadDivide", 0x6F),
        ("Semicolon", 0xBA), ("Equal", 0xBB), ("Comma", 0xBC), ("Minus", 0xBD), ("Period", 0xBE), ("Slash", 0xBF),
        ("Backquote", 0xC0), ("BracketLeft", 0xDB), ("Backslash", 0xDC), ("BracketRight", 0xDD), ("Quote", 0xDE),
        ("IntlBackslash", 0xE2), ("ContextMenu", 0x5D),
        ("MediaTrackNext", 0xB0), ("MediaTrackPrevious", 0xB1), ("MediaStop", 0xB2), ("MediaPlayPause", 0xB3),
        ("AudioVolumeMute", 0xAD), ("AudioVolumeDown", 0xAE), ("AudioVolumeUp", 0xAF),
        ("BrowserBack", 0xA6), ("BrowserForward", 0xA7), ("BrowserRefresh", 0xA8), ("BrowserStop", 0xA9),
        ("BrowserSearch", 0xAA), ("BrowserFavorites", 0xAB), ("BrowserHome", 0xAC),
        ("LaunchMail", 0xB4), ("MediaSelect", 0xB5), ("LaunchApp1", 0xB6), ("LaunchApp2", 0xB7),
    ]);
    t
}

const MODIFIERS: [&str; 8] = [
    "ControlLeft",
    "ControlRight",
    "ShiftLeft",
    "ShiftRight",
    "AltLeft",
    "AltRight",
    "MetaLeft",
    "MetaRight",
];

pub fn is_modifier(code: &str) -> bool {
    MODIFIERS.contains(&code)
}

/// rdev (macOS/Linux arka ucu) tuşunu `code` adına çevirir. Tanınmayan tuşlar `None`.
/// Windows'ta rdev kullanılmaz; yine de tablo her platformda derlenir ve test edilir.
#[cfg_attr(windows, allow(dead_code))]
pub fn rdev_key_to_code(key: &rdev::Key) -> Option<&'static str> {
    use rdev::Key::*;
    Some(match key {
        Alt => "AltLeft",
        AltGr => "AltRight",
        Backspace => "Backspace",
        CapsLock => "CapsLock",
        ControlLeft => "ControlLeft",
        ControlRight => "ControlRight",
        Delete => "Delete",
        DownArrow => "ArrowDown",
        End => "End",
        Escape => "Escape",
        F1 => "F1",
        F2 => "F2",
        F3 => "F3",
        F4 => "F4",
        F5 => "F5",
        F6 => "F6",
        F7 => "F7",
        F8 => "F8",
        F9 => "F9",
        F10 => "F10",
        F11 => "F11",
        F12 => "F12",
        Home => "Home",
        LeftArrow => "ArrowLeft",
        MetaLeft => "MetaLeft",
        MetaRight => "MetaRight",
        PageDown => "PageDown",
        PageUp => "PageUp",
        Return => "Enter",
        RightArrow => "ArrowRight",
        ShiftLeft => "ShiftLeft",
        ShiftRight => "ShiftRight",
        Space => "Space",
        Tab => "Tab",
        UpArrow => "ArrowUp",
        PrintScreen => "PrintScreen",
        ScrollLock => "ScrollLock",
        Pause => "Pause",
        NumLock => "NumLock",
        BackQuote => "Backquote",
        Num1 => "Digit1",
        Num2 => "Digit2",
        Num3 => "Digit3",
        Num4 => "Digit4",
        Num5 => "Digit5",
        Num6 => "Digit6",
        Num7 => "Digit7",
        Num8 => "Digit8",
        Num9 => "Digit9",
        Num0 => "Digit0",
        Minus => "Minus",
        Equal => "Equal",
        KeyQ => "KeyQ",
        KeyW => "KeyW",
        KeyE => "KeyE",
        KeyR => "KeyR",
        KeyT => "KeyT",
        KeyY => "KeyY",
        KeyU => "KeyU",
        KeyI => "KeyI",
        KeyO => "KeyO",
        KeyP => "KeyP",
        LeftBracket => "BracketLeft",
        RightBracket => "BracketRight",
        KeyA => "KeyA",
        KeyS => "KeyS",
        KeyD => "KeyD",
        KeyF => "KeyF",
        KeyG => "KeyG",
        KeyH => "KeyH",
        KeyJ => "KeyJ",
        KeyK => "KeyK",
        KeyL => "KeyL",
        SemiColon => "Semicolon",
        Quote => "Quote",
        BackSlash => "Backslash",
        IntlBackslash => "IntlBackslash",
        KeyZ => "KeyZ",
        KeyX => "KeyX",
        KeyC => "KeyC",
        KeyV => "KeyV",
        KeyB => "KeyB",
        KeyN => "KeyN",
        KeyM => "KeyM",
        Comma => "Comma",
        Dot => "Period",
        Slash => "Slash",
        Insert => "Insert",
        KpReturn => "NumpadEnter",
        KpMinus => "NumpadSubtract",
        KpPlus => "NumpadAdd",
        KpMultiply => "NumpadMultiply",
        KpDivide => "NumpadDivide",
        Kp0 => "Numpad0",
        Kp1 => "Numpad1",
        Kp2 => "Numpad2",
        Kp3 => "Numpad3",
        Kp4 => "Numpad4",
        Kp5 => "Numpad5",
        Kp6 => "Numpad6",
        Kp7 => "Numpad7",
        Kp8 => "Numpad8",
        Kp9 => "Numpad9",
        KpDelete => "NumpadDecimal",
        _ => return None, // Function, Unknown(_)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn real_user_bindings_migrate_correctly() {
        // Bu makinedeki gerçek eski veri: mute=54, deafen=3653, quick-status=3657
        assert_eq!(legacy_uiohook_to_code(54), Some("ShiftRight"));
        assert_eq!(legacy_uiohook_to_code(3653), Some("Pause"));
        assert_eq!(legacy_uiohook_to_code(3657), Some("PageUp"));
    }

    #[test]
    fn old_ambiguous_codes_are_resolved_by_real_meaning() {
        // Eski keyMap.js'te F11 "End", Insert "Numpad 0" diye etiketleniyordu (çakışan anahtarlar).
        assert_eq!(legacy_uiohook_to_code(87), Some("F11"));
        assert_eq!(legacy_uiohook_to_code(3663), Some("End"));
        assert_eq!(legacy_uiohook_to_code(82), Some("Numpad0"));
        assert_eq!(legacy_uiohook_to_code(3666), Some("Insert"));
        assert_eq!(legacy_uiohook_to_code(99), Some("F16"));
        assert_eq!(legacy_uiohook_to_code(3639), Some("PrintScreen"));
    }

    #[test]
    fn legacy_function_keys_use_libuiohook_numbers_not_scancodes() {
        assert_eq!(legacy_uiohook_to_code(91), Some("F13"));
        assert_eq!(legacy_uiohook_to_code(100), Some("F17")); // tarama kodu olsaydı F13 olurdu
        assert_eq!(legacy_uiohook_to_code(107), Some("F24"));
        assert_eq!(legacy_uiohook_to_code(59), Some("F1"));
        assert_eq!(legacy_uiohook_to_code(88), Some("F12"));
    }

    #[test]
    fn legacy_letters_digits_and_modifiers() {
        assert_eq!(legacy_uiohook_to_code(47), Some("KeyV"));
        assert_eq!(legacy_uiohook_to_code(30), Some("KeyA"));
        assert_eq!(legacy_uiohook_to_code(2), Some("Digit1"));
        assert_eq!(legacy_uiohook_to_code(11), Some("Digit0"));
        assert_eq!(legacy_uiohook_to_code(29), Some("ControlLeft"));
        assert_eq!(legacy_uiohook_to_code(3613), Some("ControlRight"));
        assert_eq!(legacy_uiohook_to_code(57416), Some("ArrowUp"));
        assert_eq!(legacy_uiohook_to_code(9999999), None);
    }

    #[test]
    fn windows_scancodes_are_physical() {
        assert_eq!(windows_to_code(0x2F, false, 0x56), Some("KeyV"));
        assert_eq!(windows_to_code(0x64, false, 0x7C), Some("F13"));
        assert_eq!(windows_to_code(0x76, false, 0x87), Some("F24"));
        // Numpad7 ile Home aynı tarama kodu; E0 öneki ayırt eder.
        assert_eq!(windows_to_code(0x47, false, 0x67), Some("Numpad7"));
        assert_eq!(windows_to_code(0x47, true, 0x24), Some("Home"));
        assert_eq!(windows_to_code(0x1C, true, 0x0D), Some("NumpadEnter"));
        assert_eq!(windows_to_code(0x1C, false, 0x0D), Some("Enter"));
    }

    #[test]
    fn windows_special_vk_cases() {
        assert_eq!(windows_to_code(0x45, false, 0x13), Some("Pause"));
        assert_eq!(windows_to_code(0x45, true, 0x90), Some("NumLock"));
        assert_eq!(windows_to_code(0x54, false, 0x2C), Some("PrintScreen"));
        assert_eq!(windows_to_code(0x22, true, 0xB3), Some("MediaPlayPause"));
    }

    #[test]
    fn fake_left_shift_is_ignored_but_real_right_shift_is_kept() {
        assert_eq!(windows_to_code(0x2A, true, 0xA0), None); // Windows'un uydurduğu E0 2A
        assert_eq!(windows_to_code(0x2A, false, 0xA0), Some("ShiftLeft"));
        // Gerçek cihazda ölçüldü: Sağ Shift = scan 0x36, vk 0xA1, E0 bayrağı SET
        assert_eq!(windows_to_code(0x36, true, 0xA1), Some("ShiftRight"));
        assert_eq!(windows_to_code(0x36, false, 0xA1), Some("ShiftRight"));
    }

    #[test]
    fn no_duplicate_codes_in_unextended_table() {
        let mut seen = HashSet::new();
        for scan in 0..0x100u32 {
            if let Some(c) = windows_to_code(scan, false, 0) {
                // 0x54 (SysRq) bilerek PrintScreen'e gider; diğer hepsi benzersiz olmalı.
                if scan != 0x54 {
                    assert!(seen.insert(c), "{c} birden fazla tarama koduna atanmış (0x{scan:X})");
                }
            }
        }
    }

    #[test]
    fn vk_table_has_unique_codes_and_vks_and_keeps_left_right() {
        let t = vk_table();
        let mut codes = std::collections::HashSet::new();
        let mut vks = std::collections::HashSet::new();
        for (c, v) in &t {
            assert!(codes.insert(*c), "{c} iki kez var");
            assert!(vks.insert(*v), "VK 0x{v:X} ({c}) iki kez var");
        }
        let find = |c: &str| t.iter().find(|(n, _)| *n == c).map(|(_, v)| *v);
        assert_eq!(find("ShiftLeft"), Some(0xA0));
        assert_eq!(find("ShiftRight"), Some(0xA1)); // sağ/sol ayrımı korunur
        assert_eq!(find("KeyV"), Some(0x56));
        assert_eq!(find("F13"), Some(0x7C));
        assert_eq!(find("Pause"), Some(0x13));
    }

    #[test]
    fn modifiers() {
        assert!(is_modifier("ShiftRight") && is_modifier("MetaLeft"));
        assert!(!is_modifier("KeyV") && !is_modifier("Pause"));
    }

    #[test]
    fn rdev_table_covers_common_keys() {
        assert_eq!(rdev_key_to_code(&rdev::Key::KeyV), Some("KeyV"));
        assert_eq!(rdev_key_to_code(&rdev::Key::Kp0), Some("Numpad0"));
        assert_eq!(rdev_key_to_code(&rdev::Key::Dot), Some("Period"));
        assert_eq!(rdev_key_to_code(&rdev::Key::Unknown(999)), None);
    }
}
