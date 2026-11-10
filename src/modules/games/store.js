import { create } from "zustand";
import { applyMatch, levelOf } from "./progress";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Gerçek zamanlı oyunların anlık görüntü kanalı — React DIŞINDA (saniyede 30–60 mesaj bileşenleri yeniden çizdirmesin).
 * Görünüm katmanı abone olur; React'e yalnızca skor/faz gibi "meta" değişince haber verilir.
 */
export const live = {
  v: null,
  rtt: 0.08, // sn, ping/pong ile ölçülür
  route: "relay", // "p2p" (doğrudan) | "relay" (LiveKit üzerinden)
  subs: new Set(),
  push(v) {
    this.v = v;
    const now = performance.now() / 1000;
    for (const f of this.subs) f(v, now);
  },
  sub(f) {
    this.subs.add(f);
    return () => this.subs.delete(f);
  },
};
export const REALTIME = new Set(["airhockey", "pingpong"]); // bilardo sıra tabanlı: vuruş parametreleriyle
/** React'e iletilecek meta anahtarı: bunlar değişmedikçe setView çağrılmaz */
export const metaKey = (v) => [v.phase, v.score?.join("-"), v.winner, v.reason, v.msg, v.server, v.seats?.join(",")].join("|");

/**
 * 🎮 Netrex Games durumu (hafif; motor/arayüz kodu BURADA YOK)
 *  session: odadaki lobi/oyun bilgisi  { sid, gameId, hostId, status, config, players, watchers, max }
 *  view:    bu istemciye gelen son oyun durumu (engine.view çıktısı)
 *  open:    oyun paneli açık mı  ·  screen: 'store' | 'detail' | 'room'  ·  detailId: seçili oyun
 */
export const useGamesStore = create((set) => ({
  session: null,
  view: null,
  open: false,
  screen: "store",
  detailId: null,
  conn: "ok", // ok | lost
  notice: "",
  arcadeOpen: false, // ses odası dışından açılan tek kişilik oyun paneli
  setArcadeOpen: (arcadeOpen) => set({ arcadeOpen }),
  setSession: (session) => set({ session }),
  setView: (view) => set({ view }),
  setOpen: (open) => set({ open }),
  go: (screen, detailId = null) => set({ screen, detailId }),
  setConn: (conn) => set({ conn }),
  setNotice: (notice) => set({ notice }),
  reactions: [], // [{id, e, name}] — ekranda kısa süre görünür
  pushReaction: (r) => set((s) => ({ reactions: [...s.reactions.slice(-5), r] })),
  dropReaction: (id) => set((s) => ({ reactions: s.reactions.filter((x) => x.id !== id) })),
  resetSession: () => {
    live.v = null;
    set({ session: null, view: null, conn: "ok", notice: "" });
  },
}));

/** Kişisel kitaplık: favoriler, son oynananlar ve oynama sayıları (yalnızca bu cihazda gerçek veri) */
export const useGamesLibrary = create(
  persist(
    (set) => ({
      favorites: [],
      recent: [], // [{id, at}]
      plays: {},
      toggleFav: (id) => set((s) => ({ favorites: s.favorites.includes(id) ? s.favorites.filter((x) => x !== id) : [...s.favorites, id] })),
      markPlayed: (id) =>
        set((s) => ({
          recent: [{ id, at: Date.now() }, ...s.recent.filter((r) => r.id !== id)].slice(0, 8),
          plays: { ...s.plays, [id]: (s.plays[id] || 0) + 1 },
        })),
    }),
    { name: "netrex-games-library", version: 1, storage: createJSONStorage(() => localStorage) }
  )
);

/** Görünüm ve ses tercihleri (yalnızca bu cihazda, anında uygulanır) */
export const PREF_DEFAULTS = {
  vol: 70,
  muted: false,
  gfx: "auto", // auto | 0 düşük | 1 orta | 2 yüksek | 3 ultra
  showFps: false,
  p2p: true, // host ↔ misafir doğrudan bağlantı (düşük gecikme; karşı taraf IP'nizi görür)
  hockey: { table: "ice", mine: "indigo", puck: "black", trail: "none" },
  pong: { table: "blue", mine: "red", trail: "none" },
  okey: { cloth: "green", tile: "cream", showOpp: true },
  pool: { cloth: "green" },
  emlak: { token: 0, follow: true }, // lobide son seçtiğin piyon (bir sonraki oyunda otomatik istenir)
};
export const useGamesPrefs = create(
  persist(
    (set) => ({
      ...PREF_DEFAULTS,
      setPref: (game, key, val) => set((s) => ({ [game]: { ...s[game], [key]: val } })),
      setVol: (vol) => set({ vol }),
      setMuted: (muted) => set({ muted }),
      setGfx: (gfx) => set({ gfx }),
      setShowFps: (showFps) => set({ showFps }),
      setP2p: (p2p) => set({ p2p }),
      resetPrefs: () => set(PREF_DEFAULTS),
    }),
    { name: "netrex-games-prefs", version: 3, migrate: (s) => ({ ...s, hockey: { ...PREF_DEFAULTS.hockey, ...(s?.hockey || {}), puck: "black" }, pong: { ...PREF_DEFAULTS.pong }, pool: { ...PREF_DEFAULTS.pool, ...(s?.pool || {}) } }), storage: createJSONStorage(() => localStorage) }
  )
);

/** Kişisel istatistikler: bu cihazdaki gerçek maç sonuçları (sunucuya yazılmaz) */
export const useGamesStats = create(
  persist(
    (set, get) => ({
      byGame: {}, // id → {played, wins, losses, draws, streak, best}
      history: [], // son 30 maç
      record: (game, result, detail, withWho) =>
        set((s) => {
          const g = s.byGame[game] || { played: 0, wins: 0, losses: 0, draws: 0, streak: 0, best: 0 };
          const win = result === "win";
          const streak = win ? g.streak + 1 : 0;
          return {
            byGame: {
              ...s.byGame,
              [game]: {
                played: g.played + 1,
                wins: g.wins + (win ? 1 : 0),
                losses: g.losses + (result === "loss" ? 1 : 0),
                draws: g.draws + (result === "draw" ? 1 : 0),
                streak,
                best: Math.max(g.best, streak),
              },
            },
            history: [{ game, result, detail, withWho, at: Date.now() }, ...s.history].slice(0, 30),
          };
        }),
      reset: () => set({ byGame: {}, history: [] }),
    }),
    { name: "netrex-games-stats", version: 1, storage: createJSONStorage(() => localStorage) }
  )
);

/** Bir maçın bu oyuncu açısından sonucu: 'win' | 'loss' | 'draw' | null (izleyici) */
export function resultOf(view, myId) {
  if (!view || view.phase !== "over") return null;
  if (view.t === "okey") return view.me < 0 ? null : view.reason === "draw" ? "draw" : view.winner === view.me ? "win" : "loss";
  if (view.t === "tabu") return view.me < 0 ? null : view.winner === -1 ? "draw" : view.winner === view.me ? "win" : "loss";
  if (view.t === "pool") return view.me < 0 ? null : view.winner === view.me ? "win" : "loss";
  if (view.t === "emlak") return view.me < 0 ? null : view.winner === view.me ? "win" : "loss";
  const seat = view.seats.indexOf(myId);
  return seat < 0 ? null : view.winner === seat ? "win" : "loss";
}
export function detailOf(view) {
  if (view.t === "okey") return view.reason === "draw" ? "Yığın bitti" : "Okey ile bitti";
  if (view.t === "tabu") return `${view.score[0]} – ${view.score[1]}`;
  if (view.t === "emlak") return view.reason === "last" ? "Son kalan" : "Tur sınırında en zengin";
  if (view.t === "pool") return view.reason === "eight" ? "8 top cebe" : view.reason === "eight_foul" ? "8 faulle girdi" : "Rakip ayrıldı";
  return `${view.score[0]} – ${view.score[1]}`;
}

/** XP, görevler, başarımlar + son maçın ödül özeti (maç sonu ekranı için) */
export const useGamesProgress = create(
  persist(
    (set, get) => ({
      prog: null,
      lastReward: null, // { key, reward }
      apply: (key, match, stats) => {
        if (get().lastReward?.key === key) return;
        const today = new Date().toISOString().slice(0, 10);
        const { next, reward } = applyMatch(get().prog, match, stats, today);
        set({ prog: next, lastReward: { key, reward } });
      },
      reset: () => set({ prog: null, lastReward: null }),
    }),
    { name: "netrex-games-progress", version: 1, storage: createJSONStorage(() => localStorage) }
  )
);
export const useLevel = () => levelOf(useGamesProgress((s) => s.prog?.xp || 0)).level;

/** Maç sonucundan ilerleme girdisi */
export function matchOf(view, myId, session) {
  const res = resultOf(view, myId);
  if (!res) return null;
  let mine = null;
  let theirs = null;
  if (view.t === "airhockey" || view.t === "pingpong") {
    const seat = view.seats.indexOf(myId);
    mine = view.score[seat];
    theirs = view.score[1 - seat];
  } else if (view.t === "tabu") {
    mine = view.score[view.me];
    theirs = view.score[1 - view.me];
  }
  const vsHuman = session.players.some((p) => !p.bot && p.id !== myId);
  return { game: view.t, result: res, mine, theirs, vsHuman };
}
