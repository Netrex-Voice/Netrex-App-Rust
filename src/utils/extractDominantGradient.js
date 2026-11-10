// src/utils/extractDominantGradient.js

export async function extractDominantGradient(source, opts = {}) {
  const { angle = 135, satBoost = 1.3, lightTarget = 0.52 } = opts;

  const src = typeof source === "string" ? source : URL.createObjectURL(source);
  const revokeOnDone = typeof source !== "string";

  try {
    const pixelObjs = await loadPixels(src, 128);

    if (!pixelObjs || pixelObjs.length === 0) {
      return `linear-gradient(${angle}deg, #6366f1 0%, #a855f7 100%)`;
    }

    // 1. Renkli pikselleri filtrele
    const colorful = pixelObjs.filter((p) => {
      const [r, g, b] = p.rgb;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 510;
      const sat = max === 0 ? 0 : (max - min) / max;
      return l > 0.08 && l < 0.92 && sat > 0.2;
    });

    const candidates =
      colorful.length > 30
        ? colorful
        : pixelObjs.filter((p) => {
            const [r, g, b] = p.rgb;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const sat = max === 0 ? 0 : (max - min) / max;
            return sat > 0.1;
          });

    if (candidates.length < 2) {
      return `linear-gradient(${angle}deg, #6366f1 0%, #a855f7 100%)`;
    }

    // 2. Her pikselin HSL + ağırlığını hesapla
    const hslPixels = candidates.map((p) => {
      const [r, g, b] = p.rgb;
      const [h, s, l] = rgbToHsl(r, g, b);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      const weight = sat * sat * p.score;
      return { rgb: p.rgb, hsl: [h, s, l], score: p.score, weight };
    });

    // 3. HUE Histogramı - 72 bin (her biri 5°)
    const HUE_BINS = 72;
    const bins = Array.from({ length: HUE_BINS }, () => ({
      weight: 0,
      pixels: [],
    }));

    for (const p of hslPixels) {
      const binIdx = Math.min(HUE_BINS - 1, Math.floor(p.hsl[0] * HUE_BINS));
      bins[binIdx].weight += p.weight;
      bins[binIdx].pixels.push(p);
    }

    // 4. Local peak'leri bul
    const peaks = [];
    for (let i = 0; i < HUE_BINS; i++) {
      const prev = bins[(i - 2 + HUE_BINS) % HUE_BINS].weight;
      const curr = bins[i].weight;
      const next = bins[(i + 2) % HUE_BINS].weight;
      if (curr > prev && curr > next && curr > 0.001) {
        peaks.push({ binIdx: i, weight: curr, pixels: bins[i].pixels });
      }
    }

    // Peak yoksa en ağır 2 bin
    if (peaks.length < 2) {
      const sorted = [...bins]
        .map((b, i) => ({ ...b, binIdx: i }))
        .filter((b) => b.pixels.length > 0)
        .sort((a, b) => b.weight - a.weight);

      const p1 = sorted[0];
      const p2 = sorted.find((b) => {
        const diff = Math.abs(b.binIdx - p1.binIdx);
        return Math.min(diff, HUE_BINS - diff) > 8;
      }) ?? sorted[1];

      if (!p1 || !p2) {
        return `linear-gradient(${angle}deg, #6366f1 0%, #a855f7 100%)`;
      }

      const c1 = getBestPixel(collectBinPixels(bins, p1.binIdx, 2, HUE_BINS));
      const c2 = getBestPixel(collectBinPixels(bins, p2.binIdx, 2, HUE_BINS));
      return buildGradient(c1, c2, angle, satBoost, lightTarget);
    }

    // 5. En zıt peak çiftini bul
    let bestPair = null;
    let bestScore = -1;

    for (let i = 0; i < peaks.length; i++) {
      for (let j = i + 1; j < peaks.length; j++) {
        const diff = Math.abs(peaks[i].binIdx - peaks[j].binIdx);
        const hueDist = Math.min(diff, HUE_BINS - diff);
        const score =
          (hueDist / (HUE_BINS / 2)) ** 1.5 *
          Math.sqrt(peaks[i].weight * peaks[j].weight);

        if (score > bestScore) {
          bestScore = score;
          bestPair = [peaks[i], peaks[j]];
        }
      }
    }

    if (!bestPair) {
      const solo = peaks[0];
      const oppositeIdx = (solo.binIdx + Math.floor(HUE_BINS / 2)) % HUE_BINS;
      bestPair = [solo, { binIdx: oppositeIdx, pixels: [] }];
    }

    // 6. Temsilci pikselleri topla
    const pixels1 = collectBinPixels(bins, bestPair[0].binIdx, 2, HUE_BINS);
    const pixels2 = collectBinPixels(bins, bestPair[1].binIdx, 2, HUE_BINS);

    const c1 = getBestPixel(pixels1);
    const c2 =
      pixels2.length > 0
        ? getBestPixel(pixels2)
        : syntheticColor(bestPair[1].binIdx, HUE_BINS, lightTarget);

    return buildGradient(c1, c2, angle, satBoost, lightTarget);
  } finally {
    if (revokeOnDone) URL.revokeObjectURL(src);
  }
}

// ─── Yardımcılar ────────────────────────────────────────────────────────────

function collectBinPixels(bins, centerIdx, range, total) {
  const result = [];
  for (let d = -range; d <= range; d++) {
    const idx = (centerIdx + d + total) % total;
    result.push(...bins[idx].pixels);
  }
  return result;
}

function getBestPixel(pixels) {
  if (pixels.length === 0) return [128, 128, 128];
  let best = pixels[0];
  for (const p of pixels) {
    if (p.weight > best.weight) best = p;
  }
  return best.rgb;
}

function syntheticColor(binIdx, totalBins, l) {
  const h = binIdx / totalBins;
  return hslToRgb(h, 0.8, l);
}

function buildGradient(rgb1, rgb2, angle, satBoost, lightTarget) {
  const start = enhance(rgb1, satBoost, lightTarget + 0.04);
  const end = enhance(rgb2, satBoost, lightTarget - 0.04);

  const dist = colorDistance(start, end);
  let finalEnd = end;
  if (dist < 80) {
    const [h] = rgbToHsl(...end);
    const newH = (h + 0.5) % 1;
    finalEnd = hslToRgb(newH, 0.75, lightTarget);
  }

  return `linear-gradient(${angle}deg, ${toHex(start)} 0%, ${toHex(finalEnd)} 100%)`;
}

function enhance([r, g, b], satBoost, lightTarget) {
  let [h, s, l] = rgbToHsl(r, g, b);
  s = Math.min(1, s * satBoost);
  if (s < 0.25) s = 0.5;
  l = l * 0.4 + lightTarget * 0.6;
  l = Math.max(0.38, Math.min(0.62, l));
  return hslToRgb(h, s, l);
}

function colorDistance([r1, g1, b1], [r2, g2, b2]) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function toHex([r, g, b]) {
  return (
    "#" +
    [r, g, b]
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")
      )
      .join("")
  );
}

function loadPixels(url, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const pixelObjs = [];
        const center = size / 2;

        for (let i = 0; i < data.length; i += 8) {
          if (data[i + 3] < 160) continue;
          const idx = i / 4;
          const x = idx % size;
          const y = Math.floor(idx / size);
          const distFromCenter = Math.sqrt(
            (x - center) ** 2 + (y - center) ** 2
          );
          const saliency = Math.max(
            0.25,
            1.0 - distFromCenter / (size * 0.75)
          );
          pixelObjs.push({
            rgb: [data[i], data[i + 1], data[i + 2]],
            score: saliency,
          });
        }
        resolve(pixelObjs);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("Resim yüklenemedi"));
    img.src = url;
  });
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(hue2rgb(h + 1 / 3) * 255),
    Math.round(hue2rgb(h) * 255),
    Math.round(hue2rgb(h - 1 / 3) * 255),
  ];
}