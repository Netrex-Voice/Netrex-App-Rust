/**
 * LiveKit Cloud bölge seçimi: gecikmeye göre en hızlı bölgeyi bulur ve hatırlar.
 *
 * Neden: LiveKit Cloud, varsayılan URL'de istemciyi COĞRAFİ yakınlığa göre bir bölgeye yönlendirir. İnternet yolu coğrafyayı
 * izlemez: bu geliştirici makinede İsrail (987 km) seçiliyordu ama Frankfurt (2200 km) ~%40 daha düşük gecikmeliydi.
 * Ölçüm (Room.connect, ısınmış ortanca): varsayılan 1464 ms, Frankfurt'a sabit 568 ms. Odaya girişteki ICE/DTLS/veri kanalı
 * adımlarının her biri bir gidiş-dönüş olduğundan gecikme doğrudan bekleme süresine çarpar.
 *
 * Nasıl: oda bağlandıktan SONRA arka planda (girişi geciktirmez) projenin bölge listesi (`/settings/regions`) alınır, her
 * bölgeye gecikme ölçülür, en hızlısı localStorage'da 12 saat saklanır. Sonraki girişlerde `getPreferredUrl` o bölgenin
 * URL'sini verir. Güvenlik ağları: önbellek süresi, bağlantı zaman aşımında silinir, LiveKit istemcisinin kendi bölge
 * yedeklemesi (bölge ulaşılamazsa diğerlerini dener) açık kalır. Yalnızca `*.livekit.cloud` adreslerinde çalışır
 * (yerel/kendi sunucumuzda hiçbir şey yapmaz).
 */

const STORE_KEY = "netrex-lk-region-v1";
const TTL_MS = 12 * 60 * 60 * 1000;
const inflight = new Set(); // aynı proje için eşzamanlı ikinci ölçüm başlamasın
const MIN_PROBED = 2; // en az bu kadar bölgeden ölçüm gelmeden karar verilmez

const isCloud = (url) => {
  try { return new URL(String(url).replace(/^wss?:/, "https:")).hostname.endsWith(".livekit.cloud"); } catch { return false; }
};
const hostOf = (url) => new URL(String(url).replace(/^wss?:/, "https:")).host;
const toWss = (url) => String(url).replace(/^https:/, "wss:").replace(/\/+$/, "");

function readStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {}; } catch { return {}; }
}
function writeStore(v) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch { /* depolama kapalı: önbellek yok, sorun değil */ }
}

/** Önbellekte taze bir en-hızlı-bölge varsa onun URL'si, yoksa verilen URL (değişmeden). */
export function getPreferredUrl(baseUrl) {
  if (!baseUrl || !isCloud(baseUrl)) return baseUrl;
  const e = readStore()[hostOf(baseUrl)];
  if (e && e.url && Date.now() - e.at < TTL_MS) return e.url;
  return baseUrl;
}

/** Bağlantı sorunu olursa önbelleği sil (bir sonraki giriş varsayılana döner, sonra yeniden ölçülür). */
export function invalidatePreferredUrl(baseUrl) {
  if (!baseUrl || !isCloud(baseUrl)) return;
  const s = readStore();
  delete s[hostOf(baseUrl)];
  writeStore(s);
}

/** Tek bölgeye gecikme (ms): bağlantıyı ısıt (DNS+TLS), sonra aynı bağlantıdaki 2. isteğin süresi ≈ 1 gidiş-dönüş. */
async function probeRtt(host, fetchImpl = fetch) {
  const url = `https://${host}/`;
  const opt = { mode: "no-cors", cache: "no-store" };
  try {
    await fetchImpl(url, opt);
    const samples = [];
    for (let i = 0; i < 2; i++) {
      const t = performance.now();
      await fetchImpl(url, opt);
      samples.push(performance.now() - t);
    }
    return Math.min(...samples);
  } catch {
    return null;
  }
}

/**
 * Bölgeleri ölç ve en hızlısını kaydet. `token`: projeden alınmış herhangi bir geçerli erişim token'ı.
 * Dönüş: { url, region, rtt, all } veya null (ölçüm yetersiz). Hata fırlatmaz.
 */
export async function measureAndCacheBestRegion(baseUrl, token, { fetchImpl = fetch } = {}) {
  if (!baseUrl || !token || !isCloud(baseUrl)) return null;
  const host = hostOf(baseUrl);
  const s = readStore();
  if (s[host] && Date.now() - s[host].at < TTL_MS) return s[host]; // taze: yeniden ölçme
  if (inflight.has(host)) return null;
  inflight.add(host);
  try {

  let regions;
  try {
    const res = await fetchImpl(`https://${host}/settings/regions`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    regions = (await res.json()).regions || [];
  } catch {
    return null;
  }
  if (!regions.length) return null;

  const all = [];
  for (const r of regions) {
    const rtt = await probeRtt(hostOf(r.url), fetchImpl); // sıralı: ölçümler birbirini bozmasın
    if (rtt != null) all.push({ region: r.region, url: toWss(r.url), rtt: Math.round(rtt) });
  }
  if (all.length < MIN_PROBED) return null;
  all.sort((a, b) => a.rtt - b.rtt);
  const best = { ...all[0], at: Date.now(), all: all.slice(0, 4) };
  const store = readStore();
  store[host] = best;
  writeStore(store);
  return best;
  } finally {
    inflight.delete(host);
  }
}
