"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pairs, getPair } from "@/lib/pairs";
import type { PairAnalysis, Quote } from "@/lib/types";
import { TradingViewChart } from "./TradingViewChart";
import { SignalBar, SignalPanel } from "./SignalGauge";
import {
  TIMEFRAMES,
  TIMEFRAME_LABEL,
  type Timeframe,
} from "@/lib/twelvedata";

const QUOTE_REFRESH_MS = 15_000;

export function Dashboard() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState("EURUSD");
  const [analysis, setAnalysis] = useState<PairAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [expanded, setExpanded] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const previous = useRef<Record<string, number>>({});

  // ── Watchlist prices ──────────────────────────────────────────────
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

  // ── Signal analysis for the selected instrument ───────────────────
  //
  // The chart is TradingView's and fetches its own prices; this call exists
  // only to compute the signal, which is ours.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/candles/${selected}?tf=${timeframe}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Could not load analysis");
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
  }, [selected, timeframe]);

  // Backfill the watchlist's signal column.
  //
  // Twelve Data's free tier allows 8 requests a minute, so the forex pairs
  // are spaced accordingly — firing them off back to back returns nothing but
  // 429s and leaves most of the column blank. The crypto pairs come from
  // Binance, which has no such limit, so they go first and fill the board
  // while the rest trickle in. Responses cache at the edge, so this cost is
  // paid once rather than per visitor.
  useEffect(() => {
    let cancelled = false;

    const FOREX_GAP_MS = 8_000;
    const CRYPTO_GAP_MS = 300;

    const load = async (id: string) => {
      try {
        const res = await fetch(`/api/candles/${id}`);
        if (!res.ok) return false;
        const data: PairAnalysis = await res.json();
        if (cancelled) return true;
        setScores((prev) => ({ ...prev, [data.pair]: data.signal.score }));
        return true;
      } catch {
        return false;
      }
    };

    (async () => {
      // Cheap ones first, so the column isn't empty while we wait.
      const streaming = pairs.filter((p) => p.live === "stream");
      const polled = pairs.filter((p) => p.live !== "stream");

      for (const p of streaming) {
        if (cancelled) return;
        await load(p.id);
        await wait(CRYPTO_GAP_MS);
      }

      const failed: string[] = [];
      for (const p of polled) {
        if (cancelled) return;
        const ok = await load(p.id);
        if (!ok) failed.push(p.id);
        await wait(FOREX_GAP_MS);
      }

      // One retry pass — a single 429 shouldn't leave a row blank forever.
      for (const id of failed) {
        if (cancelled) return;
        await load(id);
        await wait(FOREX_GAP_MS);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // F toggles fullscreen, Escape leaves it. Ignored while the user is typing
  // so the shortcut can never swallow a keystroke meant for an input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setExpanded((v) => !v);
      } else if (e.key === "Escape") {
        setExpanded(false);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Stop the page behind the overlay from scrolling.
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded]);

  const pairDef = getPair(selected);

  if (expanded && pairDef) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-bg">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="flex items-baseline gap-3">
            <h1 className="font-mono text-lg font-semibold">{selected}</h1>
            <span className="hidden text-xs text-muted sm:inline">
              {pairDef.name}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              className="flex overflow-hidden rounded border border-line"
              role="group"
              aria-label="Timeframe"
            >
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  aria-pressed={timeframe === tf}
                  className={`px-2.5 py-1.5 font-mono text-xs transition-colors ${
                    timeframe === tf
                      ? "bg-accent text-[#0b0e13]"
                      : "text-muted hover:bg-panel-2"
                  }`}
                >
                  {TIMEFRAME_LABEL[tf]}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="flex items-center gap-2 rounded border border-line px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-accent hover:text-accent"
            >
              Exit
              <kbd className="rounded border border-line px-1 text-[10px]">
                Esc
              </kbd>
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1">
          <TradingViewChart pair={pairDef} timeframe={timeframe} expanded />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
      {/* ── Watchlist ───────────────────────────────────────────── */}
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

        <ul className="max-h-[560px] overflow-y-auto">
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

      {/* ── Chart + signal ──────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="rounded-lg border border-line bg-panel p-4">
          <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-mono text-xl font-semibold">{selected}</h1>
              <p className="text-xs text-muted">{pairDef?.name}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 rounded border border-line px-2.5 py-1.5 font-mono text-[10px] text-up">
                <span className="live-dot size-1.5 rounded-full bg-up" />
                LIVE
                <span className="text-faint">TradingView</span>
              </span>

              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="flex items-center gap-2 rounded border border-line px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-accent hover:text-accent"
                title="Expand the chart to fill the window"
              >
                <ExpandIcon />
                Fullscreen
                <kbd className="rounded border border-line px-1 text-[10px]">
                  F
                </kbd>
              </button>

              <div
                className="flex overflow-hidden rounded border border-line"
                role="group"
                aria-label="Timeframe"
              >
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setTimeframe(tf)}
                    aria-pressed={timeframe === tf}
                    className={`px-2.5 py-1.5 font-mono text-xs transition-colors ${
                      timeframe === tf
                        ? "bg-accent text-[#0b0e13]"
                        : "text-muted hover:bg-panel-2"
                    }`}
                  >
                    {TIMEFRAME_LABEL[tf]}
                  </button>
                ))}
              </div>
            </div>
          </header>

          {pairDef && <TradingViewChart pair={pairDef} timeframe={timeframe} />}

          <p className="mt-3 border-t border-line pt-3 font-mono text-[11px] text-faint">
            Live chart and prices by TradingView. Press{" "}
            <kbd className="rounded border border-line px-1">F</kbd> for
            fullscreen. Use the left toolbar to draw your own zones, or add
            indicators from the top bar.
          </p>
        </div>

        {loading && (
          <div className="rounded-lg border border-line bg-panel p-4 text-sm text-muted">
            Loading signal for {selected}…
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-line bg-panel p-4">
            <p className="text-sm text-down">{error}</p>
            <p className="mt-1 text-xs text-faint">
              The chart above is unaffected — it takes its prices from
              TradingView.
            </p>
          </div>
        )}

        {analysis && !loading && !error && (
          <div className="grid gap-4 sm:grid-cols-2">
            <SignalPanel signal={analysis.signal} />

            <div className="rounded-lg border border-line bg-panel p-4">
              <h2 className="mb-3 text-sm font-medium text-muted">
                How this score is built
              </h2>
              <p className="mb-3 text-xs leading-relaxed text-faint">
                Four readings of the last {analysis.candles.length} candles on
                the {TIMEFRAME_LABEL[timeframe]} timeframe, each normalised to
                −100…100 and weighted: trend 35%, RSI 25%, momentum 25%, range
                position 15%.
              </p>
              <p className="mb-3 text-xs leading-relaxed text-faint">
                Confidence is separate from the score — it measures how much the
                four components agree, so a +40 backed by all of them reads
                differently from a +40 dragged up by one extreme reading.
              </p>
              <p className="font-mono text-[11px] text-faint">
                Analysis data: {analysis.sourceLabel}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ExpandIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
      aria-hidden="true"
    >
      <path d="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4" />
    </svg>
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
