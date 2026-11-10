// Noise gate eşiği: ses işlemcisi (useVoiceProcessor) ve ayar ekranındaki seviye göstergesi AYNI sabitleri
// kullanmalı; yoksa çizginin göstergede nerede durduğu ile gate'in gerçekte nerede açıldığı birbirini tutmaz.

export const THRESHOLD_MIN_RMS = 0.001;
export const THRESHOLD_MAX_RMS = 0.10;

/** Kaydırıcı değeri (0-100) → RMS eşiği */
export function sliderToRms(sliderValue) {
  return THRESHOLD_MIN_RMS + (sliderValue / 100) * (THRESHOLD_MAX_RMS - THRESHOLD_MIN_RMS);
}

/** RMS → kaydırıcı ölçeğinde yüzde (0-100) */
export function rmsToSlider(rms) {
  const n = (rms - THRESHOLD_MIN_RMS) / (THRESHOLD_MAX_RMS - THRESHOLD_MIN_RMS);
  return Math.max(0, Math.min(1, n)) * 100;
}
