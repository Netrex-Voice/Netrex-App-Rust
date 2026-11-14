// Toplu mesaj yazma mantığının birim testleri:  npm run test:unit
import test from "node:test";
import assert from "node:assert/strict";
import { createBatcher, expandMessageDocs, mergeMessages } from "../chatBatch.js";

const msg = (id, ts, extra = {}) => ({ id, text: `m${id}`, userId: "u1", username: "Ali", timestamp: ts, ...extra });

function setup(opts = {}) {
  const writes = [];
  let n = 0;
  const batcher = createBatcher({
    write: async (chunk) => { writes.push(structuredClone(chunk)); },
    delayMs: 30,
    maxItems: 3,
    newId: () => `chunk${++n}`,
    ...opts,
  });
  return { batcher, writes };
}

test("mesajlar tek belgede birikir ve süre dolunca TEK yazmayla kaydedilir", async () => {
  const { batcher, writes } = setup();
  const d1 = batcher.add({ serverId: "s", channelId: "c", message: msg("a", 1) });
  const d2 = batcher.add({ serverId: "s", channelId: "c", message: msg("b", 2, { _doc: "x", _chunk: true, imageUrl: undefined }) });
  assert.equal(d1, "chunk1");
  assert.equal(d2, "chunk1");
  assert.equal(writes.length, 0);
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(writes.length, 1);
  const { docId, data } = writes[0];
  assert.equal(docId, "chunk1");
  assert.equal(data.userId, "u1");
  assert.equal(data.timestamp, 1);
  assert.equal(data.lastTimestamp, 2);
  // yazar bilgisi belge düzeyinde; iç alanlar (_doc, _chunk) ve undefined değerler yazılmaz
  assert.deepEqual(data.items, [{ id: "a", text: "ma", timestamp: 1 }, { id: "b", text: "mb", timestamp: 2 }]);
  assert.equal(batcher.pendingCount(), 0);
});

test("sınır dolunca beklemeden yazılır; sonraki mesaj yeni belgeye gider", async () => {
  const { batcher, writes } = setup();
  for (const [i, id] of ["a", "b", "c"].entries()) batcher.add({ serverId: "s", channelId: "c", message: msg(id, i) });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(writes.length, 1);
  assert.equal(writes[0].data.items.length, 3);
  assert.equal(batcher.add({ serverId: "s", channelId: "c", message: msg("d", 9) }), "chunk2");
  await batcher.flushAll();
  assert.equal(writes.length, 2);
});

test("kanallar ayrı belgelere yazılır; flushAll hepsini yazar", async () => {
  const { batcher, writes } = setup();
  batcher.add({ serverId: "s", channelId: "c1", message: msg("a", 1) });
  batcher.add({ serverId: "s", channelId: "c2", message: msg("b", 2) });
  await batcher.flushAll();
  assert.deepEqual(writes.map((w) => w.channelId).sort(), ["c1", "c2"]);
});

test("yazılmadan önce düzenleme, silme ve tepki kuyruğa uygulanır", async () => {
  const { batcher, writes } = setup();
  batcher.add({ serverId: "s", channelId: "c", message: msg("a", 1) });
  batcher.add({ serverId: "s", channelId: "c", message: msg("b", 2) });
  assert.equal(batcher.editPending("s", "c", "a", { text: "düzeltildi", edited: true }), true);
  assert.equal(batcher.editPending("s", "c", "yok", { text: "x" }), false);
  assert.equal(batcher.setPendingReactions("s", "c", "a", { "👍": ["u2"] }), true);
  assert.equal(batcher.removePending("s", "c", "b"), true);
  assert.equal(batcher.removePending("s", "c", "b"), false);
  await batcher.flushAll();
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].data.items, [{ id: "a", text: "düzeltildi", timestamp: 1, edited: true }]);
  assert.deepEqual(writes[0].data.reactions, { a: { "👍": ["u2"] } });
});

test("hepsi silinen kuyruk hiç yazılmaz", async () => {
  const { batcher, writes } = setup();
  batcher.add({ serverId: "s", channelId: "c", message: msg("a", 1) });
  batcher.removePending("s", "c", "a");
  await batcher.flushAll();
  assert.equal(writes.length, 0);
});

test("yazma hatasında yeniden denenir", async () => {
  let calls = 0;
  const { batcher } = setup({
    write: async () => { calls += 1; if (calls === 1) throw new Error("ağ yok"); },
  });
  batcher.add({ serverId: "s", channelId: "c", message: msg("a", 1) });
  await batcher.flushAll();
  assert.equal(calls, 2);
});

test("expandMessageDocs: eski tek-mesaj belgeleri ve toplu belgeler birlikte, zamana göre sıralı", () => {
  const out = expandMessageDocs([
    { id: "chunk1", data: { userId: "u1", username: "Ali", timestamp: 10, items: [{ id: "a", text: "bir", timestamp: 10 }, { id: "b", text: "üç", timestamp: 30 }], reactions: { b: { "👍": ["u2"] } } } },
    { id: "old1", data: { userId: "u2", username: "Veli", text: "iki", timestamp: 20 } },
  ]);
  assert.deepEqual(out.map((m) => m.id), ["a", "old1", "b"]);
  assert.deepEqual(out[0], { userId: "u1", username: "Ali", id: "a", text: "bir", timestamp: 10, _doc: "chunk1", _chunk: true });
  assert.equal(out[1]._chunk, false);
  assert.equal(out[1]._doc, "old1");
  assert.deepEqual(out[2].reactions, { "👍": ["u2"] });
});

test("mergeMessages: tekilleştirir (ilk gelen kalır) ve sıralar", () => {
  const base = [{ id: "a", timestamp: 1, text: "kayıtlı" }, { id: "c", timestamp: 3 }];
  const merged = mergeMessages(base, [{ id: "a", timestamp: 1, text: "canlı" }, { id: "b", timestamp: 2 }]);
  assert.deepEqual(merged.map((m) => m.id), ["a", "b", "c"]);
  assert.equal(merged[0].text, "kayıtlı");
  assert.equal(mergeMessages(base, []), base);
});
