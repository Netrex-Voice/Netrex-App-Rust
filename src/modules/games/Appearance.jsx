"use client";

import { X, RotateCcw, Volume2, VolumeX, Lock } from "lucide-react";
import { useGamesPrefs, useLevel } from "./store";
import { PLAYER_COLORS, HOCKEY_TABLES, PUCK_COLORS, PONG_TABLES, OKEY_CLOTH, OKEY_TILES, TRAILS } from "./themes";
import { Btn, beep } from "./ui";

function Swatches({ value, options, onPick, label }) {
  const level = useLevel();
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-[#dbdee1]">{label}</span>
      <div className="flex gap-1.5" role="radiogroup" aria-label={label}>
        {Object.entries(options).map(([k, o]) => {
          const col = o.c || o.top || o.a || o.bg;
          const locked = (o.lvl || 1) > level;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={value === k}
              aria-label={locked ? `${o.label} — ${o.lvl}. seviyede açılır` : o.label}
              title={locked ? `${o.label} · ${o.lvl}. seviyede açılır` : o.label}
              disabled={locked}
              onClick={() => onPick(k)}
              className={`relative w-7 h-7 rounded-md border-2 transition ${value === k ? "border-white scale-110" : "border-white/15 enabled:hover:border-white/50"} disabled:cursor-not-allowed`}
              style={{ background: col }}
            >
              {locked && <span className="absolute inset-0 rounded-[4px] bg-black/60 flex items-center justify-center"><Lock size={11} className="text-white/80" /></span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const Section = ({ title, children }) => (
  <section className="rounded-lg bg-white/[0.06] p-4">
    <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#949ba4] mb-1">{title}</h3>
    <div className="divide-y divide-white/5">{children}</div>
  </section>
);

/** Görünüm ve ses ayarları — değişiklikler anında oyuna yansır, bu cihazda saklanır */
export default function Appearance({ onClose }) {
  const p = useGamesPrefs();
  return (
    <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-label="Görünüm ayarları" onClick={onClose}>
      <div className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-2xl glass-card shadow-soft-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center mb-4">
          <h2 className="text-base font-bold text-white">Görünüm ve ses</h2>
          <button type="button" onClick={onClose} className="ml-auto p-1.5 rounded-lg text-[#949ba4] hover:bg-white/5" aria-label="Kapat"><X size={16} /></button>
        </div>
        <div className="flex flex-col gap-3">
          <Section title="Ses">
            <div className="flex items-center gap-3 py-2">
              <button type="button" onClick={() => p.setMuted(!p.muted)} aria-pressed={p.muted} aria-label={p.muted ? "Sesi aç" : "Sesi kapat"} className="p-1.5 rounded-lg text-[#b5bac1] hover:bg-white/5">
                {p.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input type="range" min={0} max={100} value={p.vol} onChange={(e) => p.setVol(Number(e.target.value))} onMouseUp={() => beep(660, 0.1)} className="flex-1 accent-[#6366f1]" aria-label="Oyun sesi seviyesi" />
              <span className="w-9 text-right text-xs text-[#949ba4] tabular-nums">{p.vol}</span>
            </div>
          </Section>
          <Section title="Grafik">
            <div className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm text-[#dbdee1]">Kalite</span>
              <select value={String(p.gfx)} onChange={(e) => p.setGfx(e.target.value === "auto" ? "auto" : Number(e.target.value))} className="bg-[#1e1f22] border border-white/10 rounded-xl px-2.5 py-1.5 text-sm text-white" aria-label="Grafik kalitesi">
                <option value="auto">Otomatik (60 fps'i korur)</option>
                <option value="3">Ultra</option>
                <option value="2">Yüksek</option>
                <option value="1">Orta</option>
                <option value="0">Düşük</option>
              </select>
            </div>
            <label className="flex items-center justify-between py-2 text-sm text-[#dbdee1]">
              FPS göstergesi
              <input type="checkbox" checked={p.showFps} onChange={(e) => p.setShowFps(e.target.checked)} className="accent-[#6366f1] w-4 h-4" />
            </label>
            <label className="flex items-center justify-between py-2 text-sm text-[#dbdee1]">
              Doğrudan bağlantı (P2P) — düşük gecikme
              <input type="checkbox" checked={p.p2p !== false} onChange={(e) => p.setP2p(e.target.checked)} className="accent-[#6366f1] w-4 h-4" />
            </label>
            <p className="text-[11px] text-[#6b7280] pb-1">P2P açıkken oyun trafiği doğrudan oyuncular arasında gider (daha az ping); karşı oyuncu IP adresinizi görebilir. Kurulamazsa otomatik olarak sunucu üzerinden devam eder.</p>
            <p className="text-[11px] text-[#6b7280] pb-1">Otomatikte kalite, kare hızı 60'ın altına düşerse kendiliğinden azalır. Değişiklik bir sonraki maçta uygulanır.</p>
          </Section>
          <Section title="Air Hockey">
            <Swatches label="Masa" value={p.hockey.table} options={HOCKEY_TABLES} onPick={(v) => p.setPref("hockey", "table", v)} />
            <Swatches label="Raketin" value={p.hockey.mine} options={PLAYER_COLORS} onPick={(v) => p.setPref("hockey", "mine", v)} />
            <Swatches label="Disk" value={p.hockey.puck} options={PUCK_COLORS} onPick={(v) => p.setPref("hockey", "puck", v)} />
          </Section>
          <Section title="Ping Pong">
            <Swatches label="Masa" value={p.pong.table} options={PONG_TABLES} onPick={(v) => p.setPref("pong", "table", v)} />
            <Swatches label="Raket lastiği" value={p.pong.mine} options={PLAYER_COLORS} onPick={(v) => p.setPref("pong", "mine", v)} />
          </Section>
          <Section title="Okey">
            <Swatches label="Masa örtüsü" value={p.okey.cloth} options={OKEY_CLOTH} onPick={(v) => p.setPref("okey", "cloth", v)} />
            <Swatches label="Taş seti" value={p.okey.tile} options={OKEY_TILES} onPick={(v) => p.setPref("okey", "tile", v)} />
            <label className="flex items-center justify-between py-2 text-sm text-[#dbdee1]">
              Rakip taşlarını göster
              <input type="checkbox" checked={p.okey.showOpp} onChange={(e) => p.setPref("okey", "showOpp", e.target.checked)} className="accent-[#6366f1] w-4 h-4" />
            </label>
          </Section>
        </div>
        <p className="mt-3 text-[11px] text-[#6b7280]">Kilitli seçenekler maç oynayıp seviye atladıkça açılır.</p>
        <div className="mt-3 flex justify-between">
          <Btn tone="ghost" onClick={p.resetPrefs}><RotateCcw size={13} className="inline -mt-0.5 mr-1.5" />Varsayılana dön</Btn>
          <Btn onClick={onClose}>Tamam</Btn>
        </div>
      </div>
    </div>
  );
}
