/**
 * 🎬 Watch Party bağlantı sınıflandırıcı
 *
 * Kullanıcının yapıştırdığı bağlantının hangi oynatıcıyla çalınacağını (ya da neden çalınamayacağını) söyler.
 * Eklerken (WatchPartyPlaylist) ve oynatırken (WatchPartyPlayer) aynı kurallar kullanılsın diye tek yerde tutulur.
 *
 * Desteklenenler:  YouTube (video + çalma listesi), SoundCloud (tek parça), Vimeo, Wistia, Mux,
 *                  doğrudan ses/video dosyası (.mp3 .mp4 .webm ...), HLS (.m3u8), DASH (.mpd)
 */

export const MAX_PLAYLIST_TRACKS = 300; // Firestore belgesi (1MB) ve arayüz için üst sınır

export const SUPPORTED_SITES_HINT =
  "YouTube (video ve çalma listesi), SoundCloud, Vimeo, doğrudan ses/video bağlantısı (.mp3, .mp4, .m3u8...)";

const AUDIO_EXT = /\.(m4a|m4b|mp3|mpga|wav|weba|aac|oga|ogg|opus|flac)$/i;
const VIDEO_EXT = /\.(mp4|ogv|webm|mov|m4v)$/i;
const HLS_EXT = /\.m3u8$/i;
const DASH_EXT = /\.mpd$/i;

// Neden desteklenmediği açıkça söylenen siteler
const BLOCKED_HOSTS = [
  [/(^|\.)twitch\.tv$/, "Twitch yayınları stabilite sorunları nedeniyle desteklenmiyor."],
  [/(^|\.)kick\.com$/, "Kick platformu API kısıtlamaları nedeniyle desteklenmiyor."],
  [/(^|\.)spotify\.com$/, "Spotify yalnızca 30 saniyelik önizleme verir ve senkronize edilemez. SoundCloud veya YouTube kullanın."],
  [/(^|\.)tiktok\.com$/, "TikTok videoları senkronize edilemiyor."],
  [/(^|\.)(netflix|primevideo|disneyplus|hbomax|max|hulu)\.com$/, "Telifli (DRM korumalı) yayın servisleri desteklenmiyor."],
  [/(^|\.)(instagram|facebook|fb)\.com$/, "Bu site dışarıdan oynatmaya izin vermiyor."],
  [/(^|\.)dailymotion\.com$/, "Dailymotion desteklenmiyor."],
];

const INVALID = (reason) => ({ kind: "invalid", reason });
const UNSUPPORTED = (reason) => ({ kind: "unsupported", reason });

/**
 * @returns {{
 *   kind: 'youtube'|'youtube-playlist'|'soundcloud'|'vimeo'|'wistia'|'mux'|'file'|'hls'|'dash'|'unsupported'|'invalid',
 *   url?: string,        // normalize edilmiş, kaydedilecek bağlantı
 *   videoId?: string,    // YouTube video kimliği
 *   listId?: string,     // YouTube çalma listesi kimliği (video bağlantısında da olabilir)
 *   reason?: string      // desteklenmiyorsa kullanıcıya gösterilecek sebep
 * }}
 */
export function classifyUrl(raw) {
  let input = String(raw || "").trim();
  if (!input) return INVALID("Bir bağlantı yapıştırın.");
  if (!/^https?:\/\//i.test(input)) {
    // "youtube.com/..." gibi şemasız yapıştırmalar
    if (/^[\w-]+(\.[\w-]+)+\/?/.test(input)) input = `https://${input}`;
    else return INVALID("Geçerli bir bağlantı girin (https://...).");
  }

  let u;
  try {
    u = new URL(input);
  } catch {
    return INVALID("Geçersiz URL formatı.");
  }

  const host = u.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  const path = u.pathname;

  // ── YouTube ──
  if (host === "youtu.be" || host === "youtube.com" || host === "youtube-nocookie.com") {
    const list = u.searchParams.get("list");
    // "RD…" karışımlar sonsuzdur ve kişiseldir; "UL/LL/WL" özel listelerdir
    const usableList = list && !/^(RD|UL|LL|WL)/.test(list) ? list : null;

    let videoId = null;
    if (host === "youtu.be") videoId = path.slice(1).split("/")[0];
    else videoId = u.searchParams.get("v") || (path.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/) || [])[1] || null;

    if (videoId && /^[\w-]{11}$/.test(videoId)) {
      return {
        kind: "youtube",
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        listId: usableList,
      };
    }
    if (path === "/playlist" || (list && !videoId)) {
      if (usableList) return { kind: "youtube-playlist", listId: usableList };
      return UNSUPPORTED("Bu bir YouTube karışımı/kişisel liste; eklenemez. Herkese açık bir çalma listesi bağlantısı kullanın.");
    }
    return INVALID("Geçerli bir YouTube video veya çalma listesi bağlantısı girin.");
  }

  // ── SoundCloud ──
  if (host === "soundcloud.com") {
    const parts = path.split("/").filter(Boolean);
    if (parts.includes("sets")) return UNSUPPORTED("SoundCloud çalma listeleri desteklenmiyor. Tek parça bağlantısı girin (ya da listeyi YouTube'dan ekleyin).");
    if (parts.length < 2) return UNSUPPORTED("Bir parça bağlantısı girin (kullanıcı veya ana sayfa değil).");
    return { kind: "soundcloud", url: `https://soundcloud.com/${parts.join("/")}` }; // sorgu parametreleri atılır
  }
  if (host === "on.soundcloud.com" || host === "snd.sc") {
    return UNSUPPORTED("SoundCloud kısa bağlantısı çözülemiyor. Tarayıcıdaki tam soundcloud.com/... adresini kullanın.");
  }

  // ── Vimeo ──
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    if (/\/\d+/.test(path)) return { kind: "vimeo", url: u.toString() };
    return UNSUPPORTED("Bir Vimeo video bağlantısı girin.");
  }

  // ── Wistia / Mux ──
  if (/(^|\.)wistia\.(com|net)$|^wi\.st$/.test(host) && /\/(medias|embed)\//.test(path)) {
    return { kind: "wistia", url: u.toString() };
  }
  if (host === "stream.mux.com" && !HLS_EXT.test(path)) {
    return { kind: "mux", url: u.toString() };
  }

  // ── Açıkça desteklenmeyen siteler (sebebiyle birlikte) ──
  for (const [re, reason] of BLOCKED_HOSTS) {
    if (re.test(host)) return UNSUPPORTED(reason);
  }

  // ── Doğrudan medya dosyaları (herhangi bir sunucu) ──
  if (HLS_EXT.test(path)) return { kind: "hls", url: u.toString() };
  if (DASH_EXT.test(path)) return { kind: "dash", url: u.toString() };
  if (AUDIO_EXT.test(path) || VIDEO_EXT.test(path)) return { kind: "file", url: u.toString() };

  return UNSUPPORTED(`Bu site doğrudan desteklenmiyor. Desteklenenler: ${SUPPORTED_SITES_HINT}.`);
}

/** Doğrudan dosya bağlantısından okunur bir başlık üretir (ör. ".../Harika%20Sarki.mp3" → "Harika Sarki") */
export function titleFromFileUrl(url) {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() || "");
    return last.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_]+/g, " ").trim() || url;
  } catch {
    return url;
  }
}

/**
 * YouTube çalma listesinin parçalarını getirir.
 *  - Masaüstü uygulaması: Electron ana işlemi okur (CORS yok)
 *  - Web: /api/youtube-playlist (sunucu okur)
 * @returns {Promise<{ title: string, tracks: {videoId,title,thumbnail,duration}[], truncated: boolean }>}
 */
export async function fetchPlaylistTracks(listId) {
  if (typeof window !== "undefined" && window.netrex?.fetchYouTubePlaylist) {
    const res = await window.netrex.fetchYouTubePlaylist(listId);
    if (!res?.ok) throw new Error(res?.error || "Liste alınamadı.");
    return res;
  }
  const r = await fetch(`/api/youtube-playlist?list=${encodeURIComponent(listId)}`);
  const json = await r.json().catch(() => null);
  if (!r.ok || !json?.ok) throw new Error(json?.error || "Liste alınamadı.");
  return json;
}
