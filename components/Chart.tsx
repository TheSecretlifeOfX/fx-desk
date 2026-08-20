"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle, OrderBlock } from "@/lib/types";
import { OrderBlockPrimitive } from "./OrderBlockPrimitive";

/**
 * Interactive candlestick chart built on TradingView's Lightweight Charts.
 *
 * Scroll to zoom, drag to pan, and the order block zones stay pinned to their
 * prices throughout because they're drawn by a series primitive that
 * re-projects them every frame rather than being baked into the image.
 *
 * The chart instance is created once and then fed via imperative handles;
 * React never re-renders it. Data changes go through setData, live prices go
 * through update, which is the difference between a chart that ticks smoothly
 * and one that rebuilds itself twice a minute.
 */
export function Chart({
  candles,
  orderBlocks,
  ema9,
  ema21,
  digits,
  showBlocks,
  livePrice,
}: {
  candles: Candle[];
  orderBlocks: OrderBlock[];
  ema9: (number | null)[];
  ema21: (number | null)[];
  digits: number;
  showBlocks: boolean;
  livePrice?: number;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const fastRef = useRef<ISeriesApi<"Line"> | null>(null);
  const slowRef = useRef<ISeriesApi<"Line"> | null>(null);
  const blocksRef = useRef<OrderBlockPrimitive | null>(null);

  // ── Create once ───────────────────────────────────────────────────
  useEffect(() => {
    const el = holder.current;
    if (!el) return;

    const css = getComputedStyle(document.documentElement);
    const v = (name: string, fallback: string) =>
      css.getPropertyValue(name).trim() || fallback;

    const up = v("--up", "#26a96a");
    const down = v("--down", "#e05260");

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: v("--muted", "#8b94a7"),
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: v("--grid", "#1b212c") },
        horzLines: { color: v("--grid", "#1b212c") },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: v("--axis", "#6b7488"), style: LineStyle.Dashed, labelBackgroundColor: v("--panel-2", "#171c26") },
        horzLine: { color: v("--axis", "#6b7488"), style: LineStyle.Dashed, labelBackgroundColor: v("--panel-2", "#171c26") },
      },
      rightPriceScale: {
        borderColor: v("--line", "#232a37"),
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderColor: v("--line", "#232a37"),
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
      },
      // Everything that makes it feel like a real chart.
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
      autoSize: true,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      borderUpColor: up,
      borderDownColor: down,
      wickUpColor: up,
      wickDownColor: down,
      priceFormat: { type: "price", precision: digits, minMove: 10 ** -digits },
    });

    const slow = chart.addSeries(LineSeries, {
      color: v("--ema-slow", "#8b5cf6"),
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    const fast = chart.addSeries(LineSeries, {
      color: v("--ema-fast", "#f0b429"),
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    const primitive = new OrderBlockPrimitive({ bull: up, bear: down });
    candleSeries.attachPrimitive(primitive);

    chartRef.current = chart;
    candleRef.current = candleSeries;
    fastRef.current = fast;
    slowRef.current = slow;
    blocksRef.current = primitive;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      fastRef.current = null;
      slowRef.current = null;
      blocksRef.current = null;
    };
  }, [digits]);

  // ── Feed data ─────────────────────────────────────────────────────
  useEffect(() => {
    const candleSeries = candleRef.current;
    const fast = fastRef.current;
    const slow = slowRef.current;
    const primitive = blocksRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !fast || !slow || !primitive || !chart) return;
    if (candles.length === 0) return;

    const times: Time[] = candles.map((c) => c.time as UTCTimestamp);

    candleSeries.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    fast.setData(line(candles, ema9));
    slow.setData(line(candles, ema21));
    primitive.setData(orderBlocks, times);

    chart.timeScale().fitContent();
  }, [candles, ema9, ema21, orderBlocks]);

  // ── Toggle zones without touching the data ────────────────────────
  useEffect(() => {
    blocksRef.current?.setEnabled(showBlocks);
  }, [showBlocks]);

  // ── Live price folds into the last candle ─────────────────────────
  useEffect(() => {
    const series = candleRef.current;
    if (!series || livePrice === undefined || candles.length === 0) return;

    const last = candles[candles.length - 1];
    series.update({
      time: last.time as UTCTimestamp,
      open: last.open,
      high: Math.max(last.high, livePrice),
      low: Math.min(last.low, livePrice),
      close: livePrice,
    });
  }, [livePrice, candles]);

  return (
    <div
      ref={holder}
      className="h-[440px] w-full"
      role="img"
      aria-label={`Interactive candlestick chart with ${orderBlocks.length} order blocks. Scroll to zoom, drag to pan.`}
    />
  );
}

function line(candles: Candle[], values: (number | null)[]) {
  const out: { time: UTCTimestamp; value: number }[] = [];
  for (let i = 0; i < candles.length; i++) {
    const v = values[i];
    if (v === null || v === undefined) continue;
    out.push({ time: candles[i].time as UTCTimestamp, value: v });
  }
  return out;
}
