import type { Candle, Quote } from "./types";
import { pairs, type PairDef } from "./pairs";

/**
 * Every outbound request lives here and runs on the server.
 *
 * The upstream (AwesomeAPI) needs no key, but routing through our own
 * handlers still buys three things: the browser never talks to a third party,
 * responses can be cached and rate-limited on our terms, and the shape the
 * client sees is ours rather than theirs — so swapping providers later
 * touches this file and nothing else.
 */

const BASE = "https://economia.awesomeapi.com.br";
const UA = "fx-desk/1.0 (portfolio demo)";

class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function get(path: string, revalidate: number): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    next: { revalidate },
  });

  if (!res.ok) {
    throw new UpstreamError(
      `Upstream responded ${res.status}`,
      res.status === 429 ? 429 : 502,
    );
  }

  return res.json();
}

type RawDaily = {
  high: string;
  low: string;
  bid: string;
  varBid: string;
  timestamp: string;
};

/**
 * AwesomeAPI gives high, low, close (bid) and the change (varBid) but no
 * explicit open. Open is recoverable as close − change, which the data
 * confirms: the derived open always falls inside the session's high/low.
 */
export async function fetchCandles(
  pair: PairDef,
  limit = 200,
): Promise<Candle[]> {
  const raw = (await get(
    `/json/daily/${pair.api}/${limit}`,
    900,
  )) as RawDaily[];

  if (!Array.isArray(raw) || raw.length === 0) {
    throw new UpstreamError("Upstream returned no candles", 502);
  }

  const candles = raw
    .map((r): Candle | null => {
      const close = Number(r.bid);
      const change = Number(r.varBid);
      const high = Number(r.high);
      const low = Number(r.low);
      const time = Number(r.timestamp);

      if (![close, change, high, low, time].every(Number.isFinite)) return null;
      if (high <= 0 || low <= 0) return null;

      const open = close - change;

      return {
        time,
        open: clampInside(open, low, high),
        high: Math.max(high, close, open),
        low: Math.min(low, close, open),
        close,
      };
    })
    .filter((c): c is Candle => c !== null)
    // Upstream returns newest first; charts read oldest to newest.
    .reverse();

  if (candles.length < 30) {
    throw new UpstreamError("Not enough candles to analyse", 502);
  }

  return candles;
}

type RawQuote = {
  code: string;
  codein: string;
  name: string;
  bid: string;
  ask: string;
  high: string;
  low: string;
  varBid: string;
  pctChange: string;
  timestamp: string;
};

export async function fetchQuotes(): Promise<Quote[]> {
  const list = pairs.map((p) => p.api).join(",");
  const raw = (await get(`/last/${list}`, 30)) as Record<string, RawQuote>;

  const out: Quote[] = [];

  for (const pair of pairs) {
    const key = pair.api.replace("-", "");
    const r = raw[key];
    if (!r) continue;

    const bid = Number(r.bid);
    if (!Number.isFinite(bid)) continue;

    out.push({
      pair: pair.id,
      name: pair.name,
      bid,
      ask: Number(r.ask) || bid,
      high: Number(r.high) || bid,
      low: Number(r.low) || bid,
      change: Number(r.varBid) || 0,
      changePercent: Number(r.pctChange) || 0,
      timestamp: Number(r.timestamp) || Math.floor(Date.now() / 1000),
    });
  }

  if (out.length === 0) {
    throw new UpstreamError("Upstream returned no quotes", 502);
  }

  return out;
}

export function errorStatus(err: unknown): number {
  return err instanceof UpstreamError ? err.status : 502;
}

function clampInside(v: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, v));
}
