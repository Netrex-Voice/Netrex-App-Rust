import { useEffect, useState } from "react";
import { Track } from "livekit-client";

// Uzaktaki katılımcının konuşma animasyonu: gelen sesin kendisinden ANLIK seviye ölçer.
//
// Eskiden participant.audioLevel kullanılıyordu; bu değer LiveKit SUNUCUSUNUN konuşmacı tespitinden gelir ve
// konuşma bittikten sonra yaklaşık bir saniye boyunca "konuşuyor" kalır. Burada alınan MediaStreamTrack'in
// seviyesini yerelde ölçüyoruz: gecikme yok, animasyon sesle birlikte söner. Track yoksa eski değere düşer.

const LEVEL_THRESHOLD = 0.006; // lineer RMS; gate kapalıyken gelen ses ~0
const HOLD_MS = 150; // hece/kelime arasında animasyon titremesin
const TICK_MS = 50;

// Tüm kartlar tek bir AudioContext paylaşır; kimse kullanmıyorsa kapatılır (RAM)
let sharedCtx = null;
let refCount = 0;
let closeTimer = null;

function acquireCtx() {
  clearTimeout(closeTimer);
  closeTimer = null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    sharedCtx = new AudioCtx({ latencyHint: "interactive" });
  }
  if (sharedCtx.state === "suspended") sharedCtx.resume().catch(() => {});
  refCount++;
  return sharedCtx;
}

function releaseCtx() {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && sharedCtx) {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (refCount === 0 && sharedCtx && sharedCtx.state !== "closed") {
        sharedCtx.close().catch(() => {});
        sharedCtx = null;
      }
    }, 3000);
  }
}

export function useRemoteSpeaking(participant, isLocal) {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (isLocal || !participant) return;

    let source = null;
    let analyser = null;
    let buf = null;
    let boundTrack = null;
    let holdsCtx = false;
    let lastAbove = -Infinity; // 0 olursa performance.now() küçükken başta yanlışlıkla "konuşuyor" görünür
    let state = false;

    const unbind = () => {
      try { source?.disconnect(); } catch (e) {}
      try { analyser?.disconnect(); } catch (e) {}
      source = null;
      analyser = null;
      boundTrack = null;
      if (holdsCtx) {
        holdsCtx = false;
        releaseCtx();
      }
    };

    const bind = () => {
      const mst = participant.getTrackPublication?.(Track.Source.Microphone)?.track?.mediaStreamTrack;
      if (mst === boundTrack) return;
      unbind();
      if (!mst || mst.readyState === "ended") return;
      try {
        const ctx = acquireCtx();
        holdsCtx = true;
        source = ctx.createMediaStreamSource(new MediaStream([mst]));
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        buf = new Float32Array(analyser.fftSize);
        source.connect(analyser); // hoparlöre bağlı değil: yalnızca ölçüm
        boundTrack = mst;
      } catch (e) {
        unbind();
      }
    };

    const tick = () => {
      bind();
      let level = 0;
      if (analyser && buf) {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        level = Math.sqrt(sum / buf.length);
      } else {
        level = participant.audioLevel || 0; // yedek: sunucu değeri
      }
      const now = performance.now();
      if (level > LEVEL_THRESHOLD) lastAbove = now;
      const next = now - lastAbove < HOLD_MS;
      if (next !== state) {
        state = next;
        setSpeaking(next); // yalnızca değişimde render
      }
    };

    const timer = setInterval(tick, TICK_MS);
    return () => {
      clearInterval(timer);
      unbind();
    };
  }, [participant, isLocal]);

  return speaking;
}
