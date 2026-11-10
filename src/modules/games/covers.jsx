"use client";

/**
 * Oyun kapak görselleri: dış dosya/asset indirmeden, her oyun için çizilmiş 16:9 SVG sahne.
 * Mağaza kartlarında, detay sayfasında ve "son oynadıkların" şeridinde kullanılır.
 */

const defs = (id, a, b) => (
  <defs>
    <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor={a} />
      <stop offset="1" stopColor={b} />
    </linearGradient>
    <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="60%">
      <stop offset="0" stopColor="#fff" stopOpacity=".35" />
      <stop offset="1" stopColor="#fff" stopOpacity="0" />
    </radialGradient>
    <filter id={`${id}-sh`} x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity=".45" />
    </filter>
  </defs>
);

function AirHockey() {
  return (
    <>
      {defs("ah", "#0b1b3a", "#0e4a7a")}
      <rect width="400" height="225" fill="url(#ah-bg)" />
      <rect x="30" y="22" width="340" height="181" rx="22" fill="#0b2b57" stroke="#7dd3fc" strokeWidth="5" />
      <rect x="40" y="32" width="320" height="161" rx="14" fill="#123f78" />
      <line x1="200" y1="32" x2="200" y2="193" stroke="#7dd3fc" strokeOpacity=".7" strokeWidth="3" />
      <circle cx="200" cy="112" r="34" fill="none" stroke="#7dd3fc" strokeOpacity=".7" strokeWidth="3" />
      <rect x="32" y="84" width="9" height="56" rx="4" fill="#020617" />
      <rect x="359" y="84" width="9" height="56" rx="4" fill="#020617" />
      <g filter="url(#ah-sh)">
        <circle cx="105" cy="112" r="30" fill="#ef4444" />
        <circle cx="105" cy="112" r="20" fill="#b91c1c" />
        <circle cx="105" cy="112" r="9" fill="#fecaca" />
        <circle cx="295" cy="86" r="30" fill="#38bdf8" />
        <circle cx="295" cy="86" r="20" fill="#0284c7" />
        <circle cx="295" cy="86" r="9" fill="#e0f2fe" />
        <circle cx="205" cy="146" r="15" fill="#111827" stroke="#e5e7eb" strokeWidth="3" />
      </g>
      <path d="M205 146 L160 160" stroke="#fff" strokeOpacity=".35" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 9" />
    </>
  );
}

function PingPong() {
  return (
    <>
      {defs("pp", "#2a1405", "#7c2d12")}
      <rect width="400" height="225" fill="url(#pp-bg)" />
      <ellipse cx="200" cy="215" rx="190" ry="26" fill="#000" opacity=".35" />
      <polygon points="40,150 360,150 392,200 8,200" fill="#0f5132" stroke="#e5e7eb" strokeWidth="3" />
      <polygon points="40,150 360,150 355,157 45,157" fill="#e5e7eb" opacity=".6" />
      <line x1="200" y1="150" x2="200" y2="200" stroke="#e5e7eb" strokeOpacity=".7" strokeWidth="2.5" />
      <rect x="38" y="200" width="324" height="5" fill="#052e1a" />
      <rect x="196" y="112" width="8" height="40" fill="#cbd5e1" />
      <rect x="100" y="112" width="200" height="38" fill="#e5e7eb" fillOpacity=".25" stroke="#fff" strokeWidth="2" />
      {Array.from({ length: 9 }).map((_, i) => <line key={i} x1={100 + i * 25} y1="112" x2={100 + i * 25} y2="150" stroke="#fff" strokeOpacity=".4" />)}
      <g filter="url(#pp-sh)">
        <g transform="rotate(-28 78 90)">
          <circle cx="78" cy="78" r="30" fill="#dc2626" />
          <circle cx="78" cy="78" r="30" fill="none" stroke="#7f1d1d" strokeWidth="3" />
          <rect x="72" y="105" width="12" height="38" rx="5" fill="#b45309" />
        </g>
        <g transform="rotate(24 322 76)">
          <circle cx="322" cy="64" r="30" fill="#111827" />
          <circle cx="322" cy="64" r="30" fill="none" stroke="#6b7280" strokeWidth="3" />
          <rect x="316" y="91" width="12" height="38" rx="5" fill="#b45309" />
        </g>
        <circle cx="205" cy="78" r="10" fill="#fff" />
      </g>
      <path d="M118 86 Q165 40 200 76" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" />
    </>
  );
}

function Pool() {
  const ball = (cx, cy, c, n, stripe) => (
    <g key={n}>
      <circle cx={cx} cy={cy} r="11" fill={stripe ? "#f8fafc" : c} />
      {stripe && <path d={`M${cx - 10.5} ${cy - 3.5} h21 v7 h-21z`} fill={c} />}
      <circle cx={cx} cy={cy} r="5" fill="#fff" />
      <text x={cx} y={cy + 2.4} textAnchor="middle" fontSize="6.5" fontWeight="800" fill="#111">{n}</text>
      <circle cx={cx - 3.5} cy={cy - 4} r="2.4" fill="#fff" opacity=".55" />
    </g>
  );
  return (
    <>
      {defs("pl", "#052e16", "#14532d")}
      <rect width="400" height="225" fill="#2a1407" />
      <rect x="14" y="14" width="372" height="197" rx="20" fill="#5b3418" stroke="#8a5a2c" strokeWidth="4" />
      <rect x="32" y="32" width="336" height="161" rx="8" fill="url(#pl-bg)" />
      <rect x="32" y="32" width="336" height="161" rx="8" fill="url(#pl-glow)" opacity=".5" />
      {[[34, 34], [366, 34], [34, 191], [366, 191], [200, 31], [200, 194]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="11" fill="#050505" />)}
      <g filter="url(#pl-sh)">
        {ball(262, 112, "#facc15", 1)}
        {ball(282, 101, "#2563eb", 2)}
        {ball(282, 123, "#ef4444", 3)}
        {ball(302, 90, "#7c3aed", 4)}
        {ball(302, 112, "#111", 8)}
        {ball(302, 134, "#16a34a", 6, true)}
        {ball(322, 79, "#f97316", 5)}
        {ball(322, 101, "#dc2626", 11, true)}
        {ball(322, 123, "#1d4ed8", 10, true)}
        <circle cx="120" cy="112" r="11" fill="#f8fafc" />
        <circle cx="116" cy="108" r="3" fill="#fff" opacity=".8" />
      </g>
      <line x1="30" y1="112" x2="104" y2="112" stroke="#fff" strokeOpacity=".4" strokeDasharray="3 6" />
      <g transform="rotate(-1 60 112)" filter="url(#pl-sh)">
        <rect x="-10" y="109" width="95" height="6" rx="3" fill="#f5d7a1" />
        <rect x="80" y="109.5" width="8" height="5" fill="#38bdf8" />
      </g>
    </>
  );
}

function Tabu() {
  return (
    <>
      {defs("tb", "#2e1065", "#7e22ce")}
      <rect width="400" height="225" fill="url(#tb-bg)" />
      <circle cx="320" cy="40" r="90" fill="url(#tb-glow)" />
      <g filter="url(#tb-sh)">
        <g transform="rotate(-8 140 112)">
          <rect x="62" y="30" width="172" height="150" rx="14" fill="#f8fafc" />
          <rect x="62" y="30" width="172" height="40" rx="14" fill="#ef4444" />
          <rect x="62" y="56" width="172" height="14" fill="#ef4444" />
          <text x="148" y="58" textAnchor="middle" fontSize="26" fontWeight="900" fill="#fff" letterSpacing="1">KAHVE</text>
          {["Fincan", "Türk", "Fal", "Çekirdek", "Sıcak"].map((w, i) => (
            <text key={w} x="148" y={96 + i * 18} textAnchor="middle" fontSize="13" fontWeight="700" fill="#374151">{w}</text>
          ))}
        </g>
        <g transform="rotate(10 290 120)">
          <rect x="228" y="46" width="124" height="140" rx="14" fill="#fde68a" />
          <text x="290" y="108" textAnchor="middle" fontSize="44" fontWeight="900" fill="#b91c1c">TABU</text>
          <circle cx="290" cy="146" r="18" fill="none" stroke="#b91c1c" strokeWidth="5" />
          <line x1="277" y1="159" x2="303" y2="133" stroke="#b91c1c" strokeWidth="5" />
        </g>
      </g>
      <text x="40" y="206" fontSize="13" fontWeight="800" fill="#fff" fillOpacity=".6" letterSpacing="3">ANLAT · TAHMİN ET · SUSMA</text>
    </>
  );
}

function Okey() {
  const tile = (x, y, n, c, rot = 0, fake) => (
    <g key={x + "" + y} transform={`rotate(${rot} ${x + 24} ${y + 32})`} filter="url(#ok-sh)">
      <rect x={x} y={y} width="48" height="64" rx="7" fill="#fdf6e3" stroke="#d6c9a6" strokeWidth="2" />
      <rect x={x + 3} y={y + 3} width="42" height="58" rx="5" fill="none" stroke="#e7dcc0" />
      <text x={x + 24} y={y + 36} textAnchor="middle" fontSize="28" fontWeight="900" fill={c}>{fake ? "★" : n}</text>
      <circle cx={x + 24} cy={y + 49} r="4" fill={c} />
    </g>
  );
  return (
    <>
      {defs("ok", "#064e3b", "#065f46")}
      <rect width="400" height="225" fill="url(#ok-bg)" />
      <ellipse cx="200" cy="120" rx="190" ry="110" fill="url(#ok-glow)" opacity=".5" />
      <rect x="40" y="140" width="320" height="46" rx="10" fill="#92400e" />
      <rect x="40" y="140" width="320" height="12" rx="6" fill="#b45309" />
      {tile(48, 70, 7, "#dc2626", -4)}
      {tile(98, 66, 8, "#dc2626", -2)}
      {tile(148, 64, 9, "#dc2626", 0)}
      {tile(198, 64, 10, "#dc2626", 2)}
      {tile(248, 66, 5, "#1d4ed8", 4)}
      {tile(298, 70, 5, "#111827", 7)}
      {tile(120, 20, 1, "#ca8a04", -10, true)}
      {tile(232, 18, 13, "#16a34a", 9)}
    </>
  );
}

function Emlak() {
  const cols = ["#955436", "#aae0fa", "#d93a96", "#f7941d", "#ed1b24", "#fef200", "#1fb25a", "#0072bb"];
  return (
    <>
      {defs("em", "#0f3d2a", "#14532d")}
      <rect width="400" height="225" fill="#1a1007" />
      <g transform="translate(200 116) rotate(-3) scale(1 .98)" filter="url(#em-sh)">
        <rect x="-168" y="-100" width="336" height="200" rx="4" fill="#0f3d2a" />
        <rect x="-164" y="-96" width="328" height="192" fill="#cfe8d3" />
        <rect x="-118" y="-60" width="236" height="120" fill="#bfdcc4" stroke="#111" strokeWidth="1.5" />
        {Array.from({ length: 9 }).map((_, i) => (
          <g key={i}>
            <rect x={-118 + i * 26.2} y={-96} width="26.2" height="36" fill="#f4faf3" stroke="#111" />
            {i % 3 !== 2 && <rect x={-118 + i * 26.2} y={-96} width="26.2" height="12" fill={cols[(i + 2) % 8]} stroke="#111" />}
            <rect x={-118 + i * 26.2} y={60} width="26.2" height="36" fill="#f4faf3" stroke="#111" />
            {i % 3 !== 0 && <rect x={-118 + i * 26.2} y={60} width="26.2" height="12" fill={cols[(i + 5) % 8]} stroke="#111" />}
          </g>
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <g key={i}>
            <rect x={-164} y={-60 + i * 24} width="46" height="24" fill="#f4faf3" stroke="#111" />
            <rect x={-164} y={-60 + i * 24} width="10" height="24" fill={cols[(i + 1) % 8]} stroke="#111" opacity={i === 2 ? 0 : 1} />
            <rect x={118} y={-60 + i * 24} width="46" height="24" fill="#f4faf3" stroke="#111" />
            <rect x={154} y={-60 + i * 24} width="10" height="24" fill={cols[(i + 4) % 8]} stroke="#111" opacity={i === 3 ? 0 : 1} />
          </g>
        ))}
        {[[-164, -96], [118, -96], [-164, 60], [118, 60]].map(([x, y], i) => <rect key={i} x={x} y={y} width="46" height="36" fill={["#fff", "#f59e0b", "#e8f5e9", "#bfdbfe"][i]} stroke="#111" />)}
        <g transform="rotate(-45)">
          <rect x="-96" y="-18" width="192" height="36" fill="#d4252b" stroke="#fff" strokeWidth="2" />
          <text x="0" y="10" textAnchor="middle" fontSize="28" fontWeight="900" fill="#fff" letterSpacing="2">EMLAK</text>
        </g>
      </g>
      <g filter="url(#em-sh)">
        <circle cx="332" cy="168" r="11" fill="#ef4444" stroke="#fff" strokeWidth="2" />
        <circle cx="68" cy="60" r="11" fill="#3b82f6" stroke="#fff" strokeWidth="2" />
        <rect x="316" y="72" width="26" height="26" rx="5" fill="#fff" transform="rotate(14 329 85)" />
        {[[322, 78], [336, 92]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.4" fill="#111" />)}
        <rect x="342" y="92" width="24" height="24" rx="5" fill="#fff" transform="rotate(-10 354 104)" />
        {[[348, 98], [360, 98], [348, 110], [360, 110], [354, 104]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.1" fill="#111" />)}
      </g>
    </>
  );
}

function Chess() {
  const sq = [];
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) sq.push(<rect key={r * 8 + f} x={100 + f * 25} y={12 + r * 25} width="25" height="25" fill={(r + f) % 2 ? "#769656" : "#eeeed2"} />);
  const glyph = { fontFamily: "'Segoe UI Symbol','Noto Sans Symbols 2','Apple Symbols','DejaVu Sans',serif", fontWeight: 400 };
  return (
    <>
      {defs("ch", "#1f2a14", "#3d5a24")}
      <rect width="400" height="225" fill="url(#ch-bg)" />
      <g filter="url(#ch-sh)">{sq}</g>
      <rect x="100" y="12" width="200" height="200" fill="none" stroke="#2b3a1a" strokeWidth="3" />
      <g style={glyph} textAnchor="middle" fontSize="24" stroke="#1b1b1b" strokeWidth="1" paintOrder="stroke">
        <text x="237.5" y="86" fill="#fff">{"♞︎"}</text>
        <text x="162.5" y="136" fill="#1f1f1f" stroke="#fff" strokeWidth=".6">{"♜︎"}</text>
        <text x="187.5" y="36" fill="#1f1f1f" stroke="#fff" strokeWidth=".6">{"♚︎"}</text>
        <text x="212.5" y="186" fill="#fff">{"♕︎"}</text>
        <text x="262.5" y="161" fill="#fff">{"♙︎"}</text>
      </g>
      <text x="350" y="60" textAnchor="middle" fontSize="30" fontWeight="900" fill="#fff" stroke="#14210b" strokeWidth="1.5" paintOrder="stroke">ELO</text>
      <text x="350" y="86" textAnchor="middle" fontSize="16" fontWeight="800" fill="#bef264">250 → 2400</text>
    </>
  );
}

function HillClimb() {
  return (
    <>
      <defs>
        <linearGradient id="hc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4ab8f0" /><stop offset="1" stopColor="#bfe9fb" /></linearGradient>
        <filter id="hc-sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity=".4" /></filter>
      </defs>
      <rect width="400" height="225" fill="url(#hc-sky)" />
      <circle cx="320" cy="48" r="26" fill="#fde68a" />
      <path d="M0 150 Q70 100 140 140 T280 120 T400 140 V225 H0Z" fill="#7dc4a0" />
      <path d="M0 175 Q60 150 130 172 T270 150 T400 130 V225 H0Z" fill="#8a5a2b" />
      <path d="M0 175 Q60 150 130 172 T270 150 T400 130" fill="none" stroke="#6bbf3a" strokeWidth="9" />
      <g transform="translate(168 118) rotate(-18)" filter="url(#hc-sh)">
        <rect x="-40" y="-14" width="80" height="22" rx="7" fill="#e11d48" />
        <rect x="-22" y="-30" width="40" height="18" rx="6" fill="#fb7185" />
        <rect x="-14" y="-27" width="24" height="12" rx="3" fill="#bae6fd" />
        <circle cx="0" cy="-25" r="7" fill="#fcd9b6" />
        <circle cx="-26" cy="14" r="13" fill="#1f2937" /><circle cx="-26" cy="14" r="6" fill="#9ca3af" />
        <circle cx="26" cy="14" r="13" fill="#1f2937" /><circle cx="26" cy="14" r="6" fill="#9ca3af" />
      </g>
      {[[250, 118], [276, 108], [302, 100]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="8" fill="#facc15" stroke="#a16207" strokeWidth="2" /><text x={x} y={y + 3.5} textAnchor="middle" fontSize="10" fontWeight="900" fill="#a16207">$</text></g>)}
    </>
  );
}

const Emo = (id, a, b, emoji, extra) => function EmojiCover() {
  return (
    <>
      {defs(id, a, b)}
      <rect width="400" height="225" fill={`url(#${id}-bg)`} />
      <circle cx="200" cy="112" r="120" fill={`url(#${id}-glow)`} />
      {extra}
      <text x="200" y="146" textAnchor="middle" fontSize="110" filter={`url(#${id}-sh)`}>{emoji}</text>
    </>
  );
};
const Cov2048 = Emo("g2048", "#7c4a03", "#f59e0b", "🔢", <>{[0, 1, 2, 3].map((i) => <rect key={i} x={30 + i * 90} y="24" width="70" height="40" rx="8" fill="#fff" opacity=".18" />)}</>);
const CovSnake = Emo("snake", "#052e16", "#16a34a", "🐍");
const CovMines = Emo("mines", "#450a0a", "#dc2626", "💣", <>{[0, 1, 2, 3, 4].map((i) => <rect key={i} x={20 + i * 76} y="170" width="60" height="40" rx="8" fill="#fff" opacity=".14" />)}</>);
const CovMemory = Emo("memory", "#500724", "#db2777", "🧠");
const CovBreakout = Emo("breakout", "#082f49", "#0ea5e9", "🧱", <>{[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} x={14 + i * 54} y="16" width="48" height="16" rx="3" fill={["#ef4444", "#f97316", "#facc15", "#22c55e", "#38bdf8", "#a855f7", "#ec4899"][i]} />)}<rect x="150" y="196" width="100" height="12" rx="6" fill="#fff" /></>);
const CovTetris = Emo("tetris", "#2e1065", "#9333ea", "🧩");
const CovC4 = Emo("connect4", "#172554", "#2563eb", "🔴", <><circle cx="90" cy="170" r="22" fill="#facc15" /><circle cx="310" cy="170" r="22" fill="#ef4444" /><circle cx="310" cy="60" r="22" fill="#facc15" /></>);
const CovFlappy = Emo("flappy", "#0369a1", "#38bdf8", "🐤", <><rect x="40" y="0" width="40" height="80" fill="#22c55e" /><rect x="320" y="150" width="40" height="80" fill="#22c55e" /></>);

const ART = { airhockey: AirHockey, pingpong: PingPong, pool: Pool, tabu: Tabu, okey: Okey, emlak: Emlak, chess: Chess, hillclimb: HillClimb, g2048: Cov2048, snake: CovSnake, mines: CovMines, memory: CovMemory, breakout: CovBreakout, tetris: CovTetris, connect4: CovC4, flappy: CovFlappy };

/** 16:9 kapak; `className` ile boyutlandırılır. Bilinmeyen oyunda accent renkli düz zemin. */
export default function Cover({ g, className = "" }) {
  const Art = ART[g.id];
  return (
    <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${g.name} kapak görseli`} className={`block w-full h-full ${className}`}>
      {Art ? <Art /> : <rect width="400" height="225" fill={g.accent} />}
    </svg>
  );
}
