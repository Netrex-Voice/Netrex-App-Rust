class VoiceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    this._bufferSize = 2048;
    this._buffer = new Float32Array(this._bufferSize);
    this._bufferIndex = 0;
    
    // ✅ FIX: 128 → 48 (noise gate + animasyon tepkisi için ~128ms @ 48kHz)
    this._reportIntervalQuanta = 48;
    this._quantaCount = 0;
    
    // Hann Window
    this._hannWindow = new Float32Array(this._bufferSize);
    for (let i = 0; i < this._bufferSize; i++) {
      this._hannWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (this._bufferSize - 1)));
    }
    
    // FFT arrays
    this._fftReal = new Float32Array(this._bufferSize);
    this._fftImag = new Float32Array(this._bufferSize);
    
    this._sampleRate = 48000;
    
    // RMS Smoothing
    this._smoothedRms = 0;
    this._rmsAttack = 0.35;
    this._rmsRelease = 0.03;
  }

  fft(real, imag) {
    const n = real.length;
    if (n <= 1) return;
    
    let j = 0;
    for (let i = 0; i < n; i++) {
      if (i < j) {
        [real[i], real[j]] = [real[j], real[i]];
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
      let m = n >> 1;
      while (m >= 1 && j >= m) {
        j -= m;
        m >>= 1;
      }
      j += m;
    }
    
    for (let s = 1; s < n; s <<= 1) {
      const angle = -Math.PI / s;
      const wReal = Math.cos(angle);
      const wImag = Math.sin(angle);
      
      for (let k = 0; k < n; k += s << 1) {
        let tReal = 1, tImag = 0;
        for (let jj = 0; jj < s; jj++) {
          const i = k + jj;
          const evenReal = real[i];
          const evenImag = imag[i];
          const oddReal = real[i + s] * tReal - imag[i + s] * tImag;
          const oddImag = real[i + s] * tImag + imag[i + s] * tReal;
          
          real[i] = evenReal + oddReal;
          imag[i] = evenImag + oddImag;
          real[i + s] = evenReal - oddReal;
          imag[i + s] = evenImag - oddImag;
          
          const temp = tReal;
          tReal = temp * wReal - tImag * wImag;
          tImag = temp * wImag + tImag * wReal;
        }
      }
    }
  }

  calculateSpectralPower(lowFreq, highFreq) {
    const nyquist = this._sampleRate / 2;
    const binCount = this._bufferSize / 2;
    const binSize = nyquist / binCount;
    
    const lowBin = Math.max(0, Math.floor(lowFreq / binSize));
    const highBin = Math.min(binCount - 1, Math.ceil(highFreq / binSize));
    
    if (lowBin > highBin) return 0;
    
    let power = 0;
    for (let i = lowBin; i <= highBin; i++) {
      power += this._fftReal[i] * this._fftReal[i] + 
               this._fftImag[i] * this._fftImag[i];
    }
    
    return Math.sqrt(power / (highBin - lowBin + 1));
  }

  calculateRMS(data) {
    const len = data.length;
    const unrollSize = 4;
    const unrollEnd = len - (len % unrollSize);
    let sum = 0;
    
    // ✅ Loop unrolling - 4 değer birden
    for (let i = 0; i < unrollEnd; i += unrollSize) {
      const v0 = data[i];
      const v1 = data[i + 1];
      const v2 = data[i + 2];
      const v3 = data[i + 3];
      sum += v0 * v0 + v1 * v1 + v2 * v2 + v3 * v3;
    }
    
    // Kalan değerler
    for (let i = unrollEnd; i < len; i++) {
      sum += data[i] * data[i];
    }
    
    return Math.sqrt(sum / len);
  }

  calculateZCR(data) {
    const len = data.length;
    if (len < 2) return 0;
    
    let crossings = 0;
    let prev = data[0] >= 0 ? 1 : 0;
    
    // ✅ Bitwise XOR - daha hızlı comparison
    for (let i = 1; i < len; i++) {
      const curr = data[i] >= 0 ? 1 : 0;
      crossings += prev ^ curr;
      prev = curr;
    }
    
    return crossings / len;
  }

  calculateCrestFactor(data, rms) {
    if (rms < 0.0001) return 0;
    
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
    
    return peak / rms;
  }

  analyzeBuffer() {
    const validData = this._buffer.subarray(0, this._bufferIndex);
    if (validData.length === 0) return;
    
    // 1. Temel metrikler
    const rawRms = this.calculateRMS(validData);
    const zcr = this.calculateZCR(validData);
    const crestFactor = this.calculateCrestFactor(validData, rawRms);
    
    // RMS Smoothing
    const smoothingFactor = rawRms > this._smoothedRms ? this._rmsAttack : this._rmsRelease;
    this._smoothedRms = this._smoothedRms * (1 - smoothingFactor) + rawRms * smoothingFactor;
    // Karar ve sınıflandırma ANLIK seviyeye bakar. Yumuşatılmış değer (sönme katsayısı 0.03) konuşma bittikten
    // sonra saniyelerce eşiğin üstünde kalıyor, konuşma animasyonunu ve noise gate'i gereksiz uzatıyordu.
    // Konuşma arası boşluklar için kapıda zaten 300 ms hold var. _smoothedRms yalnızca ölçüm amaçlı kalır.
    const rms = rawRms;
    
    // 2. FFT
    const dataLen = Math.min(validData.length, this._bufferSize);
    for (let i = 0; i < dataLen; i++) {
      this._fftReal[i] = validData[i] * this._hannWindow[i];
      this._fftImag[i] = 0;
    }
    for (let i = dataLen; i < this._bufferSize; i++) {
      this._fftReal[i] = 0;
      this._fftImag[i] = 0;
    }
    
    this.fft(this._fftReal, this._fftImag);
    
    // 3. Frekans Bantları
    const fundamentalVoice = this.calculateSpectralPower(80, 500);
    const midVoice = this.calculateSpectralPower(500, 2000);
    const highVoice = this.calculateSpectralPower(2000, 5000);
    const voicePower = fundamentalVoice + midVoice + highVoice;
    
    const windPower = this.calculateSpectralPower(20, 100);
    const impactPower = this.calculateSpectralPower(8000, 16000);
    
    // 4. Oranlar
    const epsilon = 0.0001;
    const voiceToWindRatio = (voicePower + epsilon) / (windPower + epsilon);
    const voiceToImpactRatio = (voicePower + epsilon) / (impactPower + epsilon);
    
    // ============================================
    // ✅ DÜZELTİLMİŞ CLASSIFICATION v3.1
    // ============================================
    
    // ✅ SORUN 3 DÜZELTİLDİ: isTransient - RMS kontrolü eklendi, ratio düşürüldü
    const isTransient = 
      crestFactor > 4.5 && 
      voiceToImpactRatio < 1.0 &&         // 1.5 → 1.0 (daha katı)
      rms > 0.01;                          // ✅ Çok zayıf sesler darbe değil
    
    // ✅ SORUN 1 DÜZELTİLDİ: isSustainedVoice - RMS kontrolü eklendi
    const isSustainedVoice = 
      rms > 0.002 &&                       // ✅ Minimum RMS eklendi
      crestFactor < 2.5 &&
      zcr > 0.02 && zcr < 0.20 &&
      voiceToWindRatio > 3.0 &&
      voiceToImpactRatio > 1.5;
    
    // ✅ SORUN 2 DÜZELTİLDİ: hasPotentialVoice - threshold'lar düzeltildi
    const hasPotentialVoice = 
      rms > 0.0015 &&                      // 0.001 → 0.0015
      zcr > 0.02 && zcr < 0.20 &&          // 0.015-0.22 → 0.02-0.20
      voiceToWindRatio > 2.5;              // 2.0 → 2.5
    
    // ✅ SORUN 6 DÜZELTİLDİ: isWhisper - threshold genişletildi
    const isWhisper = 
      rms > 0.002 && rms < 0.03 &&         // 0.0015-0.015 → 0.002-0.03
      zcr > 0.02 && zcr < 0.18 &&
      voiceToWindRatio > 2.5 &&
      crestFactor < 3.0;
    
    // ============================================
    // Main thread'e gönder
    // ============================================
    this.port.postMessage({
      type: 'metrics',
      rms,
      // Yumuşatılmamış anlık seviye: smoothed rms ilk ölçümde gerçek seviyenin ~%35'ine ulaşır,
      // gate'in kelime başını kaçırmaması için açılış kararında bu kullanılır
      rawRms,
      zcr,
      crestFactor,
      voicePower,
      windPower,
      impactPower,
      voiceToWindRatio,
      voiceToImpactRatio,
      isTransient,
      isSustainedVoice,
      hasPotentialVoice,
      isWhisper
    });
  }

  process(inputs, outputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    
    const channelData = input[0];
    if (!channelData || channelData.length === 0) return true;
    
    if (typeof sampleRate !== 'undefined') {
      this._sampleRate = sampleRate;
    }
    
    // ============================================
    // ✅ SORUN 7 DÜZELTİLDİ: Buffer overflow tamamen çözüldü
    // ============================================
    
    // Buffer dolacaksa önce analiz yap
    if (this._bufferIndex + channelData.length > this._bufferSize) {
      this.analyzeBuffer();
      this._bufferIndex = 0;
      this._quantaCount = 0;
    }
    
    // ✅ Güvenli set - sadece sığan kadar ekle
    const spaceLeft = this._bufferSize - this._bufferIndex;
    const dataToAdd = Math.min(channelData.length, spaceLeft);
    
    if (dataToAdd > 0) {
      this._buffer.set(channelData.subarray(0, dataToAdd), this._bufferIndex);
      this._bufferIndex += dataToAdd;
    }
    
    this._quantaCount++;

    // Periyodik analiz
    if (this._quantaCount >= this._reportIntervalQuanta) {
      this.analyzeBuffer();
      this._bufferIndex = 0;
      this._quantaCount = 0;
    }

    return true;
  }
}

registerProcessor('voice-processor', VoiceProcessor);
