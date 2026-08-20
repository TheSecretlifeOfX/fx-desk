import type { Candle } from "./types";
import type { PairDef } from "./pairs";
import type { Timeframe } from "./twelvedata";

/**
 * History for the streaming instruments.
 *
 * Uses Binance's public data mirror, which needs no key and — unlike their
 * main API host — answers from the networks this runs on. The same host
 * serves the WebSocket the browser subscribes to, so the historical candles
 * and the live ticks come from one source and line up exactly.
 */

const BASE = "https://data-api.binance.vision";

/** Our timeframes happen to match Binance's interval codes except for 5min/15min. */
const INTERVAL: Record<Timeframe, string> = {
  "5min": "5m",
  "15min": "15m",
  "1h": "1h",
  "4h": "4h",
  "1day": "1d",
};

/** Binance quotes against USDT; we present it as USD. */
function symbol(pair: PairDef): string {
  return (pair.stream ?? "").toUpperCase();
}

export function isStreaming(pair: PairDef): boolean {
  return pair.live === "stream" && Boolean(pair.stream);
}

type Kline = [number, string, string, string, string, ...unknown[]];

export async function fetchKlines(
  pair: PairDef,
  timeframe: Timeframe,
  limit = 500,
): Promise<Candle[]> {
  const url =
    `${BASE}/api/v3/klines?symbol=${symbol(pair)}` +
    `&interval=${INTERVAL[timeframe]}&limit=${limit}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: timeframe === "1day" ? 900 : 60 },
  });

  if (!res.ok) throw new Error(`Binance responded ${res.status}`);

  const raw = (await res.json()) as Kline[];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("Binance returned no candles");
  }

  const candles = raw
    .map((k): Candle | null => {
      const time = Math.floor(k[0] / 1000);
      const open = Number(k[1]);
      const high = Number(k[2]);
      const low = Number(k[3]);
      const close = Number(k[4]);
      if (![time, open, high, low, close].every(Number.isFinite)) return null;
      if (low <= 0 || high < low) return null;
      return { time, open, high, low, close };
    })
    .filter((c): c is Candle => c !== null);

  if (candles.length < 40) throw new Error("Not enough candles to analyse");
  return candles;
}

/** The browser subscribes here directly — no proxy, so ticks aren't delayed. */
export function streamUrl(pair: PairDef, timeframe: Timeframe): string | null {
  if (!isStreaming(pair)) return null;
  return `wss://data-stream.binance.vision/ws/${pair.stream}@kline_${INTERVAL[timeframe]}`;
}
