// Mikrofon yakalama kısıtları için ortak kurallar (ilk bağlantı, ayar değişimi, mikrofon yayını ve ayar ekranındaki
// seviye göstergesi aynı sonucu versin).

// AGC kullanıcının ayarına bağlıdır. Krisp modunda zorla kapatmayı denedik: mikrofon seviyesi AGC'siz çok düştü
// ve noise gate eşiği (%15) eskisine göre neredeyse hiç geçilemez oldu. Gate eşiği AGC'li seviyeye göre ayarlı.
export function effectiveAutoGainControl(autoGainControl, _noiseSuppressionMode) {
  return !!autoGainControl;
}
