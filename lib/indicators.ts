import type { Candle } from "./types";

/**
 * Exponential moving average. Seeded with a simple average of the first
 * `period` values so the series doesn't lurch in the first few bars.
 * Returns nulls until enough data exists, keeping index alignment with the
 * candle array.
 */
export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;

  const k = 2 / (period + 1);
  let prev =
    values.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
  out[period - 1] = prev;

  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/**
 * Wilder's RSI. Uses smoothed (not simple) averages after the first window,
 * which is what every charting platform actually plots.
 */
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = toRsi(avgGain, avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = toRsi(avgGain, avgLoss);
  }

  return out;
}

function toRsi(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Average True Range — the yardstick everything else is measured against.
 * Used here to decide whether a move counts as "impulsive" relative to how
 * much this pair normally moves, so the same code works on EURUSD and on
 * gold without hand-tuned thresholds.
 */
export function atr(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0;

  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = candles[i - 1].close;
    trs.push(
      Math.max(
        c.high - c.low,
        Math.abs(c.high - prevClose),
        Math.abs(c.low - prevClose),
      ),
    );
  }

  const window = trs.slice(-period);
  return window.reduce((sum, v) => sum + v, 0) / window.length;
}

/** Percentage rate of change over `lookback` bars. */
export function momentum(values: number[], lookback = 10): number {
  if (values.length <= lookback) return 0;
  const now = values[values.length - 1];
  const then = values[values.length - 1 - lookback];
  if (then === 0) return 0;
  return ((now - then) / then) * 100;
}

/** Where the last close sits inside the recent range, 0 (low) to 100 (high). */
export function rangePosition(candles: Candle[], lookback = 20): number {
  const window = candles.slice(-lookback);
  if (!window.length) return 50;
  const high = Math.max(...window.map((c) => c.high));
  const low = Math.min(...window.map((c) => c.low));
  if (high === low) return 50;
  const close = window[window.length - 1].close;
  return ((close - low) / (high - low)) * 100;
}
