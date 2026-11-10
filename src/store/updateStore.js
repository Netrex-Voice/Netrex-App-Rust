import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";

export const useUpdateStore = createWithEqualityFn(
  (set, get) => ({
    status: "idle",
    progress: 0,
    updateInfo: null,
    _isInitialized: false,
    _cleanupFunctions: [],

    setStatus: (status) => set({ status }),
    setProgress: (progress) => set({ progress }),
    setUpdateInfo: (updateInfo) => {
      if (!updateInfo || typeof updateInfo !== 'object') return;
      set({ updateInfo });
    },

    initialize: () => {
      if (get()._isInitialized) return;
      if (typeof window === "undefined" || !window.netrex) return;

      const cleanups = [];

      const unsubStatus = window.netrex.onUpdateStatus((status, info) => {
        set({ status });
        if (info && typeof info === 'object') {
          set({ updateInfo: info });
        }
      });
      cleanups.push(unsubStatus);

      const unsubProgress = window.netrex.onUpdateProgress((percent) => {
        set({ status: "downloading", progress: Math.round(percent) });
      });
      cleanups.push(unsubProgress);

      const handleTestUpdate = (e) => {
        const { status, progress, info } = e.detail;
        if (status) set({ status });
        if (progress !== undefined) set({ progress });
        if (info) set({ updateInfo: info });
      };
      
      window.addEventListener("NETREX_TEST_UPDATE", handleTestUpdate);
      cleanups.push(() => window.removeEventListener("NETREX_TEST_UPDATE", handleTestUpdate));

      set({ _isInitialized: true, _cleanupFunctions: cleanups });
    },

    cleanup: () => {
      const cleanups = get()._cleanupFunctions;
      cleanups.forEach(fn => fn?.());
      set({ _isInitialized: false, _cleanupFunctions: [] });
    },

    reset: () => set({ status: "idle", progress: 0, updateInfo: null }),
  }),
  shallow
);
