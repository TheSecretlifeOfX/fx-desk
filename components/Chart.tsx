"use client";

import { useMemo, useState } from "react";
import type { Candle, OrderBlock } from "@/lib/types";

const W = 1000;
const H = 460;
const PAD = { top: 16, right: 66, bottom: 28, left: 10 };

/**
 * Candlestick chart drawn as plain SVG — no charting library.
 *
 * Everything is projected through two scale functions, so the same code
 * handles EURUSD at 1.16 and gold at 3,900 without special cases. Order
 * blocks are drawn as horizontal zones behind the candles, extended to the
 * right edge because a zone matters until price reaches it.
 */
export function Chart({
  candles,
  orderBlocks,
  ema9,
  ema21,
  digits,
  showBlocks,
}: {
  candles: Candle[];
  orderBlocks: OrderBlock[];
  ema9: (number | null)[];
  ema21: (number | null)[];
  digits: number;
  showBlocks: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const view = useMemo(() => {
    const lows = candles.map((c) => c.low);
    const highs = candles.map((c) => c.high);

    let min = Math.min(...lows);
    let max = Math.max(...highs);

    // Zones can sit outside the price range; keep them on screen.
    if (showBlocks) {
      for (const b of orderBlocks) {
        min = Math.min(min, b.bottom);
        max = Math.max(max, b.top);
      }
    }

    const span = max - min || 1;
    min -= span * 0.06;
    max += span * 0.06;

    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const step = plotW / candles.length;

    const x = (i: number) => PAD.left + i * step + step / 2;
    const y = (p: number) =>
      PAD.top + plotH - ((p - min) / (max - min)) * plotH;

    return { x, y, step, min, max, plotH };
  }, [candles, orderBlocks, showBlocks]);

  const bodyW = Math.max(1.2, view.step * 0.62);
  const active = hover !== null ? candles[hover] : candles[candles.length - 1];

  const gridLines = useMemo(() => {
    const out: { p: number; y: number }[] = [];
    for (let i = 0; i <= 5; i++) {
      const p = view.min + ((view.max - view.min) * i) / 5;
      out.push({ p, y: view.y(p) });
    }
    return out;
  }, [view]);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        role="img"
        aria-label={`Daily candlestick chart with ${orderBlocks.length} order blocks`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.floor((px - PAD.left) / view.step);
          setHover(i >= 0 && i < candles.length ? i : null);
        }}
      >
        {gridLines.map((g) => (
          <g key={g.p}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={g.y}
              y2={g.y}
              stroke="var(--grid)"
              strokeWidth="1"
            />
            <text
              x={W - PAD.right + 6}
              y={g.y + 3.5}
              className="fill-[var(--axis)] font-mono"
              fontSize="10.5"
            >
              {g.p.toFixed(digits)}
            </text>
          </g>
        ))}

        {showBlocks &&
          orderBlocks.map((b) => {
            const top = view.y(b.top);
            const bottom = view.y(b.bottom);
            const colour = b.kind === "bullish" ? "var(--up)" : "var(--down)";
            return (
              <g key={`${b.kind}-${b.index}`}>
                <rect
                  x={view.x(b.index) - bodyW / 2}
                  y={top}
                  width={W - PAD.right - (view.x(b.index) - bodyW / 2)}
                  height={Math.max(1.5, bottom - top)}
                  fill={colour}
                  opacity={b.mitigated ? 0.07 : 0.16}
                />
                <line
                  x1={view.x(b.index) - bodyW / 2}
                  x2={W - PAD.right}
                  y1={top}
                  y2={top}
                  stroke={colour}
                  strokeWidth="1"
                  strokeDasharray={b.mitigated ? "3 3" : undefined}
                  opacity={b.mitigated ? 0.45 : 0.9}
                />
                <line
                  x1={view.x(b.index) - bodyW / 2}
                  x2={W - PAD.right}
                  y1={bottom}
                  y2={bottom}
                  stroke={colour}
                  strokeWidth="1"
                  strokeDasharray={b.mitigated ? "3 3" : undefined}
                  opacity={b.mitigated ? 0.45 : 0.9}
                />
              </g>
            );
          })}

        <Line points={ema21} view={view} stroke="var(--ema-slow)" />
        <Line points={ema9} view={view} stroke="var(--ema-fast)" />

        {candles.map((c, i) => {
          const up = c.close >= c.open;
          const colour = up ? "var(--up)" : "var(--down)";
          const yOpen = view.y(c.open);
          const yClose = view.y(c.close);
          return (
            <g key={c.time} opacity={hover === null || hover === i ? 1 : 0.75}>
              <line
                x1={view.x(i)}
                x2={view.x(i)}
                y1={view.y(c.high)}
                y2={view.y(c.low)}
                stroke={colour}
                strokeWidth="1"
              />
              <rect
                x={view.x(i) - bodyW / 2}
                y={Math.min(yOpen, yClose)}
                width={bodyW}
                height={Math.max(1, Math.abs(yClose - yOpen))}
                fill={colour}
              />
            </g>
          );
        })}

        {hover !== null && (
          <line
            x1={view.x(hover)}
            x2={view.x(hover)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="var(--axis)"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.6"
          />
        )}

        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={view.y(candles[candles.length - 1].close)}
          y2={view.y(candles[candles.length - 1].close)}
          stroke="var(--accent)"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] text-[var(--muted)]">
        <span>
          {new Date(active.time * 1000).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          })}
        </span>
        <span>O {active.open.toFixed(digits)}</span>
        <span>H {active.high.toFixed(digits)}</span>
        <span>L {active.low.toFixed(digits)}</span>
        <span
          className={
            active.close >= active.open
              ? "text-[var(--up)]"
              : "text-[var(--down)]"
          }
        >
          C {active.close.toFixed(digits)}
        </span>
      </div>
    </div>
  );
}

function Line({
  points,
  view,
  stroke,
}: {
  points: (number | null)[];
  view: { x: (i: number) => number; y: (p: number) => number };
  stroke: string;
}) {
  const d = points
    .map((p, i) =>
      p === null ? null : `${view.x(i).toFixed(1)},${view.y(p).toFixed(1)}`,
    )
    .filter(Boolean)
    .join(" L ");

  if (!d) return null;
  return (
    <path
      d={`M ${d}`}
      fill="none"
      stroke={stroke}
      strokeWidth="1.3"
      opacity="0.85"
    />
  );
}
