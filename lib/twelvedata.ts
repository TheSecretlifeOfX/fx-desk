import type { Candle } from "./types";
import type { PairDef } from "./pairs";

/**
 * Primary provider: Twelve Data. Real intraday OHLC, and the only source
 * tested that serves shared cloud IPs without complaint.
 *
 * The key is read from the environment and never leaves the server — the
 * browser only ever talks to our own route handlers. Without a key the
 * public "demo" key is used, which works but is restricted to a couple of
 * symbols; `TWELVEDATA_API_KEY` (free tier, 800 requests/day) unlocks the
 * rest. Callers get a clear error rather than a silent empty chart when a
 * symbol isn't covered.
 */

const BASE = "https://api.twelvedata.com";

export const TIMEFRAMES = ["5min", "15min", "1h", "4h", "1day"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const TIMEFRAME_LABEL: Record<Timeframe, string> = {
  "5min": "5m",
  "15min": "15m",
  "1h": "1H",
  "4h": "4H",
  "1day": "1D",
};

export function isTimeframe(v: string): v is Timeframe {
  return (TIMEFRAMES as readonly string[]).includes(v);
}

function apiKey(): string {
  return process.env.TWELVEDATA_API_KEY?.trim() || "demo";
}

/** Our "EUR-USD" becomes their "EUR/USD". */
function symbol(pair: PairDef): string {
  return pair.api.replace("-", "/");
}

type Row = {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
};

type Response = {
  values?: Row[];
  status?: string;
  code?: number;
  message?: string;
};

export class TwelveDataError extends Error {
  constructor(
    message: string,
    readonly code: number,
  ) {
    super(message);
  }
}

export async function fetchIntraday(
  pair: PairDef,
  timeframe: Timeframe,
  outputsize = 500,
): Promise<Candle[]> {
  const url =
    `${BASE}/time_series?symbol=${encodeURIComponent(symbol(pair))}` +
    `&interval=${timeframe}&outputsize=${outputsize}&apikey=${apiKey()}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    // Intraday bars go stale quickly; daily ones don't.
    next: { revalidate: timeframe === "1day" ? 900 : 120 },
  });

  if (!res.ok) {
    throw new TwelveDataError(`Provider responded ${res.status}`, res.status);
  }

  const body = (await res.json()) as Response;

  if (body.status === "error" || body.code) {
    throw new TwelveDataError(
      body.message ?? "Provider rejected the request",
      body.code ?? 502,
    );
  }

  const rows = body.values;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new TwelveDataError("Provider returned no candles", 502);
  }

  const candles = rows
    .map((r): Candle | null => {
      const open = Number(r.open);
      const high = Number(r.high);
      const low = Number(r.low);
      const close = Number(r.close);
      // Their datetimes are UTC but unmarked; make that explicit.
      const time = Math.floor(
        Date.parse(r.datetime.replace(" ", "T") + "Z") / 1000,
      );

      if (![open, high, low, close, time].every(Number.isFinite)) return null;
      if (high < low || low <= 0) return null;

      return {
        time,
        open,
        high: Math.max(high, open, close),
        low: Math.min(low, open, close),
        close,
      };
    })
    .filter((c): c is Candle => c !== null)
    // Newest first upstream; charts read oldest to newest.
    .reverse();

  if (candles.length < 40) {
    throw new TwelveDataError("Not enough candles to analyse", 502);
  }

  return dedupeByTime(candles);
}

/** Guards against the provider repeating a timestamp, which breaks the chart. */
function dedupeByTime(candles: Candle[]): Candle[] {
  const seen = new Set<number>();
  const out: Candle[] = [];
  for (const c of candles) {
    if (seen.has(c.time)) continue;
    seen.add(c.time);
    out.push(c);
  }
  return out;
}

export function hasOwnKey(): boolean {
  return Boolean(process.env.TWELVEDATA_API_KEY?.trim());
}
