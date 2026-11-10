import { create } from "zustand";

// Yerleşim durumu (geçici). Üye listesi görünürlüğü eskiden `Home` bileşeninin state'indeydi: düğmeye basınca tüm sayfa
// (odanın ağır bileşenleri dahil) yeniden render ediliyor, bu iş animasyonun ilk karelerini yiyor ve panel
// "animasyonsuz" açılıp kapanıyormuş gibi görünüyordu. Depoda tutunca yalnızca AppShell'in sağ paneli güncellenir.
export const useLayoutStore = create((set) => ({
  showMemberList: true,
  setShowMemberList: (show) => set({ showMemberList: !!show }),
  toggleMemberList: () => set((s) => ({ showMemberList: !s.showMemberList })),
}));
