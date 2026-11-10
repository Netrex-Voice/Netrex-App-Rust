"use client";

import { Component, Suspense, lazy, useEffect } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { Gamepad2 } from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { toast } from "@/src/utils/toast";
import { useGamesStore, useGamesPrefs, useGamesLibrary, useGamesStats, resultOf, detailOf, live, REALTIME, metaKey, useGamesProgress, matchOf } from "./store";
import { getGame } from "./registry";
import { HostSession, LIMITS } from "./runtime";
import { LinkRouter, PeerLink, SIG_TOPIC } from "./p2p";

/**
 * 🎮 Netrex Games — oda içi oturum köprüsü (HAFİF)
 *
 * Ağ: LiveKit data channel (`gm_*` konuları). Tek yetki kaynağı oturumu açan istemci (HOST): oyun durumu
 * yalnızca onda yaşar (`HostSession`), diğer herkese yalnızca kendi görünümü gider. Gönderen kimliği LiveKit'in
 * imzaladığı Netrex kimliğidir; ayrı bir kimlik doğrulama sistemi yoktur. Ağır arayüz `lazy()` ile yalnızca panel
 * açılınca yüklenir; ayarlardan kapalıysa hiçbir dinleyici kurulmaz.
 *
 * Taşıyıcı: host ↔ misafir arası doğrudan WebRTC DataChannel (p2p.js, düşük gecikme); LiveKit yalnızca sinyalleşme,
 * yayınlar (lobi) ve P2P kurulamadığında yedek yoldur.
 */

const GamesHub = lazy(() => import("./GamesHub"));

const enc = (o) => new TextEncoder().encode(JSON.stringify(o));
const dec = (b) => JSON.parse(new TextDecoder().decode(b));
const st = () => useGamesStore.getState();

let bridge = null;
export const gamesActions = {
  isReady: () => !!bridge,
  toggle: () => bridge?.toggle(),
  create: (gameId, opts) => bridge?.create(gameId, opts),
  join: () => bridge?.join(),
  leave: () => bridge?.leave(),
  cmd: (c) => bridge?.cmd(c),
  input: (m, reliable = true) => bridge?.input(m, reliable),
};

class GamesBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    console.error("Games modülü hatası:", error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0e0f12]/95">
        <div className="max-w-sm text-center p-6 rounded-2xl bg-[#111214] border border-red-500/30">
          <div className="text-sm font-bold text-red-400 mb-1">Oyun açılamadı</div>
          <p className="text-xs text-[#949ba4] mb-4">Oyun modülünde bir sorun oluştu. Oda ve ses etkilenmedi.</p>
          <button onClick={this.props.onClose} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition">
            Kapat
          </button>
        </div>
      </div>
    );
  }
}

function GamesSession() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const open = useGamesStore((s) => s.open);
  const myId = localParticipant?.identity;

  useEffect(() => {
    if (!room || !localParticipant || !myId) return;
    let host = null; // HostSession | null
    let loop = null;
    let lastT = 0;
    const playedSids = new Set();

    const lk = (topic, obj, dest, reliable = true) => {
      try {
        const bytes = enc(obj);
        if (bytes.length > 14000) return; // güvenli üst sınır
        localParticipant.publishData(bytes, { topic, reliable, ...(dest ? { destinationIdentities: dest } : {}) });
      } catch (e) {}
    };
    // Hedefli mesajlar P2P'den (açıksa), yayınlar ve yedek LiveKit'ten
    const router = new LinkRouter({
      relay: lk,
      makeLink: (o) =>
        new PeerLink({
          ...o,
          signal: (k, d) => lk(SIG_TOPIC, { k, d }, [o.peerId], true),
          onMessage: (topic, obj, from, size) => handle(topic, obj, from, size),
        }),
    });
    router.enabled = useGamesPrefs.getState().p2p !== false;
    const unsubPrefs = useGamesPrefs.subscribe((p) => router.setEnabled(p.p2p !== false));
    const publish = (topic, obj, dest, reliable = true) => router.send(topic, obj, dest, reliable);
    const dropLinks = () => router.closeAll();

    // ───── Gelen mesajı store'a uygula (host kendi mesajlarını da buradan geçirir) ─────
    const apply = (topic, o, from) => {
      const s = st();
      if (topic === "gm_lobby") {
        // Lobiyi yalnızca kendi kimliğiyle host olan gönderebilir; şekil bozuksa yok sayılır
        if (o.hostId !== from || !getGame(o.gameId) || !Array.isArray(o.players) || o.players.length > 12) return;
        if (s.session && s.session.sid !== o.sid && s.session.hostId !== from) return; // ilk açılan geçerli
        if (s.session && s.session.hostId !== from) return;
        s.setSession(o);
        if (!host && o.hostId !== myId && o.players.some((p) => p.id === myId)) router.connect(o.hostId, true);
        if (o.status === "playing" && !playedSids.has(o.sid)) {
          playedSids.add(o.sid);
          if (o.players.some((p) => p.id === myId)) useGamesLibrary.getState().markPlayed(o.gameId);
        }
        if (o.status === "lobby") s.setView(null);
      } else if (topic === "gm_state") {
        if (s.session?.sid === o.sid && s.session.hostId === from) {
          if (REALTIME.has(o.v?.t)) {
            // konumlar canlı kanala; React yalnızca meta değişince
            if (typeof o.v.time === "number" && live.v && live.v.time > o.v.time && live.v.phase === o.v.phase) return; // sırası bozuk (kayıplı kanal)
            live.push(o.v);
            if (!s.view || metaKey(s.view) !== metaKey(o.v)) s.setView(o.v);
          } else s.setView(o.v);
          const key = `${o.sid}-${s.session.round}`;
          const res = resultOf(o.v, myId);
          if (res && !playedSids.has("r" + key)) {
            playedSids.add("r" + key);
            const names = s.session.players.filter((p) => p.id !== myId).map((p) => p.name).slice(0, 4);
            useGamesStats.getState().record(o.v.t, res, detailOf(o.v), names.join(", "));
            const m = matchOf(o.v, myId, s.session);
            if (m) useGamesProgress.getState().apply(key, m, useGamesStats.getState());
          }
        }
      } else if (topic === "gm_rej") {
        if (s.session?.sid === o.sid) toast.error("Bu hamle geçerli değil", { id: "gm-rej", duration: 1500 });
      } else if (topic === "gm_kicked") {
        if (s.session?.sid === o.sid) {
          dropLinks();
          s.resetSession();
          toast.info("Oturumdan çıkarıldın");
        }
      } else if (topic === "gm_invite") {
        const g = getGame(o.gameId);
        if (g && !s.session) {
          toast.info(`${String(o.from || "Biri").slice(0, 32)} seni ${g.name} oyununa davet etti`, {
            id: "gm-invite",
            duration: 12000,
            action: { label: "Katıl", onClick: () => (st().setOpen(true), st().go("room"), bridge?.join()) },
          });
        }
      } else if (topic === "gm_react") {
        if (s.session?.sid === o.sid && typeof o.e === "string") {
          const id = Math.random().toString(36).slice(2);
          s.pushReaction({ id, e: o.e.slice(0, 4), name: String(o.name || "").slice(0, 24) });
          setTimeout(() => st().dropReaction(id), 3200);
        }
      } else if (topic === "gm_close") {
        if (s.session?.sid === o.sid && s.session.hostId === from) {
          dropLinks();
          s.resetSession();
          live.v = null;
          toast.info("Oyun oturumu kapandı");
        }
      }
    };

    // Host'un taşıyıcısı: kendime giden mesaj yerel uygulanır, kalanı ağa gider
    const transport = {
      send: (topic, obj, dest, reliable) => {
        const remote = dest ? dest.filter((d) => d !== myId) : null;
        if (!dest || dest.includes(myId)) apply(topic, obj, myId);
        if (dest ? remote.length : true) publish(topic, obj, remote, reliable);
      },
    };

    const stopHosting = (announce = true) => {
      if (loop) clearInterval(loop);
      loop = null;
      dropLinks();
      if (host && announce) transport.send("gm_close", { sid: host.sid }, null, true);
      host = null;
    };

    const startLoop = () => {
      lastT = performance.now();
      loop = setInterval(() => {
        const now = performance.now();
        const dt = Math.min(0.1, (now - lastT) / 1000);
        lastT = now;
        if (!host) return;
        try {
          host.tick(dt);
        } catch (e) {
          console.error("[games] simülasyon hatası", e);
          toast.error("Oyun hatası — oturum kapatıldı");
          stopHosting();
          st().resetSession();
        }
      }, 16);
    };

    // Host'a gelen (ya da kendi) komutlar; yetkiyi HostSession denetler
    const runCmd = (from, c) => {
      if (c.k === "team") host.setTeam(c.id && from === host.hostId ? String(c.id) : from, c.team);
      else if (c.k === "ready") host.setReady(from, !!c.v);
      else if (c.k === "token") host.setToken(from, c.id ? String(c.id) : from, Number(c.v));
      else if (c.k === "start") host.start(from);
      else if (c.k === "bot") host.addBot(from);
      else if (c.k === "rmbot") host.removeBot(from, String(c.id));
      else if (c.k === "cfg") host.setConfig(from, c.cfg);
      else if (c.k === "kick") host.kick(from, String(c.id));
      else if (c.k === "lobby") host.backToLobby(from);
      else if (c.k === "access") host.setAccess(from, c.v);
      else if (c.k === "invite") host.invite(from, Array.isArray(c.ids) ? c.ids.map(String) : []);
      else if (c.k === "react") host.react(from, c.e);
    };

    // Tek giriş noktası: LiveKit (yayın/yedek) ve P2P (doğrudan) mesajları aynı yoldan geçer; `from` her iki yolda da
    // imzalı kimliktir (P2P bağlantısı yalnızca sinyalleşmeyi yapan kimliğe bağlanır).
    const handle = (topic, o, from, size, name) => {
      if (!from || from === myId || !topic.startsWith("gm_") || size > LIMITS.MSG_BYTES) return;
      if (!o || typeof o !== "object") return;

      if (topic === "gm_ping") {
        if (host) publish("gm_pong", { t: o.t }, [from], false);
        return;
      }
      if (topic === "gm_pong") {
        const rtt = (performance.now() - Number(o.t)) / 1000;
        if (rtt > 0 && rtt < 2) live.rtt = live.rtt * 0.7 + rtt * 0.3;
        return;
      }
      if (topic === "gm_ask") {
        if (host) host.resync(from);
        return;
      }
      if (host && o.sid === host.sid) {
        if (topic === "gm_join") return void host.join(from, name || o.name || "Oyuncu");
        if (topic === "gm_leave") return void (host.leave(from), router.drop(from));
        if (topic === "gm_in") return void host.input(from, o.m);
        if (topic === "gm_cmd") return void runCmd(from, o.c || {});
      }
      if (!host) apply(topic, o, from);
    };

    const onData = (payload, participant, _k, topic) => {
      if (!participant || !topic || participant.identity === myId || payload.byteLength > LIMITS.MSG_BYTES) return;
      let o;
      try {
        o = dec(payload);
      } catch (e) {
        return;
      }
      if (topic === SIG_TOPIC) {
        // Yalnızca host teklif (offer) kabul eder; cevap/ICE yalnızca bizim başlattığımız hatlara uygulanır
        if (o && typeof o.k === "string" && (o.k !== "offer" || host)) router.signal(participant.identity, o.k, o.d);
        return;
      }
      handle(topic, o, participant.identity, payload.byteLength, participant.name);
    };

    const onLeft = (p) => {
      const id = p?.identity;
      router.drop(id);
      if (host) host.leave(id);
      else if (st().session?.hostId === id) {
        dropLinks();
        st().resetSession();
        toast.info("Oyunu açan kişi ayrıldı, oturum kapandı");
      }
    };

    const onReconnected = () => {
      st().setConn("ok");
      publish("gm_ask", {});
    };

    bridge = {
      toggle: () => st().setOpen(!st().open),
      create: async (gameId, { solo = false } = {}) => {
        const m = getGame(gameId);
        if (!m || host || st().session) return;
        try {
          const engine = await m.engine();
          host = new HostSession({
            sid: Math.random().toString(36).slice(2, 10),
            manifest: m, engine, hostId: myId, hostName: localParticipant.name || "Host", transport,
          });
          startLoop();
          host.publishLobby();
          st().go("room");
          if (solo) {
            while (host.players.size < Math.max(m.players.min, m.fillBots ? 1 : 2) && host.addBot(myId));
            host.start(myId);
          } else {
            toast.info(`${m.name} lobisi açıldı`, { id: "gm-open" });
          }
        } catch (e) {
          console.error("[games] oturum açılamadı", e);
          stopHosting(false);
          toast.error("Oyun yüklenemedi");
        }
      },
      join: () => {
        const sid = st().session?.sid;
        if (sid && !host) {
          router.connect(st().session.hostId, true);
          publish("gm_join", { sid });
        }
        st().go("room");
      },
      leave: () => {
        const s = st().session;
        if (!s) return;
        if (host) stopHosting();
        else {
          publish("gm_leave", { sid: s.sid });
          dropLinks();
        }
        st().resetSession();
        st().go("store");
      },
      cmd: (c) => {
        const s = st().session;
        if (!s) return;
        if (host) runCmd(myId, c);
        else publish("gm_cmd", { sid: s.sid, c });
      },
      input: (m, reliable) => {
        const s = st().session;
        if (!s) return;
        if (host) host.input(myId, m);
        else publish("gm_in", { sid: s.sid, m }, [s.hostId], reliable);
      },
    };

    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.ParticipantDisconnected, onLeft);
    room.on(RoomEvent.Reconnected, onReconnected);
    room.on(RoomEvent.Reconnecting, () => st().setConn("lost"));
    publish("gm_ask", {});

    // Misafir: oturumdayken 1,5 sn'de bir RTT ölçümü (tahmin ve ileri sarma bunu kullanır)
    const pinger = setInterval(() => {
      const s = st().session;
      if (s && !host && s.status === "playing") {
        live.route = router.isDirect(s.hostId) ? "p2p" : "relay";
        publish("gm_ping", { t: performance.now() }, [s.hostId], false); // oyun trafiğiyle aynı yoldan: gerçek RTT
      }
    }, 1000);

    // Uzun süre işlem görmeyen lobi/oyun kendini kapatır (kaynak sızıntısı olmaz)
    const idleCheck = setInterval(() => {
      if (host?.idle()) {
        toast.info("Hareketsizlik nedeniyle oyun oturumu kapandı");
        stopHosting();
        st().resetSession();
      }
    }, 60000);

    return () => {
      clearInterval(idleCheck);
      clearInterval(pinger);
      unsubPrefs();
      router.closeAll();
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.ParticipantDisconnected, onLeft);
      room.off(RoomEvent.Reconnected, onReconnected);
      stopHosting();
      bridge = null;
      st().resetSession();
      st().setOpen(false);
    };
  }, [room, localParticipant, myId]);

  if (!open) return null;
  return (
    <GamesBoundary onClose={() => gamesActions.toggle()}>
      <Suspense
        fallback={
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0e0f12]/95 text-[#949ba4] text-sm gap-2">
            <Gamepad2 size={18} className="animate-pulse" /> Oyunlar yükleniyor…
          </div>
        }
      >
        <GamesHub />
      </Suspense>
    </GamesBoundary>
  );
}

/** Ayarlardan kapalıysa HİÇBİR ŞEY çalışmaz */
export default function GamesHandler() {
  const enabled = useSettingsStore((s) => s.gamesEnabled);
  if (!enabled) return null;
  return <GamesSession />;
}
