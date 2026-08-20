"use client";

import { useEffect, useRef, useState } from "react";
import type { PairDef } from "@/lib/pairs";
import type { Timeframe } from "@/lib/twelvedata";

export type LiveBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type FeedStatus = "connecting" | "streaming" | "polling" | "offline";

const POLL_MS = 5_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 20_000;

/**
 * Supplies the forming candle, by whichever means the instrument allows.
 *
 * Streaming instruments open a WebSocket straight to the exchange — no proxy,
 * because putting a serverless function in the middle of a tick feed would add
 * latency and cost without adding anything. Each message carries the whole
 * current candle, so it can go to the chart untouched.
 *
 * Everything else is polled. Real-time forex is licensed and no free provider
 * streams it, so a timer is the honest ceiling: the price does move between
 * polls, and the forming candle's high and low accumulate from the ticks we
 * do see.
 *
 * Both paths pause when the tab is hidden. A backgrounded tab holding a socket
 * open and a timer running is how a demo quietly burns someone's data.
 */
export function useLiveFeed(
  pair: PairDef | undefined,
  timeframe: Timeframe,
  seed: LiveBar | null,
): { bar: LiveBar | null; status: FeedStatus; lastTick: number | null } {
  const [bar, setBar] = useState<LiveBar | null>(null);
  const [status, setStatus] = useState<FeedStatus>("connecting");
  const [lastTick, setLastTick] = useState<number | null>(null);

  // Held in a ref so the poll path can accumulate high/low without the effect
  // re-subscribing on every tick.
  const current = useRef<LiveBar | null>(null);

  useEffect(() => {
    current.current = seed;
    setBar(seed);
  }, [seed]);

  useEffect(() => {
    if (!pair) return;

    let stopped = false;
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const push = (next: LiveBar) => {
      current.current = next;
      setBar(next);
      setLastTick(Date.now());
    };

    // ── Streaming ────────────────────────────────────────────────────
    const connect = () => {
      if (stopped) return;

      const url = streamUrlFor(pair, timeframe);
      if (!url) return;

      setStatus(attempts === 0 ? "connecting" : "connecting");
      socket = new WebSocket(url);

      socket.onopen = () => {
        attempts = 0;
        if (!stopped) setStatus("streaming");
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            k?: { t: number; o: string; h: string; l: string; c: string };
          };
          const k = msg.k;
          if (!k) return;
          push({
            time: Math.floor(k.t / 1000),
            open: Number(k.o),
            high: Number(k.h),
            low: Number(k.l),
            close: Number(k.c),
          });
        } catch {
          // A malformed frame is not worth tearing the socket down for.
        }
      };

      socket.onerror = () => socket?.close();

      socket.onclose = () => {
        if (stopped) return;
        setStatus("offline");
        // Exponential backoff, capped — a reconnect storm against a public
        // feed gets you banned, not connected.
        const wait = Math.min(
          RECONNECT_MAX_MS,
          RECONNECT_BASE_MS * 2 ** attempts,
        );
        attempts += 1;
        timer = setTimeout(connect, wait);
      };
    };

    // ── Polling ──────────────────────────────────────────────────────
    const poll = async () => {
      if (stopped) return;
      try {
        const res = await fetch(`/api/quote/${pair.id}`, { cache: "no-store" });
        if (!res.ok) throw new Error("quote failed");
        const { price } = (await res.json()) as { price: number };
        if (!Number.isFinite(price)) throw new Error("bad price");

        const now = Math.floor(Date.now() / 1000);
        const slot = bucket(now, timeframe);
        const prev = current.current;

        if (!prev || slot > prev.time) {
          // The period rolled over: start a fresh candle at this price.
          push({ time: slot, open: price, high: price, low: price, close: price });
        } else {
          push({
            ...prev,
            high: Math.max(prev.high, price),
            low: Math.min(prev.low, price),
            close: price,
          });
        }
        if (!stopped) setStatus("polling");
      } catch {
        if (!stopped) setStatus("offline");
      } finally {
        if (!stopped) timer = setTimeout(poll, POLL_MS);
      }
    };

    const start = () => {
      if (pair.live === "stream") connect();
      else poll();
    };

    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (socket) {
        socket.onclose = null;
        socket.close();
        socket = null;
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
        setStatus("offline");
      } else {
        attempts = 0;
        start();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [pair, timeframe]);

  return { bar, status, lastTick };
}

const SECONDS: Record<Timeframe, number> = {
  "5min": 300,
  "15min": 900,
  "1h": 3600,
  "4h": 14400,
  "1day": 86400,
};

/** Start of the period `now` falls in — where the forming candle belongs. */
function bucket(now: number, timeframe: Timeframe): number {
  const size = SECONDS[timeframe];
  return Math.floor(now / size) * size;
}

const INTERVAL: Record<Timeframe, string> = {
  "5min": "5m",
  "15min": "15m",
  "1h": "1h",
  "4h": "4h",
  "1day": "1d",
};

function streamUrlFor(pair: PairDef, timeframe: Timeframe): string | null {
  if (pair.live !== "stream" || !pair.stream) return null;
  return `wss://data-stream.binance.vision/ws/${pair.stream}@kline_${INTERVAL[timeframe]}`;
}
