import { NextResponse } from "next/server";
import { errorStatus, loadQuotes, SOURCE_LABEL } from "@/lib/source";

export const revalidate = 30;

export async function GET() {
  try {
    const { quotes, source } = await loadQuotes();
    return NextResponse.json(
      {
        quotes,
        source,
        sourceLabel: SOURCE_LABEL[source],
        generatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      },
    );
  } catch (err) {
    const status = errorStatus(err);
    return NextResponse.json(
      {
        error:
          status === 429
            ? "Rate limited by the upstream data provider. Try again shortly."
            : "Could not reach the market data provider.",
      },
      { status },
    );
  }
}
