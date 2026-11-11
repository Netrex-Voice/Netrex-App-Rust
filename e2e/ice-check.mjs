// Odadayken WebRTC'nin hangi yoldan bağlandığını (UDP / TCP / TURN-relay) pasif okur. Hiçbir şeyi değiştirmez.
const tabs = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = tabs.find((t) => t.type === "page" && t.url.startsWith("http://tauri.localhost/") && !t.url.includes("/overlays/"));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) pend.get(m.id)(m); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

const proto = await send("Runtime.evaluate", { expression: "RTCPeerConnection.prototype" });
const objs = await send("Runtime.queryObjects", { prototypeObjectId: proto.result.result.objectId });
const arr = await send("Runtime.callFunctionOn", {
  objectId: objs.result.objects.objectId,
  functionDeclaration: `async function () {
    const out = [];
    for (const pc of this) {
      if (pc.connectionState === 'closed') continue;
      const stats = await pc.getStats();
      const byId = {}; stats.forEach((s) => { byId[s.id] = s; });
      let pair = null, transport = null;
      stats.forEach((s) => { if (s.type === 'transport') transport = s; });
      if (transport && transport.selectedCandidatePairId) pair = byId[transport.selectedCandidatePairId];
      if (!pair) stats.forEach((s) => { if (s.type === 'candidate-pair' && s.nominated && s.state === 'succeeded') pair = s; });
      const l = pair && byId[pair.localCandidateId], r = pair && byId[pair.remoteCandidateId];
      const cands = []; stats.forEach((s) => { if (s.type === 'local-candidate') cands.push(s.candidateType + '/' + (s.protocol || '?') + (s.relayProtocol ? '(' + s.relayProtocol + ')' : '')); });
      out.push({
        durum: pc.connectionState + ' / ice ' + pc.iceConnectionState,
        secilen: pair ? { yerel: l && (l.candidateType + '/' + l.protocol + (l.relayProtocol ? '(' + l.relayProtocol + ')' : '')), uzak: r && (r.candidateType + '/' + r.protocol), rttMs: pair.currentRoundTripTime != null ? Math.round(pair.currentRoundTripTime * 1000) : null } : null,
        dtls: transport && transport.dtlsState,
        toplananAdaylar: [...new Set(cands)],
      });
    }
    return JSON.stringify(out);
  }`,
  returnByValue: true,
  awaitPromise: true,
});
console.log(arr.result.result.value ? JSON.stringify(JSON.parse(arr.result.result.value), null, 1) : JSON.stringify(arr));
process.exit(0);
