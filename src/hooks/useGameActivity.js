"use client";

import { useState, useCallback } from "react";

export function useGameActivity() {
  const [currentGame] = useState(null);
  const [isEnabled, setIsEnabled] = useState(false);

  // Oyun durumunu toggle et (artık hiçbir şey yapmıyor)
  const toggleGameDetection = useCallback(async (enabled) => {
    setIsEnabled(enabled);
  }, []);

  return {
    currentGame: null, // Her zaman null
    isEnabled,
    toggleGameDetection,
  };
}

export default useGameActivity;
