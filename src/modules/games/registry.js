/**
 * 🎮 Netrex Games — oyun kayıt defteri (manifest + doğrulama)
 *
 * Her oyun bir manifest ile tanımlanır. Motor (`engine`) yalnızca HOST'ta, arayüz (`view`) herkeste, ikisi de
 * dinamik import ile ve oyun açılınca yüklenir. Yeni oyun eklemek = bir motor + bir arayüz + buraya bir manifest
 * (bkz. docs/games/README.md). Üçüncü taraf kod YÜKLENMEZ: yalnızca bu repodaki birinci taraf modüller kayıtlıdır.
 */

export const CATEGORIES = {
  sports: "Spor",
  party: "Parti",
  board: "Masa Oyunu",
  casual: "Rahat",
  solo: "Tek Kişilik",
  puzzle: "Bulmaca",
  action: "Aksiyon",
};

const COLORS = { red: "Kırmızı", blue: "İndigo", green: "Yeşil", amber: "Turuncu", pink: "Pembe", teal: "Turkuaz" };

export const GAMES = [
  {
    id: "airhockey",
    version: "1.0.0",
    name: "Air Hockey",
    tagline: "Gerçek ölçülü masa, falsolu disk, sıfır gecikme hissi",
    description:
      "2 × 1 m gerçek ölçülü 3B masa: 82,5 mm disk, yuvarlatılmış raylar, hava yastığı. Raydan ve raketten sürtünmeyle sekme diski döndürür (falso). Kendi raketin anında tepki verir; vuruşun host tarafından doğrulanır, skoru yalnızca host belirler.",
    category: "sports",
    accent: "#38bdf8",
    icon: "Zap",
    players: { min: 2, max: 2 },
    bots: true,
    realtime: true,
    secret: false,
    controls: ["Fare / dokunma: raketi sürükle", "Raket yalnızca kendi yarında hareket eder"],
    howTo: ["Diski rakip kaleye gönder.", "İlk hedef skora ulaşan kazanır.", "Rakip ayrılırsa maçı hükmen kazanırsın."],
    config: [
      { key: "target", label: "Hedef skor", group: "Maç", type: "select", options: [3, 5, 7, 10, 15], default: 7 },
      { key: "goal", label: "Kale genişliği", group: "Saha", type: "select", options: ["small", "normal", "large"], labels: { small: "Dar", normal: "Normal", large: "Geniş" }, default: "normal" },
      { key: "padSize", label: "Raket boyutu", group: "Saha", type: "select", options: ["small", "normal", "large"], labels: { small: "Küçük", normal: "Normal", large: "Büyük" }, default: "normal" },
      { key: "puckSpeed", label: "Disk hızı", group: "Saha", type: "select", options: ["slow", "normal", "fast"], labels: { slow: "Yavaş", normal: "Normal", fast: "Hızlı" }, default: "normal" },
      { key: "botLevel", label: "Bot seviyesi", type: "select", options: ["easy", "normal", "hard"], labels: { easy: "Kolay", normal: "Normal", hard: "Zor" }, default: "normal" },
    ],
    engine: () => import("./engines/airhockey.js"),
    view: () => import("./views/AirHockeyView.jsx"),
  },
  {
    id: "pingpong",
    version: "1.0.0",
    name: "Ping Pong",
    tagline: "3B masa tenisi: topspin, kesme, Magnus kavisi",
    description:
      "ITTF ölçülü masa ve file, 40 mm top: hava direnci, Magnus etkisi (topspin dalar, kesme süzülür), falsolu sekme. Raketi yukarı sürersen topspin, aşağı kesersen backspin, hızlı vurursan smaç. Servis, let, çift sekme ve 2 fark kuralları.",
    category: "sports",
    accent: "#f59e0b",
    icon: "Dumbbell",
    players: { min: 2, max: 2 },
    bots: true,
    realtime: true,
    secret: false,
    controls: ["Fare / dokunma / ok tuşları: raketi yana ve yukarı sür (ileri-geri otomatik)", "Servis: tıkla veya Boşluk; raketi hareket ettirerek falso ver"],
    howTo: ["Topu file üzerinden rakip masaya gönder.", "Rakip tarafta iki sekme = sayı.", "Kendi masana düşen ya da dışarı giden top sayı kaybettirir."],
    config: [
      { key: "target", label: "Hedef sayı", group: "Maç", type: "select", options: [5, 7, 11, 15, 21], default: 11 },
      { key: "winBy2", label: "2 sayı fark şartı", group: "Maç", type: "toggle", default: true },
      { key: "serveEvery", label: "Servis kaç sayıda değişsin", group: "Maç", type: "select", options: [1, 2, 5], default: 2 },
      { key: "speed", label: "Top hızı", group: "Fizik", type: "select", options: ["slow", "normal", "fast"], labels: { slow: "Yavaş", normal: "Normal", fast: "Hızlı" }, default: "normal" },
      { key: "botLevel", label: "Bot seviyesi", type: "select", options: ["easy", "normal", "hard"], labels: { easy: "Kolay", normal: "Normal", hard: "Zor" }, default: "normal" },
    ],
    engine: () => import("./engines/pingpong.js"),
    view: () => import("./views/PingPongView.jsx"),
  },
  {
    id: "pool",
    version: "1.0.0",
    name: "Bilardo",
    tagline: "8 top: falso, takip, geri çekme — gerçek fizikle",
    description:
      "8 ft masada 8 top. Toplar kayar ve yuvarlanır; ıstakanın vurduğu nokta takip, geri çekme ve yan falso üretir; bantlar ve cep çeneleri gerçek geometriyle modellenmiştir. Vuruş parametreleri gönderilir, herkes aynı fiziği kendi ekranında 60 fps oynatır: ping'den etkilenmez.",
    category: "sports",
    accent: "#16a34a",
    icon: "Circle",
    players: { min: 2, max: 2 },
    bots: true,
    realtime: false,
    secret: false,
    controls: ["Sürükle: nişan al (Shift: hassas)", "Güç: basılı tut ve geri çek, bırakınca vur", "Sağ alttaki toptan falso noktasını seç", "Elde top: beyazı sürükleyip bırak"],
    howTo: ["Açılıştan sonra ilk geçerli sokuş grubunu belirler (düz 1–7 / çizgili 9–15).", "Kendi grubunu bitir, sonra 8'i sok.", "Faul (beyaz cebe, yanlış ilk temas, bant yok): rakip elde topla oynar.", "8'i erken ya da faulle sokmak oyunu kaybettirir."],
    config: [
      { key: "turnTime", label: "Vuruş süresi", group: "Kurallar", type: "select", options: [0, 30, 45, 60], labels: { 0: "Sınırsız", 30: "30 sn", 45: "45 sn", 60: "60 sn" }, default: 0 },
      { key: "botLevel", label: "Bot seviyesi", type: "select", options: ["easy", "normal", "hard"], labels: { easy: "Kolay", normal: "Normal", hard: "Zor" }, default: "normal" },
    ],
    engine: () => import("./engines/pool.js"),
    view: () => import("./views/PoolView.jsx"),
  },
  {
    id: "tabu",
    version: "1.0.0",
    name: "Tabu",
    tagline: "Yasaklı kelimeleri söylemeden anlat, takımın bilsin",
    description:
      "İki takım sırayla oynar. Anlatıcı kelimeyi yasaklıları söylemeden anlatır; rakip takım gizlice denetler. Kart yalnızca yetkili oyunculara gönderilir.",
    category: "party",
    accent: "#a855f7",
    icon: "MessageCircleQuestion",
    players: { min: 4, max: 12 },
    bots: false,
    realtime: false,
    secret: true,
    teams: true,
    controls: ["Anlatıcı: Doğru / Pas", "Rakip takım: Tabu! (yasaklı söylendiğinde)"],
    howTo: ["Anlatıcı kartı sesli sohbette anlatır.", "Doğru +1, Tabu −1, Pas hakkı sınırlıdır.", "Tüm turlar bitince en yüksek puanlı takım kazanır."],
    config: [
      { key: "secs", label: "Tur süresi (sn)", group: "Tur", type: "select", options: [30, 45, 60, 90, 120], default: 60 },
      { key: "rounds", label: "Takım başına tur", group: "Tur", type: "select", options: [1, 2, 3, 4, 6], default: 3 },
      { key: "passes", label: "Pas hakkı", group: "Tur", type: "select", options: [0, 1, 3, 5], default: 3 },
      { key: "okPts", label: "Doğru bilince puan", group: "Puan", type: "select", options: [1, 2, 3], default: 1 },
      { key: "tabooPts", label: "Tabu cezası", group: "Puan", type: "select", options: [0, 1, 2], default: 1 },
      { key: "name0", label: "1. takım adı", group: "Takımlar", type: "text", max: 16, default: "Kırmızı Takım" },
      { key: "color0", label: "1. takım rengi", group: "Takımlar", type: "select", options: ["red", "blue", "green", "amber", "pink", "teal"], labels: COLORS, default: "red" },
      { key: "name1", label: "2. takım adı", group: "Takımlar", type: "text", max: 16, default: "Mavi Takım" },
      { key: "color1", label: "2. takım rengi", group: "Takımlar", type: "select", options: ["red", "blue", "green", "amber", "pink", "teal"], labels: COLORS, default: "blue" },
      { key: "cardPack", label: "Kart havuzu", group: "Kartlar", type: "select", options: ["builtin", "mix", "custom"], labels: { builtin: "Hazır kartlar", mix: "Hazır + benim kartlarım", custom: "Yalnızca benim kartlarım (≥10)" }, default: "builtin" },
      { key: "customCards", label: "Özel kartlar", group: "Kartlar", type: "area", max: 2400, hint: "Her satır: Kelime: yasak1, yasak2, yasak3 (3–5 yasaklı)", default: "" },
    ],
    engine: () => import("./engines/tabu.js"),
    view: () => import("./views/TabuView.jsx"),
  },
  {
    id: "emlak",
    version: "1.0.0",
    name: "Emlak",
    tagline: "İstanbul'u satın al, kirayı topla, rakiplerini iflas ettir",
    description:
      "Klasik Monopoly kurallarıyla İstanbul edisyonu: 40 karelik tahta, 8 renk grubu, 4 ulaşım hattı, 2 idare, Şans ve Hazine kartları. Satın al ya da ihaleye çıkar, grubunu tamamlayıp ev ve otel kur, takas yap, ipotek et. Zarlar gerçek fizikle yuvarlanır; sonuçları sunucu belirler. 2–6 kişi, eksik koltuklara bot eklenebilir.",
    category: "board",
    accent: "#f59e0b",
    icon: "Building2",
    players: { min: 2, max: 6 },
    bots: true,
    tokens: 10, // piyon sayısı (engines/emlakTokens.js ile aynı)
    realtime: false,
    secret: false,
    controls: ["Zar at, satın al ya da ihaleye çıkar", "Arsana tıkla: ev kur, sat, ipotek et", "Oyuncuya tıkla: takas teklif et"],
    howTo: ["Başlangıçtan her geçişte 200 alırsın.", "Bir renk grubunun tamamı sendeyse kira iki kat olur ve ev kurabilirsin (eşit dağıtarak).", "Parası biten varlık satar ya da iflas eder; son kalan ya da tur sınırında en zengin kazanır."],
    config: [
      { key: "rounds", label: "Tur sınırı", group: "Kurallar", type: "select", options: [15, 25, 40, 60], default: 25 },
      { key: "auctions", label: "Alınmayan arsa ihaleye çıksın", group: "Kurallar", type: "toggle", default: true },
      { key: "turnTime", label: "Hamle süresi", group: "Kurallar", type: "select", options: [0, 45, 60, 90], labels: { 0: "Sınırsız", 45: "45 sn", 60: "60 sn", 90: "90 sn" }, default: 0 },
    ],
    engine: () => import("./engines/emlak.js"),
    view: () => import("./views/EmlakView.jsx"),
  },
  {
    id: "okey",
    version: "1.0.0",
    name: "Okey",
    tagline: "Dört kişilik klasik Türk Okey'i, eksik koltuklara bot",
    description:
      "106 taş, gösterge, okey ve sahte okey ile standart kurallar. Dağıtım ve tüm hamleler sunucuda doğrulanır; kimse başkasının elini göremez. Boş koltukları botlar doldurur.",
    category: "board",
    accent: "#ef4444",
    icon: "LayoutGrid",
    players: { min: 1, max: 4 },
    bots: true,
    realtime: false,
    secret: true,
    controls: ["Taşı sürükle ya da tıkla-seç", "Yığından veya soldaki atıktan çek, sonra taş at", "Eliniz hazırsa taşı 'Bitir'e sürükleyin"],
    howTo: ["Amaç: 14 taşın tamamını seri veya gruplara ayırıp bir taş atarak bitirmek.", "Seri: aynı renk ardışık (≥3). Grup: aynı sayı farklı renk (3–4).", "Okey joker, sahte okey okeyin yüzünü taşır."],
    config: [
      { key: "turnTime", label: "Hamle süresi", group: "Kurallar", type: "select", options: [0, 30, 60, 90], labels: { 0: "Sınırsız", 30: "30 sn", 60: "60 sn", 90: "90 sn" }, default: 0 },
      { key: "hints", label: "Bitirme ipucu (eliniz hazırsa uyarır)", group: "Kurallar", type: "toggle", default: true },
      { key: "botLevel", label: "Bot seviyesi", type: "select", options: ["easy", "normal", "hard"], labels: { easy: "Kolay", normal: "Normal", hard: "Zor" }, default: "normal" },
    ],
    engine: () => import("./engines/okey.js"),
    view: () => import("./views/OkeyView.jsx"),
  },
  {
    id: "chess",
    version: "1.0.0",
    name: "Satranç",
    tagline: "Botlara karşı Elo kas: 250'den 2400'e merdiven, Bullet / Blitz / Rapid puanları",
    description:
      "Tam kurallı satranç: rok, geçerken alma, terfi, pat, yetersiz materyal, 50 hamle ve üçlü tekrar. Saatli (Bullet, Blitz, Rapid) maçlar puanlıdır; her kategorinin Elo puanı ayrı tutulur. 13 botluk merdivenin her basamağı kendi puanına sahiptir: yendikçe puanın artar, kaybettikçe düşer. Puan merdiveni tahminidir, gerçek bir Elo havuzuyla kalibre edilmemiştir.",
    category: "solo",
    accent: "#81b64c",
    icon: "Crown",
    solo: true,
    players: { min: 1, max: 1 },
    bots: true,
    realtime: false,
    secret: false,
    controls: ["Taşı sürükle ya da tıkla-seç, sonra hedef kareye tıkla", "← → ile hamleleri incele, F ile tahtayı çevir", "Oyundan çıkmak mağlubiyet sayılmaz; saat işlemeye devam eder"],
    howTo: ["Seviyeni belirle, rakip botu ve süreyi seç.", "Saatli oyunlar puanlıdır: beklenenden güçlü rakibi yenmek daha çok puan verir.", "Süren biterse (rakip mat edemiyorsa beraberlik) maçı kaybedersin; terk etmek de mağlubiyettir."],
    config: [],
    view: () => import("./views/ChessView.jsx"),
  },
  {
    id: "hillclimb",
    version: "1.0.0",
    name: "Tepe Tırmanışı",
    tagline: "Gaz, fren, benzin ve mesafe: arazide en uzağa git, jant ve motor geliştir",
    description:
      "Fizik tabanlı 2B araç tırmanışı. Gaz ve fren pedalıyla arazide ilerle, benzin bitmeden yakıt bidonu topla, havada takla atarak bonus kazan, madenleri biriktirip motor, süspansiyon, lastik ve 4x4 geliştir. Üç araç, dört bölüm (Kır, Çöl, Kutup, Ay: düşük yerçekimi). Tüm görseller ve sesler bu oyun için özgün çizilmiş/sentezlenmiştir.",
    category: "solo",
    accent: "#f59e0b",
    icon: "Mountain",
    solo: true,
    players: { min: 1, max: 1 },
    bots: false,
    realtime: true,
    secret: false,
    controls: ["→ / D: gaz · ← / A: fren ve geri", "Havada gaz ve fren aracı döndürür", "Ekrandaki pedallar dokunmatik ve fareyle de çalışır · P: duraklat"],
    howTo: ["Sürücünün kafası yere değerse oyun biter; takla atmadan inmeye çalış.", "Benzin göstergesi sıfıra inerse araç durunca oyun biter, kırmızı bidonları topla.", "Altınlarla garajda araç ve yükseltme al."],
    config: [],
    view: () => import("./views/HillClimbView.jsx"),
  },
  {
    id: "g2048", version: "1.0.0", name: "2048", tagline: "Kaydır, birleştir, 2048'e ulaş",
    description: "Klasik sayı bulmacası: aynı sayılı taşları kaydırarak birleştir. Her hamlede yeni taş gelir; hamle kalmayınca oyun biter.",
    category: "puzzle", accent: "#f59e0b", icon: "Gamepad2", solo: true, players: { min: 1, max: 1 }, bots: false, realtime: false, secret: false,
    controls: ["Ok tuşları / WASD ya da parmakla kaydır"],
    howTo: ["Aynı sayılar çarpışınca toplanır.", "2048 taşına ulaşınca kazanırsın, istersen devam edersin."],
    config: [],
    view: () => import("./views/Game2048View.jsx"),
  },
  {
    id: "snake", version: "1.0.0", name: "Yılan", tagline: "Elmaları ye, uzadıkça hızlan, duvara ve kendine çarpma",
    description: "Klasik yılan: elma yedikçe uzar ve hızlanırsın. Her 5 elmada kısa süre görünen altın elma +5 puan verir.",
    category: "action", accent: "#22c55e", icon: "Gamepad2", solo: true, players: { min: 1, max: 1 }, bots: false, realtime: false, secret: false,
    controls: ["Ok tuşları / WASD ya da kaydır", "P: duraklat"],
    howTo: ["Elmaları ye, kendine ve duvara çarpma.", "Altın elma süre dolmadan alınırsa +5."],
    config: [],
    view: () => import("./views/SnakeView.jsx"),
  },
  {
    id: "mines", version: "1.0.0", name: "Mayın Tarlası", tagline: "Bayrakla, aç, tarlayı temizle",
    description: "Mayına basmadan tüm güvenli kareleri aç. İlk tık her zaman güvenlidir. Kolay, Orta ve Zor tahta; en iyi süre kaydedilir.",
    category: "puzzle", accent: "#ef4444", icon: "Gamepad2", solo: true, players: { min: 1, max: 1 }, bots: false, realtime: false, secret: false,
    controls: ["Sol tık: aç · sağ tık / uzun bas: bayrak", "Açık sayıya tıkla: çevresi tamamsa komşuları aç"],
    howTo: ["Sayı, çevredeki mayın adedidir.", "Tüm güvenli kareleri açınca kazanırsın."],
    config: [],
    view: () => import("./views/MinesView.jsx"),
  },
  {
    id: "memory", version: "1.0.0", name: "Hafıza", tagline: "Kartları çevir, çiftleri bul",
    description: "Emoji kartlarının eşlerini bul. Üç boyut; en az hamle ve süre tutulur.",
    category: "puzzle", accent: "#ec4899", icon: "Gamepad2", solo: true, players: { min: 1, max: 1 }, bots: false, realtime: false, secret: false,
    controls: ["Karta tıkla ya da dokun"],
    howTo: ["Her hamlede iki kart çevirirsin.", "Tüm çiftleri bulunca biter."],
    config: [],
    view: () => import("./views/MemoryView.jsx"),
  },
  {
    id: "breakout", version: "1.0.0", name: "Tuğla Kırma", tagline: "Topu düşürme, tüm tuğlaları kır",
    description: "Raketle topu zıplat, tuğlaları kır. Her seviye daha çok ve sağlam tuğla, daha hızlı top getirir.",
    category: "action", accent: "#38bdf8", icon: "Gamepad2", solo: true, players: { min: 1, max: 1 }, bots: false, realtime: false, secret: false,
    controls: ["Fare / dokunma ya da ← → / A D ile raketi sür", "Tıkla ya da boşluk: fırlat"],
    howTo: ["Topu düşürürsen can kaybedersin (3 can).", "Raketin kenarıyla vurunca top açılı gider."],
    config: [],
    view: () => import("./views/BreakoutView.jsx"),
  },
  {
    id: "tetris", version: "1.0.0", name: "Blok Yığma", tagline: "Parçaları yerleştir, satırları temizle",
    description: "Düşen parçaları döndür ve yerleştir; tam satırlar temizlenir. Seviye arttıkça hızlanır. 7'li torba, gölge parça ve anında bırakma var.",
    category: "puzzle", accent: "#a855f7", icon: "Gamepad2", solo: true, players: { min: 1, max: 1 }, bots: false, realtime: false, secret: false,
    controls: ["← → / A D yana · ↑ / W döndür", "↓ / S hızlı indir · Boşluk anında bırak · P duraklat"],
    howTo: ["Parçalar yığılıp tavana ulaşırsa oyun biter.", "Çoklu satır ve art arda temizleme daha çok puan verir."],
    config: [],
    view: () => import("./views/TetrisView.jsx"),
  },
  {
    id: "connect4", version: "1.0.0", name: "4 Bağla", tagline: "Botu geç: dört taşı yan yana getir",
    description: "Sütunlara taş bırak; yatay, dikey ya da çapraz dört taş yapan kazanır. Üç bot seviyesi, galibiyet serisi tutulur.",
    category: "board", accent: "#3b82f6", icon: "Gamepad2", solo: true, players: { min: 1, max: 1 }, bots: false, realtime: false, secret: false,
    controls: ["Bir sütuna tıkla"],
    howTo: ["Taş en alta düşer.", "Botun dörtlüsünü engelle, kendi dörtlünü kur."],
    config: [],
    view: () => import("./views/Connect4View.jsx"),
  },
  {
    id: "flappy", version: "1.0.0", name: "Kanatlı", tagline: "Boruların arasından süzül",
    description: "Tek tuşla kanat çırp, borular arasından geç. Her boruda +1; ilerledikçe hızlanır.",
    category: "action", accent: "#facc15", icon: "Gamepad2", solo: true, players: { min: 1, max: 1 }, bots: false, realtime: false, secret: false,
    controls: ["Boşluk / ↑ / tıkla / dokun: kanat çırp"],
    howTo: ["Borulara ve yere çarpma.", "Mümkün olduğunca çok boru geç."],
    config: [],
    view: () => import("./views/FlappyView.jsx"),
  },
];

export const getGame = (id) => GAMES.find((g) => g.id === id) || null;

/** Manifest doğrulaması: kayıt anında ve testlerde çalışır; hatalı manifest oyunu kaydetmeyi engeller */
export function validateManifest(m) {
  const errs = [];
  const need = (c, msg) => c || errs.push(msg);
  need(m && typeof m === "object", "manifest yok");
  if (!m || typeof m !== "object") return errs;
  need(/^[a-z][a-z0-9]{1,23}$/.test(m.id || ""), "id geçersiz");
  need(/^\d+\.\d+\.\d+$/.test(m.version || ""), "version semver olmalı");
  need(typeof m.name === "string" && m.name.length > 0 && m.name.length <= 40, "name geçersiz");
  need(typeof m.description === "string" && m.description.length > 0, "description yok");
  need(m.category in CATEGORIES, "category geçersiz");
  need(Number.isInteger(m.players?.min) && Number.isInteger(m.players?.max) && m.players.min >= 1 && m.players.min <= m.players.max && m.players.max <= 12, "players aralığı geçersiz");
  need(m.tokens === undefined || (Number.isInteger(m.tokens) && m.tokens >= 1 && m.tokens <= 32), "tokens geçersiz");
  need(typeof m.view === "function" && (m.solo || typeof m.engine === "function"), "engine/view yükleyicisi eksik (tek kişilik oyunda yalnızca view gerekir)");
  need(Array.isArray(m.howTo) && m.howTo.length > 0, "howTo boş");
  for (const c of m.config || []) {
    const ty = c.type || "select";
    const ok = ty === "select" ? Array.isArray(c.options) && c.options.includes(c.default) : ty === "toggle" ? typeof c.default === "boolean" : typeof c.default === "string" && c.max > 0;
    need(typeof c.key === "string" && ok, `config ${c.key} geçersiz`);
  }
  return errs;
}

/** Ağdan gelen konfigürasyonu manifest şemasına göre temizler (yalnızca bilinen anahtar ve izinli değerler) */
export function cleanConfig(manifest, cfg) {
  const out = {};
  for (const c of manifest.config || []) {
    const v = cfg?.[c.key];
    if (c.type === "toggle") out[c.key] = typeof v === "boolean" ? v : c.default;
    else if (c.type === "text" || c.type === "area") out[c.key] = typeof v === "string" ? v.replace(/[\u0000-\u0009\u000b-\u001f<>]/g, " ").slice(0, c.max) : c.default;
    else out[c.key] = c.options.includes(v) ? v : c.default;
  }
  return out;
}

GAMES.forEach((g) => {
  const e = validateManifest(g);
  if (e.length && typeof console !== "undefined") console.error(`[games] ${g.id} manifest hatası:`, e);
});
