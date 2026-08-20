"use client";

import { useEffect, useRef } from "react";
import type { PairDef } from "@/lib/pairs";
import type { Timeframe } from "@/lib/twelvedata";

/**
 * TradingView's Advanced Real-Time Chart widget.
 *
 * This is their official embed, so the prices are TradingView's own live feed
 * rather than anything we fetch — which also means the chart arrives with
 * their full toolset: drawing tools, indicators, replay, and every timeframe
 * they support.
 *
 * The widget renders into an iframe it creates itself, so nothing outside it
 * can draw on top. Changing symbol or interval means tearing the whole thing
 * down and building a new one; there's no imperative API to update in place.
 */

const INTERVAL: Record<Timeframe, string> = {
  "5min": "5",
  "15min": "15",
  "1h": "60",
  "4h": "240",
  "1day": "D",
};

const SCRIPT_SRC =
  "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

export function TradingViewChart({
  pair,
  timeframe,
}: {
  pair: PairDef;
  timeframe: Timeframe;
}) {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;

    // The widget script appends siblings to its own container, so start from
    // an empty node each time rather than trying to reconcile.
    el.innerHTML = "";

    const mount = document.createElement("div");
    mount.className = "tradingview-widget-container__widget h-full w-full";
    el.appendChild(mount);

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      symbol: pair.tvSymbol,
      interval: INTERVAL[timeframe],
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      autosize: true,
      hide_side_toolbar: false,
      allow_symbol_change: false,
      withdateranges: true,
      details: false,
      calendar: false,
      backgroundColor: "rgba(18, 22, 30, 1)",
      gridColor: "rgba(35, 42, 55, 0.6)",
      support_host: "https://www.tradingview.com",
    });

    el.appendChild(script);

    return () => {
      el.innerHTML = "";
    };
  }, [pair.tvSymbol, timeframe]);

  return (
    <div
      ref={holder}
      key={`${pair.tvSymbol}-${timeframe}`}
      className="tradingview-widget-container h-[520px] w-full"
    />
  );
}
