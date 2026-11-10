"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn, ZoomOut, RotateCcw, Check, Move } from "lucide-react";

/**
 * ImageCropModal - Canvas tabanlı, sürükle-kaydır-zoom destekli kırpma modalı.
 *
 * Props:
 *   file        - Kırpılacak File nesnesi
 *   aspectRatio - Kırpma oranı (örn. 1 = kare, 16/9 = geniş). Varsayılan: 1
 *   shape       - "circle" | "rect"  Varsayılan: "rect"
 *   title       - Modal başlığı
 *   onSave      - async (croppedFile: File) => void   → Kaydet butonuna basıldığında
 *   onClose     - () => void
 */
export default function ImageCropModal({
  file,
  aspectRatio = 1,
  shape = "rect",
  title = "Resmi Düzenle",
  onSave,
  onClose,
}) {
  const canvasRef = useRef(null);
  const imgRef = useRef(new Image());
  const stateRef = useRef({ zoom: 1, offset: { x: 0, y: 0 } });
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startOX: 0,
    startOY: 0,
  });
  const rafRef = useRef(null);

  const [imgSrc] = useState(() => URL.createObjectURL(file));
  const [imgLoaded, setImgLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ── Canvas / kırpma alan boyutları ──────────────────────────────────────────
  const CANVAS = 320;
  const PAD = 24;
  const cropW = CANVAS - PAD * 2;
  const cropH = Math.round(cropW / aspectRatio);
  const cropX = PAD;
  const cropY = Math.round((CANVAS - cropH) / 2);

  // ── Resim URL temizleme ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => URL.revokeObjectURL(imgSrc);
  }, [imgSrc]);

  // ── Resmi yükle ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const img = imgRef.current;
    img.onload = () => setImgLoaded(true);
    img.src = imgSrc;
  }, [imgSrc]);

  // ── Temel ölçeği hesapla (kırpma alanını cover edecek minimum zoom) ─────────
  const getBaseScale = useCallback(() => {
    const img = imgRef.current;
    if (!img.naturalWidth) return 1;
    return Math.max(cropW / img.naturalWidth, cropH / img.naturalHeight);
  }, [cropW, cropH]);

  // ── Offset kırpma sınırı ────────────────────────────────────────────────────
  const clamp = useCallback(
    (ox, oy, z) => {
      const img = imgRef.current;
      if (!img.naturalWidth) return { x: ox, y: oy };
      const scale = getBaseScale() * z;
      const iW = img.naturalWidth * scale;
      const iH = img.naturalHeight * scale;
      const iX = (CANVAS - iW) / 2 + ox;
      const iY = (CANVAS - iH) / 2 + oy;
      let dx = 0,
        dy = 0;
      if (iX > cropX) dx = cropX - iX;
      if (iY > cropY) dy = cropY - iY;
      if (iX + iW < cropX + cropW) dx = cropX + cropW - (iX + iW);
      if (iY + iH < cropY + cropH) dy = cropY + cropH - (iY + iH);
      return { x: ox + dx, y: oy + dy };
    },
    [getBaseScale, cropX, cropY, cropW, cropH, CANVAS],
  );

  // ── Canvas çizimi ───────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img.naturalWidth) return;

    const ctx = canvas.getContext("2d");
    const { zoom: z, offset: o } = stateRef.current;
    const scale = getBaseScale() * z;
    const iW = img.naturalWidth * scale;
    const iH = img.naturalHeight * scale;
    const iX = (CANVAS - iW) / 2 + o.x;
    const iY = (CANVAS - iH) / 2 + o.y;

    ctx.clearRect(0, 0, CANVAS, CANVAS);

    // 1) Arka plan (koyu)
    ctx.fillStyle = "#080a0c";
    ctx.fillRect(0, 0, CANVAS, CANVAS);

    // 2) Loş resim (tüm alan)
    ctx.globalAlpha = 0.22;
    ctx.drawImage(img, iX, iY, iW, iH);
    ctx.globalAlpha = 1;

    // 3) Karartma katmanı (kırpma dışı)
    ctx.fillStyle = "rgba(6,7,9,0.72)";
    ctx.fillRect(0, 0, CANVAS, CANVAS);

    // 4) Kırpma alanında net resim
    ctx.save();
    if (shape === "circle") {
      ctx.beginPath();
      ctx.arc(cropX + cropW / 2, cropY + cropH / 2, cropW / 2, 0, Math.PI * 2);
      ctx.clip();
    } else {
      const r = 6; // rounded clip
      ctx.beginPath();
      ctx.moveTo(cropX + r, cropY);
      ctx.lineTo(cropX + cropW - r, cropY);
      ctx.arcTo(cropX + cropW, cropY, cropX + cropW, cropY + r, r);
      ctx.lineTo(cropX + cropW, cropY + cropH - r);
      ctx.arcTo(
        cropX + cropW,
        cropY + cropH,
        cropX + cropW - r,
        cropY + cropH,
        r,
      );
      ctx.lineTo(cropX + r, cropY + cropH);
      ctx.arcTo(cropX, cropY + cropH, cropX, cropY + cropH - r, r);
      ctx.lineTo(cropX, cropY + r);
      ctx.arcTo(cropX, cropY, cropX + r, cropY, r);
      ctx.closePath();
      ctx.clip();
    }
    ctx.drawImage(img, iX, iY, iW, iH);
    ctx.restore();

    // 5) Üçte-bir kılavuzları
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 0.75;
    ctx.setLineDash([]);
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cropX + (cropW * i) / 3, cropY);
      ctx.lineTo(cropX + (cropW * i) / 3, cropY + cropH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cropX, cropY + (cropH * i) / 3);
      ctx.lineTo(cropX + cropW, cropY + (cropH * i) / 3);
      ctx.stroke();
    }
    ctx.restore();

    // 6) Kırpma kenar çizgisi (ince, beyaz)
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineWidth = 1;
    if (shape === "circle") {
      ctx.beginPath();
      ctx.arc(cropX + cropW / 2, cropY + cropH / 2, cropW / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const r = 6;
      ctx.beginPath();
      ctx.moveTo(cropX + r, cropY);
      ctx.lineTo(cropX + cropW - r, cropY);
      ctx.arcTo(cropX + cropW, cropY, cropX + cropW, cropY + r, r);
      ctx.lineTo(cropX + cropW, cropY + cropH - r);
      ctx.arcTo(
        cropX + cropW,
        cropY + cropH,
        cropX + cropW - r,
        cropY + cropH,
        r,
      );
      ctx.lineTo(cropX + r, cropY + cropH);
      ctx.arcTo(cropX, cropY + cropH, cropX, cropY + cropH - r, r);
      ctx.lineTo(cropX, cropY + r);
      ctx.arcTo(cropX, cropY, cropX + r, cropY, r);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();

    // 7) Köşe tutamaçları - renkli, yuvarlak uçlu (rect için)
    if (shape === "rect") {
      const cs = 14;
      const lw = 2.5;
      // Tutamaç rengi: indigo/violet
      const handleColor = "rgba(139,92,246,0.95)";
      const glowColor = "rgba(99,102,241,0.45)";

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = lw;

      [
        [cropX, cropY, 1, 1],
        [cropX + cropW, cropY, -1, 1],
        [cropX, cropY + cropH, 1, -1],
        [cropX + cropW, cropY + cropH, -1, -1],
      ].forEach(([cx, cy, dx, dy]) => {
        // Glow
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = lw + 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy + dy * cs);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + dx * cs, cy);
        ctx.stroke();
        // Solid
        ctx.strokeStyle = handleColor;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(cx, cy + dy * cs);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + dx * cs, cy);
        ctx.stroke();
      });
      ctx.restore();
    }
  }, [shape, getBaseScale, cropX, cropY, cropW, cropH, CANVAS]);

  // Zoom/offset değiştiğinde ref'i güncelle ve çiz
  useEffect(() => {
    stateRef.current = { zoom, offset };
    if (imgLoaded) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(draw);
    }
  }, [zoom, offset, imgLoaded, draw]);

  // ── Sürükleme (mouse) ───────────────────────────────────────────────────────
  const onMouseDown = (e) => {
    e.preventDefault();
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startOX: stateRef.current.offset.x,
      startOY: stateRef.current.offset.y,
    };
    setIsDragging(true);
  };

  const onMouseMove = useCallback(
    (e) => {
      if (!dragRef.current.active) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const next = clamp(
        dragRef.current.startOX + dx,
        dragRef.current.startOY + dy,
        stateRef.current.zoom,
      );
      setOffset(next);
    },
    [clamp],
  );

  const onMouseUp = () => {
    dragRef.current.active = false;
    setIsDragging(false);
  };

  // ── Sürükleme (touch) ───────────────────────────────────────────────────────
  const onTouchStart = (e) => {
    const t = e.touches[0];
    dragRef.current = {
      active: true,
      startX: t.clientX,
      startY: t.clientY,
      startOX: stateRef.current.offset.x,
      startOY: stateRef.current.offset.y,
    };
    setIsDragging(true);
  };

  const onTouchMove = useCallback(
    (e) => {
      if (!dragRef.current.active) return;
      const t = e.touches[0];
      const dx = t.clientX - dragRef.current.startX;
      const dy = t.clientY - dragRef.current.startY;
      const next = clamp(
        dragRef.current.startOX + dx,
        dragRef.current.startOY + dy,
        stateRef.current.zoom,
      );
      setOffset(next);
    },
    [clamp],
  );

  const onTouchEnd = () => {
    dragRef.current.active = false;
    setIsDragging(false);
  };

  // ── Zoom değiştir ───────────────────────────────────────────────────────────
  const handleZoom = (val) => {
    const z = Math.min(Math.max(parseFloat(val), 1), 4);
    const clamped = clamp(
      stateRef.current.offset.x,
      stateRef.current.offset.y,
      z,
    );
    setZoom(z);
    setOffset(clamped);
  };

  // ── Sıfırla ─────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // ── Kaydet → canvas → blob → File ───────────────────────────────────────────
  const handleSave = async () => {
    const img = imgRef.current;
    if (!img.naturalWidth || !imgLoaded) return;

    setIsSaving(true);
    try {
      const OUT =
        shape === "circle"
          ? 512
          : Math.round(512 / aspectRatio) * aspectRatio > 512
            ? 512
            : 512;
      const outW = 512;
      const outH = Math.round(512 / aspectRatio);

      const out = document.createElement("canvas");
      out.width = outW;
      out.height = outH;
      const ctx = out.getContext("2d");

      const scale = getBaseScale() * zoom;
      const iW = img.naturalWidth * scale;
      const iH = img.naturalHeight * scale;
      const iX = (CANVAS - iW) / 2 + offset.x;
      const iY = (CANVAS - iH) / 2 + offset.y;

      // Orijinal resimde kırpma karesine karşılık gelen alan
      const srcX = ((cropX - iX) / iW) * img.naturalWidth;
      const srcY = ((cropY - iY) / iH) * img.naturalHeight;
      const srcW = (cropW / iW) * img.naturalWidth;
      const srcH = (cropH / iH) * img.naturalHeight;

      if (shape === "circle") {
        ctx.beginPath();
        ctx.arc(outW / 2, outH / 2, outW / 2, 0, Math.PI * 2);
        ctx.clip();
      }

      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

      await new Promise((resolve, reject) => {
        out.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Blob oluşturulamadı"));
              return;
            }
            const ext = shape === "circle" ? "png" : "jpg";
            const mime = shape === "circle" ? "image/png" : "image/jpeg";
            const croppedFile = new File(
              [blob],
              file.name.replace(/\.[^.]+$/, `.${ext}`),
              { type: mime },
            );
            Promise.resolve(onSave(croppedFile)).then(resolve).catch(reject);
          },
          shape === "circle" ? "image/png" : "image/jpeg",
          0.93,
        );
      });
    } catch (err) {
      console.error("Kırpma kaydedilemedi:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (typeof document === "undefined") return null;

  const fillPct = ((zoom - 1) / 3) * 100;

  return createPortal(
    <div className="fixed inset-0 z-[10100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-[420px] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        style={{
          background: "linear-gradient(160deg, #16171a 0%, #0e0f11 100%)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.07), 0 32px 64px rgba(0,0,0,0.7), 0 0 80px rgba(99,102,241,0.08)",
        }}
      >
        {/* Gradient border top */}
        <div
          className="h-px w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(139,92,246,0.6), rgba(99,102,241,0.8), rgba(6,182,212,0.5), transparent)",
          }}
        />

        {/* Header */}
        <div className="px-5 pt-4 pb-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Icon badge */}
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.15))",
                border: "1px solid rgba(99,102,241,0.25)",
              }}
            >
              <Move size={18} className="text-indigo-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#5f6370]">
                Resim Düzenleyici
              </p>
              <h3 className="text-[15px] font-semibold text-white/90 leading-tight mt-px">
                {title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white/70 hover:bg-white/6 transition-all duration-150 bg-red-600/30 hover:bg-red-700/30"
          >
            <X size={20} />
          </button>
        </div>

        {/* Divider */}
        <div
          className="h-px mx-5"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
          }}
        />

        {/* Canvas area - full bleed */}
        <div
          className="relative mx-5 mt-4"
          style={{
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow:
              "inset 0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.5)",
            background: "#080a0c",
          }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS}
            height={CANVAS}
            className={`block select-none w-full ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
            style={{ touchAction: "none", display: "block" }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          />

          {/* Loading overlay */}
          {!imgLoaded && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "#080a0c" }}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-7 h-7 border-2 border-white/8 border-t-indigo-500 rounded-full animate-spin" />
                <span className="text-[10px] text-[#3d3f47] font-medium tracking-wide">
                  Yükleniyor
                </span>
              </div>
            </div>
          )}

          {/* Drag hint - bottom left */}
          {imgLoaded && (
            <div
              className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none"
              style={{
                background: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(6px)",
                borderRadius: "20px",
                padding: "4px 9px",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <Move size={10} className="text-white/40" />
              <span className="text-[9px] text-white/35 font-medium tracking-wide">
                Sürükle
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="px-5 pt-4 pb-4 space-y-3.5">
          {/* Zoom row */}
          <div className="flex items-center gap-3">
            {/* Minus */}
            <button
              onClick={() => handleZoom(Math.max(1, zoom - 0.25))}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#4a4c57] hover:text-white/70 transition-colors flex-shrink-0"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <ZoomOut size={15} />
            </button>

            {/* Slider */}
            <div className="flex-1 relative flex items-center">
              <input
                type="range"
                min="1"
                max="4"
                step="0.01"
                value={zoom}
                onChange={(e) => handleZoom(e.target.value)}
                className="w-full appearance-none cursor-pointer"
                style={{
                  height: "3px",
                  borderRadius: "999px",
                  outline: "none",
                  background: `linear-gradient(to right, #6366f1 ${fillPct}%, rgba(255,255,255,0.08) ${fillPct}%)`,
                  accentColor: "#6366f1",
                }}
              />
            </div>

            {/* Plus */}
            <button
              onClick={() => handleZoom(Math.min(4, zoom + 0.25))}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#4a4c57] hover:text-white/70 transition-colors flex-shrink-0"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <ZoomIn size={15} />
            </button>

            {/* Badge */}
            <div className="w-11 text-center flex-shrink-0">
              <span
                className="text-[11px] font-bold tabular-nums"
                style={{ color: zoom > 1 ? "#818cf8" : "#3d3f47" }}
              >
                {Math.round(fillPct)}%
              </span>
            </div>
            {/* Reset */}
            <button
              onClick={handleReset}
              className="flex items-center justify-center gap-1 px-4 py-2 rounded-xl text-[11px] font-bold text-[#ffffff] hover:text-[#ededed] transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center justify-between gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving || !imgLoaded}
            className="flex-1 py-2.5 px-4 rounded-xl text-[13px] font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            style={{
              background: isSaving
                ? "rgba(99,102,241,0.5)"
                : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              boxShadow: isSaving
                ? "none"
                : "0 4px 20px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.1)",
            }}
          >
            {isSaving ? (
              <span className="w-3.5 h-3.5 border-2 border-white/25 border-t-white rounded-full animate-spin" />
            ) : (
              <Check size={14} strokeWidth={2.5} />
            )}
            {isSaving ? "Kaydediliyor..." : "Uygula ve Kaydet"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
