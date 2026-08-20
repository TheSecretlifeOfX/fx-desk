"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pairs, getPair } from "@/lib/pairs";
import type { PairAnalysis, Quote } from "@/lib/types";
import { Chart } from "./Chart";
import { SignalBar, SignalPanel, biasColour } from "./SignalGauge";
import { BIAS_LABEL } from "@/lib/signal";

const QUOTE_REFRESH_MS = 20_000;

export function Dashboard() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState("EURUSD");
  const [analysis, setAnalysis] = useState<PairAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [showBlocks, setShowBlocks] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const previous = useRef<Record<string, number>>({});

  // ── Live quotes, polled ────────────────────────────────────────────
  const loadQuotes = useCallback(async () => {
    try {
      const res = await fetch("/api/pairs");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not load prices");
      }
      const data: { quotes: Quote[] } = await res.json();

      setQuotes((prev) => {
        previous.current = Object.fromEntries(
          Object.entries(prev).map(([k, v]) => [k, v.bid]),
        );
        return Object.fromEntries(data.quotes.map((q) => [q.pair, q]));
      });
      setUpdatedAt(new Date());
      setQuoteError(null);
    } catch (e) {
      setQuoteError(e instanceof Error ? e.message : "Could not load prices");
    }
  }, []);

  useEffect(() => {
    loadQuotes();
    const id = setInterval(loadQuotes, QUOTE_REFRESH_MS);
    return () => clearInterval(id);
  }, [loadQuotes]);

  // ── Analysis for the selected pair ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/candles/${selected}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Could not load chart");
        return body as PairAnalysis;
      })
      .then((data) => {
        if (cancelled) return;
        setAnalysis(data);
        setScores((s) => ({ ...s, [data.pair]: data.signal.score }));
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  // Fill in the watchlist's signal column in the background, one pair at a
  // time so we don't fire eleven requests at the upstream simultaneously.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      for (const p of pairs) {
        if (cancelled) return;
        if (scores[p.id] !== undefined) continue;
        try {
          const res = await fetch(`/api/candles/${p.id}`);
          if (!res.ok) continue;
          const data: PairAnalysis = await res.json();
          if (cancelled) return;
          setScores((s) => ({ ...s, [data.pair]: data.signal.score }));
        } catch {
          // A missing signal just leaves that row blank.
        }
        await new Promise((r) => setTimeout(r, 220));
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally runs once — `scores` is read, not depended on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pairDef = getPair(selected);
  const quote = quotes[selected];

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* ── Watchlist ─────────────────────────────────────────────── */}
      <aside className="rounded-lg border border-line bg-panel">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-medium">Watchlist</h2>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-faint">
            <span className="live-dot size-1.5 rounded-full bg-up" />
            {updatedAt
              ? updatedAt.toLocaleTimeString("en-GB", { hour12: false })
              : "—"}
          </span>
        </header>

        {quoteError && (
          <p className="border-b border-line px-4 py-2 text-[11px] text-down">
            {quoteError}
          </p>
        )}

        <ul className="max-h-[520px] overflow-y-auto">
          {pairs.map((p) => {
            const q = quotes[p.id];
            const score = scores[p.id];
            const prev = previous.current[p.id];
            const dir =
              q && prev !== undefined
                ? q.bid > prev
                  ? "up"
                  : q.bid < prev
                    ? "down"
                    : null
                : null;

            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelected(p.id)}
                  aria-current={selected === p.id}
                  className={`flex w-full items-center gap-3 border-l-2 px-4 py-2.5 text-left transition-colors ${
                    selected === p.id
                      ? "border-accent bg-panel-2"
                      : "border-transparent hover:bg-panel-2"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-sm font-medium">
                        {p.id}
                      </span>
                      <span
                        className={`font-mono text-sm tabular-nums ${
                          dir === "up"
                            ? "flash-up"
                            : dir === "down"
                              ? "flash-down"
                              : ""
                        }`}
                      >
                        {q ? q.bid.toFixed(p.digits) : "—"}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="w-16 shrink-0">
                        {score !== undefined && <SignalBar score={score} />}
                      </span>
                      <span
                        className="font-mono text-[11px] tabular-nums"
                        style={{
                          color: q
                            ? q.changePercent >= 0
                              ? "var(--up)"
                              : "var(--down)"
                            : "var(--faint)",
                        }}
                      >
                        {q
                          ? `${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toFixed(2)}%`
                          : ""}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* ── Chart + signal ────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="rounded-lg border border-line bg-panel p-4">
          <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-mono text-xl font-semibold">{selected}</h1>
              <p className="text-xs text-muted">{pairDef?.name}</p>
            </div>

            <div className="flex items-center gap-4">
              {quote && (
                <div className="text-right">
                  <p className="font-mono text-xl tabular-nums">
                    {quote.bid.toFixed(pairDef?.digits ?? 5)}
                  </p>
                  <p
                    className="font-mono text-xs tabular-nums"
                    style={{
                      color:
                        quote.changePercent >= 0 ? "var(--up)" : "var(--down)",
                    }}
                  >
                    {quote.changePercent >= 0 ? "+" : ""}
                    {quote.change.toFixed(pairDef?.digits ?? 5)} (
                    {quote.changePercent >= 0 ? "+" : ""}
                    {quote.changePercent.toFixed(2)}%)
                  </p>
                </div>
              )}

              <label className="flex cursor-pointer items-center gap-2 rounded border border-line px-3 py-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={showBlocks}
                  onChange={(e) => setShowBlocks(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                Order blocks
              </label>
            </div>
          </header>

          {loading && (
            <div className="flex h-[460px] items-center justify-center text-sm text-muted">
              Loading {selected}…
            </div>
          )}

          {error && !loading && (
            <div className="flex h-[460px] flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-down">{error}</p>
              <button
                type="button"
                onClick={() => setSelected((s) => s)}
                className="rounded border border-line px-3 py-1.5 text-xs hover:border-accent"
              >
                Retry
              </button>
            </div>
          )}

          {analysis && !loading && !error && (
            <>
              <Chart
                candles={analysis.candles}
                orderBlocks={analysis.orderBlocks}
                ema9={analysis.indicators.ema9}
                ema21={analysis.indicators.ema21}
                digits={pairDef?.digits ?? 5}
                showBlocks={showBlocks}
              />
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 font-mono text-[11px] text-faint">
                <li className="text-muted">{analysis.sourceLabel}</li>
                <li>
                  <span className="mr-1.5 inline-block h-0.5 w-3 align-middle bg-[var(--ema-fast)]" />
                  EMA 9
                </li>
                <li>
                  <span className="mr-1.5 inline-block h-0.5 w-3 align-middle bg-[var(--ema-slow)]" />
                  EMA 21
                </li>
                <li>
                  <span className="mr-1.5 inline-block size-2 align-middle bg-[var(--up)] opacity-40" />
                  Bullish block
                </li>
                <li>
                  <span className="mr-1.5 inline-block size-2 align-middle bg-[var(--down)] opacity-40" />
                  Bearish block
                </li>
                <li>dashed = mitigated</li>
              </ul>
            </>
          )}
        </div>

        {analysis && !loading && !error && (
          <div className="grid gap-4 sm:grid-cols-2">
            <SignalPanel signal={analysis.signal} />

            <div className="rounded-lg border border-line bg-panel p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-medium text-muted">Order blocks</h2>
                <span className="font-mono text-xs text-faint">
                  {analysis.orderBlocks.length} found
                </span>
              </div>

              {analysis.orderBlocks.length === 0 ? (
                <p className="text-xs text-faint">
                  No qualifying zones in this window. A block needs an
                  impulsive move of at least 1.6× ATR that breaks the origin
                  candle&rsquo;s range.
                </p>
              ) : (
                <ul className="space-y-2">
                  {[...analysis.orderBlocks]
                    .sort((a, b) => b.index - a.index)
                    .map((b) => (
                      <li
                        key={`${b.kind}-${b.index}`}
                        className="flex items-center justify-between gap-3 rounded border border-line bg-panel-2 px-3 py-2"
                      >
                        <div>
                          <p
                            className="text-xs font-medium capitalize"
                            style={{
                              color:
                                b.kind === "bullish"
                                  ? "var(--up)"
                                  : "var(--down)",
                            }}
                          >
                            {b.kind}
                            {b.mitigated && (
                              <span className="ml-1.5 font-normal text-faint">
                                mitigated
                              </span>
                            )}
                          </p>
                          <p className="font-mono text-[11px] text-faint">
                            {new Date(b.time * 1000).toLocaleDateString(
                              "en-GB",
                              { day: "2-digit", month: "short", timeZone: "UTC" },
                            )}
                          </p>
                        </div>
                        <div className="text-right font-mono text-[11px]">
                          <p className="text-muted">
                            {b.bottom.toFixed(pairDef?.digits ?? 5)} –{" "}
                            {b.top.toFixed(pairDef?.digits ?? 5)}
                          </p>
                          <p className="text-faint">{b.strength}× ATR</p>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
