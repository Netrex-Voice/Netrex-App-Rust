import { create } from "zustand";

/**
 * Bağlı olunan sesli odanın kişi listesi + çıkış işlevi (oda EKRANININ dışında, ör. Ana Sayfa'daki küçük kutuda kullanmak için).
 *
 * LiveKit bağlamı yalnızca ActiveRoom'un içinde olduğundan, kişileri oradaki `RoomPresencePublisher` bu depoya yazar.
 * "Konuşuyor" bilgisi buraya YAZILMAZ: o zaten `speakingStore`'da (kenar çubuğundaki satırlar da oradan okur).
 *
 * `leaveRoom`: ActiveRoom'un KENDİ çıkış işlevi (çıkış sesi + Firebase oda kaydı ve ses durumu temizliği + sayfa durumu).
 * Dışarıdaki düğmeler (kart, küçük kutu) bunu çağırır; sayfanın yalın "odayı kapat" işlevi bu adımları ATLAR ve
 * kullanıcıyı başkalarında "hayalet" olarak bırakırdı.
 *
 * Kalıcı değildir; odadan çıkınca temizlenir.
 */
export const useRoomPresenceStore = create((set) => ({
  roomId: null,
  channelName: "",
  serverName: "",
  participants: [], // { userId, displayName, photoURL, profileColor, isMuted, isDeafened, isLocal }
  leaveRoom: null,
  publish: (data) => set(data),
  setLeaveRoom: (fn) => set({ leaveRoom: fn }),
  clear: () => set({ roomId: null, channelName: "", serverName: "", participants: [], leaveRoom: null }),
}));
