import { useCallback, useRef, useEffect, useMemo } from "react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useSoundManagerStore } from "@/src/store/soundManagerStore";

export function useSoundEffects() {
  // ✅ OPTIMIZATION #1 & #4: Ref with pre-normalized volume
  const normalizedVolumeRef = useRef(0);
  
  // ✅ OPTIMIZATION #3: Selective subscription (only sfxVolume)
  const sfxVolume = useSettingsStore(state => state.sfxVolume);
  
  // ✅ OPTIMIZATION #4: Pre-calculate normalized volume when it changes
  useEffect(() => {
    normalizedVolumeRef.current = sfxVolume / 100;
  }, [sfxVolume]);
  
  // ✅ OPTIMIZATION #2: Init on mount (no lazy check)
  useEffect(() => {
    const { isLoaded, init } = useSoundManagerStore.getState();
    if (!isLoaded) {
      init();
    }
  }, []);

  // ✅ OPTIMIZATION #1, #3: Stable playSound with zero dependencies
  const playSound = useCallback((soundName) => {
    const volume = normalizedVolumeRef.current;
    
    // Early return if muted
    if (volume === 0) return;
    
    // ✅ OPTIMIZATION #3: getState() - no subscription, no re-render
    const { play } = useSoundManagerStore.getState();
    
    try {
      // Direct play with pre-normalized volume
      play(soundName, volume);
    } catch (error) {
      // ✅ OPTIMIZATION #5: Development-only logging
      if (process.env.NODE_ENV === 'development') {
        console.error("Ses çalma hatası:", error);
      }
      // Silent fail in production
    }
  }, []); // ✅ Zero dependencies - perfectly stable

  // ✅ OPTIMIZATION #6: Memoize return object (prevent object recreation)
  return useMemo(() => ({ playSound }), [playSound]);
}
