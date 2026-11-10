// src/components/watch-party/WatchPartyPlaylist.jsx
'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useWatchPartyStore } from '@/src/store/watchPartyStore';
import { useWatchPartyVote } from '@/src/hooks/useWatchPartyVote';
import { useAuthStore } from '@/src/store/authStore';
import {
  addTrackToPlaylist,
  addTracksToPlaylist,
  removeTrackFromPlaylist,
  clearCurrentTrackInDb,
} from '@/src/services/watchPartyService';
import {
  classifyUrl,
  fetchPlaylistTracks,
  titleFromFileUrl,
  SUPPORTED_SITES_HINT,
  MAX_PLAYLIST_TRACKS,
} from '@/src/utils/watchPartyUrl';
import {
  Plus, Trash2, Play, Link, Loader2,
  ThumbsUp, ThumbsDown, X, Music, ListMusic, ListPlus,
} from 'lucide-react';

export function WatchPartyPlaylist({
  serverId, channelId, permissions,
  onPlayTrack, onClose, videoFS,
}) {
  const currentTrack = useWatchPartyStore((s) => s.currentTrack);
  const playlist     = useWatchPartyStore((s) => s.playlist);
  const currentUser  = useAuthStore((s) => s.user);

  const { toggleUpvote, toggleDownvote, getScore, getMyVote } =
    useWatchPartyVote(serverId, channelId);

  const [inputUrl, setInputUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError]       = useState('');

  // ─── Skor'a göre sırala (store'daki getSortedPlaylist kullan) ───
  const sortedPlaylist = useWatchPartyStore((s) => s.getSortedPlaylist());

  // Yapıştırılan bağlantının türü (canlı): çalma listesi bağlantısında ek düğme göstermek için
  const parsed = useMemo(() => (inputUrl.trim() ? classifyUrl(inputUrl) : null), [inputUrl]);

  // ─── Başlık / küçük resim (tek parça) ───
  const resolveMeta = useCallback(async (info) => {
    let url = info.url;
    let title = info.kind === 'file' ? titleFromFileUrl(url) : url;
    let thumbnail = '';

    const fetchJson = async (endpoint, ms = 4000) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ms);
      try {
        const res = await fetch(endpoint, { signal: controller.signal });
        return await res.json();
      } finally {
        clearTimeout(timer);
      }
    };

    try {
      if (info.kind === 'youtube') {
        thumbnail = `https://img.youtube.com/vi/${info.videoId}/mqdefault.jpg`;
        let data = null;
        try {
          data = await fetchJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
        } catch {
          try { data = await fetchJson(`https://noembed.com/embed?url=${encodeURIComponent(url)}`); } catch {}
        }
        if (data?.title) title = data.title;
        if (data?.thumbnail_url) thumbnail = data.thumbnail_url;
      } else if (info.kind === 'soundcloud') {
        const data = await fetchJson(`https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`);
        if (data?.title) title = data.title;
        if (data?.thumbnail_url) thumbnail = data.thumbnail_url;
        // Gerçek parça URL'ini çek
        if (data?.html) {
          const m = data.html.match(/url=([^&"'>]+)/);
          if (m?.[1]) url = decodeURIComponent(m[1]);
        }
      } else if (info.kind === 'vimeo' || info.kind === 'wistia') {
        const data = await fetchJson(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
        if (data?.title) title = data.title;
        if (data?.thumbnail_url) thumbnail = data.thumbnail_url;
      }
      // Doğrudan dosya / HLS / DASH: başlık dosya adından üretilir (ağ isteği gerekmez)
    } catch {
      /* başlık alınamazsa bağlantı/dosya adıyla eklenir */
    }
    return { url, title, thumbnail };
  }, []);

  // ─── Çalma listesinin TAMAMINI ekle ───
  const handleAddPlaylist = useCallback(async (listId) => {
    if (!permissions.canManageTracks || !listId) return;
    setError('');

    const room = MAX_PLAYLIST_TRACKS - playlist.length;
    if (room <= 0) {
      setError(`Liste dolu (en fazla ${MAX_PLAYLIST_TRACKS} parça).`);
      return;
    }

    setIsAdding(true);
    try {
      const res = await fetchPlaylistTracks(listId);

      const existing = new Set(playlist.map((t) => t.url));
      const fresh = res.tracks
        .map((t) => ({
          url: `https://www.youtube.com/watch?v=${t.videoId}`,
          title: t.title,
          thumbnail: t.thumbnail,
          duration: t.duration || 0,
          addedBy: currentUser?.uid || '',
          addedByName: currentUser?.displayName || 'Bilinmeyen',
        }))
        .filter((t) => !existing.has(t.url));

      if (fresh.length === 0) {
        setError('Bu listedeki tüm parçalar zaten ekli.');
        return;
      }

      const toAdd = fresh.slice(0, room);
      const added = await addTracksToPlaylist(serverId, channelId, toAdd);
      setInputUrl('');

      const notes = [];
      if (fresh.length > toAdd.length) notes.push(`liste dolduğu için ${fresh.length - toAdd.length} parça eklenemedi`);
      if (res.truncated) notes.push('çok uzun liste, ilk parçalar alındı');
      toast.success(`"${res.title}" listesinden ${toAdd.length} parça eklendi${notes.length ? ` (${notes.join('; ')})` : ''}.`);

      // Hiçbir şey çalmıyorsa (müzik dinlemek için ideal) ilk parçadan başla
      if (!currentTrack && permissions.canControl && added[0]) onPlayTrack(added[0]);
    } catch (err) {
      setError(err?.message || 'Liste eklenemedi.');
    } finally {
      setIsAdding(false);
    }
  }, [permissions, playlist, currentUser, serverId, channelId, currentTrack, onPlayTrack]);

  // ─── Parça Ekle ───
  const handleAdd = useCallback(async () => {
    if (!inputUrl.trim() || !permissions.canManageTracks) return;
    setError('');

    const info = classifyUrl(inputUrl);
    if (info.kind === 'invalid' || info.kind === 'unsupported') {
      setError(info.reason);
      return;
    }
    // Yalnızca liste bağlantısı: hepsini ekle
    if (info.kind === 'youtube-playlist') {
      await handleAddPlaylist(info.listId);
      return;
    }

    if (playlist.length >= MAX_PLAYLIST_TRACKS) {
      setError(`Liste dolu (en fazla ${MAX_PLAYLIST_TRACKS} parça).`);
      return;
    }
    if (playlist.some((track) => track.url === info.url)) {
      setError('Bu parça zaten listeye eklenmiş!');
      setInputUrl('');
      return;
    }

    setIsAdding(true);
    try {
      const meta = await resolveMeta(info);
      await addTrackToPlaylist(serverId, channelId, {
        url:         meta.url,
        title:       meta.title,
        thumbnail:   meta.thumbnail,
        duration:    0,
        addedBy:     currentUser?.uid || '',
        addedByName: currentUser?.displayName || 'Bilinmeyen',
      });
      setInputUrl('');
    } catch (err) {
      console.error('[WatchPartyPlaylist] Ekleme hatası:', err);
      setError('Eklenirken hata oluştu.');
    } finally {
      setIsAdding(false);
    }
  }, [inputUrl, serverId, channelId, permissions, currentUser, playlist, resolveMeta, handleAddPlaylist]);

  // ─── Animasyon varyantları ───
  const variants = videoFS
    ? {
        initial: { opacity: 0, y: 10, scale: 0.95 },
        animate: { opacity: 1, y: 0,  scale: 1 },
        exit:    { opacity: 0, y: 10, scale: 0.95 },
      }
    : {
        initial: { width: 0, opacity: 0 },
        animate: { width: 400, opacity: 1 },
        exit:    { width: 0, opacity: 0 },
      };

  return (
    <motion.div
      {...variants}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={
        videoFS
          ? `absolute bottom-36 right-12 w-[400px] h-[calc(100vh-200px)] flex flex-col
             bg-zinc-900/90 backdrop-blur-3xl rounded-3xl border border-white/10
             shadow-2xl z-[160] overflow-hidden`
          : `overflow-hidden bg-zinc-900/90 backdrop-blur-3xl border-r border-white/10
             flex flex-col shrink-0 z-[150] h-[370px]`
      }
      style={videoFS ? {} : { width: 400 }}
    >
      {/* ── ARKA PLAN EFEKTİ ── */}
      {currentTrack?.thumbnail && (
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none overflow-hidden">
          <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover blur-2xl scale-125" />
        </div>
      )}

      <div className="relative z-10 flex flex-col w-full h-full">

      {/* ── Başlık ── */}
      <div className="flex items-center justify-between px-5 py-4
                      border-b border-white/5 bg-white/5 shrink-0">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ListMusic size={16} className="text-emerald-400" />
          Çalma Listesi
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-lg">
            {playlist.length} parça
          </span>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition-all text-white/50 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── URL Ekleme ── */}
      {permissions.canManageTracks ? (
        <div className="px-4 py-3 border-b border-white/5 bg-black/20 shrink-0">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5
                            border border-white/5 focus-within:border-emerald-500/40
                            focus-within:bg-white/8 transition-all">
              <Link size={14} className="text-white/30 shrink-0" />
              <input
                type="text"
                placeholder="YouTube, SoundCloud, Vimeo veya ses/video linki..."
                value={inputUrl}
                onChange={(e) => { setInputUrl(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="flex-1 bg-transparent text-sm text-white outline-none
                           placeholder:text-white/25"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={isAdding || !inputUrl.trim()}
              className="px-3 py-2.5 bg-emerald-500 hover:bg-emerald-400 rounded-xl
                         transition-all disabled:opacity-30 disabled:cursor-not-allowed
                         active:scale-95 shadow-lg shadow-emerald-500/20"
            >
              {isAdding
                ? <Loader2 size={16} className="text-white animate-spin" />
                : <Plus size={16} className="text-white" />
              }
            </button>
          </div>
          {/* Video bağlantısı bir çalma listesinden geliyorsa tüm listeyi ekleme seçeneği */}
          {parsed?.kind === 'youtube' && parsed.listId && !isAdding && (
            <button
              onClick={() => handleAddPlaylist(parsed.listId)}
              className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl
                         bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25
                         text-emerald-300 text-xs font-semibold transition-all active:scale-[0.98]"
            >
              <ListPlus size={14} />
              Videonun bulunduğu tüm çalma listesini ekle
            </button>
          )}
          {parsed?.kind === 'youtube-playlist' && (
            <p className="text-[11px] text-emerald-300/80 mt-1.5 ml-1">
              Bu bir çalma listesi: tüm parçalar eklenecek (en fazla 200).
            </p>
          )}
          {error ? (
            <p className="text-[11px] text-red-400 mt-1.5 ml-1">{error}</p>
          ) : !parsed ? (
            <p className="text-[10px] text-white/25 mt-1.5 ml-1 leading-snug">
              Desteklenenler: {SUPPORTED_SITES_HINT}.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="px-4 py-2.5 border-b border-white/5 bg-black/20 shrink-0">
          <p className="text-xs text-white/35 text-center">
            Parça eklemek için yetki gerekli
          </p>
        </div>
      )}

      {/* ── Liste ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-2 min-h-0">
        {sortedPlaylist.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center text-white/20">
            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <Music size={22} className="opacity-50" />
            </div>
            <p className="text-sm font-medium">Henüz parça yok</p>
            <p className="text-xs mt-1 opacity-60">Bir link ekleyin</p>
          </div>
        ) : (
          (() => {
            const nextTrackCandidate = sortedPlaylist.find(t => t.id !== currentTrack?.id);
            return sortedPlaylist.map((track) => {
              const isActive = track.id === currentTrack?.id;
              const isNext   = track.id === nextTrackCandidate?.id;
              const score    = getScore(track.id);
              const myVote   = getMyVote(track.id);

              return (
                <motion.div
                  key={track.id}
                  layout
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl
                    hover:bg-white/5 transition-all group relative
                    ${isActive ? 'bg-emerald-500/10' : ''}`}
                >
                  {/* Thumbnail */}
                  <div className="relative w-11 h-11 rounded-xl overflow-hidden
                                  shrink-0 border border-white/10 bg-zinc-800">
                    {track.thumbnail ? (
                      <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music size={14} className="text-white/20" />
                      </div>
                    )}

                    {/* Hover: Oynat */}
                    {permissions.canControl && !isActive && (
                      <button
                        onClick={() => onPlayTrack(track)}
                        className="absolute inset-0 bg-black/60 flex items-center justify-center
                                   opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Play size={18} className="text-white" fill="white" />
                      </button>
                    )}

                    {/* Aktif animasyonu */}
                    {isActive && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="flex gap-[3px] items-end h-4">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              className="w-1 bg-emerald-400 rounded-full"
                              animate={{ height: ['20%', '100%', '20%'] }}
                              transition={{
                                repeat: Infinity,
                                duration: 0.8,
                                delay: i * 0.15,
                                ease: 'easeInOut',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bilgi */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate
                      ${isActive ? 'text-emerald-400' : 'text-white/90'}`}>
                      {track.title}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5 truncate flex items-center gap-1.5">
                      {track.addedByName && (
                        <>
                          <span className="w-3.5 h-3.5 rounded-full bg-white/10
                                           flex items-center justify-center text-[8px] text-white/60">
                            {track.addedByName[0]?.toUpperCase()}
                          </span>
                          {track.addedByName}
                        </>
                      )}
                      {isNext && !isActive && (
                        <span className="ml-1 text-[10px] bg-amber-500/20 text-amber-400
                                         px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                          Sıradaki
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Oy */}
                  <div className="flex items-center gap-0.5 bg-black/20 rounded-xl p-1
                                  border border-white/5">
                    <button
                      onClick={() => toggleUpvote(track.id)}
                      className={`p-1.5 rounded-lg transition-all
                        ${myVote === 1
                          ? 'text-emerald-400 bg-emerald-500/20'
                          : 'text-white/40 hover:text-white hover:bg-white/10'}`}
                    >
                      <ThumbsUp size={13} />
                    </button>
                    <span className={`text-xs font-bold tabular-nums min-w-[1.25rem] text-center
                      ${score > 0 ? 'text-emerald-400' : score < 0 ? 'text-red-400' : 'text-white/40'}`}>
                      {score}
                    </span>
                    <button
                      onClick={() => toggleDownvote(track.id)}
                      className={`p-1.5 rounded-lg transition-all
                        ${myVote === -1
                          ? 'text-red-400 bg-red-500/20'
                          : 'text-white/40 hover:text-white hover:bg-white/10'}`}
                    >
                      <ThumbsDown size={13} />
                    </button>
                  </div>

                  {/* Sil */}
                  {permissions.canManageTracks && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isActive) {
                          const remaining = sortedPlaylist.filter((t) => t.id !== track.id);
                          if (remaining.length > 0) onPlayTrack(remaining[0]);
                          else clearCurrentTrackInDb(serverId, channelId);
                        }
                        removeTrackFromPlaylist(serverId, channelId, track);
                      }}
                      className="p-1.5 rounded-xl hover:bg-red-500/20
                                 opacity-0 group-hover:opacity-100 transition-all
                                 absolute right-3 bg-zinc-800 border border-white/10 shadow-lg"
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  )}
                </motion.div>
              );
            });
          })()
        )}
      </div>
      </div>
    </motion.div>
  );
}