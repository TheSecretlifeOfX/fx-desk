export type PairDef = {
  /** Our slug: EURUSD */
  id: string;
  /** AwesomeAPI's format: EUR-USD */
  api: string;
  name: string;
  base: string;
  quote: string;
  /** Decimal places to show. JPY crosses and gold quote differently. */
  digits: number;
  group: "Major" | "Cross" | "Metal" | "Crypto";
  /**
   * How this instrument gets its live price.
   *
   * "stream" instruments push over a WebSocket and tick sub-second.
   * "poll" instruments are re-fetched on a timer, because real-time forex
   * feeds are licensed and no free provider offers one.
   */
  live: "stream" | "poll";
  /** Binance symbol, for the streaming instruments. */
  stream?: string;
  /** Exchange-qualified symbol for the TradingView widget. */
  tvSymbol: string;
};

export const pairs: PairDef[] = [
  { id: "EURUSD", api: "EUR-USD", name: "Euro / US Dollar", base: "EUR", quote: "USD", digits: 5, group: "Major", live: "poll", tvSymbol: "FX:EURUSD" },
  { id: "GBPUSD", api: "GBP-USD", name: "British Pound / US Dollar", base: "GBP", quote: "USD", digits: 5, group: "Major", live: "poll", tvSymbol: "FX:GBPUSD" },
  { id: "USDJPY", api: "USD-JPY", name: "US Dollar / Japanese Yen", base: "USD", quote: "JPY", digits: 3, group: "Major", live: "poll", tvSymbol: "FX:USDJPY" },
  { id: "USDCHF", api: "USD-CHF", name: "US Dollar / Swiss Franc", base: "USD", quote: "CHF", digits: 5, group: "Major", live: "poll", tvSymbol: "FX:USDCHF" },
  { id: "AUDUSD", api: "AUD-USD", name: "Australian Dollar / US Dollar", base: "AUD", quote: "USD", digits: 5, group: "Major", live: "poll", tvSymbol: "FX:AUDUSD" },
  { id: "USDCAD", api: "USD-CAD", name: "US Dollar / Canadian Dollar", base: "USD", quote: "CAD", digits: 5, group: "Major", live: "poll", tvSymbol: "FX:USDCAD" },
  { id: "NZDUSD", api: "NZD-USD", name: "New Zealand Dollar / US Dollar", base: "NZD", quote: "USD", digits: 5, group: "Major", live: "poll", tvSymbol: "FX:NZDUSD" },
  { id: "EURGBP", api: "EUR-GBP", name: "Euro / British Pound", base: "EUR", quote: "GBP", digits: 5, group: "Cross", live: "poll", tvSymbol: "FX:EURGBP" },
  { id: "EURJPY", api: "EUR-JPY", name: "Euro / Japanese Yen", base: "EUR", quote: "JPY", digits: 3, group: "Cross", live: "poll", tvSymbol: "FX:EURJPY" },
  { id: "GBPJPY", api: "GBP-JPY", name: "British Pound / Japanese Yen", base: "GBP", quote: "JPY", digits: 3, group: "Cross", live: "poll", tvSymbol: "FX:GBPJPY" },
  { id: "XAUUSD", api: "XAU-USD", name: "Gold / US Dollar", base: "XAU", quote: "USD", digits: 2, group: "Metal", live: "poll", tvSymbol: "OANDA:XAUUSD" },

  // Streaming instruments. Binance publishes a free, keyless public feed, so
  // these tick sub-second over a WebSocket rather than on a polling timer.
  { id: "BTCUSD", api: "BTC-USD", name: "Bitcoin / US Dollar", base: "BTC", quote: "USD", digits: 2, group: "Crypto", live: "stream", stream: "btcusdt", tvSymbol: "BINANCE:BTCUSDT" },
  { id: "ETHUSD", api: "ETH-USD", name: "Ethereum / US Dollar", base: "ETH", quote: "USD", digits: 2, group: "Crypto", live: "stream", stream: "ethusdt", tvSymbol: "BINANCE:ETHUSDT" },
  { id: "SOLUSD", api: "SOL-USD", name: "Solana / US Dollar", base: "SOL", quote: "USD", digits: 3, group: "Crypto", live: "stream", stream: "solusdt", tvSymbol: "BINANCE:SOLUSDT" },
  { id: "XRPUSD", api: "XRP-USD", name: "XRP / US Dollar", base: "XRP", quote: "USD", digits: 4, group: "Crypto", live: "stream", stream: "xrpusdt", tvSymbol: "BINANCE:XRPUSDT" },
];

export function getPair(id: string): PairDef | undefined {
  return pairs.find((p) => p.id.toLowerCase() === id.toLowerCase());
}

/** One pip, in price terms, for sizing moves in a human-readable way. */
export function pipSize(pair: PairDef): number {
  if (pair.group === "Metal") return 0.1;
  return pair.quote === "JPY" ? 0.01 : 0.0001;
}
