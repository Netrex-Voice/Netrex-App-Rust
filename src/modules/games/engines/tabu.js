/**
 * 🤫 Tabu — takım tabanlı kelime anlatma (host durum makinesi, saf mantık).
 * Gizlilik: aktif kartı YALNIZCA anlatıcı ve rakip takım (yasaklı denetçiler) görür; `view(s, pid)` kimin ne
 * göreceğini belirler. Anlatıcının kendi takımı kartı asla almaz. Süre/puan/kart sırası yalnızca burada değişir.
 * Kelime havuzu tabuCards.js içindeki özgün Türkçe kart listesinden gelir.
 */
import { TABU_CARDS } from "./tabuCards.js";
import { clamp, fin, shuffle } from "./util.js";

export const meta = { seats: [4, 12], teams: true };

export const TEAM_COLORS = { red: "#ef4444", blue: "#6366f1", green: "#23a559", amber: "#faa61a", pink: "#ec4899", teal: "#14b8a6" };

/** Host'un yazdığı özel kartlar: her satır "Kelime: yasak1, yasak2, ..." (3–5 yasaklı). Geçersiz satırlar atlanır. */
export function parseCustomCards(text) {
  const out = [];
  for (const line of String(text || "").split("\n").slice(0, 60)) {
    const [w, rest] = line.split(":");
    const word = (w || "").trim().slice(0, 28);
    const taboo = (rest || "").split(",").map((x) => x.trim().slice(0, 24)).filter(Boolean).slice(0, 5);
    if (word && taboo.length >= 3) out.push([word, taboo]);
  }
  return out;
}

export function create({ players, config = {}, rng = Math.random }) {
  const teams = [[], []];
  players.forEach((p, i) => teams[p.team === 1 || (p.team == null && i % 2) ? 1 : 0].push(p.id));
  const custom = parseCustomCards(config.customCards);
  const pack = config.cardPack === "custom" && custom.length >= 10 ? "custom" : config.cardPack === "mix" && custom.length ? "mix" : "builtin";
  const cards = pack === "custom" ? custom : pack === "mix" ? [...TABU_CARDS, ...custom] : TABU_CARDS;
  const nm = (v, d) => String(v || "").replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, 16) || d;
  const s = {
    t: "tabu",
    rng,
    cards,
    okPts: [1, 2, 3].includes(config.okPts) ? config.okPts : 1,
    tabooPts: [0, 1, 2].includes(config.tabooPts) ? config.tabooPts : 1,
    teamNames: [nm(config.name0, "Kırmızı Takım"), nm(config.name1, "Mavi Takım")],
    teamColors: [TEAM_COLORS[config.color0] || TEAM_COLORS.red, TEAM_COLORS[config.color1] || TEAM_COLORS.blue],
    teams,
    names: Object.fromEntries(players.map((p) => [p.id, p.name || ""])),
    secs: clamp(Math.round(fin(config.secs, 60)), 20, 180),
    rounds: clamp(Math.round(fin(config.rounds, 3)), 1, 6), // takım başına tur
    passLimit: clamp(Math.round(fin(config.passes, 3)), 0, 10),
    phase: "ready", // ready (anlatıcı hazır) | play | over
    turn: 0,
    rot: [0, 0],
    turnsPlayed: 0,
    score: [0, 0],
    remain: 0,
    passes: 0,
    deck: [],
    pos: 0,
    card: null,
    cardNo: 0,
    last: "",
    stats: { ok: 0, taboo: 0, pass: 0 },
  };
  s.deck = shuffle([...cards.keys()], rng);
  return s;
}

export const describer = (s) => (s.phase === "over" ? null : s.teams[s.turn][s.rot[s.turn] % s.teams[s.turn].length] ?? null);
const teamOf = (s, pid) => (s.teams[0].includes(pid) ? 0 : s.teams[1].includes(pid) ? 1 : -1);

function draw(s) {
  if (s.pos >= s.deck.length) {
    s.deck = shuffle([...s.cards.keys()], s.rng);
    s.pos = 0;
  }
  s.card = s.cards[s.deck[s.pos++]];
  s.cardNo++;
}

function endTurn(s, why) {
  s.turnsPlayed++;
  s.rot[s.turn]++;
  s.card = null;
  s.last = why;
  if (s.turnsPlayed >= s.rounds * 2) s.phase = "over";
  else {
    s.turn = 1 - s.turn;
    s.phase = "ready";
  }
}

export function input(s, pid, m) {
  if (!m || typeof m !== "object") return false;
  const d = describer(s);
  switch (m.t) {
    case "go":
      if (s.phase !== "ready" || pid !== d) return false;
      s.phase = "play";
      s.remain = s.secs;
      s.passes = s.passLimit;
      s.last = "";
      draw(s);
      return true;
    case "ok":
      if (s.phase !== "play" || pid !== d || !s.card) return false;
      s.score[s.turn] += s.okPts;
      s.stats.ok++;
      s.last = `Doğru! +${s.okPts}`;
      draw(s);
      return true;
    case "taboo": {
      // yalnızca rakip takım (denetçi) ya da rakip takım boşsa anlatıcı
      if (s.phase !== "play" || !s.card) return false;
      const oppN = s.teams[1 - s.turn].length;
      if (!(teamOf(s, pid) === 1 - s.turn || (!oppN && pid === d))) return false;
      s.score[s.turn] -= s.tabooPts;
      s.stats.taboo++;
      s.last = s.tabooPts ? `TABU! −${s.tabooPts}` : "TABU!";
      draw(s);
      return true;
    }
    case "pass":
      if (s.phase !== "play" || pid !== d || s.passes <= 0 || !s.card) return false;
      s.passes--;
      s.stats.pass++;
      s.last = "Pas";
      draw(s);
      return true;
    default:
      return false;
  }
}

export function tick(s, dt) {
  if (s.phase !== "play") return;
  s.remain -= dt;
  if (s.remain <= 0) {
    s.remain = 0;
    endTurn(s, "Süre doldu");
  }
}

export function playerLeft(s, pid) {
  const t = teamOf(s, pid);
  if (t < 0 || s.phase === "over") return;
  const wasDescriber = describer(s) === pid && s.phase !== "over";
  s.teams[t] = s.teams[t].filter((id) => id !== pid);
  if (!s.teams[0].length || !s.teams[1].length) {
    s.phase = "over";
    s.last = "Bir takım boş kaldı";
    s.card = null;
    return;
  }
  if (wasDescriber && s.phase === "play") endTurn(s, "Anlatıcı ayrıldı");
  else if (t === s.turn) s.rot[t] = s.rot[t] % s.teams[t].length;
}

export const isOver = (s) => s.phase === "over";

/** Kartı kimler görebilir: anlatıcı + rakip takım, yalnızca tur sürerken */
export function canSeeCard(s, pid) {
  if (s.phase !== "play" || !s.card) return false;
  return pid === describer(s) || teamOf(s, pid) === 1 - s.turn;
}

export function view(s, pid) {
  const d = describer(s);
  const v = {
    t: "tabu",
    phase: s.phase,
    teams: s.teams,
    names: s.names,
    teamNames: s.teamNames,
    teamColors: s.teamColors,
    okPts: s.okPts,
    tabooPts: s.tabooPts,
    score: s.score,
    turn: s.turn,
    describer: d,
    remain: Math.ceil(s.remain),
    secs: s.secs,
    passes: s.passes,
    passLimit: s.passLimit,
    turnsPlayed: s.turnsPlayed,
    totalTurns: s.rounds * 2,
    last: s.last,
    stats: s.stats,
    winner: s.phase === "over" ? (s.score[0] === s.score[1] ? -1 : s.score[0] > s.score[1] ? 0 : 1) : null,
    me: teamOf(s, pid),
  };
  // Gizli kart yalnızca yetkili oyuncuya gider; anlatıcının takımı yalnızca kart numarasını görür
  if (canSeeCard(s, pid)) v.card = { word: s.card[0], taboo: s.card[1], no: s.cardNo, judge: pid !== d };
  else v.cardHidden = s.phase === "play";
  return v;
}
