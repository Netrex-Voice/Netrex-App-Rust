import { useEffect, useRef } from "react";
import { useRoomContext } from "@livekit/components-react";
import { Track, RoomEvent } from "livekit-client";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useLatencyStatsStore } from "@/src/store/latencyStatsStore";

// Konuşma gecikmesini düşürür: alıcı tarafındaki jitter (titreşim) tamponunu küçültür ve ağ takılırsa
// kendini otomatik geri açar. Gecikmenin ağ ve ses cihazı dışındaki en büyük, bizim kontrol ettiğimiz kalemi bu.
//
//   normal : tarayıcı varsayılanı (dokunma)
//   low    : hedef tampon 30 ms
//   ultra  : hedef tampon 0 ms (olabildiğince düşük; zayıf ağda daha çok takılır, koruma devreye girer)
//
// Koruma: boşluk doldurma (takılma) oranı yükselirse hedef kademeli artar, ağ düzelince yavaşça tabana iner.

const FLOOR_MS = { normal: null, low: 30, ultra: 0 };
const CEIL_MS = 150; // koruma en fazla bu kadar tampona çıkar
const STEP_UP_MS = 20;
const STEP_DOWN_MS = 10;
const BAD_RATIO = 0.03; // %3'ten fazla takılma → tamponu artır
const GOOD_RATIO = 0.01; // %1'in altı → inmeye uygun
const RECOVER_AFTER_MS = 20000;
const TICK_MS = 2000;

function setReceiverTarget(receiver, ms) {
  if (!receiver) return;
  try {
    if ("jitterBufferTarget" in receiver) receiver.jitterBufferTarget = ms == null ? null : ms;
  } catch (e) {}
  try {
    if ("playoutDelayHint" in receiver) receiver.playoutDelayHint = ms == null ? undefined : ms / 1000;
  } catch (e) {}
}

function remoteMicReceivers(room) {
  const list = [];
  room.remoteParticipants.forEach((p) => {
    const track = p.getTrackPublication(Track.Source.Microphone)?.track;
    if (track?.receiver) list.push(track.receiver);
  });
  return list;
}

export function useLatencyOptimizer() {
  const room = useRoomContext();
  const latencyMode = useSettingsStore((s) => s.latencyMode ?? "low");

  const modeRef = useRef(latencyMode);
  modeRef.current = latencyMode;

  useEffect(() => {
    if (!room) return;

    let targetMs = null;
    let goodSince = Date.now();
    const prev = new WeakMap(); // receiver -> önceki sayaçlar
    let stopped = false;

    const applyAll = () => {
      remoteMicReceivers(room).forEach((r) => setReceiverTarget(r, targetMs));
    };

    const tick = async () => {
      if (stopped) return;
      const floor = FLOOR_MS[modeRef.current] ?? null;
      const receivers = remoteMicReceivers(room);

      let worstRatio = 0;
      let jbDelaySum = 0;
      let jbCountSum = 0;
      let rtt = null;

      await Promise.all(
        receivers.map(async (rcv) => {
          if (!rcv.getStats) return;
          let report;
          try {
            report = await rcv.getStats();
          } catch (e) {
            return;
          }
          report.forEach((s) => {
            if (s.type === "inbound-rtp" && s.kind === "audio") {
              const before = prev.get(rcv);
              // Sessizlik (DTX) doldurması takılma değildir: yalnızca gerçek paket kaybı doldurmasını say
              const realConcealed = (s.concealedSamples || 0) - (s.silentConcealedSamples || 0);
              const total = s.totalSamplesReceived || 0;
              if (before && total > before.total) {
                const ratio = Math.max(0, realConcealed - before.concealed) / (total - before.total);
                if (ratio > worstRatio) worstRatio = ratio;
              }
              if (before && s.jitterBufferEmittedCount > before.jbCount) {
                jbDelaySum += s.jitterBufferDelay - before.jbDelay;
                jbCountSum += s.jitterBufferEmittedCount - before.jbCount;
              }
              prev.set(rcv, {
                concealed: realConcealed,
                total,
                jbDelay: s.jitterBufferDelay || 0,
                jbCount: s.jitterBufferEmittedCount || 0,
              });
            } else if (s.type === "candidate-pair" && s.nominated && s.currentRoundTripTime != null) {
              rtt = s.currentRoundTripTime * 1000;
            }
          });
        }),
      );

      // Hedef tamponu güncelle
      const now = Date.now();
      if (floor == null) {
        targetMs = null;
      } else {
        if (targetMs == null || targetMs < floor) targetMs = floor;
        if (worstRatio > BAD_RATIO) {
          targetMs = Math.min(CEIL_MS, targetMs + STEP_UP_MS);
          goodSince = now;
        } else if (worstRatio < GOOD_RATIO) {
          if (targetMs > floor && now - goodSince > RECOVER_AFTER_MS) {
            targetMs = Math.max(floor, targetMs - STEP_DOWN_MS);
            goodSince = now;
          }
        } else {
          goodSince = now; // gri bölge: ne artır ne azalt
        }
      }
      applyAll();

      useLatencyStatsStore.getState().setStats({
        rttMs: rtt != null ? Math.round(rtt) : null,
        jitterBufferMs: jbCountSum > 0 ? Math.round((jbDelaySum / jbCountSum) * 1000) : null,
        concealPct: receivers.length ? Math.round(worstRatio * 1000) / 10 : null,
        targetMs,
      });
    };

    // Yeni abone olunan track'e hemen uygula (bir sonraki tick'i bekleme)
    const onSubscribed = (track) => {
      if (track?.kind === Track.Kind.Audio) setReceiverTarget(track.receiver, targetMs);
    };
    room.on(RoomEvent.TrackSubscribed, onSubscribed);

    const timer = setInterval(tick, TICK_MS);
    tick();

    return () => {
      stopped = true;
      clearInterval(timer);
      room.off(RoomEvent.TrackSubscribed, onSubscribed);
      // Varsayılana dön ve ölçümleri temizle
      remoteMicReceivers(room).forEach((r) => setReceiverTarget(r, null));
      useLatencyStatsStore.getState().reset();
    };
  }, [room]);
}
