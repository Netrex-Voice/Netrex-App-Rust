import test from "node:test";
import assert from "node:assert/strict";
import { LinkRouter, PeerLink } from "../p2p.js";

const fakeLink = (opts, log) => ({
  ...opts,
  state: "connecting",
  get open() { return this.state === "open"; },
  send(topic, obj, rel) { log.push(["p2p", topic, rel]); return this.state === "open"; },
  signalIn(k) { log.push(["sig", k]); },
  close() { this.state = "closed"; },
});

function setup() {
  const log = [];
  let t = 0;
  const r = new LinkRouter({ relay: (topic, o, dest, rel) => log.push(["relay", topic, dest, rel]), makeLink: (o) => fakeLink(o, log), now: () => t });
  return { r, log, tick: (ms) => (t += ms) };
}

test("bağlantı açılana kadar LiveKit'ten, açılınca P2P'den gider", () => {
  const { r, log } = setup();
  const l = r.connect("a", true);
  r.send("gm_state", {}, ["a"], false);
  assert.deepEqual(log.pop(), ["relay", "gm_state", ["a"], false]);
  l.state = "open";
  r.send("gm_state", {}, ["a"], false);
  assert.deepEqual(log.pop(), ["p2p", "gm_state", false]);
  assert.equal(r.isDirect("a"), true);
});

test("karışık hedefler bölünür; yayın (dest yok) her zaman LiveKit", () => {
  const { r, log } = setup();
  r.connect("a", true).state = "open";
  r.send("gm_react", {}, ["a", "b"], false);
  assert.deepEqual(log, [["p2p", "gm_react", false], ["relay", "gm_react", ["b"], false]]);
  log.length = 0;
  r.send("gm_lobby", {}, null, true);
  assert.deepEqual(log, [["relay", "gm_lobby", null, true]]);
});

test("düşen bağlantı LiveKit'e döner ve 20 sn içinde yeniden denenmez", () => {
  const { r, log, tick } = setup();
  const l = r.connect("a", true);
  l.state = "open";
  l.state = "failed";
  l.onState("failed");
  r.send("gm_in", {}, ["a"], true);
  assert.deepEqual(log.pop(), ["relay", "gm_in", ["a"], true]);
  assert.equal(r.connect("a", true), null, "bekleme süresi");
  tick(20001);
  assert.ok(r.connect("a", true));
});

test("send false dönerse (kanal tıkalı/kapalı) o mesaj LiveKit'e düşer", () => {
  const { r, log } = setup();
  const l = r.connect("a", true);
  l.state = "open";
  l.send = () => false;
  r.send("gm_in", {}, ["a"], true);
  assert.deepEqual(log.pop(), ["relay", "gm_in", ["a"], true]);
});

test("offer yeni link kurar ve sinyali iletir; kapalıyken (ayar) hiçbir link kurulmaz", () => {
  const { r, log } = setup();
  r.signal("x", "offer", { sdp: "..." });
  assert.ok(r.links.get("x"));
  assert.deepEqual(log.pop(), ["sig", "offer"]);
  r.setEnabled(false);
  assert.equal(r.links.size, 0);
  assert.equal(r.connect("y", true), null);
  r.send("gm_in", {}, ["x"], true);
  assert.deepEqual(log.pop(), ["relay", "gm_in", ["x"], true]);
});

test("PeerLink: bozuk / aşırı büyük çerçeveler yok sayılır, geçerli çerçeve gönderen kimliğiyle iletilir", () => {
  const got = [];
  const ch = () => ({ readyState: "connecting", bufferedAmount: 0, send() {} });
  class FakePC { createDataChannel() { return ch(); } close() {} }
  const l = new PeerLink({ peerId: "p", initiator: false, signal() {}, onMessage: (...a) => got.push(a), RTC: FakePC });
  l._recv("not json");
  l._recv(JSON.stringify(["t", 5]));
  l._recv(JSON.stringify([1, {}]));
  l._recv("x".repeat(17000));
  l._recv(JSON.stringify(["gm_in", { sid: "s" }]));
  assert.equal(got.length, 1);
  assert.deepEqual(got[0].slice(0, 3), ["gm_in", { sid: "s" }, "p"]);
  l.close();
});
