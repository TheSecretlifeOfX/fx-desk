import { NextResponse } from "next/server";
import { getPair } from "@/lib/pairs";
import { errorStatus, loadCandles, SOURCE_LABEL } from "@/lib/source";
import { isTimeframe, type Timeframe } from "@/lib/twelvedata";
import { atr, ema, rsi } from "@/lib/indicators";
import { computeSignal } from "@/lib/signal";
import type { PairAnalysis } from "@/lib/types";

export const revalidate = 900;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pair: string }> },
) {
  const { pair: slug } = await params;
  const pair = getPair(slug);

  // Never trust the query string — fall back if it's been hand-edited.
  const requested = new URL(request.url).searchParams.get("tf") ?? "1h";
  const timeframe: Timeframe = isTimeframe(requested) ? requested : "1h";

  if (!pair) {
    return NextResponse.json({ error: "Unknown pair" }, { status: 404 });
  }

  try {
    const { candles, source } = await loadCandles(pair, timeframe, 200);
    const closes = candles.map((c) => c.close);

    const analysis: PairAnalysis = {
      pair: pair.id,
      name: pair.name,
      candles,
      signal: computeSignal(candles),
      indicators: {
        ema9: ema(closes, 9),
        ema21: ema(closes, 21),
        rsi14: rsi(closes, 14),
        atr14: atr(candles, 14),
      },
      lastClose: closes[closes.length - 1],
      timeframe,
      source,
      sourceLabel: SOURCE_LABEL[source],
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(analysis, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    const status = errorStatus(err);
    return NextResponse.json(
      {
        error:
          status === 429
            ? "Rate limited by the upstream data provider. Try again shortly."
            : "Could not load history for this pair.",
      },
      { status },
    );
  }
}
