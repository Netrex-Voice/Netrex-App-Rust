"use client";

// Tauri köprüsü: window.netrex'i diğer her şeyden ÖNCE kur
import "@/src/lib/tauriBridge";
import { executeCleanupTasks } from "@/src/utils/cleanup";
import { usePresence } from "@/src/hooks/usePresence";
import { useIdleDetection } from "@/src/hooks/useIdleDetection";
import { SettingsApplier } from "@/src/components/SettingsApplier";
import ToastSystem from "@/src/components/ui/ToastSystem";
import { useEffect, useRef, memo } from "react";
import { MotionConfig } from "framer-motion";

// ✅ OPTIMIZATION #5: Memoize ToastSystem to prevent re-renders
const MemoizedToast = memo(ToastSystem);

export function Providers({ children }) {
  // ✅ OPTIMIZATION #2: Ref guard to prevent duplicate registration
  const cleanupRegisteredRef = useRef(false);
  
  // ✅ OPTIMIZATION #3: Global hooks (single subscription per hook)
  usePresence();
  useIdleDetection();
  
  // ✅ OPTIMIZATION #1 & #2: Cleanup registration (once only, static import)
  useEffect(() => {
    // Guard: only register once
    if (cleanupRegisteredRef.current) return;
    
    // Check if Electron API is available
    if (typeof window === 'undefined' || !window.netrex?.onAppWillQuit) return;
    
    cleanupRegisteredRef.current = true;
    
    // Register cleanup handler
    const unregister = window.netrex.onAppWillQuit(executeCleanupTasks);
    
    return () => {
      cleanupRegisteredRef.current = false;
      // ✅ Call cleanup function if it exists
      if (typeof unregister === 'function') {
        unregister();
      }
    };
  }, []); // Empty deps - only run once

  return (
    // reducedMotion="user": işletim sistemi "animasyonları azalt" diyorsa Framer Motion kayma/ölçek/layout hareketini
    // bırakır, opaklık geçişlerini korur
    <MotionConfig reducedMotion="user">
      <SettingsApplier />
      {children}
      <MemoizedToast />
    </MotionConfig>
  );
}
