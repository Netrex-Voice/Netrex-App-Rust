"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/src/store/settingsStore";

export function SettingsApplier() {
  const uiScale = useSettingsStore(state => state.uiScale);
  const fontSize = useSettingsStore(state => state.fontSize);
  const fontFamily = useSettingsStore(state => state.fontFamily);

  // UI Scale + Font settings
  useEffect(() => {
    const root = document.documentElement;
    
    // UI ölçeklendirme
    root.style.setProperty("--ui-scale", `${uiScale / 100}`);
    root.style.fontSize = `${uiScale / 100}rem`;

    // Font boyutu
    const fontSizeMap = {
      small: "14px",
      medium: "16px",
      large: "18px",
    };
    const baseFontSize = fontSizeMap[fontSize] || "16px";
    root.style.setProperty("--base-font-size", baseFontSize);
    document.body.style.fontSize = baseFontSize;

    // Font ailesi
    let fontFamilyValue;
    if (fontFamily === "system") {
      fontFamilyValue = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
    } else {
      // Font adını düzgün formata çevir (kebab-case'den Title Case'e)
      const fontName = fontFamily
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      fontFamilyValue = `"${fontName}", -apple-system, BlinkMacSystemFont, sans-serif`;
    }
    root.style.setProperty("--font-family", fontFamilyValue);
    document.body.style.fontFamily = fontFamilyValue;
  }, [uiScale, fontSize, fontFamily]);

  // ✅ OPTIMIZATION: Separate effect for performance settings
  const hardwareAcceleration = useSettingsStore(state => state.hardwareAcceleration);
  const graphicsQuality = useSettingsStore(state => state.graphicsQuality);

  useEffect(() => {
    // GPU Hızlandırma
    if (hardwareAcceleration) {
      document.body.classList.add("hardware-accel-on");
    } else {
      document.body.classList.remove("hardware-accel-on");
    }

    // Görsel Kalite (Low = Blur yok)
    if (graphicsQuality === "low") {
      document.body.classList.add("graphics-quality-low");
    } else {
      document.body.classList.remove("graphics-quality-low");
    }
  }, [hardwareAcceleration, graphicsQuality]);

  return null;
}
