"use client";

import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Maximize2, Minimize2, Volume2, VolumeX, Gamepad2 } from "lucide-react";
import { getGame } from "./registry";
import { useGamesPrefs, useGamesLibrary } from "./store";

/**
 * Tek kişilik oyun kabuğu: LiveKit'e / ağa bağlı DEĞİL (ses odası dışında da açılır). Üst çubuk + tembel yüklenen görünüm.
 * Görünüm özellikleri: { onLeave, fullscreen }.
 */
class SoloBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    console.error("Tek kişilik oyun hatası:", error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <div className="max-w-sm rounded-2xl border border-red-500/30 bg-[#111214] p-6">
          <div className="mb-1 text-sm font-bold text-red-400">Oyun açılamadı</div>
          <p className="mb-4 text-xs text-[#949ba4]">Oyunda bir sorun oluştu. Uygulamanın geri kalanı etkilenmedi.</p>
          <button onClick={this.props.onLeave} className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/15">Geri dön</button>
        </div>
      </div>
    );
  }
}

export default function SoloRoom({ id, onLeave }) {
  const g = getGame(id);
  const View = useMemo(() => (g ? lazy(g.view) : null), [id]); // eslint-disable-line
  const rootRef = useRef(null);
  const [fs, setFs] = useState(false);
  const muted = useGamesPrefs((s) => s.muted);
  const setMuted = useGamesPrefs((s) => s.setMuted);

  useEffect(() => { if (id) useGamesLibrary.getState().markPlayed(id); }, [id]); // "Son oynadıkların" ve sayaç
  useEffect(() => {
    const on = () => setFs(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", on);
    return () => {
      document.removeEventListener("fullscreenchange", on);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);
  const toggleFs = () => (document.fullscreenElement ? document.exitFullscreen?.() : rootRef.current?.requestFullscreen?.())?.catch?.(() => {});

  if (!g) return <div className="p-8 text-sm font-semibold text-white/60">Oyun bulunamadı.</div>;
  const iconBtn = "flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#c4c9d4] transition hover:border-white/20 hover:bg-white/10 hover:text-white";
  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col" style={{ background: "linear-gradient(180deg, #1b1040, #2a1a60 60%, #1d1248)" }}>
      <div className="relative z-10 shrink-0">
        <div className="flex h-[52px] items-center gap-3 bg-[#0f1115]/90 px-4 backdrop-blur-xl">
          <button type="button" onClick={onLeave} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-[#c4c9d4] transition hover:bg-white/10 hover:text-white"><ArrowLeft size={14} />Mağaza</button>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[15px] font-extrabold tracking-tight text-white">{g.name}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8b93a3]">Tek kişilik</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setMuted(!muted)} className={iconBtn} aria-label={muted ? "Sesi aç" : "Sesi kapat"} title={muted ? "Sesi aç" : "Sesi kapat"}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
            <button type="button" onClick={toggleFs} className={iconBtn} aria-label={fs ? "Tam ekrandan çık" : "Tam ekran"} title={fs ? "Tam ekrandan çık" : "Tam ekran"}>{fs ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
          </div>
        </div>
        <div className="h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${g.accent}, transparent)` }} />
      </div>
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <SoloBoundary onLeave={onLeave}>
          <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-[#949ba4]"><Gamepad2 size={16} className="animate-pulse" />{g.name} yükleniyor…</div>}>
            <View onLeave={onLeave} fullscreen={fs} />
          </Suspense>
        </SoloBoundary>
      </div>
    </div>
  );
}
