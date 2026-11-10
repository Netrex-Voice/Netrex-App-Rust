"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Gamepad2, X, Play } from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useGamesStore } from "./store";
import { GAMES } from "./registry";
import Cover from "./covers";
import SoloRoom from "./SoloRoom";

/**
 * Tek kişilik oyun paneli: ses odasına girmeden, sol raydaki düğmeden açılır. Çok oyunculu oyunlar (Air Hockey vb.)
 * yalnızca ses odasında olduğu için burada listelenmez. Ayarlardan kapalıysa hiç render edilmez.
 */
export default function SoloArcade() {
  const enabled = useSettingsStore((s) => s.gamesEnabled);
  const open = useGamesStore((s) => s.arcadeOpen);
  const setOpen = useGamesStore((s) => s.setArcadeOpen);
  const [id, setId] = useState(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && !e.defaultPrevented && (id ? setId(null) : setOpen(false));
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, id, setOpen]);
  if (!enabled || !open) return null;

  const solo = GAMES.filter((g) => g.solo);
  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ background: "linear-gradient(180deg, #1b1040, #2a1a60 60%, #1d1248)" }} role="dialog" aria-label="Tek kişilik oyunlar">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b-[3px] border-black/40 px-4" style={{ background: "linear-gradient(180deg, #3b2a85, #2a1d63)" }}>
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-b from-indigo-400 to-indigo-700"><Gamepad2 size={18} className="text-white" /></span>
        <span className="text-lg font-black tracking-wide text-white">TEK KİŞİLİK OYUNLAR</span>
        <button type="button" onClick={() => setOpen(false)} className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-red-500/80 text-white shadow-[0_3px_0_#7f1d1d] transition hover:bg-red-500 active:translate-y-[2px]" aria-label="Kapat"><X size={16} /></button>
      </header>
      {id ? (
        <SoloRoom id={id} onLeave={() => setId(null)} />
      ) : (
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto grid max-w-4xl grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
            {solo.map((g) => (
              <button key={g.id} type="button" onClick={() => setId(g.id)} className="group overflow-hidden rounded-3xl bg-[#171a2e] text-left transition hover:-translate-y-1" style={{ border: `3px solid ${g.accent}` }}>
                <span className="relative block aspect-video w-full overflow-hidden">
                  <Cover g={g} className="transition-transform duration-500 group-hover:scale-110" />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white" style={{ color: g.accent }}><Play size={24} className="ml-0.5 fill-current" /></span>
                  </span>
                </span>
                <span className="block p-4">
                  <span className="block text-xl font-black text-white">{g.name}</span>
                  <span className="mt-1 block text-sm font-medium text-white/70">{g.tagline}</span>
                </span>
              </button>
            ))}
          </div>
        </main>
      )}
    </div>,
    document.body
  );
}
