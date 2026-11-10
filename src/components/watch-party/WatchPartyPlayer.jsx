'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import ReactPlayer from 'react-player';
import { toast } from 'sonner';
import { motion, AnimatePresence, useDragControls, useMotionValue, animate } from 'framer-motion';
import { useMaybeRoomContext } from '@livekit/components-react';
import { useWatchPartyStore } from '@/src/store/watchPartyStore';
import { useWatchPartySync } from '@/src/hooks/useWatchPartySync';
import { useWatchPartyDrift } from '@/src/hooks/useWatchPartyDrift';
import { useWatchPartyPermission } from '@/src/hooks/useWatchPartyPermission';
import { WatchPartyControls } from './WatchPartyControls';
import { WatchPartyPlaylist } from './WatchPartyPlaylist';
import { WatchPartyUserPrefs } from './WatchPartyUserPrefs';
import { endWatchParty } from '@/src/services/watchPartyService';
import { formatTime } from '@/src/utils/formatTime';
import { Minimize, Maximize, X, Music, MonitorPlay, GripHorizontal, Minus, Square, Play, Pause, Volume2, VolumeX, Forward, Rewind } from 'lucide-react';

function getYouTubeId(url) {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([^&?\s#\/]+)/
  );
  return match?.[1] || null;
}

// ═══════════════════════════════════════════════════════════
// SOUNDCLOUD PLAYER - postMessage API
// ═══════════════════════════════════════════════════════════
function SoundCloudPlayer({
  trackUrl,
  shouldPlay,
  effectiveVolume,
  videoMode,
  videoFS,
  playerApiRef,
  onDuration,
  onProgress,
  onEnded,
  onReady,
}) {
  const iframeRef = useRef(null);
  const isReadyRef = useRef(false);
  const durationRef = useRef(0);
  const currentTimeRef = useRef(0);
  const shouldPlayRef = useRef(shouldPlay);
  shouldPlayRef.current = shouldPlay;

  const post = useCallback((method, value) => {
    try {
      const msg = value !== undefined ? { method, value } : { method };
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify(msg), '*');
    } catch {}
  }, []);

  const volumeRef = useRef(effectiveVolume);
  useEffect(() => { volumeRef.current = effectiveVolume; }, [effectiveVolume]);

  const handleIframeLoad = useCallback(() => {
    setTimeout(() => {
      post('addEventListener', 'ready');
      post('addEventListener', 'playProgress');
      post('addEventListener', 'play');
      post('addEventListener', 'pause');
      post('addEventListener', 'finish');
      post('getDuration');
    }, 800);
  }, [post]);

  useEffect(() => {
    const handler = (event) => {
      if (!event.origin?.includes('soundcloud.com')) return;
      let data;
      try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
      if (!data?.method) return;

      switch (data.method) {
        case 'ready':
          isReadyRef.current = true;
          post('addEventListener', 'playProgress');
          post('addEventListener', 'finish');
          post('getDuration');
          post('setVolume', effectiveVolume * 100);
          playerApiRef.current = {
            seekTo: (secs) => post('seekTo', secs * 1000),
            getCurrentTime: () => currentTimeRef.current,
            getDuration: () => durationRef.current,
          };
          if (shouldPlayRef.current) setTimeout(() => post('play'), 500);
          onReady();
          break;
        case 'getDuration':
          if (data.value && data.value > 0) {
            const dur = data.value / 1000;
            durationRef.current = dur;
            onDuration(dur);
          }
          break;
        case 'playProgress':
          if (data.value) {
            const currentMs = data.value.currentPosition || 0;
            const relative  = data.value.relativePosition || 0;
            const current   = currentMs / 1000;
            currentTimeRef.current = current;
            onProgress({ played: relative, playedSeconds: current });
            if (durationRef.current === 0 && relative > 0 && current > 0) {
              const estimated = current / relative;
              durationRef.current = estimated;
              onDuration(estimated);
            }
          }
          break;
        case 'finish':
          onEnded();
          break;
        case 'play':
          if (durationRef.current === 0) post('getDuration');
          post('setVolume', volumeRef.current * 100);
          break;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [post, playerApiRef, onReady, onProgress, onDuration, onEnded]);

  useEffect(() => { if (!isReadyRef.current) return; post(shouldPlay ? 'play' : 'pause'); }, [shouldPlay, post]);
  useEffect(() => { if (!isReadyRef.current) return; post('setVolume', effectiveVolume * 100); }, [effectiveVolume, post]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (durationRef.current > 0) { clearInterval(timer); return; }
      if (isReadyRef.current) post('getDuration');
    }, 2000);
    return () => clearInterval(timer);
  }, [post]);

  const cleanUrl = trackUrl.split('?')[0];
  const src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(cleanUrl)}&color=%2350c878&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=${videoFS ? 'true' : 'false'}`;

  return (
    <iframe
      ref={iframeRef} src={src} onLoad={handleIframeLoad}
      width="100%" height={videoFS ? '100%' : videoMode ? 220 : 166}
      scrolling="no" frameBorder="no" allow="autoplay"
      className={videoFS ? 'absolute inset-0 w-full h-full z-0' : ''}
      style={videoFS ? { height: '100%' } : videoMode ? {} : { height: 1, opacity: 0, pointerEvents: 'none', position: 'absolute' }}
    />
  );
}


// ═══════════════════════════════════════════════════════════
// YouTube Wrapper Component
// ═══════════════════════════════════════════════════════════
function YouTubePlayer({
  videoId, shouldPlay, effectiveVolume, videoMode, videoFS, ytQuality,
  onReady, onStateChange, onError,
  playerApiRef, ytPlayerRef,
}) {
  const wrapperRef = useRef(null);
  const targetRef = useRef(null);
  const [apiLoaded, setApiLoaded] = useState(!!window.YT?.Player);
  const currentVideoIdRef = useRef(null);
  const isReadyRef = useRef(false);
  const volumeRef = useRef(effectiveVolume);

  useEffect(() => { volumeRef.current = effectiveVolume; }, [effectiveVolume]);

  useEffect(() => {
    if (window.YT?.Player) { setApiLoaded(true); return; }
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
    const checker = setInterval(() => {
      if (window.YT?.Player) { setApiLoaded(true); clearInterval(checker); }
    }, 300);
    return () => clearInterval(checker);
  }, []);

  useEffect(() => {
    if (!apiLoaded || !videoId || !wrapperRef.current) return;
    if (currentVideoIdRef.current === videoId && isReadyRef.current) return;

    if (ytPlayerRef.current && isReadyRef.current) {
      currentVideoIdRef.current = videoId;
      try { ytPlayerRef.current.loadVideoById({ videoId, startSeconds: 0 }); } catch {}
      return;
    }

    if (targetRef.current) {
      try { wrapperRef.current.removeChild(targetRef.current); } catch {}
    }

    const target = document.createElement('div');
    target.id = `yt-target-${Date.now()}`;
    wrapperRef.current.appendChild(target);
    targetRef.current = target;
    currentVideoIdRef.current = videoId;
    isReadyRef.current = false;

    try {
      const isFileProtocol = window.location.protocol.includes('file') || window.location.protocol.includes('app');
      const playerVars = {
        autoplay: 0, controls: 0, modestbranding: 1, rel: 0,
        playsinline: 1, iv_load_policy: 3, enablejsapi: 1,
        vq: ytQuality || 'auto',
      };
      if (!isFileProtocol) playerVars.origin = window.location.origin;

      ytPlayerRef.current = new window.YT.Player(target, {
        videoId, width: '100%', height: '100%',
        playerVars,
        events: {
          onReady: (event) => {
            isReadyRef.current = true;
            try {
              const iframe = event.target.getIframe();
              if (iframe) {
                iframe.style.width = '100%'; iframe.style.height = '100%'; iframe.style.border = 'none';
                iframe.setAttribute('allow', 'autoplay; encrypted-media; accelerometer; gyroscope; picture-in-picture; clipboard-write');
                iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
              }
              const vol = Math.round(volumeRef.current * 100);
              event.target.setVolume(vol);
              if (vol === 0) event.target.mute(); else event.target.unMute();
            } catch {}
            onReady(event);
          },
          onStateChange: (event) => {
            if (event.data === window.YT?.PlayerState?.PLAYING) {
              const vol = Math.round(volumeRef.current * 100);
              event.target.setVolume(vol);
              if (vol === 0) event.target.mute(); else event.target.unMute();
            }
            onStateChange(event);
          },
          onError: (event) => onError(event),
        },
      });
    } catch (e) { console.error('[WatchParty] YT create error:', e); }
  }, [apiLoaded, videoId]);

  useEffect(() => {
    if (!isReadyRef.current || !ytPlayerRef.current) return;
    try { if (shouldPlay) ytPlayerRef.current.playVideo(); else ytPlayerRef.current.pauseVideo(); } catch {}
  }, [shouldPlay, ytPlayerRef]);

  useEffect(() => {
    if (!isReadyRef.current || !ytPlayerRef.current) return;
    try {
      const vol = Math.round(effectiveVolume * 100);
      ytPlayerRef.current.setVolume(vol);
      if (vol === 0) ytPlayerRef.current.mute(); else ytPlayerRef.current.unMute();
    } catch {}
  }, [effectiveVolume, ytPlayerRef]);

  useEffect(() => {
    if (!isReadyRef.current || !ytPlayerRef.current) return;
    try { ytPlayerRef.current.setPlaybackQuality(ytQuality || 'auto'); } catch {}
  }, [ytQuality, ytPlayerRef]);

  useEffect(() => {
    return () => {
      isReadyRef.current = false;
      currentVideoIdRef.current = null;
      try { ytPlayerRef.current?.destroy(); } catch {}
      ytPlayerRef.current = null;
    };
  }, [ytPlayerRef]);

  return (
    <div 
      ref={wrapperRef} 
      className={`w-full bg-black pointer-events-none select-none ${videoFS ? 'absolute inset-0 h-full z-0' : ''}`} 
      style={videoFS ? { height: '100%' } : { height: 220 }} 
    />
  );
}

// ═══════════════════════════════════════════════════════════
// GENEL OYNATICI (Vimeo, doğrudan ses/video dosyası, HLS, DASH, Wistia, Mux)
// react-player v3: ref doğrudan <video>/<audio> benzeri öğedir (currentTime, duration...); v2'deki
// getCurrentTime/seekTo/onProgress YOKTUR. Burada v3 olayları, senkron kodunun beklediği adaptöre çevrilir.
// ═══════════════════════════════════════════════════════════
function GenericPlayer({
  src,
  shouldPlay,
  effectiveVolume,
  playerApiRef,
  onReady,
  onProgress,
  onDuration,
  onEnded,
  onError,
  onBuffering,
}) {
  const elRef = useRef(null);

  const attachRef = useCallback((el) => {
    elRef.current = el;
    if (!el) return;
    playerApiRef.current = {
      seekTo: (s) => { try { el.currentTime = Math.max(0, s); } catch {} },
      getCurrentTime: () => { try { return el.currentTime || 0; } catch { return 0; } },
      getDuration: () => { try { const d = el.duration; return Number.isFinite(d) ? d : 0; } catch { return 0; } },
      __generic: el,
    };
  }, [playerApiRef]);

  // Parça değişince/oynatıcı sökülünce eski adaptör kalmasın (başka oynatıcı kendi adaptörünü kurar)
  useEffect(() => () => {
    if (playerApiRef.current?.__generic) playerApiRef.current = null;
  }, [playerApiRef]);

  const reportDuration = useCallback((e) => {
    const el = e?.currentTarget || elRef.current;
    const d = el?.duration;
    if (Number.isFinite(d) && d > 0) onDuration(d);
  }, [onDuration]);

  // react-player v3'ün onReady'si `loadstart`ta (süre/konum henüz bilinmezken) tetiklenir; erken seek yok sayılabilir.
  // Başlangıç senkronu için meta veri yüklenince (süre biliniyor, seek güvenli) bir kez "hazır" deriz.
  const readyFiredRef = useRef(false);
  const handleMetadata = useCallback((e) => {
    reportDuration(e);
    if (!readyFiredRef.current) {
      readyFiredRef.current = true;
      onReady();
    }
  }, [reportDuration, onReady]);

  const reportTime = useCallback((e) => {
    const el = e?.currentTarget || elRef.current;
    if (!el) return;
    const t = el.currentTime || 0;
    const d = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0;
    onProgress({ played: d > 0 ? t / d : 0, playedSeconds: t });
  }, [onProgress]);

  return (
    <ReactPlayer
      ref={attachRef}
      src={src}
      playing={shouldPlay}
      volume={effectiveVolume}
      muted={effectiveVolume === 0}
      controls={false}
      playsInline
      width="100%"
      height="100%"
      style={{ width: '100%', height: '100%' }}
      onLoadedMetadata={handleMetadata}
      onDurationChange={reportDuration}
      onTimeUpdate={reportTime}
      onEnded={onEnded}
      onError={onError}
      onWaiting={() => onBuffering(true)}
      onPlaying={() => onBuffering(false)}
      onCanPlay={() => onBuffering(false)}
    />
  );
}

// ═══════════════════════════════════════════════════════════
// ANA PLAYER
// ═══════════════════════════════════════════════════════════
export function WatchPartyPlayer({ serverId, channelId }) {
  const room = useMaybeRoomContext();
  const playerRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const seekingRef = useRef(false);

  const [progress, setProgress] = useState({ played: 0, playedSeconds: 0 });
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const bufferingTimeoutRef = useRef(null);
  const [activePanel, setActivePanel] = useState(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [isMouseIdle, setIsMouseIdle] = useState(false);
  const idleTimeoutRef = useRef(null);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef(null);

  const [osd, setOsd] = useState({ icon: null, text: '', show: false, id: 0 });
  const showOSD = useCallback((icon, text = '') => {
    setOsd({ icon, text, show: true, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!osd.show) return;
    const t = setTimeout(() => setOsd(s => ({ ...s, show: false })), 600);
    return () => clearTimeout(t);
  }, [osd.id, osd.show]);

  const [winSize, setWinSize] = useState({ 
    w: typeof window !== "undefined" ? window.innerWidth : 1920, 
    h: typeof window !== "undefined" ? window.innerHeight : 1080 
  });
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const clampPos = (w, h) => {
      const widthMod = activePanel === 'playlist' ? 400 : activePanel === 'prefs' ? 360 : 0;
      const minX = -w + (380 + widthMod) + 48;
      const minY = -h + 500;
      
      const curX = dragX.get();
      const curY = dragY.get();

      if (curX < minX) animate(dragX, minX, { type: 'spring', damping: 25, stiffness: 300 });
      else if (curX > 0) animate(dragX, 0, { type: 'spring', damping: 25, stiffness: 300 });

      if (curY < minY) animate(dragY, minY, { type: 'spring', damping: 25, stiffness: 300 });
      else if (curY > 0) animate(dragY, 0, { type: 'spring', damping: 25, stiffness: 300 });
    };

    clampPos(window.innerWidth, window.innerHeight);

    const handleResize = () => {
      setWinSize({ w: window.innerWidth, h: window.innerHeight });
      clampPos(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activePanel, dragX, dragY]);


  const handleTogglePanel = useCallback((panel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }, []);

  const currentTrack = useWatchPartyStore((s) => s.currentTrack);
  const dragControls = useDragControls();
  const isPlaying    = useWatchPartyStore((s) => s.playbackState.isPlaying);
  const startedAt    = useWatchPartyStore((s) => s.playbackState.startedAt);
  const isMuted      = useWatchPartyStore((s) => s.localPreferences.isMuted);
  const localVolume  = useWatchPartyStore((s) => s.localPreferences.volume);
  const videoMode    = useWatchPartyStore((s) => s.localPreferences.videoMode);
  const videoFS      = useWatchPartyStore((s) => s.localPreferences.videoFullscreen);
  const showPlayer   = useWatchPartyStore((s) => s.localPreferences.showPlayer);
  const ytQuality    = useWatchPartyStore((s) => s.localPreferences.videoQuality) || 'auto';
  const playlist     = useWatchPartyStore((s) => s.playlist);
  const toggleFS     = useWatchPartyStore((s) => s.toggleFullscreen);
  const toggleVideo  = useWatchPartyStore((s) => s.toggleVideoMode);
  const setLocalPref = useWatchPartyStore((s) => s.setLocalPref);

  useEffect(() => {
    if (videoFS) {
      animate(dragX, 0, { type: 'spring', damping: 25, stiffness: 300 });
      animate(dragY, 0, { type: 'spring', damping: 25, stiffness: 300 });
    }
  }, [videoFS, dragX, dragY]);

  // Videoların mastering (desibel) limiti yüksek olduğu için maksimum sesi arka planda yarı yarıya tırpanlıyoruz.
  const effectiveVolume = (isMuted) ? 0 : ((localVolume / 100) * 0.5);
  const shouldPlay = isPlaying;

  const videoId = useMemo(() => getYouTubeId(currentTrack?.url), [currentTrack?.url]);
  const isYouTube = !!videoId;
  const isSoundCloud = !!currentTrack?.url?.includes('soundcloud.com/');
  const isGeneric = !isYouTube && !isSoundCloud && !!currentTrack?.url;

  const permissions = useWatchPartyPermission(serverId);

  const handleConfirmClose = () => {
    if (permissions?.canManageTracks) {
      endWatchParty(serverId, channelId);
    } else {
      useWatchPartyStore.getState().resetWatchParty();
    }
    setShowCloseModal(false);
  };
  const { hostPlay, hostPause, hostSeek, hostSkip, autoAdvance } =
    useWatchPartySync(room, playerRef, serverId, channelId);
  useWatchPartyDrift(playerRef);

  // ─── SENKRONİZASYON (REAKTİF) ───
  const pbState = useWatchPartyStore((s) => s.playbackState);
  const lastSyncRef = useRef(null);

  useEffect(() => {
    // Uzak state'den gelen lastUpdated değiştiyse veya isPlaying değiştiyse senkron ol
    if (!pbState.lastUpdated || !playerRef.current) return;
    
    // Zaten bu pulse'u işlediysek veya çok yakınsa skip? 
    // Hayır, her lastUpdated aslında host'un bir aksiyonudur.
    if (pbState.lastUpdated === lastSyncRef.current) return;
    lastSyncRef.current = pbState.lastUpdated;

    const performSync = () => {
      let jumpTo = 0;
      if (pbState.isPlaying && pbState.receivedAt) {
        // 🔥 FIX: (Şu an - Verinin Ulaştığı An) + Kayıtlı Pozisyon
        const elapsedSinceSync = (Date.now() - pbState.receivedAt) / 1000;
        jumpTo = (pbState.seekPosition || 0) + elapsedSinceSync;
      } else {
        jumpTo = pbState.seekPosition || 0;
      }

      // 0'ın altı ise 0 yap
      jumpTo = Math.max(0, jumpTo);

      const actual = playerRef.current.getCurrentTime ? playerRef.current.getCurrentTime() : 0;
      
      // Eğer ciddi bir fark varsa (1.2 saniyeden fazla) zıpla
      if (Math.abs(jumpTo - actual) > 1.2) {
        console.log(`[WatchParty] Sync Pulse: Jumping to ${jumpTo.toFixed(1)}s (was at ${actual.toFixed(1)}s)`);
        try { playerRef.current.seekTo(jumpTo, 'seconds'); } catch {}
      }
    };

    // Player hazır ise hemen yap, değilse 500ms sonra bir kez daha dene (fallback)
    performSync();
    const t = setTimeout(performSync, 800);
    return () => clearTimeout(t);
  }, [pbState.lastUpdated, pbState.isPlaying, pbState.startedAt, pbState.seekPosition]);


  // ═══ YouTube Callbacks ═══
  const handleYTReady = useCallback(() => {
    setBuffering(false);
    playerRef.current = {
      seekTo: (s) => { try { ytPlayerRef.current?.seekTo(s, true); } catch {} },
      getCurrentTime: () => { try { return ytPlayerRef.current?.getCurrentTime() || 0; } catch { return 0; } },
      getDuration: () => { try { return ytPlayerRef.current?.getDuration() || 0; } catch { return 0; } },
    };
    try { const d = ytPlayerRef.current?.getDuration(); if (d > 0) setDuration(d); } catch {}

    const store = useWatchPartyStore.getState();
    const pb = store.playbackState;
    
    // Initial Sync
    let jumpTo = 0;
    if (pb.isPlaying && pb.receivedAt) {
      const elapsedSinceSync = (Date.now() - pb.receivedAt) / 1000;
      jumpTo = (pb.seekPosition || 0) + elapsedSinceSync;
    } else {
      jumpTo = pb.seekPosition || 0;
    }

    if (jumpTo > 0) {
      try { ytPlayerRef.current?.seekTo(jumpTo, true); } catch {}
    }

    if (pb.isPlaying) {
      try { ytPlayerRef.current?.playVideo(); } catch {}
    } else {
      try { ytPlayerRef.current?.pauseVideo(); } catch {}
    }
  }, []);

  const handleYTState = useCallback((event) => {
    const s = event.data;
    if (s === window.YT?.PlayerState?.ENDED && permissions.canControl) autoAdvance();
    
    if (s === window.YT?.PlayerState?.BUFFERING) {
      if (bufferingTimeoutRef.current) clearTimeout(bufferingTimeoutRef.current);
      bufferingTimeoutRef.current = setTimeout(() => setBuffering(true), 300);
    }
    
    if (s === window.YT?.PlayerState?.PLAYING || s === window.YT?.PlayerState?.PAUSED) {
      if (bufferingTimeoutRef.current) clearTimeout(bufferingTimeoutRef.current);
      setBuffering(false);
    }

    if (s === window.YT?.PlayerState?.PLAYING) {
      try { const d = ytPlayerRef.current?.getDuration(); if (d > 0 && duration === 0) setDuration(d); } catch {}
    }
  }, [permissions.canControl, autoAdvance, duration]);

  useEffect(() => {
    if (!isYouTube) return;
    const timer = setInterval(() => {
      try {
        if (!ytPlayerRef.current?.getCurrentTime) return;
        const t = ytPlayerRef.current.getCurrentTime() || 0;
        const d = ytPlayerRef.current.getDuration() || 0;
        if (d > 0 && duration === 0) setDuration(d);
        if (!seekingRef.current) setProgress({ played: d > 0 ? t / d : 0, playedSeconds: t });
      } catch {}
    }, 500);
    return () => clearInterval(timer);
  }, [isYouTube, duration]);

  // ═══ SoundCloud Callbacks ═══
  const handleSCReady = useCallback(() => {
    setBuffering(false);
    const store = useWatchPartyStore.getState();
    const pb = store.playbackState;
    
    let jumpTo = 0;
    if (pb.isPlaying && pb.receivedAt) {
      const elapsedSinceSync = (Date.now() - pb.receivedAt) / 1000;
      jumpTo = (pb.seekPosition || 0) + elapsedSinceSync;
    } else {
      jumpTo = pb.seekPosition || 0;
    }

    if (jumpTo > 0) {
      setTimeout(() => { try { playerRef.current?.seekTo(jumpTo); } catch {} }, 400);
    }
  }, []);

  const handleSCDuration = useCallback((dur) => { if (dur > 0) setDuration(dur); }, []);
  const handleSCProgress = useCallback((state) => { if (!seekingRef.current) setProgress(state); }, []);
  const handleSCEnded = useCallback(() => { if (permissions.canControl) autoAdvance(); }, [permissions.canControl, autoAdvance]);

  // ═══ Track Reset ═══
  const prevTrackRef = useRef(null);
  useEffect(() => {
    const url = currentTrack?.url;
    if (!url || url === prevTrackRef.current) return;
    prevTrackRef.current = url;
    setBuffering(true);
    setProgress({ played: 0, playedSeconds: 0 });
    setDuration(0);
    setLocalPref('videoMode', true);
  }, [currentTrack?.url, setLocalPref]);

  useEffect(() => {
    // Empty track no longer collapses video panel.
  }, [currentTrack]);

  // ═══ Generic ReactPlayer ═══
  const handleRPReady = useCallback(() => {
    setBuffering(false);
    const store = useWatchPartyStore.getState();
    const pb = store.playbackState;
    
    const d = playerRef.current?.getDuration?.();
    if (d && d > 0) setDuration(d);

    let jumpTo = 0;
    if (pb.isPlaying && pb.receivedAt) {
      const elapsedSinceSync = (Date.now() - pb.receivedAt) / 1000;
      jumpTo = (pb.seekPosition || 0) + elapsedSinceSync;
    } else {
      jumpTo = pb.seekPosition || 0;
    }

    if (jumpTo > 0) {
      playerRef.current?.seekTo?.(Math.max(0, jumpTo), 'seconds');
    }
  }, []);

  const handleRPProgress = useCallback((state) => {
    if (!seekingRef.current) setProgress(state);
    if (duration === 0 && playerRef.current?.getDuration) {
      const d = playerRef.current.getDuration();
      if (d && d > 0 && isFinite(d)) setDuration(d);
    }
  }, [duration]);

  const handleRPEnded = useCallback(() => { if (permissions.canControl) autoAdvance(); }, [permissions.canControl, autoAdvance]);
  const handleRPError = useCallback((error) => {
    setBuffering(false);
    if (!error) return;
    const msg = error?.message || String(error) || '';
    if (msg.includes('AbortError') || msg.includes('interrupted')) return;
    console.warn('[WatchParty] ReactPlayer error:', error);
    toast.error('Bu bağlantı oynatılamadı. Site dışarıdan oynatmaya izin vermiyor ya da dosya biçimi desteklenmiyor.', { id: 'wp-generic-error' });
  }, []);

  useEffect(() => {
    if (isYouTube || isSoundCloud || !currentTrack?.url || duration > 0) return;
    const p = setInterval(() => {
      if (playerRef.current?.getDuration) {
        const d = playerRef.current.getDuration();
        if (d && d > 0 && isFinite(d)) { setDuration(d); clearInterval(p); }
      }
    }, 1000);
    return () => clearInterval(p);
  }, [currentTrack?.url, duration, isYouTube, isSoundCloud]);

  // ═══ Kontrol ═══
  const handleSeekChange = useCallback((e) => {
    if (!permissions.canControl) return;
    setProgress({ played: parseFloat(e.target.value), playedSeconds: parseFloat(e.target.value) * duration });
  }, [permissions.canControl, duration]);

  const handleSeekStart = useCallback(() => { if (permissions.canControl) seekingRef.current = true; }, [permissions.canControl]);

  const handleSeekCommit = useCallback((e) => {
    if (!permissions.canControl) return;
    seekingRef.current = false;
    hostSeek(parseFloat(e.target.value) * duration);
  }, [permissions.canControl, duration, hostSeek]);

  const handlePlayPause = useCallback(() => {
    if (!permissions.canControl) return;
    if (isPlaying) hostPause(); else hostPlay(currentTrack, progress.playedSeconds);
  }, [permissions.canControl, isPlaying, hostPause, hostPlay, currentTrack, progress.playedSeconds]);

  const handleSkipNext = useCallback(() => {
    if (!permissions.canControl) return;
    const sorted = useWatchPartyStore.getState().getSortedPlaylist();
    const idx = sorted.findIndex((t) => t.id === currentTrack?.id);
    if (idx >= 0 && idx < sorted.length - 1) hostSkip(sorted[idx + 1]);
    else if (sorted.length > 0 && idx !== 0) hostSkip(sorted[0]);
  }, [permissions.canControl, currentTrack, hostSkip]);

  const handleSkipPrev = useCallback(() => {
    if (!permissions.canControl) return;
    const sorted = useWatchPartyStore.getState().getSortedPlaylist();
    const idx = sorted.findIndex((t) => t.id === currentTrack?.id);
    if (idx > 0) hostSkip(sorted[idx - 1]);
    else if (sorted.length > 0 && idx === 0) hostSkip(sorted[sorted.length - 1]);
  }, [permissions.canControl, currentTrack, hostSkip]);

  // Fullscreen
  useEffect(() => {
    const h = () => { const fs = !!document.fullscreenElement; const s = useWatchPartyStore.getState(); if (s.localPreferences.videoFullscreen !== fs) s.setLocalPref('videoFullscreen', fs); };
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  useEffect(() => {
    const el = document.getElementById('wp-player-root');
    if (!el) return;
    if (videoFS && !document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else if (!videoFS && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, [videoFS]);

  useEffect(() => {
    if (!videoFS) return; // Sadece tam ekrandaysa çalış

    const h = (e) => { 
      // Tam ekrandan çıkış
      if (e.key === 'Escape' && !document.fullscreenElement) {
        toggleFS(); 
      }
      
      // Herkes için Local (Yerel) Kısayollar
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const state = useWatchPartyStore.getState();
        const currentVol = state.localPreferences.volume;
        const delta = e.key === 'ArrowUp' ? 1 : -1;
        const newVol = Math.max(0, Math.min(100, currentVol + delta));
        
        if (newVol !== currentVol) {
          state.setLocalPref('volume', newVol);
          if (newVol > 0 && state.localPreferences.isMuted) {
            state.setLocalPref('isMuted', false);
          }
          if (newVol === 0) {
            showOSD('mute', '0%');
          } else {
            showOSD('volume', `${newVol}%`);
          }
        }
      }

      // Yalnızca Yetkililer için (Host Sync) Kısayolları
      if (permissions.canControl) {
        // İleri/Geri sarma
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const currentPos = playerRef.current?.getCurrentTime?.() || 0;
          const skipAmount = 5;
          const newPos = e.key === 'ArrowRight' ? currentPos + skipAmount : currentPos - skipAmount;
          hostSeek(Math.max(0, Math.min(newPos, duration)));
          showOSD(e.key === 'ArrowRight' ? 'forward' : 'rewind', e.key === 'ArrowRight' ? '+5s' : '-5s');
        }

        // Oynat / Durdur
        if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          const state = useWatchPartyStore.getState();
          const isPlayingNow = state.playbackState.isPlaying;
          if (isPlayingNow) {
            hostPause();
            showOSD('pause');
          } else {
            const currentPos = playerRef.current?.getCurrentTime?.() || state.playbackState.seekPosition || 0;
            hostPlay(state.currentTrack, currentPos);
            showOSD('play');
          }
        }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [videoFS, toggleFS, permissions.canControl, duration, hostSeek, hostPlay, hostPause]);

  // Mouse Idle for Fullscreen
  useEffect(() => {
    if (!videoFS) { setIsMouseIdle(false); return; }
    let lastMove = 0;
    const resetIdleTimer = () => {
      const now = Date.now();
      if (now - lastMove < 200) return; // Throttle events
      lastMove = now;

      setIsMouseIdle((prev) => prev ? false : prev);

      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = setTimeout(() => { setIsMouseIdle(true); }, 3000);
    };
    resetIdleTimer();
    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('mousedown', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);
    return () => {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('mousedown', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
    };
  }, [videoFS]);

  const videoHeight = videoFS ? '100%' : 220;

  const playerContent = (
    <>
      <motion.div
        layout
        id="wp-player-root"
        key="wp-player-card"
        style={{ x: dragX, y: dragY }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={showPlayer ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        drag={!videoFS}
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        dragConstraints={{ 
          left: -winSize.w + (380 + (activePanel === 'playlist' ? 400 : activePanel === 'prefs' ? 360 : 0)) + 48, 
          right: 0, 
          top: -winSize.h + 500, 
          bottom: 0 
        }}
        className={videoFS
          ? 'fixed inset-0 z-[200] flex flex-col bg-black'
          : `fixed bottom-6 right-6 max-w-[calc(100vw-48px)] ${showPlayer ? 'z-[100] pointer-events-auto' : 'z-[-1] pointer-events-none'}`
        }
      >
        <div id="wp-player-container"
          className={`relative flex group/fs transition-all duration-300
            ${videoFS ? `flex-col w-full h-full flex-1 ${isMouseIdle ? 'cursor-none' : ''}` : 'flex-row items-stretch bg-zinc-900/90 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden'}`}
        >
          {/* Panels */}
          <AnimatePresence>
            {activePanel === 'playlist' && (
              <WatchPartyPlaylist key="wp-panel-playlist" serverId={serverId} channelId={channelId}
                permissions={permissions} videoFS={videoFS}
                onPlayTrack={(t) => { if (permissions.canControl) hostSkip(t); setActivePanel(null); }}
                onClose={() => setActivePanel(null)} />
            )}
            {activePanel === 'prefs' && <WatchPartyUserPrefs key="wp-panel-prefs" videoFS={videoFS} onClose={() => setActivePanel(null)} />}
          </AnimatePresence>

          <div className={`flex flex-col relative bg-zinc-900/90 ${videoFS ? 'w-full h-full' : 'w-[380px] shrink-0'}`}>
            
            {/* ═══ KONTROL BAR (TITLE BAR) ═══ */}
            {!videoFS && (
              <div 
                className="h-8 bg-black/40 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-3 cursor-grab active:cursor-grabbing shrink-0 z-[160] select-none"
                onPointerDown={(e) => dragControls.start(e)}
              >
                 <div className="flex items-center gap-2 pointer-events-none">
                    <MonitorPlay size={12} className="text-white/40" />
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Netrex Watch Party</span>
                 </div>
                 <div className="flex items-center gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
                    <button onClick={() => useWatchPartyStore.getState().togglePlayer()} className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors" title="Simge Durumuna Küçült">
                       <Minus size={13} strokeWidth={2.5} />
                    </button>
                    <button onClick={() => useWatchPartyStore.getState().toggleFullscreen()} className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors" title="Tam Ekran">
                       <Square size={11} strokeWidth={2.5} />
                    </button>
                    <button onClick={() => setShowCloseModal(true)} className="p-1 hover:bg-red-500/20 rounded text-white/40 hover:text-red-400 transition-colors" title="Kapat">
                       <X size={14} strokeWidth={2.5} />
                    </button>
                 </div>
              </div>
            )}

            {/* AYRIK ARKA PLAN (KIRPMA EFEKTİ İÇİN) */}
          {!videoFS && currentTrack?.thumbnail && (
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none overflow-hidden">
              <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover blur-2xl scale-125" />
            </div>
          )}

          {/* ═══ VİDEO ALANI ═══ */}
          <div className={`transition-all duration-300 overflow-hidden ${videoFS ? 'absolute inset-0 w-full h-full z-0' : 'relative w-full z-10 bg-black/50'}`}
               style={videoFS ? { height: '100%' } : { height: videoHeight }}>

            {/* Click Catcher - Çift Tıkla Tam Ekran, Yetkililerde Tek Tıkla Durdur/Başlat */}
            <div 
              className="absolute inset-0 z-[150] cursor-pointer"
              onClick={() => {
                clickCountRef.current += 1;
                if (clickCountRef.current === 1) {
                  clickTimerRef.current = setTimeout(() => {
                    if (clickCountRef.current === 1) {
                      // Tek tık (Sadece Yetkililerde Play/Pause)
                      if (permissions.canControl) {
                        const state = useWatchPartyStore.getState();
                        const isPlayingNow = state.playbackState.isPlaying;
                        if (isPlayingNow) {
                          hostPause();
                          showOSD('pause');
                        } else {
                          const currentPos = playerRef.current?.getCurrentTime?.() || state.playbackState.seekPosition || 0;
                          hostPlay(state.currentTrack, currentPos);
                          showOSD('play');
                        }
                      }
                    }
                    clickCountRef.current = 0;
                  }, 250);
                } else if (clickCountRef.current === 2) {
                  // Çift tık (Herkes için Tam Ekran / Pencere geçişi)
                  clearTimeout(clickTimerRef.current);
                  clickCountRef.current = 0;
                  useWatchPartyStore.getState().toggleFullscreen();
                }
              }}
            />

            {/* OSD (Ekran İçi Gösterge) */}
            <AnimatePresence>
              {osd.show && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-[200]">
                  <motion.div
                    key={osd.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.1 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col items-center justify-center
                               bg-black/60 backdrop-blur-xl rounded-full p-6 shadow-2xl"
                  >
                    {osd.icon === 'play' && <Play size={48} className="text-white fill-white" />}
                    {osd.icon === 'pause' && <Pause size={48} className="text-white fill-white" />}
                    {osd.icon === 'forward' && <Forward size={48} className="text-white fill-white" />}
                    {osd.icon === 'rewind' && <Rewind size={48} className="text-white fill-white" />}
                    {osd.icon === 'volume' && <Volume2 size={48} className="text-white" />}
                    {osd.icon === 'mute' && <VolumeX size={48} className="text-white" />}
                    
                    {osd.text && (
                      <span className="text-white/90 text-sm font-bold mt-3 uppercase tracking-wider">{osd.text}</span>
                    )}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {!currentTrack && !videoFS && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20">
                <MonitorPlay size={48} className="mb-3 opacity-50" />
              </div>
            )}

            {isYouTube && videoId && (
              <YouTubePlayer videoId={videoId} shouldPlay={shouldPlay} effectiveVolume={effectiveVolume}
                videoMode={videoMode} videoFS={videoFS} ytQuality={ytQuality}
                onReady={handleYTReady} onStateChange={handleYTState}
                onError={(e) => console.warn('[WatchParty] YT error:', e.data)}
                playerApiRef={playerRef} ytPlayerRef={ytPlayerRef} />
            )}

            {isSoundCloud && currentTrack?.url && (
              <SoundCloudPlayer
                key={currentTrack.url} trackUrl={currentTrack.url} shouldPlay={shouldPlay}
                effectiveVolume={effectiveVolume} videoMode={videoMode} videoFS={videoFS}
                playerApiRef={playerRef} onReady={handleSCReady} onDuration={handleSCDuration}
                onProgress={handleSCProgress} onEnded={handleSCEnded}
              />
            )}



            {isGeneric && (
              <div className={videoFS ? "absolute inset-0 w-full h-full" : "w-full h-full"}>
                <GenericPlayer
                  key={currentTrack.url} src={currentTrack.url} shouldPlay={shouldPlay}
                  effectiveVolume={effectiveVolume} playerApiRef={playerRef}
                  onReady={handleRPReady} onProgress={handleRPProgress} onDuration={handleSCDuration}
                  onEnded={handleRPEnded} onError={handleRPError} onBuffering={setBuffering} />
              </div>
            )}
          </div>

          {/* ═══ KONTROL PANELİ ═══ */}
          <div className={`flex flex-col transition-all duration-500 z-[150]
            ${videoFS
              ? `absolute bottom-0 left-0 right-0 pt-32 pb-12 px-12 bg-gradient-to-t from-black/95 via-black/80 to-transparent gap-6 ${isMouseIdle ? 'opacity-0 pointer-events-none' : 'opacity-100'}`
              : 'relative p-5 gap-5'}`}>

            {/* Track Info */}
            <div className={`flex items-center gap-4 ${videoFS ? '' : 'pr-8'}`}>
              <div className={`relative shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-zinc-800/50 ${videoFS ? 'w-32 h-32' : 'w-16 h-16'}`}>
                {currentTrack?.thumbnail
                  ? <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-white/5 flex items-center justify-center text-white/20 text-2xl">
                      <Music size={24} />
                    </div>}
                {buffering && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                    <div className="w-5 h-5 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
                  </div>
                )}
                {(isMuted || localVolume === 0) && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                    <span className={`${videoFS ? 'text-3xl' : 'text-lg'}`}>🔇</span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <p className={`font-bold text-white truncate drop-shadow-sm tracking-wide ${videoFS ? 'text-3xl' : 'text-base'}`}>
                    {currentTrack?.title || 'Parça seçilmedi'}
                  </p>
                </div>
                
                {currentTrack?.addedByName && (
                  <p className={`text-white/60 truncate flex items-center gap-1.5 font-medium ${videoFS ? 'text-lg mt-2' : 'text-sm mt-1'}`}>
                    <span className="w-4 h-4 rounded-full bg-white/10 text-white/80 flex items-center justify-center text-[9px] font-bold">
                      {currentTrack.addedByName[0]?.toUpperCase()}
                    </span>
                    {currentTrack.addedByName}
                    {isGeneric && <span className="ml-1 text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/40">URL</span>}
                  </p>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {currentTrack && permissions.canControl && (
              <div className="flex flex-col gap-2">
                <div className="relative group/seek flex items-center h-5"
                     onMouseDown={handleSeekStart} onTouchStart={handleSeekStart}
                     onMouseUp={handleSeekCommit} onTouchEnd={handleSeekCommit}
                     onMouseMove={(e) => { if (seekingRef.current) handleSeekChange(e); }}
                >
                  <input type="range" min={0} max={1} step={0.0001}
                    value={progress.played || 0}
                    onChange={handleSeekChange}
                    disabled={!permissions.canControl}
                    className="w-full h-1.5 appearance-none rounded-full cursor-pointer focus:outline-none transition-all [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,0,0,0.5)] [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-200 [&::-webkit-slider-thumb]:opacity-0 group-hover/seek:[&::-webkit-slider-thumb]:opacity-100 group-active/seek:[&::-webkit-slider-thumb]:scale-110 disabled:cursor-not-allowed"
                    style={{
                      background: `linear-gradient(to right, white ${progress.played * 100}%, rgba(255,255,255,0.1) ${progress.played * 100}%)`
                    }}
                  />
                </div>
                <div className="flex items-center justify-between px-1">
                  <span className={`tabular-nums font-medium font-mono text-white/50 ${videoFS ? 'text-sm' : 'text-[11px]'}`}>
                    {formatTime(progress.playedSeconds)}
                  </span>
                  <span className={`tabular-nums font-medium font-mono text-white/50 ${videoFS ? 'text-sm' : 'text-[11px]'}`}>
                    {formatTime(duration)}
                  </span>
                </div>
              </div>
            )}

            {/* Controls */}
            <WatchPartyControls permissions={permissions} isPlaying={isPlaying}
              videoFS={videoFS}
              hasVideo={!!currentTrack}
              onPlayPause={handlePlayPause} onSkipNext={handleSkipNext} onSkipPrev={handleSkipPrev}
              onTogglePlaylist={() => handleTogglePanel('playlist')}
              onTogglePrefs={() => handleTogglePanel('prefs')}
              activePanel={activePanel} />
          </div>
          </div>

        </div>

        {/* Backdrop */}
        <AnimatePresence>
          {activePanel && videoFS && (
            <motion.div
              key="wp-panel-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[140] bg-transparent"
              onClick={() => setActivePanel(null)}
            />
          )}
        </AnimatePresence>
        {/* Close Confirmation Modal */}
        <AnimatePresence>
          {showCloseModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto"
            >
              <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                className="bg-zinc-900 border border-white/10 p-6 rounded-3xl shadow-2xl max-w-sm w-full mx-4"
              >
                <h3 className="text-lg font-bold text-white mb-2">Watch Party'yi Kapat</h3>
                <p className="text-sm text-white/60 mb-6">
                  {permissions?.canManageTracks 
                    ? "Watch Party'yi herkes için sonlandırmak istediğinize emin misiniz?" 
                    : "Watch Party'den ayrılmak istediğinize emin misiniz?"}
                </p>
                <div className="flex justify-end gap-3">
                  <button 
                    onClick={() => setShowCloseModal(false)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    İptal
                  </button>
                  <button 
                    onClick={handleConfirmClose}
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    Kapat
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );

  if (typeof window === "undefined") return null;
  return createPortal(playerContent, document.body);
}
