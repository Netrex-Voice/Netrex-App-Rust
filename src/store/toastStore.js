import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

/**
 * ✅ OPTIMIZED ToastStore v2.0
 * - Max toast limit
 * - Immer for O(1) updates
 * - Better ID generation
 */
export const useToastStore = create(
  immer((set) => ({
    toasts: [],
    _maxToasts: 2, // Max 2 toast visible at once
    
    addToast: (toast) => {
      const id = toast.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      set((state) => {
        const newToast = {
          id,
          type: 'info',
          duration: 5000,
          ...toast,
          createdAt: Date.now(),
        };
        
        state.toasts.push(newToast);
        
        if (state.toasts.length > state._maxToasts) {
          state.toasts.shift();
        }
      });
      
      return id;
    },

    updateToast: (id, updates) => set((state) => {
      const toast = state.toasts.find(t => t.id === id);
      if (toast) {
        Object.assign(toast, updates);
      }
    }),

    removeToast: (id) => set((state) => {
      const index = state.toasts.findIndex(t => t.id === id);
      if (index !== -1) {
        state.toasts.splice(index, 1);
      }
    }),

    dismiss: (id) => set((state) => {
      const index = state.toasts.findIndex(t => t.id === id);
      if (index !== -1) {
        state.toasts.splice(index, 1);
      }
    }),

    clearToasts: () => set((state) => {
      state.toasts = [];
    })
  }))
);
