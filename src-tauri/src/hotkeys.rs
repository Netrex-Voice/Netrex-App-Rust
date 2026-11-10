//! Kısayol motoru: ham tuş/fare olaylarını kayıtlı kısayollarla eşleştirir.
//!
//! İşletim sisteminden bağımsız saf mantıktır (Electron `inputManager.js` karşılığı);
//! donanım olayları `input.rs`'teki arka uçlardan gelir. Davranış farkları (bilinçli iyileştirmeler):
//! * Tuş tekrarı (basılı tutunca tekrar eden keydown) TÜM kısayollarda yok sayılır
//!   (eski sistemde yalnızca bas-konuşta; "mute" tuşuna basılı tutmak sürekli aç-kapa yapardı).
//! * Eşleşme sırası deterministiktir (eylem adına göre).

use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap};
use std::time::{Duration, Instant};

use crate::keys::is_modifier;

/// Basılı tut-konuş eylemleri bu önekle başlar: toggle değil, basış + bırakış olayı üretir.
const HOLD_PREFIX: &str = "talk-";

#[derive(Clone, Debug, PartialEq)]
pub enum Binding {
    Key {
        code: String,
        ctrl: bool,
        shift: bool,
        alt: bool,
        meta: bool,
    },
    Mouse(u8),
}

impl Binding {
    /// Arayüzden/depodan gelen JSON'u okur. Geçersizse `None`.
    ///
    /// `{type:"keyboard", code:"KeyV", ctrlKey, shiftKey, altKey, metaKey}` veya
    /// `{type:"mouse", mouseButton:3}`.
    pub fn from_json(v: &Value) -> Option<Binding> {
        match v.get("type")?.as_str()? {
            "mouse" => {
                let b = v.get("mouseButton")?.as_u64()?;
                // 1/2 sol/sağ tık: kısayol olamaz (Electron ile aynı kural)
                (3..=9).contains(&b).then_some(Binding::Mouse(b as u8))
            }
            "keyboard" => {
                let code = v.get("code")?.as_str()?;
                if code.is_empty() || code.len() > 40 || !code.chars().all(|c| c.is_ascii_alphanumeric()) {
                    return None;
                }
                let flag = |k: &str| v.get(k).and_then(Value::as_bool).unwrap_or(false);
                Some(Binding::Key {
                    code: code.to_string(),
                    ctrl: flag("ctrlKey"),
                    shift: flag("shiftKey"),
                    alt: flag("altKey"),
                    meta: flag("metaKey"),
                })
            }
            _ => None,
        }
    }
}

impl Binding {
    /// Depoya yazılacak kanonik biçim (bilinmeyen alanlar atılır).
    pub fn to_json(&self) -> Value {
        match self {
            Binding::Mouse(b) => json!({ "type": "mouse", "mouseButton": b }),
            Binding::Key { code, ctrl, shift, alt, meta } => json!({
                "type": "keyboard",
                "code": code,
                "ctrlKey": ctrl,
                "shiftKey": shift,
                "altKey": alt,
                "metaKey": meta,
            }),
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Mods {
    pub ctrl: bool,
    pub shift: bool,
    pub alt: bool,
    pub meta: bool,
}

#[derive(Clone, Debug)]
pub enum InputEvent {
    Key { code: String, down: bool },
    /// Yalnızca orta/yan tuşlar (3, 4, 5…); sol/sağ tık ve hareket arka uçta elenir.
    Mouse { button: u8, down: bool },
}

/// Motorun ürettiği çıktılar (renderer'a gidecek olaylar).
#[derive(Clone, Debug, PartialEq)]
pub enum Out {
    /// `hotkey-triggered` olayı: `toggle-<eylem>`, `hold-start-<eylem>`, `hold-end-<eylem>`
    Hotkey(String),
    /// `raw-keydown` olayı (yalnızca kayıt modunda)
    Raw(Value),
}

/// Bir tuş için bırakma olayı kaçırılırsa (kanca yeniden kuruldu, odak değişti…) "basılı" kaydı
/// takılı kalıp o kısayolu sonsuza dek yok saydırmasın: bu süre hiç olay görmediğimiz tuşa
/// yeniden basılırsa yeni basış sayılır. (Gerçek tuş tekrarı olayları kaydı sürekli tazeler.)
const STALE_DOWN: Duration = Duration::from_millis(1500);

#[derive(Default)]
pub struct Engine {
    bindings: BTreeMap<String, Binding>,
    recording: bool,
    /// Basılı tuşlar ve son görülme zamanları
    down: HashMap<String, Instant>,
    mods: Mods,
    /// Şu an basılı tutulan bas-konuş eylemleri
    held: BTreeMap<String, Binding>,
}

impl Engine {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_binding(&mut self, action: &str, binding: Option<Binding>) -> Vec<Out> {
        // Basılıyken kısayol değiştirilirse takılı kalmasın.
        let mut out = Vec::new();
        if self.held.remove(action).is_some() {
            out.push(Out::Hotkey(format!("hold-end-{action}")));
        }
        match binding {
            Some(b) => {
                self.bindings.insert(action.to_string(), b);
            }
            None => {
                self.bindings.remove(action);
            }
        }
        out
    }

    /// Bu tuş bir modifier mı ya da herhangi bir kısayolda geçiyor mu? (teşhis günlüğü için)
    pub fn watches(&self, code: &str) -> bool {
        is_modifier(code)
            || self
                .bindings
                .values()
                .any(|b| matches!(b, Binding::Key { code: c, .. } if c == code))
    }

    pub fn set_recording(&mut self, on: bool) -> Vec<Out> {
        self.recording = on;
        // Eski davranış: kayıt başlayınca basılı tutmaları bırak. Ek olarak "basılı" kümesini de
        // temizle: kayıt sırasında kaçan bir bırakma olayı sonradan kısayolu kilitlemesin.
        let out = if on { self.release_all() } else { Vec::new() };
        self.down.clear();
        out
    }

    /// Dinleyici durunca / kayıt başlayınca basılı kalan bas-konuşları bırakır.
    pub fn release_all(&mut self) -> Vec<Out> {
        let out = self
            .held
            .keys()
            .map(|a| Out::Hotkey(format!("hold-end-{a}")))
            .collect();
        self.held.clear();
        self.down.clear();
        self.mods = Mods::default();
        out
    }

    pub fn on_event(&mut self, ev: &InputEvent) -> Vec<Out> {
        self.on_event_at(ev, Instant::now())
    }

    /// `on_event`, zamanı dışarıdan alır (testler için).
    pub fn on_event_at(&mut self, ev: &InputEvent, now: Instant) -> Vec<Out> {
        match ev {
            InputEvent::Key { code, down: true } => self.key_down(code, now),
            InputEvent::Key { code, down: false } => self.key_up(code),
            InputEvent::Mouse { button, down: true } => self.mouse_down(*button),
            InputEvent::Mouse { button, down: false } => self.mouse_up(*button),
        }
    }

    fn set_mod(&mut self, code: &str, on: bool) {
        match code {
            "ControlLeft" | "ControlRight" => self.mods.ctrl = on,
            "ShiftLeft" | "ShiftRight" => self.mods.shift = on,
            "AltLeft" | "AltRight" => self.mods.alt = on,
            "MetaLeft" | "MetaRight" => self.mods.meta = on,
            _ => {}
        }
    }

    fn key_down(&mut self, code: &str, now: Instant) -> Vec<Out> {
        // İşletim sistemi tuş tekrarı: zaten basılı → yeni basış değil. Ama bırakma olayı
        // kaçırıldıysa tuş sonsuza dek "basılı" kalmasın (bkz. STALE_DOWN).
        if let Some(last) = self.down.insert(code.to_string(), now) {
            if now.saturating_duration_since(last) < STALE_DOWN {
                return Vec::new();
            }
        }
        self.set_mod(code, true);

        if self.recording {
            return vec![Out::Raw(json!({
                "type": "keyboard",
                "code": code,
                "ctrlKey": self.mods.ctrl,
                "shiftKey": self.mods.shift,
                "altKey": self.mods.alt,
                "metaKey": self.mods.meta,
            }))];
        }

        let hit = self
            .bindings
            .iter()
            .find(|(_, b)| self.matches_key(b, code))
            .map(|(a, b)| (a.clone(), b.clone()));
        self.fire(hit)
    }

    fn matches_key(&self, b: &Binding, code: &str) -> bool {
        match b {
            Binding::Key { code: c, ctrl, shift, alt, meta } if c == code => {
                // Tek başına modifier tuşu kısayolu: diğer modifier'lardan bağımsız eşleşir.
                is_modifier(code)
                    || (*ctrl == self.mods.ctrl
                        && *shift == self.mods.shift
                        && *alt == self.mods.alt
                        && *meta == self.mods.meta)
            }
            _ => false,
        }
    }

    fn key_up(&mut self, code: &str) -> Vec<Out> {
        self.down.remove(code);
        self.set_mod(code, false);
        self.release_matching(|b| matches!(b, Binding::Key { code: c, .. } if c == code))
    }

    fn mouse_down(&mut self, button: u8) -> Vec<Out> {
        if self.recording {
            return vec![Out::Raw(json!({ "type": "mouse", "mouseButton": button }))];
        }
        let hit = self
            .bindings
            .iter()
            .find(|(_, b)| matches!(b, Binding::Mouse(m) if *m == button))
            .map(|(a, b)| (a.clone(), b.clone()));
        self.fire(hit)
    }

    fn mouse_up(&mut self, button: u8) -> Vec<Out> {
        self.release_matching(|b| matches!(b, Binding::Mouse(m) if *m == button))
    }

    fn fire(&mut self, hit: Option<(String, Binding)>) -> Vec<Out> {
        let Some((action, binding)) = hit else {
            return Vec::new();
        };
        if action.starts_with(HOLD_PREFIX) {
            // `held` zaten doluysa (ör. tuş tekrarı kaçarsa) ikinci hold-start gönderme.
            if self.held.insert(action.clone(), binding).is_none() {
                return vec![Out::Hotkey(format!("hold-start-{action}"))];
            }
            return Vec::new();
        }
        vec![Out::Hotkey(format!("toggle-{action}"))]
    }

    fn release_matching(&mut self, pred: impl Fn(&Binding) -> bool) -> Vec<Out> {
        if self.held.is_empty() {
            return Vec::new();
        }
        let done: Vec<String> = self
            .held
            .iter()
            .filter(|(_, b)| pred(b))
            .map(|(a, _)| a.clone())
            .collect();
        done.into_iter()
            .map(|a| {
                self.held.remove(&a);
                Out::Hotkey(format!("hold-end-{a}"))
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key(code: &str) -> Binding {
        Binding::Key { code: code.into(), ctrl: false, shift: false, alt: false, meta: false }
    }
    fn combo(code: &str, ctrl: bool, shift: bool, alt: bool) -> Binding {
        Binding::Key { code: code.into(), ctrl, shift, alt, meta: false }
    }
    fn kd(c: &str) -> InputEvent {
        InputEvent::Key { code: c.into(), down: true }
    }
    fn ku(c: &str) -> InputEvent {
        InputEvent::Key { code: c.into(), down: false }
    }
    fn hot(s: &str) -> Vec<Out> {
        vec![Out::Hotkey(s.into())]
    }

    #[test]
    fn plain_key_toggles() {
        let mut e = Engine::new();
        e.set_binding("mute", Some(key("KeyM")));
        assert_eq!(e.on_event(&kd("KeyM")), hot("toggle-mute"));
        e.on_event(&ku("KeyM"));
        assert_eq!(e.on_event(&kd("KeyM")), hot("toggle-mute"));
    }

    #[test]
    fn key_repeat_does_not_retrigger_toggle() {
        let mut e = Engine::new();
        e.set_binding("mute", Some(key("KeyM")));
        assert_eq!(e.on_event(&kd("KeyM")), hot("toggle-mute"));
        // OS tuş tekrarı: bırakmadan tekrar keydown
        assert!(e.on_event(&kd("KeyM")).is_empty());
        assert!(e.on_event(&kd("KeyM")).is_empty());
        e.on_event(&ku("KeyM"));
        assert_eq!(e.on_event(&kd("KeyM")), hot("toggle-mute"));
    }

    #[test]
    fn modifier_only_binding_ignores_other_modifiers() {
        let mut e = Engine::new();
        e.set_binding("mute", Some(key("ShiftRight")));
        // Ctrl basılıyken bile tek başına modifier kısayolu çalışır (Electron davranışı)
        e.on_event(&kd("ControlLeft"));
        assert_eq!(e.on_event(&kd("ShiftRight")), hot("toggle-mute"));
    }

    #[test]
    fn combo_requires_exact_modifiers() {
        let mut e = Engine::new();
        e.set_binding("deafen", Some(combo("KeyD", true, false, false)));
        // Ctrl yok → eşleşmez
        assert!(e.on_event(&kd("KeyD")).is_empty());
        e.on_event(&ku("KeyD"));
        // Ctrl+D → eşleşir
        e.on_event(&kd("ControlLeft"));
        assert_eq!(e.on_event(&kd("KeyD")), hot("toggle-deafen"));
        e.on_event(&ku("KeyD"));
        // Ctrl+Shift+D → fazladan modifier: eşleşmez
        e.on_event(&kd("ShiftLeft"));
        assert!(e.on_event(&kd("KeyD")).is_empty());
    }

    #[test]
    fn released_modifier_is_forgotten() {
        let mut e = Engine::new();
        e.set_binding("deafen", Some(combo("KeyD", true, false, false)));
        e.on_event(&kd("ControlLeft"));
        e.on_event(&ku("ControlLeft"));
        assert!(e.on_event(&kd("KeyD")).is_empty());
    }

    #[test]
    fn lost_key_release_does_not_lock_the_hotkey_forever() {
        let mut e = Engine::new();
        e.set_binding("mute", Some(key("KeyM")));
        let t0 = Instant::now();
        let down = InputEvent::Key { code: "KeyM".into(), down: true };
        assert_eq!(e.on_event_at(&down, t0), hot("toggle-mute"));
        // Bırakma olayı kaçtı. 100 ms sonraki tekrar: hâlâ tuş tekrarı sayılır.
        assert!(e.on_event_at(&down, t0 + Duration::from_millis(100)).is_empty());
        // Tekrarlar kaydı tazeler: sürekli basılı tutulan tuş tetiklenmez.
        assert!(e.on_event_at(&down, t0 + Duration::from_millis(1000)).is_empty());
        assert!(e.on_event_at(&down, t0 + Duration::from_millis(2000)).is_empty());
        // 1,5 sn hiç olay yok → bırakma kaçmış: yeni basış çalışmalı.
        assert_eq!(e.on_event_at(&down, t0 + Duration::from_millis(4000)), hot("toggle-mute"));
    }

    #[test]
    fn push_to_talk_hold_start_and_end() {
        let mut e = Engine::new();
        e.set_binding("talk-all", Some(key("KeyV")));
        assert_eq!(e.on_event(&kd("KeyV")), hot("hold-start-talk-all"));
        // Tuş tekrarı yeni basış sayılmaz
        assert!(e.on_event(&kd("KeyV")).is_empty());
        assert_eq!(e.on_event(&ku("KeyV")), hot("hold-end-talk-all"));
        // Bırakınca tekrar basılabilir
        assert_eq!(e.on_event(&kd("KeyV")), hot("hold-start-talk-all"));
    }

    #[test]
    fn mouse_binding_toggle_and_hold() {
        let mut e = Engine::new();
        e.set_binding("camera", Some(Binding::Mouse(4)));
        e.set_binding("talk-whisper", Some(Binding::Mouse(5)));
        assert_eq!(e.on_event(&InputEvent::Mouse { button: 4, down: true }), hot("toggle-camera"));
        assert_eq!(e.on_event(&InputEvent::Mouse { button: 5, down: true }), hot("hold-start-talk-whisper"));
        assert_eq!(e.on_event(&InputEvent::Mouse { button: 5, down: false }), hot("hold-end-talk-whisper"));
        assert!(e.on_event(&InputEvent::Mouse { button: 3, down: true }).is_empty());
    }

    #[test]
    fn recording_mode_emits_raw_and_suppresses_hotkeys() {
        let mut e = Engine::new();
        e.set_binding("mute", Some(key("KeyM")));
        e.set_recording(true);
        let out = e.on_event(&kd("KeyM"));
        assert_eq!(
            out,
            vec![Out::Raw(json!({"type":"keyboard","code":"KeyM","ctrlKey":false,"shiftKey":false,"altKey":false,"metaKey":false}))]
        );
        // Ctrl+A kaydı: modifier bilgisi raw olaya yansır
        e.on_event(&kd("ControlLeft"));
        let out = e.on_event(&kd("KeyA"));
        assert_eq!(
            out,
            vec![Out::Raw(json!({"type":"keyboard","code":"KeyA","ctrlKey":true,"shiftKey":false,"altKey":false,"metaKey":false}))]
        );
        assert_eq!(
            e.on_event(&InputEvent::Mouse { button: 4, down: true }),
            vec![Out::Raw(json!({"type":"mouse","mouseButton":4}))]
        );
    }

    #[test]
    fn entering_recording_releases_held_talk_keys() {
        let mut e = Engine::new();
        e.set_binding("talk-all", Some(key("KeyV")));
        e.on_event(&kd("KeyV"));
        assert_eq!(e.set_recording(true), hot("hold-end-talk-all"));
    }

    #[test]
    fn release_all_on_stop() {
        let mut e = Engine::new();
        e.set_binding("talk-all", Some(key("KeyV")));
        e.set_binding("talk-group-1", Some(key("KeyB")));
        e.on_event(&kd("KeyV"));
        e.on_event(&kd("KeyB"));
        let mut out = e.release_all();
        out.sort_by_key(|o| format!("{o:?}"));
        assert_eq!(out, vec![Out::Hotkey("hold-end-talk-all".into()), Out::Hotkey("hold-end-talk-group-1".into())]);
        // Sonrasında bırakma olayı fazladan hold-end üretmez
        assert!(e.on_event(&ku("KeyV")).is_empty());
    }

    #[test]
    fn rebinding_a_held_action_releases_it() {
        let mut e = Engine::new();
        e.set_binding("talk-all", Some(key("KeyV")));
        e.on_event(&kd("KeyV"));
        assert_eq!(e.set_binding("talk-all", Some(key("KeyB"))), hot("hold-end-talk-all"));
    }

    #[test]
    fn removed_binding_stops_firing() {
        let mut e = Engine::new();
        e.set_binding("mute", Some(key("KeyM")));
        e.set_binding("mute", None);
        assert!(e.on_event(&kd("KeyM")).is_empty());
    }

    #[test]
    fn json_parsing() {
        let b = Binding::from_json(&json!({"type":"keyboard","code":"KeyV","ctrlKey":true})).unwrap();
        assert_eq!(b, Binding::Key { code: "KeyV".into(), ctrl: true, shift: false, alt: false, meta: false });
        assert_eq!(Binding::from_json(&json!({"type":"mouse","mouseButton":4})), Some(Binding::Mouse(4)));
        // sol/sağ tık kısayol olamaz
        assert_eq!(Binding::from_json(&json!({"type":"mouse","mouseButton":1})), None);
        // eski sayısal biçim (henüz taşınmamış) geçersiz
        assert_eq!(Binding::from_json(&json!({"type":"keyboard","keycode":47})), None);
        // enjeksiyona uygun olmayan kod
        assert_eq!(Binding::from_json(&json!({"type":"keyboard","code":"a\"b"})), None);
        assert_eq!(Binding::from_json(&json!(null)), None);
    }
}
