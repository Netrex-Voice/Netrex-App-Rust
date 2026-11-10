import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getBot } from "./engines/chess/bots.js";
import { eloChange, categoryOf, START_RATINGS } from "./engines/chess/rating.js";
import { scoreFor, START_FEN } from "./engines/chess/game.js";

/**
 * ♟️ Satranç: puanlar (Bullet/Blitz/Rapid ayrı), maç geçmişi ve yarım kalan oyun — bu cihazda saklanır.
 * Yarım kalan oyun saat damgasıyla kaydedilir: uygulama kapansa bile saat işler, süre dolarsa mağlubiyet sayılır
 * (puan kasmak için oyundan kaçmak işe yaramaz).
 */
const blank = (r) => ({ r, games: 0, peak: r, w: 0, d: 0, l: 0, hist: [r] });

export const useChessStore = create(
  persist(
    (set, get) => ({
      ratings: null, // { bullet, blitz, rapid } — null: seviye belirleme henüz yapılmadı
      history: [], // son 100 maç
      beaten: {}, // botId → kaç kez yenildi
      game: null,
      prefs: { board: "green", sound: true, coords: true, tc: "10+0", botId: "b700", color: "random", rated: true, highlight: true },

      place: (level) => {
        const r = START_RATINGS[level] ?? 800;
        set({ ratings: { bullet: blank(r), blitz: blank(r), rapid: blank(r) } });
      },
      setPref: (k, v) => set((s) => ({ prefs: { ...s.prefs, [k]: v } })),

      start: ({ botId, color, tc, rated, startFen = START_FEN }) => {
        const now = Date.now();
        const ms = tc ? tc.min * 60000 : 0;
        const game = {
          id: Math.random().toString(36).slice(2, 9),
          botId, color, tc: tc ? { id: tc.id, min: tc.min, inc: tc.inc } : null,
          cat: tc ? categoryOf(tc.min, tc.inc) : null,
          rated: !!tc && !!rated,
          startFen, moves: [], clocks: [ms, ms], tickAt: null, over: null, rating: null, at: now,
        };
        set({ game });
        return game;
      },

      /** Hamle ekle; saat: ilk iki yarım hamle bedava, sonra süre düşer ve artış eklenir */
      playMove: (uci, now = Date.now()) => {
        const g = get().game;
        if (!g || g.over) return;
        const mover = g.moves.length % 2; // 0 beyaz, 1 siyah
        const clocks = [...g.clocks];
        if (g.tc && g.tickAt != null) clocks[mover] = Math.max(0, clocks[mover] - (now - g.tickAt)) + g.tc.inc * 1000;
        const moves = [...g.moves, uci];
        set({ game: { ...g, moves, clocks, tickAt: g.tc && moves.length >= 2 ? now : null } });
      },

      /** Oyunu bitir; puanlıysa Elo hesapla ve geçmişe yaz (tekrar çağrılırsa etkisiz) */
      finish: (result, reason) => {
        const s = get();
        const g = s.game;
        if (!g || g.over) return;
        const bot = getBot(g.botId);
        const score = scoreFor(result, g.color);
        let rating = null;
        let ratings = s.ratings;
        let beaten = s.beaten;
        if (g.rated && ratings && g.cat) {
          const cur = ratings[g.cat];
          const ch = eloChange(cur.r, bot.rating, score, cur.games);
          rating = { before: cur.r, after: ch.next, delta: ch.delta, k: ch.k, expected: ch.expected, cat: g.cat };
          ratings = {
            ...ratings,
            [g.cat]: {
              r: ch.next, games: cur.games + 1, peak: Math.max(cur.peak, ch.next),
              w: cur.w + (score === 1 ? 1 : 0), d: cur.d + (score === 0.5 ? 1 : 0), l: cur.l + (score === 0 ? 1 : 0),
              hist: [...cur.hist, ch.next].slice(-80),
            },
          };
        }
        if (score === 1) beaten = { ...beaten, [bot.id]: (beaten[bot.id] || 0) + 1 };
        const over = { result, reason };
        const entry = { id: g.id, at: Date.now(), botId: bot.id, botRating: bot.rating, color: g.color, cat: g.cat, tc: g.tc?.id || null, rated: g.rated, result, reason, score, before: rating?.before ?? null, after: rating?.after ?? null, delta: rating?.delta ?? null, plies: g.moves.length };
        set({ game: { ...g, over, rating, tickAt: null }, ratings, beaten, history: [entry, ...s.history].slice(0, 100) });
      },

      clearGame: () => set({ game: null }),
      resetAll: () => set({ ratings: null, history: [], beaten: {}, game: null }),
    }),
    { name: "netrex-chess", version: 1, storage: createJSONStorage(() => localStorage) }
  )
);
