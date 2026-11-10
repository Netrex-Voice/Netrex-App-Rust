"use client";
import React, { Suspense, useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  ExternalLink, 
  Download, 
  Image as ImageIcon, 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Maximize,
  RefreshCw,
  Minus,
  Plus
} from 'lucide-react';

function ImageViewerContent() {
  const searchParams = useSearchParams();
  const imageUrl = searchParams.get('url');

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const imgRef = useRef(null);

  if (!imageUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/50 font-medium">
        Geçerli bir resim URL'si belirtilmedi.
      </div>
    );
  }

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `netrex-media-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      window.open(imageUrl, '_blank');
    }
  };

  const handleMouseDown = (e) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && zoom > 1) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      
      const limitX = window.innerWidth * 0.8;
      const limitY = window.innerHeight * 0.8;

      setPosition({
        x: Math.max(Math.min(newX, limitX), -limitX),
        y: Math.max(Math.min(newY, limitY), -limitY)
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) handleZoomIn();
        else handleZoomOut();
      } else {
        // Pan with wheel
        setPosition(prev => {
          const newX = prev.x - e.deltaX;
          const newY = prev.y - e.deltaY;
          const limitX = window.innerWidth * 0.8;
          const limitY = window.innerHeight * 0.8;
          
          return {
            x: Math.max(Math.min(newX, limitX), -limitX),
            y: Math.max(Math.min(newY, limitY), -limitY)
          };
        });
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div 
      className="min-h-screen bg-[#0f0f11] flex flex-col relative overflow-hidden select-none animate-page-enter"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Background Decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full animate-float-slow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full animate-float" />
      
      {/* Header */}
      <header className="relative z-50 p-6 flex items-center justify-between border-b border-white/5 backdrop-blur-md bg-black/20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-lg overflow-hidden group/logo transition-all hover:border-indigo-500/50">
            <img src="/logo.png" alt="Netrex" className="w-7 h-7 object-contain group-hover/logo:scale-110 transition-transform duration-300" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Netrex Görüntüleyici</h1>
            <p className="text-xs text-white/40 font-medium uppercase tracking-widest leading-none mt-1">Premium Media Experience</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleDownload}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white px-4 py-2.5 rounded-xl border border-white/5 transition-all duration-300 hover:scale-105 active:scale-95"
          >
            <Download size={18} />
            <span className="text-sm font-semibold">İndir</span>
          </button>
          
          <a 
            href={imageUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 gradient-primary hover:shadow-glow text-white px-6 py-2.5 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg group"
          >
            <ExternalLink size={18} className="group-hover:rotate-45 transition-transform" />
            <span className="text-sm font-semibold">Orjinali Aç</span>
          </a>
        </div>
      </header>

      {/* Image Container */}
      <main className="flex-1 relative flex items-center justify-center p-8 z-10 overflow-hidden">
        <div 
          className={`relative transition-transform duration-200 ease-out ${zoom > 1 ? 'cursor-move' : 'cursor-default'}`}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
          }}
          onMouseDown={handleMouseDown}
        >
          {/* Image Glow */}
          <div className="absolute inset-0 bg-indigo-500/20 blur-[100px] opacity-50 pointer-events-none" />
          
          <div className="relative glass-card p-1.5 rounded-2xl shadow-2xl animate-scaleIn">
            <img 
              ref={imgRef}
              src={imageUrl} 
              alt="Netrex Media" 
              className="max-w-full max-h-[70vh] object-contain rounded-lg select-none shadow-inner pointer-events-none"
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
        </div>

        {/* Floating Controls */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50">
          <div className="glass-modal px-6 py-3 rounded-2xl flex items-center gap-6 shadow-2xl border border-white/10">
            <div className="flex items-center gap-2">
              <button 
                onClick={handleZoomOut}
                className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all disabled:opacity-20"
                disabled={zoom <= 0.5}
              >
                <Minus size={20} />
              </button>
              <span className="min-w-[4rem] text-center text-sm font-bold text-white/80 tabular-nums">
                %{Math.round(zoom * 100)}
              </span>
              <button 
                onClick={handleZoomIn}
                className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all disabled:opacity-20"
                disabled={zoom >= 5}
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="w-px h-6 bg-white/10" />

            <div className="flex items-center gap-2">
              <button 
                onClick={handleRotate}
                title="Döndür"
                className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all"
              >
                <RotateCw size={20} />
              </button>
              <button 
                onClick={handleReset}
                title="Sıfırla"
                className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all"
              >
                <RefreshCw size={20} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer / Status */}
      <footer className="relative z-10 px-8 py-4 flex items-center justify-between border-t border-white/5 backdrop-blur-md bg-black/10">
        <div className="flex gap-6 text-[10px] text-white/20 font-bold uppercase tracking-[0.2em]">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] self-center" />
          <span>Secure Stream Protocol</span>
        </div>
        <div className="text-[10px] text-white/40 font-medium">
          {rotation !== 0 && `${rotation}° Döndürüldü`}
          {zoom !== 1 && ` • %${Math.round(zoom * 100)} Yakınlaştırma`}
        </div>
      </footer>
    </div>
  );
}

export default function ImageViewer() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f0f11] flex items-center justify-center text-white/20 font-bold uppercase tracking-widest">Netrex Yükleniyor...</div>}>
      <ImageViewerContent />
    </Suspense>
  );
}
