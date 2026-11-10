import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWatchPartyStore } from '@/src/store/watchPartyStore';
import {
  Eye, EyeOff, X, EyeOff as EyeOffIcon,
  ChevronDown, Check
} from 'lucide-react';

const QUALITY_OPTIONS = [
  { value: 'auto', label: 'Otomatik (Önerilen)' },
  { value: 'highres', label: 'Maksimum (4K/2K)' },
  { value: 'hd1080', label: '1080p' },
  { value: 'hd720', label: '720p' },
  { value: 'large', label: '480p' },
  { value: 'medium', label: '360p' },
  { value: 'small', label: '240p' },
  { value: 'tiny', label: '144p' },
];

export function WatchPartyUserPrefs({ onClose, videoFS }) {
  const prefs         = useWatchPartyStore((s) => s.localPreferences);
  const currentTrack  = useWatchPartyStore((s) => s.currentTrack);
  const setLocalPref  = useWatchPartyStore((s) => s.setLocalPref);
  const toggleMute    = useWatchPartyStore((s) => s.toggleMute);
  const toggleVideo   = useWatchPartyStore((s) => s.toggleVideoMode);

  const [isQualityOpen, setIsQualityOpen] = useState(false);
  const qMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (qMenuRef.current && !qMenuRef.current.contains(e.target)) {
        setIsQualityOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentQuality = QUALITY_OPTIONS.find(o => o.value === (prefs.videoQuality || 'auto')) || QUALITY_OPTIONS[0];

  return (
    <motion.div
      initial={videoFS ? { opacity: 0, y: 10, scale: 0.95 } : { width: 0, opacity: 0 }}
      animate={videoFS ? { opacity: 1, y: 0, scale: 1 } : { width: 360, opacity: 1 }}
      exit={videoFS ? { opacity: 0, y: 10, scale: 0.95 } : { width: 0, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={videoFS
        ? "absolute bottom-36 right-12 w-[360px] h-[calc(100vh-200px)] flex flex-col bg-zinc-900/90 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-2xl z-[150] overflow-hidden"
        : "overflow-hidden bg-zinc-900/90 backdrop-blur-3xl border-r border-white/10 flex shrink-0 z-[150] h-[370px]"}
    >
      {/* ── ARKA PLAN EFEKTİ ── */}
      {currentTrack?.thumbnail && (
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none overflow-hidden">
          <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover blur-2xl scale-125" />
        </div>
      )}

      <div className={`relative z-10 ${videoFS ? "flex flex-col h-full" : "w-[360px] flex flex-col h-full"}`}>
        <div className="flex items-center justify-between px-5 py-4
                      border-b border-white/5 bg-white/5 shrink-0">
        <h3 className="text-sm font-bold text-white tracking-wide">Kişisel Ayarlar</h3>
        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition-all text-white/50 hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 min-h-0">

        {/* ═══ VİDEO MODU ═══ */}
        {currentTrack && (
          <div className="flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl transition-colors ${prefs.videoMode ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-white/40'}`}>
                {prefs.videoMode ? <Eye size={20} /> : <EyeOff size={20} />}
              </div>
              <div>
                <p className="text-sm text-white font-medium">Video Modu</p>
                <p className="text-xs text-white/40 mt-0.5">Videoyu player'da göster</p>
              </div>
            </div>
            <button onClick={toggleVideo}
              className={`w-12 h-6 rounded-full transition-all duration-300 relative
                ${prefs.videoMode ? 'bg-purple-500' : 'bg-white/10'}`}>
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all duration-300 shadow-md
                ${prefs.videoMode ? 'left-[26px]' : 'left-0.5'}`} />
            </button>
          </div>
        )}

        {/* ═══ VİDEO KALİTESİ ═══ */}
        {currentTrack && prefs.videoMode && (
          <div className="flex flex-col gap-3 pl-11 pb-2 animate-in fade-in zoom-in duration-300" ref={qMenuRef}>
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/50 font-medium">YouTube Kalitesi</p>
              
              <button
                onClick={() => setIsQualityOpen(!isQualityOpen)}
                className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white/90 text-xs rounded-xl px-3 py-2 outline-none transition-colors"
              >
                <span className="truncate max-w-[120px] font-medium">{currentQuality?.label}</span>
                <ChevronDown size={14} className={`text-white/50 transition-transform duration-300 ${isQualityOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <AnimatePresence>
              {isQualityOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="relative w-full bg-white/5 border border-white/10 rounded-2xl overflow-hidden py-1"
                >
                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                    {QUALITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setLocalPref('videoQuality', opt.value);
                          setIsQualityOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-left text-xs hover:bg-white/10 transition-colors"
                      >
                        <span className={opt.value === prefs.videoQuality || (opt.value === 'auto' && !prefs.videoQuality) ? 'text-emerald-400 font-bold' : 'text-white/70'}>
                          {opt.label}
                        </span>
                        {(opt.value === prefs.videoQuality || (opt.value === 'auto' && !prefs.videoQuality)) && (
                          <Check size={14} className="text-emerald-400" />
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
      </div>
    </motion.div>
  );
}
