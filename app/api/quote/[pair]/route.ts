import { NextResponse } from "next/server";
import { getPair } from "@/lib/pairs";

/**
 * A single price, as cheaply as possible.
 *
 * The dashboard polls this every few seconds for the non-streaming
 * instruments, so it does one upstream call and returns one number. Cached for
 * three seconds at the edge, which collapses many viewers into one upstream
 * request without making anyone's chart visibly stale.
 */
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pair: string }> },
) {
  const { pair: slug } = await params;
  const pair = getPair(slug);

  if (!pair) {
    return NextResponse.json({ error: "Unknown pair" }, { status: 404 });
  }

  const key = process.env.TWELVEDATA_API_KEY?.trim() || "demo";
  const symbol = encodeURIComponent(pair.api.replace("-", "/"));

  try {
    const res = await fetch(
      `https://api.twelvedata.com/price?symbol=${symbol}&apikey=${key}`,
      { headers: { Accept: "application/json" }, next: { revalidate: 3 } },
    );

    if (!res.ok) throw new Error(`Provider responded ${res.status}`);

    const body = (await res.json()) as { price?: string; message?: string };
    const price = Number(body.price);

    if (!Number.isFinite(price)) {
      throw new Error(body.message ?? "No price available");
    }

    return NextResponse.json(
      { pair: pair.id, price, at: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=3" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Quote unavailable" },
      { status: 502 },
    );
  }
}
