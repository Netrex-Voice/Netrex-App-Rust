import { create } from "zustand";

/**
 * Bağlı olunan sesli odanın kişi listesi (oda EKRANININ dışında, ör. Ana Sayfa'daki küçük kutuda göstermek için).
 *
 * LiveKit bağlamı yalnızca ActiveRoom'un içinde olduğundan, kişileri oradaki `RoomPresencePublisher` bu depoya yazar.
 * "Konuşuyor" bilgisi buraya YAZILMAZ: o zaten `speakingStore`'da (kenar çubuğundaki satırlar da oradan okur).
 * Kalıcı değildir; odadan çıkınca temizlenir.
 */
export const useRoomPresenceStore = create((set) => ({
  roomId: null,
  channelName: "",
  serverName: "",
  participants: [], // { userId, displayName, photoURL, profileColor, isMuted, isDeafened, isLocal }
  publish: (data) => set(data),
  clear: () => set({ roomId: null, channelName: "", serverName: "", participants: [] }),
}));
