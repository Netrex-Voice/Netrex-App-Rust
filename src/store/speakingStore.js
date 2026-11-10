import { create } from "zustand";

/**
 * 🎙️ Speaking Store - Fast, transient state for voice indicators
 * Does not persist, resets on refresh.
 */
export const useSpeakingStore = create((set) => ({
  speakingParticipants: {}, // Record<string, boolean>
  setSpeaking: (userId, isSpeaking) => set((state) => {
    // Sadece değişim varsa state'i güncelle (gereksiz render önleme)
    if (!!state.speakingParticipants[userId] === isSpeaking) return state;
    return {
      speakingParticipants: {
        ...state.speakingParticipants,
        [userId]: isSpeaking
      }
    };
  }),
  clearSpeaking: () => set({ speakingParticipants: {} }),
}));
