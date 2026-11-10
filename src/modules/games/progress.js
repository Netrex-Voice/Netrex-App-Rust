/**
 * 🏆 İlerleme: XP, seviye, günlük görevler, başarımlar (saf mantık, Node'da test edilir).
 * Veri yalnızca bu cihazdadır; ödüller yalnızca kozmetiktir (oyun dengesini etkilemez), bu yüzden istemci tarafı yeterli.
 */

export const LEVEL_XP = (lvl) => 100 + (lvl - 1) * 60; // lvl → lvl+1 için gereken XP

export function levelOf(xp) {
  let level = 1;
  let rest = Math.max(0, Math.floor(xp || 0));
  while (rest >= LEVEL_XP(level) && level < 99) {
    rest -= LEVEL_XP(level);
    level++;
  }
  return { level, into: rest, need: LEVEL_XP(level) };
}

/** Günlük görev havuzu. inc(m): bu maç göreve kaç birim katkı yapar */
export const CHALLENGES = [
  { id: "play2", text: "2 maç oyna", goal: 2, inc: () => 1 },
  { id: "win1", text: "1 maç kazan", goal: 1, inc: (m) => (m.result === "win" ? 1 : 0) },
  { id: "hockey5", text: "Air Hockey'de toplam 5 gol at", goal: 5, inc: (m) => (m.game === "airhockey" ? m.mine || 0 : 0) },
  { id: "pong15", text: "Ping Pong'da toplam 15 sayı al", goal: 15, inc: (m) => (m.game === "pingpong" ? m.mine || 0 : 0) },
  { id: "okeyWin", text: "Bir Okey eli kazan", goal: 1, inc: (m) => (m.game === "okey" && m.result === "win" ? 1 : 0) },
  { id: "tabu1", text: "Bir Tabu oyunu oyna", goal: 1, inc: (m) => (m.game === "tabu" ? 1 : 0) },
  { id: "friend1", text: "Bir arkadaşınla maç yap", goal: 1, inc: (m) => (m.vsHuman ? 1 : 0) },
  { id: "shutout", text: "Air Hockey'de gol yemeden kazan", goal: 1, inc: (m) => (m.game === "airhockey" && m.result === "win" && m.theirs === 0 ? 1 : 0) },
  { id: "close", text: "Bir maçı 1–2 farkla kazan", goal: 1, inc: (m) => (m.result === "win" && m.mine != null && m.mine - m.theirs <= 2 ? 1 : 0) },
];
export const CHALLENGE_XP = 60;

/** Tarihe göre deterministik 3 görev (herkes aynı gün aynı görevleri görür) */
export function dailyIds(date) {
  let h = 2166136261;
  for (const ch of date) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const pool = CHALLENGES.map((c) => c.id);
  const out = [];
  while (out.length < 3) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    const id = pool[h % pool.length];
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export const ACHIEVEMENTS = [
  { id: "first", name: "İlk Galibiyet", desc: "Herhangi bir oyunda ilk kez kazan", check: (c) => c.totalWins >= 1 },
  { id: "streak3", name: "Seri Başladı", desc: "Aynı oyunda üst üste 3 kez kazan", check: (c) => c.bestStreak >= 3 },
  { id: "streak7", name: "Durdurulamaz", desc: "Aynı oyunda üst üste 7 kez kazan", check: (c) => c.bestStreak >= 7 },
  { id: "shutout", name: "Kale Duvarı", desc: "Air Hockey'de gol yemeden kazan", check: (c) => c.m.game === "airhockey" && c.m.result === "win" && c.m.theirs === 0 },
  { id: "okey", name: "Okey!", desc: "Bir Okey eli kazan", check: (c) => (c.byGame.okey?.wins || 0) >= 1 },
  { id: "allfour", name: "Her Telden", desc: "Dört oyunun hepsini oyna", check: (c) => ["airhockey", "pingpong", "tabu", "okey"].every((g) => (c.byGame[g]?.played || 0) > 0) },
  { id: "social5", name: "Sosyal", desc: "Arkadaşlarınla 5 maç yap", check: (c) => c.humanMatches >= 5 },
  { id: "m25", name: "Müdavim", desc: "Toplam 25 maç oyna", check: (c) => c.totalPlayed >= 25 },
  { id: "lvl10", name: "Usta", desc: "10. seviyeye ulaş", check: (c) => c.level >= 10 },
];
export const ACH_XP = 100;

/**
 * Bir maç sonucunu ilerlemeye işler.
 * @param prog  { xp, daily:{date, ids, prog, done}, ach:[], firstWinDate, humanMatches }
 * @param m     { game, result:'win'|'loss'|'draw', mine, theirs, vsHuman }
 * @param stats { byGame } — bu maç DAHİL güncel istatistik
 * @param today 'YYYY-MM-DD'
 * @returns { next, reward:{ lines:[{label,xp}], total, before, after, unlocked:[], done:[], ach:[] } }
 */
export function applyMatch(prog, m, stats, today) {
  const p = {
    xp: prog?.xp || 0,
    daily: prog?.daily?.date === today ? { ...prog.daily, prog: { ...prog.daily.prog }, done: [...prog.daily.done] } : { date: today, ids: dailyIds(today), prog: {}, done: [] },
    ach: [...(prog?.ach || [])],
    firstWinDate: prog?.firstWinDate || "",
    humanMatches: (prog?.humanMatches || 0) + (m.vsHuman ? 1 : 0),
  };
  const lines = [];
  const base = m.result === "win" ? 100 : m.result === "draw" ? 60 : 35;
  lines.push({ label: m.result === "win" ? "Galibiyet" : m.result === "draw" ? "Beraberlik" : "Katılım", xp: base });
  if (m.mine && (m.game === "airhockey" || m.game === "pingpong")) lines.push({ label: `${m.mine} sayı`, xp: Math.min(60, m.mine * 6) });
  if (m.game === "okey" && m.result === "win") lines.push({ label: "Okey bitirme", xp: 40 });
  const streak = stats.byGame[m.game]?.streak || 0;
  if (m.result === "win" && streak > 1) lines.push({ label: `${streak} maçlık seri`, xp: Math.min(60, (streak - 1) * 15) });
  if (m.result === "win" && p.firstWinDate !== today) {
    p.firstWinDate = today;
    lines.push({ label: "Günün ilk galibiyeti", xp: 50 });
  }
  if (!m.vsHuman) {
    const sum = lines.reduce((a, l) => a + l.xp, 0);
    lines.push({ label: "Bot maçı (×0,6)", xp: -Math.round(sum * 0.4) });
  }
  // Günlük görevler
  const done = [];
  for (const id of p.daily.ids) {
    if (p.daily.done.includes(id)) continue;
    const c = CHALLENGES.find((x) => x.id === id);
    p.daily.prog[id] = Math.min(c.goal, (p.daily.prog[id] || 0) + c.inc(m));
    if (p.daily.prog[id] >= c.goal) {
      p.daily.done.push(id);
      done.push(c.text);
      lines.push({ label: `Görev: ${c.text}`, xp: CHALLENGE_XP });
    }
  }
  const before = levelOf(p.xp);
  let total = lines.reduce((a, l) => a + l.xp, 0);
  p.xp += total;
  // Başarımlar (seviye başarımı XP eklendikten sonra kontrol edilir)
  const ctx = {
    m,
    byGame: stats.byGame,
    totalWins: Object.values(stats.byGame).reduce((a, g) => a + g.wins, 0),
    totalPlayed: Object.values(stats.byGame).reduce((a, g) => a + g.played, 0),
    bestStreak: Math.max(0, ...Object.values(stats.byGame).map((g) => g.best || 0)),
    humanMatches: p.humanMatches,
    level: levelOf(p.xp).level,
  };
  const ach = [];
  for (const a of ACHIEVEMENTS) {
    if (p.ach.includes(a.id) || !a.check(ctx)) continue;
    p.ach.push(a.id);
    ach.push(a.name);
    lines.push({ label: `Başarım: ${a.name}`, xp: ACH_XP });
    p.xp += ACH_XP;
    total += ACH_XP;
    ctx.level = levelOf(p.xp).level;
  }
  const after = levelOf(p.xp);
  return { next: p, reward: { lines, total, before, after, done, ach } };
}
