// src/components/watch-party/WatchPartyControls.jsx
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWatchPartyStore } from '@/src/store/watchPartyStore';
import {
  ListMusic, Monitor, MonitorOff,
  Volume2, VolumeX, Maximize, Minimize, Settings,
  Play, Pause, SkipForward, SkipBack
} from 'lucide-react';

export function WatchPartyControls({
  videoFS, hasVideo, onTogglePlaylist, onTogglePrefs, activePanel,
  onPlayPause, onSkipNext, onSkipPrev, isPlaying, permissions
}) {
  const [volumeOpen, setVolumeOpen] = useState(false);
  const volumeRef = useRef(null);

  const videoMode  = useWatchPartyStore((s) => s.localPreferences.videoMode);
  const prefs      = useWatchPartyStore((s) => s.localPreferences);
  const setLocalPref = useWatchPartyStore((s) => s.setLocalPref);
  const toggleVideo  = useWatchPartyStore((s) => s.toggleVideoMode);

  // Dışarı tıklanınca kapat
  useEffect(() => {
    if (!volumeOpen) return;
    const h = (e) => {
      if (volumeRef.current && !volumeRef.current.contains(e.target))
        setVolumeOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [volumeOpen]);

  const isMuted      = prefs.isMuted || prefs.volume === 0;
  const displayVolume = isMuted ? 0 : prefs.volume;

  const toggleMute = () => {
    if (prefs.isMuted) {
      setLocalPref('isMuted', false);
      if (prefs.volume === 0) setLocalPref('volume', 60);
    } else {
      setLocalPref('isMuted', true);
    }
  };

  const handleVolume = (e) => {
    const val = parseInt(e.target.value);
    setLocalPref('volume', val);
    setLocalPref('isMuted', val === 0);
  };

  const toggleFS = () => useWatchPartyStore.getState().toggleFullscreen();

  const iconSize = videoFS ? 20 : 16;
  const base  = "p-2 rounded-xl transition-all duration-150 hover:bg-white/10 active:scale-90 text-white/60 hover:text-white";
  const active = "p-2 rounded-xl transition-all duration-150 bg-white/10 text-emerald-400";

  return (
    <div className="flex items-center justify-between w-full">
      
      {/* ─── SOL TARAF: Medya Kontrolleri ─── */}
      <div className="flex items-center gap-1">
        {hasVideo && permissions?.canControl && (
          <>
            <button onClick={onSkipPrev} className={base} title="Önceki Parça">
              <SkipBack size={iconSize} />
            </button>
            
            <button onClick={onPlayPause} className={`p-2 rounded-xl transition-all duration-150 ${isPlaying ? 'bg-white/10 text-white' : 'bg-emerald-500/20 text-emerald-400'} hover:bg-emerald-500/30 active:scale-90`} title={isPlaying ? "Durdur" : "Başlat"}>
              {isPlaying ? <Pause size={iconSize} /> : <Play size={iconSize} className="ml-0.5" />}
            </button>

            <button onClick={onSkipNext} className={base} title="Sonraki Parça">
              <SkipForward size={iconSize} />
            </button>
          </>
        )}
      </div>

      {/* ─── SAĞ TARAF: Ayarlar, Liste, Ses ─── */}
      <div className="flex items-center gap-1">
        {/* Çalma listesi */}
        <button
          onClick={onTogglePlaylist}
          className={activePanel === 'playlist' ? active : base}
          title="Çalma Listesi"
        >
          <ListMusic size={iconSize} />
        </button>

        {/* Ayarlar */}
        {hasVideo && (
          <button
            onClick={onTogglePrefs}
            className={activePanel === 'prefs' ? active : base}
            title="Ayarlar"
          >
            <Settings size={iconSize} />
          </button>
        )}

        {/* Fullscreen */}
        {(hasVideo || videoFS) && (
          <button onClick={toggleFS} className={base} title={videoFS ? "Küçült" : "Tam Ekran"}>
            {videoFS ? <Minimize size={iconSize} /> : <Maximize size={iconSize} />}
          </button>
        )}
      <div className="relative" ref={volumeRef}>
        <button
          onClick={() => setVolumeOpen((v) => !v)}
          className={volumeOpen ? active : base}
          title="Ses"
        >
          {isMuted
            ? <VolumeX size={iconSize} className="text-red-400" />
            : <Volume2 size={iconSize} />
          }
        </button>

        <AnimatePresence>
          {volumeOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              // ✅ Yukarı doğru açılan panel, sabit genişlik
              className="absolute bottom-full right-0 mb-2 z-[300]
                         w-40 bg-zinc-900/95 backdrop-blur-xl rounded-2xl
                         border border-white/10 shadow-2xl p-4 flex flex-col gap-3"
            >
              {/* Yatay slider - pozisyon sorunu yok */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/40 font-medium">Ses</span>
                  <span className="text-[11px] text-white/60 font-bold tabular-nums">
                    {displayVolume}%
                  </span>
                </div>
                <div className="relative h-5 flex items-center group/vol">
                  <input
                    type="range" min={0} max={100}
                    value={displayVolume}
                    onChange={handleVolume}
                    className="w-full h-1.5 appearance-none rounded-full cursor-pointer focus:outline-none transition-all [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,0,0,0.5)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-200 hover:[&::-webkit-slider-thumb]:scale-125 active:[&::-webkit-slider-thumb]:scale-110"
                    style={{
                      background: `linear-gradient(to right, #34d399 ${displayVolume}%, rgba(255,255,255,0.1) ${displayVolume}%)`
                    }}
                  />
                </div>
              </div>

              {/* Mute butonu */}
              <button
                onClick={toggleMute}
                className={`w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl
                  text-xs font-medium transition-all
                  ${isMuted
                    ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
              >
                {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                {isMuted ? "Sesi Aç" : "Sustur"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </div>
    </div>
  )
  
  
  
  
}