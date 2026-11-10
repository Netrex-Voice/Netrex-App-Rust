"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Satranç tahtası (saf sunum): tıkla-seç ve sürükle-bırak. Mantık yok; yasal hedefleri ve hamleyi üst bileşen verir.
 * Taşlar Unicode satranç sembolleridir (dış dosya yok); renk/kenarlıkla beyaz-siyah ayrımı yapılır.
 */
export const BOARD_THEMES = {
  green: { label: "Yeşil", light: "#eeeed2", dark: "#769656", hl: "rgba(246, 246, 105, .55)", sel: "rgba(255, 255, 80, .6)" },
  brown: { label: "Ahşap", light: "#f0d9b5", dark: "#b58863", hl: "rgba(205, 210, 106, .6)", sel: "rgba(255, 238, 90, .6)" },
  blue: { label: "Mavi", light: "#dee3e6", dark: "#8ca2ad", hl: "rgba(155, 199, 0, .45)", sel: "rgba(20, 85, 30, .45)" },
  purple: { label: "Mor", light: "#efefef", dark: "#8877b7", hl: "rgba(155, 199, 0, .45)", sel: "rgba(20, 85, 30, .45)" },
};

const GLYPH = { 1: "♟", 2: "♞", 3: "♝", 4: "♜", 5: "♛", 6: "♚" };
export const pieceGlyph = (t) => GLYPH[t] + "︎"; // FE0E: emoji yerine metin biçimi
const FONT = "'Segoe UI Symbol','Noto Sans Symbols 2','Apple Symbols','DejaVu Sans',serif";

export function Piece({ piece, size = "100%", className = "", style }) {
  const white = piece > 0;
  return (
    <span
      className={`pointer-events-none select-none leading-none ${className}`}
      style={{
        fontFamily: FONT, fontSize: size, color: white ? "#fff" : "#1d1d1f",
        WebkitTextStroke: white ? "1.4px #1d1d1f" : "1px #f2f2f2", paintOrder: "stroke fill",
        textShadow: white ? "0 1px 1px rgba(0,0,0,.35)" : "0 1px 1px rgba(255,255,255,.25)", ...style,
      }}
    >
      {pieceGlyph(Math.abs(piece))}
    </span>
  );
}

const sqName = (s) => "abcdefgh"[s & 7] + ((s >> 3) + 1);

/**
 * @param board     Int8Array(64)
 * @param flipped   siyah altta mı
 * @param targets   Map<fromSq, Set<toSq>> — hamle yapılabilen kareler
 * @param last      {from,to}|null
 * @param checkSq   şahı çekilen şahın karesi (-1)
 * @param interactive  hamle girişine izin ver
 * @param onMove    (from,to) → yasal hamle denemesi (terfi üst bileşende çözülür)
 */
export default function Board({ board, flipped, targets, last, checkSq = -1, interactive, onMove, theme = "green", coords = true, highlight = true, premoveHint }) {
  const th = BOARD_THEMES[theme] || BOARD_THEMES.green;
  const [sel, setSel] = useState(-1);
  const [drag, setDrag] = useState(null); // { from, x, y, moved }
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  dragRef.current = drag;

  // Konum değişince (hamle yapıldı / başka pozisyon) seçimi bırak
  const sig = useMemo(() => Array.from(board).join(","), [board]);
  useEffect(() => { setSel(-1); }, [sig]);

  const squares = [];
  for (let i = 0; i < 64; i++) squares.push(flipped ? 63 - i : (7 - (i >> 3)) * 8 + (i & 7));
  // görüntü sırası: sol üstten sağ alta (beyaz altta: 8. sıra üstte)

  const squareAt = (cx, cy) => {
    const r = rootRef.current?.getBoundingClientRect();
    if (!r) return -1;
    const x = Math.floor(((cx - r.left) / r.width) * 8), y = Math.floor(((cy - r.top) / r.height) * 8);
    if (x < 0 || x > 7 || y < 0 || y > 7) return -1;
    return squares[y * 8 + x];
  };

  const tryMove = (from, to) => {
    if (from === to) return false;
    if (!targets?.get(from)?.has(to)) return false;
    onMove(from, to);
    return true;
  };

  const onDown = (e, sq) => {
    if (!interactive || e.button > 0) return;
    const pc = board[sq];
    if (sel >= 0 && sel !== sq && targets?.get(sel)?.has(sq)) { tryMove(sel, sq); setSel(-1); return; }
    if (pc && targets?.has(sq)) {
      setSel(sel === sq ? -1 : sq);
      setDrag({ from: sq, x: e.clientX, y: e.clientY, moved: false });
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } else setSel(-1);
  };
  const onMovePtr = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const moved = d.moved || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4;
    setDrag({ ...d, moved, cx: e.clientX, cy: e.clientY });
  };
  const onUp = (e) => {
    const d = dragRef.current;
    setDrag(null);
    if (!d) return;
    if (d.moved) {
      const to = squareAt(e.clientX, e.clientY);
      if (to >= 0 && tryMove(d.from, to)) setSel(-1);
    }
  };

  const showTargets = sel >= 0 ? targets?.get(sel) : drag ? targets?.get(drag.from) : null;
  const rank = (i) => (flipped ? 1 + (i >> 3) : 8 - (i >> 3));
  const fileCh = (i) => "abcdefgh"[flipped ? 7 - (i & 7) : i & 7];

  return (
    <div
      ref={rootRef}
      className="relative aspect-square w-full touch-none select-none overflow-hidden rounded-md shadow-[0_8px_30px_rgba(0,0,0,.45)]"
      style={{ containerType: "inline-size" }}
      onPointerMove={onMovePtr}
      onPointerUp={onUp}
      onPointerCancel={() => setDrag(null)}
      role="grid"
      aria-label="Satranç tahtası"
    >
      <div className="grid h-full w-full grid-cols-8 grid-rows-8">
        {squares.map((sq, i) => {
          const light = ((sq >> 3) + (sq & 7)) % 2 === 1;
          const isLast = highlight && last && (last.from === sq || last.to === sq);
          const pc = board[sq];
          const isTarget = showTargets?.has(sq);
          const dragging = drag?.moved && drag.from === sq;
          return (
            <div
              key={sq}
              role="gridcell"
              aria-label={`${sqName(sq)}${pc ? " taş var" : ""}`}
              onPointerDown={(e) => onDown(e, sq)}
              className="relative flex items-center justify-center"
              style={{ background: light ? th.light : th.dark, cursor: interactive && (targets?.has(sq) || isTarget) ? "pointer" : "default" }}
            >
              {isLast && <span className="absolute inset-0" style={{ background: th.hl }} />}
              {sel === sq && <span className="absolute inset-0" style={{ background: th.sel }} />}
              {checkSq === sq && <span className="absolute inset-0" style={{ background: "radial-gradient(circle, rgba(255,0,0,.85) 0%, rgba(231,0,0,.55) 35%, rgba(169,0,0,0) 72%)" }} />}
              {coords && (i & 7) === 0 && <span className="absolute left-[3%] top-[2%] text-[clamp(8px,1.9cqw,13px)] font-bold leading-none" style={{ color: light ? th.dark : th.light }}>{rank(i)}</span>}
              {coords && i >= 56 && <span className="absolute bottom-[2%] right-[4%] text-[clamp(8px,1.9cqw,13px)] font-bold leading-none" style={{ color: light ? th.dark : th.light }}>{fileCh(i)}</span>}
              {pc !== 0 && <Piece piece={pc} size="10.2cqw" style={{ opacity: dragging ? 0.3 : 1 }} />}
              {isTarget && (pc
                ? <span className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: "inset 0 0 0 .9cqw rgba(20,85,30,.5)" }} />
                : <span className="pointer-events-none absolute h-[3.4cqw] w-[3.4cqw] rounded-full" style={{ background: "rgba(20,85,30,.5)" }} />)}
            </div>
          );
        })}
      </div>
      {drag?.moved && board[drag.from] !== 0 && (
        <div className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2" style={{ left: drag.cx, top: drag.cy }}>
          <Piece piece={board[drag.from]} size={`${(rootRef.current?.getBoundingClientRect().width || 400) * 0.13}px`} />
        </div>
      )}
      {premoveHint}
    </div>
  );
}
