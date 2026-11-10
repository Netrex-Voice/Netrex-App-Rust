import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { STAGES, STAGE_ORDER, VEHICLES, UPGRADES, upgradeCost } from "./engines/hillclimb.js";

/**
 * Tepe Tırmanışı kalıcı durumu (bu cihazda): altın, sahip olunan araçlar, yükseltmeler, bölüm rekorları.
 * Saf kurallar: bir bölüm, öncekinde istenen mesafeye ulaşılınca açılır.
 */
export const isStageUnlocked = (best, stageId) => {
  const u = STAGES[stageId]?.unlock;
  return !u || (best[u.stage] || 0) >= u.m;
};

export const useHillStore = create(
  persist(
    (set, get) => ({
      coins: 0,
      best: {}, // bölüm → en iyi mesafe (m)
      owned: ["jeep"],
      vehicle: "jeep",
      stage: "countryside",
      upg: {}, // araç → { engine, susp, tires, awd }
      stats: { runs: 0, dist: 0, flips: 0, coins: 0 },

      select: (k, v) => {
        const s = get();
        if (k === "vehicle" && s.owned.includes(v)) set({ vehicle: v });
        if (k === "stage" && isStageUnlocked(s.best, v)) set({ stage: v });
      },

      buyVehicle: (id) => {
        const s = get(), v = VEHICLES[id];
        if (!v || s.owned.includes(id) || s.coins < v.price) return false;
        set({ coins: s.coins - v.price, owned: [...s.owned, id], vehicle: id });
        return true;
      },

      /** Yükseltme satın al; başarılıysa true */
      buyUpgrade: (kind) => {
        const s = get(), spec = UPGRADES[kind];
        if (!spec || !VEHICLES[s.vehicle]) return false;
        if (kind === "awd" && !VEHICLES[s.vehicle].awdAble) return false;
        const cur = s.upg[s.vehicle]?.[kind] || 0;
        if (cur >= spec.max) return false;
        const cost = upgradeCost(kind, cur);
        if (s.coins < cost) return false;
        set({ coins: s.coins - cost, upg: { ...s.upg, [s.vehicle]: { ...(s.upg[s.vehicle] || {}), [kind]: cur + 1 } } });
        return true;
      },

      /** Koşu bitti: altın cüzdana, rekor ve istatistikler güncellenir */
      finishRun: ({ stageId, dist, coins, flips }) => {
        const s = get();
        const prev = s.best[stageId] || 0;
        const rec = Math.floor(dist) > prev;
        set({
          coins: s.coins + Math.max(0, Math.floor(coins)),
          best: rec ? { ...s.best, [stageId]: Math.floor(dist) } : s.best,
          stats: { runs: s.stats.runs + 1, dist: s.stats.dist + Math.floor(dist), flips: s.stats.flips + flips, coins: s.stats.coins + Math.max(0, Math.floor(coins)) },
        });
        const unlocked = STAGE_ORDER.filter((id) => isStageUnlocked(rec ? { ...s.best, [stageId]: Math.floor(dist) } : s.best, id) && !isStageUnlocked(s.best, id));
        return { record: rec, unlocked };
      },
      resetAll: () => set({ coins: 0, best: {}, owned: ["jeep"], vehicle: "jeep", stage: "countryside", upg: {}, stats: { runs: 0, dist: 0, flips: 0, coins: 0 } }),
    }),
    { name: "netrex-hillclimb", version: 1, storage: createJSONStorage(() => localStorage) }
  )
);
