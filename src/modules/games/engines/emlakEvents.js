/**
 * Emlak olayları: iki ardışık görünüm (engine.view çıktısı) arasındaki farktan "ne oldu?" listesi üretir.
 * Saf fonksiyon (Node'da test edilir); arayüz bu olayları sırayla oynatır (zar, yürüyüş, efekt, kamera, ses).
 * Sıra: zar → hareket → (kart karesine iniş → kart → kartın sonucuna yürüyüş) → başlangıç → kira/vergi → satın alma/takas → ev → ipotek → gözaltı → iflas → ihale → sıra.
 */
import { BOARD, PASS_GO } from "./emlak.js";

const N = BOARD.length;
const fwd = (a, b) => (b - a + N) % N;

export function diffEvents(prev, v) {
  const out = [];
  if (!prev || !v || prev.players.length !== v.players.length) return out;
  const P = v.players;
  const Q = prev.players;
  const n = P.length;
  const d = P.map((p, i) => p.cash - Q[i].cash);

  // zar + hareket (+ başlangıçtan geçiş)
  const rolled = v.rolls !== prev.rolls;
  if (rolled) out.push({ type: "roll", who: prev.turn, dice: v.dice, double: v.dice[0] === v.dice[1], seed: v.rolls });
  // kart çekildiyse piyon önce kartın karesine iner, kart açılır, sonra kartın sonucuna yürür
  const cardDrawn = v.card && v.card !== prev.card;
  const cw = prev.turn;
  let cardDone = false;
  const wrappedTo = (a, b, i) => (b < a && fwd(a, b) <= 12) || (b === 0 && a !== 0 && d[i] >= PASS_GO);
  const stride = (i, a, b) => {
    out.push({ type: "move", who: i, from: a, to: b });
    if (wrappedTo(a, b, i)) {
      out.push({ type: "go", who: i, amount: PASS_GO });
      d[i] -= PASS_GO; // sonraki nakit eşleştirmeleri başlangıç parasından etkilenmesin
    }
  };
  for (let i = 0; i < n; i++) {
    const a = Q[i].pos;
    const b = P[i].pos;
    if (a === b && !(cardDrawn && i === cw && rolled)) continue;
    const land = (a + v.dice[0] + v.dice[1]) % N;
    if (cardDrawn && rolled && i === cw && BOARD[land].kind === "card") {
      if (a !== land) stride(i, a, land);
      out.push({ type: "card", who: i, deck: v.cardDeck, text: v.card });
      cardDone = true;
      if (land !== b) stride(i, land, b);
    } else if (a !== b) stride(i, a, b);
  }

  const own = [];
  for (let sq = 0; sq < N; sq++) if (v.own[sq] !== prev.own[sq]) own.push({ sq, from: prev.own[sq], to: v.own[sq] });
  const outNow = P.map((p, i) => p.out && !Q[i].out);
  const anyOut = outNow.some(Boolean);

  // kira / vergi: mülk el değiştirmediyse karşılıklı eşit nakit değişimi kiradır
  const used = new Set();
  if (!own.length) {
    for (let i = 0; i < n; i++) {
      if (d[i] >= 0 || used.has(i)) continue;
      const j = d.findIndex((x, k) => k !== i && !used.has(k) && x === -d[i]);
      if (j >= 0) {
        used.add(i).add(j);
        out.push({ type: "rent", from: i, to: j, amount: -d[i], sq: P[i].pos });
      }
    }
    for (let i = 0; i < n; i++) {
      if (d[i] < 0 && !used.has(i) && BOARD[P[i].pos].kind === "tax") out.push({ type: "tax", who: i, amount: -d[i], sq: P[i].pos });
    }
  }

  // satın alma / ihale / takas
  if (own.length === 1 && own[0].from == null && own[0].to != null) {
    out.push({ type: prev.auction && !v.auction ? "auctionWin" : "buy", who: own[0].to, sq: own[0].sq, amount: Math.max(0, -d[own[0].to]) });
  } else if (own.length && !anyOut) {
    const who = [...new Set(own.flatMap((o) => [o.from, o.to]).filter((x) => x != null))];
    out.push({ type: "trade", who, own });
  }

  if (!anyOut) {
    for (let sq = 0; sq < N; sq++) {
      if (v.houses[sq] > prev.houses[sq]) out.push({ type: "build", sq, who: v.own[sq], level: v.houses[sq] });
      else if (v.houses[sq] < prev.houses[sq]) out.push({ type: "sellHouse", sq, who: v.own[sq] });
      if (v.mort[sq] !== prev.mort[sq]) out.push({ type: v.mort[sq] ? "mortgage" : "unmortgage", sq, who: v.own[sq] });
    }
  }

  for (let i = 0; i < n; i++) {
    if (P[i].jail > 0 !== Q[i].jail > 0) out.push({ type: P[i].jail > 0 ? "jail" : "free", who: i, sq: P[i].pos });
    if (outNow[i]) out.push({ type: "bankrupt", who: i, sq: P[i].pos });
  }

  if (!prev.auction && v.auction) out.push({ type: "auction", sq: v.auction.sq });
  if (cardDrawn && !cardDone) out.push({ type: "card", who: prev.turn, deck: v.cardDeck, text: v.card });
  if (v.turn !== prev.turn && v.phase !== "over") out.push({ type: "turn", who: v.turn });
  return out;
}
