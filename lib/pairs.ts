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
  group: "Major" | "Cross" | "Metal";
};

export const pairs: PairDef[] = [
  { id: "EURUSD", api: "EUR-USD", name: "Euro / US Dollar", base: "EUR", quote: "USD", digits: 5, group: "Major" },
  { id: "GBPUSD", api: "GBP-USD", name: "British Pound / US Dollar", base: "GBP", quote: "USD", digits: 5, group: "Major" },
  { id: "USDJPY", api: "USD-JPY", name: "US Dollar / Japanese Yen", base: "USD", quote: "JPY", digits: 3, group: "Major" },
  { id: "USDCHF", api: "USD-CHF", name: "US Dollar / Swiss Franc", base: "USD", quote: "CHF", digits: 5, group: "Major" },
  { id: "AUDUSD", api: "AUD-USD", name: "Australian Dollar / US Dollar", base: "AUD", quote: "USD", digits: 5, group: "Major" },
  { id: "USDCAD", api: "USD-CAD", name: "US Dollar / Canadian Dollar", base: "USD", quote: "CAD", digits: 5, group: "Major" },
  { id: "NZDUSD", api: "NZD-USD", name: "New Zealand Dollar / US Dollar", base: "NZD", quote: "USD", digits: 5, group: "Major" },
  { id: "EURGBP", api: "EUR-GBP", name: "Euro / British Pound", base: "EUR", quote: "GBP", digits: 5, group: "Cross" },
  { id: "EURJPY", api: "EUR-JPY", name: "Euro / Japanese Yen", base: "EUR", quote: "JPY", digits: 3, group: "Cross" },
  { id: "GBPJPY", api: "GBP-JPY", name: "British Pound / Japanese Yen", base: "GBP", quote: "JPY", digits: 3, group: "Cross" },
  { id: "XAUUSD", api: "XAU-USD", name: "Gold / US Dollar", base: "XAU", quote: "USD", digits: 2, group: "Metal" },
];

export function getPair(id: string): PairDef | undefined {
  return pairs.find((p) => p.id.toLowerCase() === id.toLowerCase());
}

/** One pip, in price terms, for sizing moves in a human-readable way. */
export function pipSize(pair: PairDef): number {
  if (pair.group === "Metal") return 0.1;
  return pair.quote === "JPY" ? 0.01 : 0.0001;
}
