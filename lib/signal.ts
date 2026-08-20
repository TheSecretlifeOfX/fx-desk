import { ema, momentum, rangePosition, rsi } from "./indicators";
import type { Candle, Signal, SignalBias } from "./types";

/**
 * Composite signal strength.
 *
 * Four independent readings of the same series, each normalised to -100..100
 * and then weighted. Nothing here is proprietary or clever — it is the
 * standard trend/momentum/mean-reversion trio that every platform ships,
 * written out explicitly so the number on screen can be traced back to the
 * arithmetic that produced it.
 *
 * Confidence is deliberately separate from score: it measures how much the
 * four components AGREE. A +40 score where every component points the same
 * way is a very different thing from a +40 produced by one extreme reading
 * dragging three flat ones along with it.
 */

const WEIGHTS = {
  trend: 0.35,
  rsi: 0.25,
  momentum: 0.25,
  position: 0.15,
};

export function computeSignal(candles: Candle[]): Signal {
  const closes = candles.map((c) => c.close);

  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const rsi14 = rsi(closes, 14);

  const lastEma9 = last(ema9);
  const lastEma21 = last(ema21);
  const lastRsi = last(rsi14);
  const mom = momentum(closes, 10);
  const pos = rangePosition(candles, 20);

  // ── Trend: how far the fast EMA sits above or below the slow one,
  //    expressed as a percentage of price so it's comparable across pairs.
  let trendScore = 0;
  let trendNote = "Not enough data";
  if (lastEma9 !== null && lastEma21 !== null && lastEma21 !== 0) {
    const spread = ((lastEma9 - lastEma21) / lastEma21) * 100;
    trendScore = clamp(spread * 60, -100, 100);
    trendNote =
      spread > 0
        ? `Fast EMA ${spread.toFixed(2)}% above slow — uptrend`
        : `Fast EMA ${Math.abs(spread).toFixed(2)}% below slow — downtrend`;
  }

  // ── RSI: 50 is neutral. Above 70 / below 30 the reading is treated as
  //    stretched rather than strong, so its contribution is pulled back
  //    towards zero instead of maxed out.
  let rsiScore = 0;
  let rsiNote = "Not enough data";
  if (lastRsi !== null) {
    const raw = (lastRsi - 50) * 2.4;
    const stretched = lastRsi > 70 || lastRsi < 30;
    rsiScore = clamp(stretched ? raw * 0.55 : raw, -100, 100);
    rsiNote = stretched
      ? `RSI ${lastRsi.toFixed(1)} — ${lastRsi > 70 ? "overbought" : "oversold"}, discounted`
      : `RSI ${lastRsi.toFixed(1)}`;
  }

  // ── Momentum: 10-bar rate of change.
  const momScore = clamp(mom * 22, -100, 100);
  const momNote = `${mom >= 0 ? "+" : ""}${mom.toFixed(2)}% over 10 sessions`;

  // ── Range position: closing near the top of the 20-bar range is
  //    constructive, near the bottom is not.
  const posScore = clamp((pos - 50) * 2, -100, 100);
  const posNote = `Closing at ${pos.toFixed(0)}% of the 20-session range`;

  const components = [
    { label: "Trend (EMA 9/21)", value: round(lastEma9 ?? 0, 5), contribution: round(trendScore), note: trendNote },
    { label: "RSI (14)", value: round(lastRsi ?? 0, 1), contribution: round(rsiScore), note: rsiNote },
    { label: "Momentum (10)", value: round(mom, 2), contribution: round(momScore), note: momNote },
    { label: "Range position", value: round(pos, 0), contribution: round(posScore), note: posNote },
  ];

  const score = clamp(
    trendScore * WEIGHTS.trend +
      rsiScore * WEIGHTS.rsi +
      momScore * WEIGHTS.momentum +
      posScore * WEIGHTS.position,
    -100,
    100,
  );

  // Agreement: what share of the components share the composite's direction,
  // scaled by how emphatic they are.
  const dir = Math.sign(score);
  const scores = [trendScore, rsiScore, momScore, posScore];
  const agreeing = scores.filter((s) => Math.sign(s) === dir && s !== 0).length;
  const avgMagnitude =
    scores.reduce((sum, s) => sum + Math.abs(s), 0) / scores.length;
  const confidence = clamp((agreeing / 4) * 70 + (avgMagnitude / 100) * 30, 0, 100);

  return {
    score: round(score),
    bias: toBias(score),
    confidence: round(confidence),
    components,
  };
}

function toBias(score: number): SignalBias {
  if (score >= 50) return "strong-buy";
  if (score >= 18) return "buy";
  if (score <= -50) return "strong-sell";
  if (score <= -18) return "sell";
  return "neutral";
}

export const BIAS_LABEL: Record<SignalBias, string> = {
  "strong-buy": "Strong Buy",
  buy: "Buy",
  neutral: "Neutral",
  sell: "Sell",
  "strong-sell": "Strong Sell",
};

function last<T>(arr: T[]): T {
  return arr[arr.length - 1];
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function round(v: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}
