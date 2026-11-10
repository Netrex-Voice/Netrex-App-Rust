"use client";

import { Gamepad2 } from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useGamesStore } from "./store";
import { gamesActions } from "./GamesHandler";

/** Alt çubuktaki oyun düğmesi. Modül ayarlardan kapalıysa HİÇ görünmez. */
export default function GamesButton() {
  const enabled = useSettingsStore((s) => s.gamesEnabled);
  const open = useGamesStore((s) => s.open);
  const session = useGamesStore((s) => s.session);
  if (!enabled) return null;
  const live = !!session && !open;

  return (
    <div className="relative flex items-center">
      <div className="w-px h-8 bg-white/10 mx-1" />
      <button
        type="button"
        onClick={() => gamesActions.toggle()}
        className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl transition duration-300 relative active:scale-95 ${
          open
            ? "bg-sky-500/20 border border-sky-500/30 text-sky-300 hover:bg-sky-500 hover:text-white"
            : "bg-white/5 border border-white/10 text-[#b5bac1] hover:bg-white/10 hover:text-white hover:border-white/20"
        }`}
        title={live ? "Odada açık bir oyun var — katıl" : "Netrex Games"}
        aria-label="Netrex Games"
      >
        <Gamepad2 size={20} />
        {live && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse shadow-[0_0_6px_rgba(56,189,248,0.7)]" />}
      </button>
    </div>
  );
}
