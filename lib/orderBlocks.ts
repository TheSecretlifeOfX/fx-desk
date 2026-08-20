import { atr } from "./indicators";
import type { Candle, OrderBlock } from "./types";

/**
 * Order block detection.
 *
 * An order block, in the smart-money-concepts vocabulary, is the last
 * opposing candle before an impulsive move — the idea being that a large
 * participant absorbed the other side there before pushing price away, and
 * that unfilled interest may still sit in that range.
 *
 * The detection here is mechanical and has three requirements:
 *
 *   1. The origin candle closes AGAINST the move that follows it (a down
 *      candle before a rally, an up candle before a selloff).
 *   2. The move that follows is impulsive — it must travel at least
 *      `minImpulse` ATR within `lookahead` candles. Measuring in ATR rather
 *      than pips is what lets the same thresholds work on EURUSD and gold.
 *   3. The move breaks structure: it takes out the extreme of the origin
 *      candle and keeps going, rather than merely wicking through it.
 *
 * A block is marked "mitigated" once price has traded back into its range,
 * which is the conventional way of saying the zone has already been used.
 *
 * None of this is predictive and none of it is advice — it is a well-defined
 * pattern drawn consistently, so a reader can check the drawing against the
 * chart themselves.
 */

type Options = {
  lookahead?: number;
  minImpulse?: number;
  maxBlocks?: number;
  /**
   * Minimum zone height as a fraction of ATR. A doji origin candle produces
   * a technically valid but useless zone — a sub-pip band that renders as a
   * hairline and can never be meaningfully "entered". Requiring real height
   * throws those out.
   */
  minHeight?: number;
};

export function findOrderBlocks(
  candles: Candle[],
  {
    lookahead = 5,
    minImpulse = 1.6,
    maxBlocks = 8,
    minHeight = 0.2,
  }: Options = {},
): OrderBlock[] {
  const range = atr(candles, 14);
  if (range <= 0 || candles.length < 30) return [];

  const found: OrderBlock[] = [];

  // Leave the final `lookahead` candles alone — there isn't yet enough
  // history after them to know whether an impulse followed.
  for (let i = 20; i < candles.length - lookahead; i++) {
    const origin = candles[i];
    const isDown = origin.close < origin.open;
    const isUp = origin.close > origin.open;
    if (!isDown && !isUp) continue;

    const following = candles.slice(i + 1, i + 1 + lookahead);
    if (following.length < 2) continue;

    if (isDown) {
      // Bullish block: a down candle, then price runs up hard.
      const peak = Math.max(...following.map((c) => c.high));
      const travel = (peak - origin.high) / range;
      const brokeStructure = peak > origin.high;
      const closedAbove = following.some((c) => c.close > origin.high);

      if (brokeStructure && closedAbove && travel >= minImpulse) {
        found.push(
          block("bullish", i, origin, travel, candles.slice(i + lookahead)),
        );
      }
    } else {
      // Bearish block: an up candle, then price drops hard.
      const trough = Math.min(...following.map((c) => c.low));
      const travel = (origin.low - trough) / range;
      const brokeStructure = trough < origin.low;
      const closedBelow = following.some((c) => c.close < origin.low);

      if (brokeStructure && closedBelow && travel >= minImpulse) {
        found.push(
          block("bearish", i, origin, travel, candles.slice(i + lookahead)),
        );
      }
    }
  }

  // Discard hairline zones from doji origin candles.
  const sized = found.filter((b) => b.top - b.bottom >= range * minHeight);

  // Overlapping blocks in the same direction are the same zone found twice;
  // keep the stronger one.
  const deduped = dedupe(sized);

  // Most recent first, capped — an unreadable chart helps nobody.
  return deduped
    .sort((a, b) => b.index - a.index)
    .slice(0, maxBlocks)
    .sort((a, b) => a.index - b.index);
}

function block(
  kind: "bullish" | "bearish",
  index: number,
  origin: Candle,
  strength: number,
  after: Candle[],
): OrderBlock {
  const top = Math.max(origin.open, origin.close, origin.high);
  const bottom = Math.min(origin.open, origin.close, origin.low);

  // Mitigated once any later candle trades back inside the zone.
  const mitigated = after.some((c) => c.low <= top && c.high >= bottom);

  return {
    kind,
    index,
    time: origin.time,
    top,
    bottom,
    strength: Math.round(strength * 100) / 100,
    mitigated,
  };
}

function dedupe(blocks: OrderBlock[]): OrderBlock[] {
  const kept: OrderBlock[] = [];

  for (const candidate of blocks) {
    const clash = kept.find(
      (k) =>
        k.kind === candidate.kind &&
        candidate.bottom <= k.top &&
        candidate.top >= k.bottom,
    );

    if (!clash) {
      kept.push(candidate);
      continue;
    }

    if (candidate.strength > clash.strength) {
      kept[kept.indexOf(clash)] = candidate;
    }
  }

  return kept;
}
