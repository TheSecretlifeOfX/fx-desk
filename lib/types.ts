export type Candle = {
  /** Unix seconds, start of the session. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type Quote = {
  pair: string;
  name: string;
  bid: number;
  ask: number;
  high: number;
  low: number;
  change: number;
  changePercent: number;
  timestamp: number;
};

export type SignalBias = "strong-sell" | "sell" | "neutral" | "buy" | "strong-buy";

export type Signal = {
  /** -100 (maximum bearish) to +100 (maximum bullish). */
  score: number;
  bias: SignalBias;
  /** How much of the evidence agrees, 0–100. */
  confidence: number;
  components: {
    label: string;
    value: number;
    /** -100..100 contribution this component made. */
    contribution: number;
    note: string;
  }[];
};

export type OrderBlock = {
  kind: "bullish" | "bearish";
  /** Index of the origin candle in the series. */
  index: number;
  time: number;
  /** Zone boundaries. */
  top: number;
  bottom: number;
  /** Size of the impulsive move that followed, in ATR multiples. */
  strength: number;
  /** True once price has traded back into the zone. */
  mitigated: boolean;
};

export type PairAnalysis = {
  pair: string;
  name: string;
  candles: Candle[];
  signal: Signal;
  orderBlocks: OrderBlock[];
  indicators: {
    ema9: (number | null)[];
    ema21: (number | null)[];
    rsi14: (number | null)[];
    atr14: number;
  };
  lastClose: number;
  /** Which provider answered — the UI names it on screen. */
  source: "binance" | "twelvedata" | "awesomeapi" | "ecb";
  timeframe: string;
  sourceLabel: string;
  /** ISO string of when this analysis was produced. */
  generatedAt: string;
};
