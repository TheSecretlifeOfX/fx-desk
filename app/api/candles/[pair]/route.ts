import { NextResponse } from "next/server";
import { getPair } from "@/lib/pairs";
import { errorStatus, loadCandles, SOURCE_LABEL } from "@/lib/source";
import { atr, ema, rsi } from "@/lib/indicators";
import { computeSignal } from "@/lib/signal";
import { findOrderBlocks } from "@/lib/orderBlocks";
import type { PairAnalysis } from "@/lib/types";

export const revalidate = 900;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pair: string }> },
) {
  const { pair: slug } = await params;
  const pair = getPair(slug);

  if (!pair) {
    return NextResponse.json({ error: "Unknown pair" }, { status: 404 });
  }

  try {
    const { candles, source } = await loadCandles(pair, 200);
    const closes = candles.map((c) => c.close);

    const analysis: PairAnalysis = {
      pair: pair.id,
      name: pair.name,
      candles,
      signal: computeSignal(candles),
      orderBlocks: findOrderBlocks(candles),
      indicators: {
        ema9: ema(closes, 9),
        ema21: ema(closes, 21),
        rsi14: rsi(closes, 14),
        atr14: atr(candles, 14),
      },
      lastClose: closes[closes.length - 1],
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
