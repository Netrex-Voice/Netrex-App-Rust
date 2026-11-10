import { createPortal } from "react-dom";
import { X, RotateCw, Maximize, Minus, Plus, Download } from "lucide-react";

export default function ImageOverlay({
  selectedImage,
  setSelectedImage,
  imgZoom,
  imgRotation,
  imgPosition,
  imgIsDragging,
  imgRef,
  handleImgMouseDown,
  handleImgMouseMove,
  handleImgMouseUp,
  handleImgZoomIn,
  handleImgZoomOut,
  handleImgRotate,
  handleImgReset
}) {
  if (!selectedImage) return null;

  const handleDownload = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(selectedImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Netrex_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-2xl flex items-center justify-center animate-in fade-in duration-300"
      onMouseMove={handleImgMouseMove}
      onMouseUp={handleImgMouseUp}
      onMouseLeave={handleImgMouseUp}
    >
      {/* Main Image Container */}
      <div 
        className={`relative w-full h-full flex items-center justify-center overflow-hidden ${
          imgIsDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={handleImgMouseDown}
      >
        <img
          ref={imgRef}
          src={selectedImage}
          alt="Full screen"
          className={`max-w-[90vw] max-h-[90vh] object-contain select-none shadow-[0_0_100px_rgba(0,0,0,0.5)] ${imgIsDragging ? 'transition-none' : 'transition-transform duration-200'}`}
          style={{ 
            transform: `translate(${imgPosition.x}px, ${imgPosition.y}px) rotate(${imgRotation}deg) scale(${imgZoom})`,
          }}
          draggable={false}
        />
      </div>

      {/* Header Controls */}
      <div className="absolute top-0 left-0 w-full p-6 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div className="flex flex-col gap-1">
          <h4 className="text-white/90 text-sm font-bold tracking-tight">Medya Görüntüleyici</h4>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em]">Netrex Core Engine</p>
        </div>
        <div className="flex items-center gap-3 pointer-events-auto">
          <button
            onClick={handleDownload}
            className="p-3 rounded-full bg-white/5 hover:bg-white/20 text-white/60 hover:text-white transition-all backdrop-blur-md border border-white/5"
            title="İndir"
          >
            <Download size={20} />
          </button>
          <button
            onClick={() => setSelectedImage(null)}
            className="p-3 rounded-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all backdrop-blur-md border border-red-500/20"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl animate-in slide-in-from-bottom-5 duration-500">
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/5">
          <button 
            onClick={handleImgZoomOut}
            className="p-2.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all"
            title="Uzaklaştır"
          >
            <Minus size={20} />
          </button>
          <div className="px-4 text-[13px] font-bold text-white/90 min-w-[70px] text-center font-mono">
            %{Math.round(imgZoom * 100)}
          </div>
          <button 
            onClick={handleImgZoomIn}
            className="p-2.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all"
            title="Yakınlaştır"
          >
            <Plus size={20} />
          </button>
        </div>
        
        <div className="w-[1px] h-8 bg-white/10 mx-1" />
        
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/5">
          <button 
            onClick={handleImgRotate}
            title="Döndür"
            className="p-2.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all"
          >
            <RotateCw size={20} />
          </button>
          <button 
            onClick={handleImgReset}
            title="Görünümü Sıfırla"
            className="p-2.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all"
          >
            <Maximize size={20} />
          </button>
        </div>
      </div>

      {/* Status Footer */}
      <div className="absolute bottom-6 px-10 w-full flex items-center justify-between pointer-events-none opacity-40">
        <div className="flex gap-6 text-[10px] text-white/50 font-bold uppercase tracking-[0.2em]">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] self-center" />
          <span>Secure Stream Protocol</span>
        </div>
        <div className="text-[10px] text-white font-bold uppercase tracking-widest">
          {imgRotation !== 0 && `${imgRotation}°`}
          {imgZoom !== 1 && (imgRotation !== 0 ? ` • ` : "") + `%${Math.round(imgZoom * 100)}`}
        </div>
      </div>
    </div>,
    document.body
  );
}
