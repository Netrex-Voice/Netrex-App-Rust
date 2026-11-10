import test from "node:test";
import assert from "node:assert/strict";
import * as g2048 from "../solo/engines/g2048.js";
import * as ms from "../solo/engines/minesweeper.js";
import * as tt from "../solo/engines/tetris.js";
import * as c4 from "../solo/engines/connect4.js";
import { makeRng } from "../engines/util.js";

test("2048: kaydırma, birleştirme (tek seferde bir kez), puan, hamle yok tespiti", () => {
  const b = [2, 2, 2, 2, 4, 0, 4, 0, 0, 0, 0, 0, 8, 8, 16, 0];
  const r = g2048.move(b, "left");
  assert.deepEqual(r.board.slice(0, 4), [4, 4, 0, 0], "2,2,2,2 → 4,4");
  assert.deepEqual(r.board.slice(4, 8), [8, 0, 0, 0]);
  assert.deepEqual(r.board.slice(12, 16), [16, 16, 0, 0]);
  assert.equal(r.gained, 4 + 4 + 8 + 16);
  assert.equal(g2048.move([2, 0, 0, 0, 4, 0, 0, 0, 8, 0, 0, 0, 16, 0, 0, 0], "left").moved, false);
  assert.deepEqual(g2048.move([2, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "right").board.slice(0, 4), [0, 0, 0, 4]);
  assert.deepEqual(g2048.move([0, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 4, 0, 0, 0], "up").board.filter((_, i) => i % 4 === 0), [4, 4, 0, 0]);
  const full = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
  assert.equal(g2048.canMove(full), false);
  assert.equal(g2048.start(makeRng(3)).filter(Boolean).length, 2);
});

test("mayın tarlası: ilk tık güvenli, taşma açılışı, sayılar doğru, kazanma/kaybetme, bayrak", () => {
  const rng = makeRng(11);
  const g = ms.blank(9, 9);
  ms.reveal(g, 40, 10, rng);
  assert.equal(g.lost, false);
  assert.equal(g.cells.filter((c) => c.mine).length, 10);
  assert.ok(!g.cells[40].mine && g.cells[40].open && g.cells[40].n === 0, "ilk tık sıfır bölgesi açar");
  assert.ok(g.opened > 1, "taşma açılışı");
  g.cells.forEach((c, i) => {
    if (c.mine) return;
    const x = i % 9, y = (i / 9) | 0;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if ((dx || dy) && nx >= 0 && ny >= 0 && nx < 9 && ny < 9 && g.cells[ny * 9 + nx].mine) n++;
    }
    assert.equal(c.n, n);
  });
  g.cells.forEach((c, i) => !c.mine && ms.reveal(g, i, 10, rng));
  assert.equal(g.won, true);
  const h = ms.blank(5, 5);
  ms.reveal(h, 12, 10, makeRng(2));
  assert.equal(h.won, false);
  const mine = h.cells.findIndex((c) => c.mine);
  ms.flag(h, mine);
  ms.reveal(h, mine, 10);
  assert.equal(h.lost, false, "bayraklı hücre açılmaz");
  ms.flag(h, mine);
  ms.reveal(h, mine, 10);
  assert.equal(h.lost, true);
});

test("blok yığma: satır temizleme, puan, tepme, sınır, oyun sonu, 7'li torba", () => {
  const g = tt.newGame(makeRng(5));
  const seen = new Set([g.piece.kind, g.next]);
  for (let i = 0; i < 5 && !g.over; i++) { tt.hardDrop(g); seen.add(g.next); }
  assert.ok(seen.size >= 6, "torba: parçalar çeşitli");
  const h = tt.newGame(makeRng(1));
  h.grid[tt.H - 1] = new Array(tt.W).fill("T");
  for (let x = 0; x < 4; x++) h.grid[tt.H - 1][x] = null;
  h.piece = { kind: "I", rot: 0, x: 0, y: 0 };
  h.piece.y = tt.ghostY(h);
  assert.equal(tt.lock(h), 1);
  assert.equal(h.lines, 1);
  assert.equal(h.score, 100);
  assert.ok(h.grid[tt.H - 1].every((c) => c === null), "temizlenen satırın üstü aşağı kaydı");
  const r = tt.newGame(makeRng(2));
  r.piece = { kind: "I", rot: 1, x: -2, y: 5 };
  assert.equal(tt.rotate(r, 1), true, "duvara yaslıyken tepmeyle döner");
  const s = tt.newGame(makeRng(2));
  s.piece = { kind: "O", rot: 0, x: -1, y: 3 };
  assert.equal(tt.tryMove(s, -1, 0), false, "sol sınır");
  const o = tt.newGame(makeRng(4));
  for (let y2 = 0; y2 < 4; y2++) o.grid[y2].fill("Z");
  tt.lock(o);
  assert.equal(o.over, true);
  assert.ok(tt.dropInterval(1) > tt.dropInterval(10));
});

test("4 bağla: dört yönde kazanma, doluluk, bot kazanan hamleyi bulur ve rakibi engeller", () => {
  let b = c4.emptyBoard();
  for (const c of [0, 1, 2, 3]) b = c4.drop(b, c, 1).board;
  assert.ok(c4.winLine(b), "yatay");
  b = c4.emptyBoard();
  for (let i = 0; i < 4; i++) b = c4.drop(b, 2, 2).board;
  assert.ok(c4.winLine(b), "dikey");
  b = c4.emptyBoard();
  for (const [c, w] of [[0, 1], [1, 2], [1, 1], [2, 2], [2, 2], [2, 1], [3, 2], [3, 2], [3, 2], [3, 1]]) b = c4.drop(b, c, w).board;
  assert.ok(c4.winLine(b), "çapraz");
  b = c4.emptyBoard();
  for (const c of [0, 1, 2]) b = c4.drop(b, c, 2).board;
  b = c4.drop(b, 5, 1).board;
  assert.equal(c4.botMove(b, 2, 4), 3, "kazanan hamle");
  b = c4.emptyBoard();
  for (const c of [0, 1, 2]) b = c4.drop(b, c, 1).board;
  b = c4.drop(b, 6, 2).board;
  assert.equal(c4.botMove(b, 2, 4), 3, "tek tehdidi engellemeli");
  const full = c4.emptyBoard();
  for (let c = 0; c < 7; c++) for (let r = 0; r < 6; r++) full[c][r] = ((c + r) % 2) + 1;
  assert.equal(c4.drop(full, 0, 1), null);
  assert.equal(c4.isFull(full), true);
});
