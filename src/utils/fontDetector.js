/**
 * Sistem fontlarını tespit eden utility
 * document.fonts API kullanarak yüklü fontları listeler
 */

// Yaygın sistem fontları listesi
const COMMON_FONTS = [
  "Arial",
  "Arial Black",
  "Calibri",
  "Cambria",
  "Comic Sans MS",
  "Consolas",
  "Courier New",
  "Georgia",
  "Helvetica",
  "Impact",
  "Lucida Console",
  "Lucida Sans Unicode",
  "Palatino",
  "Tahoma",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
  "Segoe UI",
  "Segoe UI Emoji",
  "Segoe UI Symbol",
  "Microsoft Sans Serif",
  "MS Sans Serif",
  "MS Serif",
  // "System" kaldırıldı - zaten başta "Sistem Varsayılanı" olarak ekleniyor
];

// Web fontları
const WEB_FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Source Sans Pro",
  "Raleway",
  "Ubuntu",
  "Nunito",
];

/**
 * Font'un yüklü olup olmadığını kontrol eder
 */
async function checkFontLoaded(fontName) {
  try {
    if (typeof document === "undefined" || !document.fonts) {
      return false;
    }
    
    // Font'un yüklü olup olmadığını kontrol et
    await document.fonts.ready;
    
    // Basit bir kontrol - font'un mevcut olup olmadığını test et
    const testString = "mmmmmmmmmmlli";
    const testSize = "72px";
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    
    // Referans font ile ölç
    context.font = `${testSize} monospace`;
    const baselineWidth = context.measureText(testString).width;
    
    // Test font ile ölç
    context.font = `${testSize} "${fontName}", monospace`;
    const testWidth = context.measureText(testString).width;
    
    // Eğer genişlik farklıysa font yüklü demektir
    return baselineWidth !== testWidth;
  } catch {
    return false;
  }
}

/**
 * Sistemdeki mevcut fontları listeler
 */
export async function getAvailableFonts() {
  const availableFonts = [];
  
  // Önce yaygın sistem fontlarını kontrol et
  for (const font of COMMON_FONTS) {
    try {
      const isLoaded = await checkFontLoaded(font);
      if (isLoaded) {
        availableFonts.push(font);
      }
    } catch {
      // Hata durumunda devam et
    }
  }
  
  // Web fontlarını da ekle (bunlar genellikle yüklü değildir ama seçenek olarak sunulabilir)
  // Web fontları için özel kontrol yapmaya gerek yok, kullanıcı seçerse yüklenir
  
  // Sistem varsayılanını en başa ekle
  return [
    { value: "system", label: "Sistem Varsayılanı" },
    ...availableFonts.map((font) => ({
      value: font.toLowerCase().replace(/\s+/g, "-"),
      label: font,
    })),
    // Web fontları
    ...WEB_FONTS.map((font) => ({
      value: font.toLowerCase().replace(/\s+/g, "-"),
      label: font,
    })),
  ];
}

/**
 * Basit font listesi döndürür (async kontrol yapmadan)
 * Daha hızlı ama daha az doğru
 */
export function getCommonFonts() {
  return [
    { value: "system", label: "Sistem Varsayılanı" },
    ...COMMON_FONTS.map((font) => ({
      value: font.toLowerCase().replace(/\s+/g, "-"),
      label: font,
    })),
    ...WEB_FONTS.map((font) => ({
      value: font.toLowerCase().replace(/\s+/g, "-"),
      label: font,
    })),
  ];
}

