import type { Candle, Quote } from "./types";
import { pairs, type PairDef } from "./pairs";

/**
 * Fallback provider: the ECB's published reference rates, via Frankfurter.
 *
 * The primary source (AwesomeAPI) refuses requests from shared cloud IPs,
 * which is exactly where this app runs in production. Frankfurter has no such
 * restriction, so it keeps the deployed site working.
 *
 * The trade-off is fidelity. Frankfurter publishes one reference rate per day
 * — a close, with no high, low or open. Candles built from it are bodies with
 * no wicks: open is the previous day's close, and the high/low collapse onto
 * the body. Analysis still runs, but the intraday range is genuinely absent
 * rather than estimated, which is why the UI names the source on screen.
 *
 * Everything is quoted against EUR, so the other pairs come out as crosses.
 * Gold has no ECB reference rate and is unavailable here.
 */

const BASE = "https://api.frankfurter.dev/v1";
const SYMBOLS = ["USD", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD"];

type Rates = Record<string, number>;

/** Derives a pair's price from EUR-based reference rates. */
export function cross(pair: PairDef, r: Rates): number | null {
  const v = (code: string) => (code === "EUR" ? 1 : r[code]);
  const base = v(pair.base);
  const quote = v(pair.quote);
  if (!base || !quote || !Number.isFinite(base) || !Number.isFinite(quote)) {
    return null;
  }
  return quote / base;
}

export function supportedByFrankfurter(pair: PairDef): boolean {
  const known = (c: string) => c === "EUR" || SYMBOLS.includes(c);
  return known(pair.base) && known(pair.quote);
}

async function get(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error(`Frankfurter responded ${res.status}`);
  return res.json();
}

export async function fetchCandlesFallback(
  pair: PairDef,
  days = 300,
): Promise<Candle[]> {
  if (!supportedByFrankfurter(pair)) {
    throw new Error(`${pair.id} has no ECB reference rate`);
  }

  const start = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const data = (await get(
    `/${start}..?base=EUR&symbols=${SYMBOLS.join(",")}`,
  )) as { rates?: Record<string, Rates> };

  const series = data.rates ?? {};
  const dates = Object.keys(series).sort();

  const closes: { time: number; close: number }[] = [];
  for (const date of dates) {
    const price = cross(pair, series[date]);
    if (price === null || !Number.isFinite(price) || price <= 0) continue;
    closes.push({ time: Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000), close: price });
  }

  if (closes.length < 40) {
    throw new Error("Fallback returned too little history");
  }

  // One reference rate per day means no wicks — open is the prior close and
  // the range collapses onto the body.
  const candles: Candle[] = [];
  for (let i = 1; i < closes.length; i++) {
    const open = closes[i - 1].close;
    const close = closes[i].close;
    candles.push({
      time: closes[i].time,
      open,
      close,
      high: Math.max(open, close),
      low: Math.min(open, close),
    });
  }

  return candles;
}

export async function fetchQuotesFallback(): Promise<Quote[]> {
  const [latest, previous] = await Promise.all([
    get(`/latest?base=EUR&symbols=${SYMBOLS.join(",")}`) as Promise<{
      rates?: Rates;
      date?: string;
    }>,
    get(
      `/${new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10)}..?base=EUR&symbols=${SYMBOLS.join(",")}`,
    ) as Promise<{ rates?: Record<string, Rates> }>,
  ]);

  const now = latest.rates ?? {};
  const history = previous.rates ?? {};
  const dates = Object.keys(history).sort();
  const prior = dates.length >= 2 ? history[dates[dates.length - 2]] : now;

  const out: Quote[] = [];

  for (const pair of pairs) {
    if (!supportedByFrankfurter(pair)) continue;

    const price = cross(pair, now);
    const before = cross(pair, prior);
    if (price === null) continue;

    const change = before !== null ? price - before : 0;

    out.push({
      pair: pair.id,
      name: pair.name,
      bid: price,
      ask: price,
      high: before !== null ? Math.max(price, before) : price,
      low: before !== null ? Math.min(price, before) : price,
      change,
      changePercent: before ? (change / before) * 100 : 0,
      timestamp: latest.date
        ? Math.floor(Date.parse(`${latest.date}T00:00:00Z`) / 1000)
        : Math.floor(Date.now() / 1000),
    });
  }

  if (!out.length) throw new Error("Fallback returned no quotes");
  return out;
}
