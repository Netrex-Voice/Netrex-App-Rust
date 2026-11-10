// Kısa pencerede "insan sesi benzeri" ses algılama (klavye/fare tıklamalarını eler).
// Saf fonksiyonlar: React/Web Audio'dan bağımsız, Node'da test edilebilir.
//
// Neden sadece ses seviyesi (RMS) yetmiyor: tuş ve fare sesleri kısa ama yüksektir.
// İki özellik konuşmayı bunlardan ayırır:
//  1) SÜRE: pencerenin büyük kısmında kesintisiz ses vardır (tuş sesi ~20-40 ms sürer).
//  2) PERİYODİKLİK: sesli harfler ses tellerinin düzenli titreşimini üretir (otokorelasyonda
//     güçlü tepe); tıklamalar ve gürültü üretmez.

export const FRAME_SIZE = 4096; // 48 kHz'de ~85 ms
const BLOCKS = 8;
const MIN_ACTIVE_BLOCKS = 5; // pencerenin >= %62'sinde ses sürmeli (~53 ms)
const ACTIVE_BLOCK_RATIO = 0.4; // blok genliği, en güçlü bloğun %40'ını geçerse "aktif" (sönümlü vuruşları eler)
const MIN_PERIODICITY = 0.5;
const PITCH_MIN_HZ = 70;
const PITCH_MAX_HZ = 400;
const PERIODICITY_WINDOW = 2048;

/** RMS ve "kaç blokta ses var" ölçümü (ucuz) */
export function measureFrame(buf) {
  const n = buf.length;
  const blockSize = Math.floor(n / BLOCKS);
  const blockEnergy = new Array(BLOCKS).fill(0);
  let total = 0;
  for (let b = 0; b < BLOCKS; b++) {
    let e = 0;
    const start = b * blockSize;
    for (let i = start; i < start + blockSize; i++) e += buf[i] * buf[i];
    blockEnergy[b] = e;
    total += e;
  }
  const rms = Math.sqrt(total / (blockSize * BLOCKS));
  const maxBlock = Math.max(...blockEnergy);
  let activeBlocks = 0;
  if (maxBlock > 0) {
    for (let b = 0; b < BLOCKS; b++) {
      if (blockEnergy[b] >= maxBlock * ACTIVE_BLOCK_RATIO * ACTIVE_BLOCK_RATIO) activeBlocks++;
    }
  }
  return { rms, activeBlocks };
}

/** Pencerenin son kısmında perde (pitch) periyodikliği: 0..1 (yüksek = sesli harf benzeri) */
export function periodicity(buf, sampleRate) {
  const n = buf.length;
  const len = Math.min(PERIODICITY_WINDOW, n);
  const start = n - len;

  let mean = 0;
  for (let i = start; i < n; i++) mean += buf[i];
  mean /= len;

  const x = new Float32Array(len);
  for (let i = 0; i < len; i++) x[i] = buf[start + i] - mean;

  const minLag = Math.floor(sampleRate / PITCH_MAX_HZ);
  const maxLag = Math.min(Math.ceil(sampleRate / PITCH_MIN_HZ), len - 64);

  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let num = 0;
    let e1 = 0;
    let e2 = 0;
    const m = len - lag;
    for (let i = 0; i < m; i++) {
      const a = x[i];
      const b = x[i + lag];
      num += a * b;
      e1 += a * a;
      e2 += b * b;
    }
    const r = num / Math.sqrt(e1 * e2 + 1e-12);
    if (r > best) best = r;
  }
  return best;
}

/**
 * Bu pencere "konuşma benzeri" mi?
 * @param {Float32Array} buf  son FRAME_SIZE örnek
 * @param {number} sampleRate
 * @param {number} threshold  RMS eşiği (ortam gürültüsüne göre uyarlanmış)
 * @param {{rms:number, activeBlocks:number}} [measured] önceden ölçülmüşse tekrar hesaplama
 */
export function isSpeechLike(buf, sampleRate, threshold, measured) {
  const m = measured || measureFrame(buf);
  if (m.rms <= threshold) return false;
  if (m.activeBlocks < MIN_ACTIVE_BLOCKS) return false; // kısa/ani ses (tıklama)
  return periodicity(buf, sampleRate) >= MIN_PERIODICITY; // pahalı kontrol en sonda
}
