// Fiziksel tuş adı (KeyboardEvent.code standardı) → okunur etiket.
//
// Kısayollar artık sayısal uiohook kodlarıyla değil `"KeyV"`, `"ControlLeft"`, `"F13"` gibi
// tuş adlarıyla saklanır (bkz. src-tauri/src/keys.rs). Eski sayısal tablodaki çakışmalar
// (87 → F11/End, 82 → Insert/Numpad 0 …) bu sayede ortadan kalktı.

/** Düzenden bağımsız sabit etiketler (modifier, özel, numpad, F tuşları, medya…) */
const STATIC_LABELS = {
  // Modifier
  ShiftLeft: "Left Shift",
  ShiftRight: "Right Shift",
  ControlLeft: "Left Ctrl",
  ControlRight: "Right Ctrl",
  AltLeft: "Left Alt",
  AltRight: "Right Alt",
  MetaLeft: "Left Meta",
  MetaRight: "Right Meta",

  // Özel tuşlar
  Space: "Space",
  Escape: "Esc",
  Enter: "Enter",
  Tab: "Tab",
  Backspace: "Backspace",
  Insert: "Insert",
  Delete: "Delete",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  ArrowUp: "Arrow Up",
  ArrowDown: "Arrow Down",
  ArrowLeft: "Arrow Left",
  ArrowRight: "Arrow Right",
  CapsLock: "CapsLock",
  NumLock: "NumLock",
  ScrollLock: "ScrollLock",
  Pause: "Pause",
  PrintScreen: "PrintScreen",
  ContextMenu: "Menu",

  // Numpad
  Numpad0: "Numpad 0",
  Numpad1: "Numpad 1",
  Numpad2: "Numpad 2",
  Numpad3: "Numpad 3",
  Numpad4: "Numpad 4",
  Numpad5: "Numpad 5",
  Numpad6: "Numpad 6",
  Numpad7: "Numpad 7",
  Numpad8: "Numpad 8",
  Numpad9: "Numpad 9",
  NumpadMultiply: "Numpad *",
  NumpadAdd: "Numpad +",
  NumpadSubtract: "Numpad -",
  NumpadDecimal: "Numpad .",
  NumpadDivide: "Numpad /",
  NumpadEnter: "Numpad Enter",

  // Noktalama (klavye düzeni bilinmiyorsa varsayılan ABD etiketleri)
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Backquote: "`",
  Comma: ",",
  Period: ".",
  Slash: "/",
  IntlBackslash: "<",

  // Medya / tarayıcı / uygulama tuşları
  MediaPlayPause: "Play/Pause",
  MediaStop: "Media Stop",
  MediaTrackNext: "Next Track",
  MediaTrackPrevious: "Previous Track",
  AudioVolumeMute: "Volume Mute",
  AudioVolumeUp: "Volume Up",
  AudioVolumeDown: "Volume Down",
};

// Kullanıcının GERÇEK klavye düzeni: Türkçe Q'da "BracketLeft" → "Ğ", "Semicolon" → "Ş" gibi.
// Yalnızca Chromium tabanlı WebView'lerde var (Windows/WebView2); yoksa sabit etiketlere düşer.
let layoutMap = null;
if (typeof navigator !== "undefined" && navigator.keyboard?.getLayoutMap) {
  navigator.keyboard
    .getLayoutMap()
    .then((m) => {
      layoutMap = m;
    })
    .catch(() => {});
}

const LAYOUT_AWARE =
  /^(Key[A-Z]|Digit\d|Minus|Equal|Bracket(Left|Right)|Backslash|Semicolon|Quote|Backquote|Comma|Period|Slash|IntlBackslash)$/;

/**
 * Tuş adından okunur etiket.
 * @param {string} code - Örn. "KeyV", "ControlLeft", "F13"
 * @returns {string}
 */
export function getKeyLabel(code) {
  if (!code || typeof code !== "string") return "Not Set";

  if (LAYOUT_AWARE.test(code)) {
    const ch = layoutMap?.get(code);
    if (ch) return ch.length === 1 ? ch.toLocaleUpperCase() : ch;
  }
  if (STATIC_LABELS[code]) return STATIC_LABELS[code];

  let m = code.match(/^Key([A-Z])$/);
  if (m) return m[1];
  m = code.match(/^Digit(\d)$/);
  if (m) return m[1];
  m = code.match(/^F(\d{1,2})$/);
  if (m) return `F${m[1]}`;

  // Bilinmeyen/nadir tuş: ham adı okunur hale getir ("BrowserBack" → "Browser Back")
  return code.replace(/([a-z])([A-Z])/g, "$1 $2");
}

const MODIFIER_CODES = new Set([
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
]);

/**
 * Tuş bir modifier mı (Shift/Ctrl/Alt/Meta)?
 * @param {string} code
 * @returns {boolean}
 */
export function isModifierKey(code) {
  return MODIFIER_CODES.has(code);
}

/**
 * Fare düğmesi etiketi
 * @param {number} button - Düğme kodu
 * @returns {string}
 */
export function getMouseLabel(button) {
  switch (button) {
    case 3:
      return "Middle Click";
    case 4:
      return "Mouse 4 (Back)";
    case 5:
      return "Mouse 5 (Forward)";
    default:
      return `Mouse ${button}`;
  }
}
