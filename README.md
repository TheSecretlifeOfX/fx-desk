# FX Desk

**Live demo → [fx-desk-live.vercel.app](https://fx-desk-live.vercel.app)**

A market dashboard: live TradingView charts for 15 instruments, alongside a
composite signal-strength score computed from the price history. Built with
Next.js 15, TypeScript and Tailwind CSS.

> **Not financial advice.** Signal scores are arithmetic on past prices — they
> predict nothing. This is a demonstration of data fetching and algorithm
> design. Do not trade from it.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3002.

## What it does

- **15 instruments** — 7 majors, 3 crosses, gold, and 4 crypto pairs
- **Live TradingView charts** — their official widget, so the prices, drawing
  tools, indicators and replay are all theirs
- **Five timeframes** — 5m, 15m, 1H, 4H, 1D
- **Signal strength** from −100 to +100, with a separate confidence figure
- **Live watchlist** with per-instrument signal bars

## Data

Three providers, tried in order, because no single free source is reliable
from a serverless platform:

| Provider | Data | Notes |
| --- | --- | --- |
| **Binance** | Intraday OHLC + **WebSocket stream** | Crypto only. No key, sub-second ticks |
| **Twelve Data** | Intraday OHLC, all timeframes | Forex primary. Needs a key for full coverage |
| **AwesomeAPI** | Daily OHLC | Refuses shared cloud IPs — works locally, not in production |
| **ECB** (Frankfurter) | Daily close only | Last resort. No wicks, no gold |

Whichever answered is **named in the UI**, because a chart that silently
changes fidelity is worse than one that tells you what you're looking at.

### API key

Without one, Twelve Data's public `demo` key is used, which covers only a
couple of symbols; everything else falls through to the daily providers. A
[free Twelve Data key](https://twelvedata.com/pricing) (800 requests/day)
unlocks intraday on all pairs:

```bash
# .env.local, or a Vercel environment variable
TWELVEDATA_API_KEY=your_key_here
```

The key is read on the server and never reaches the browser.

### Why crypto streams and forex doesn't

Real-time forex is licensed data — no free provider streams it, and any that
claims to is serving you a delayed feed. So the two kinds of instrument get
their live prices differently, and the interface says which is which rather
than pretending they're the same:

- **Crypto** opens a WebSocket straight from the browser to Binance's public
  feed. Ticks arrive sub-second and each message carries the whole forming
  candle. The badge reads `LIVE stream`.
- **Forex** polls a lightweight endpoint every 5 seconds. The price genuinely
  moves between polls, and the forming candle accumulates its high and low
  from the ticks that arrive. The badge reads `LIVE 5s`.

Both pause when the tab is hidden. The socket reconnects with exponential
backoff capped at 20 seconds — hammering a public feed gets you banned, not
connected.

### On TradingView

The chart is TradingView's official **Advanced Real-Time Chart** widget, so
the prices on it are their own live feed rather than anything fetched here.
That brings their full toolset with it — drawing tools, indicators, replay —
and it means the chart keeps working regardless of what the data providers
below are doing.

The trade-off is that the widget renders inside an iframe, so nothing outside
it can draw on it. An earlier version used TradingView's open-source
[Lightweight Charts](https://github.com/tradingview/lightweight-charts)
library with independently fetched data in order to render custom order-block
zones; that's in the git history if you want to compare. Real TradingView
data and custom overlays are mutually exclusive, and this version chooses the
data.

The providers below are still used, but only to compute the signal — not to
draw the chart.

## How the signal works

Four independent readings, each normalised to −100..100, then weighted:

| Component | Weight | What it measures |
| --- | --- | --- |
| Trend (EMA 9/21) | 35% | Fast EMA's distance from the slow one, as a % of price |
| RSI (14) | 25% | Wilder's RSI, distance from 50 |
| Momentum | 25% | 10-session rate of change |
| Range position | 15% | Where the close sits in the 20-session range |

Two details worth noting:

**Overbought readings are discounted, not maximised.** An RSI above 70 or
below 30 has its contribution scaled to 55%. A stretched market is a weaker
argument for continuation than a trending one, and treating extremes as
maximum conviction is how naive scoring systems buy tops.

**Confidence is separate from score.** It measures how much the four
components *agree*. A +40 where everything points the same way is a different
proposition from a +40 produced by one extreme reading dragging three flat
ones along. Both appear on screen.

## Architecture

```
app/
  api/pairs/route.ts          live quotes for all instruments
  api/candles/[pair]/route.ts candles + indicators + signal
  page.tsx                    dashboard
components/
  Dashboard.tsx               state, polling, selection
  TradingViewChart.tsx        the embedded widget
  SignalGauge.tsx             score bar and component breakdown
lib/
  source.ts                   provider chain and failover
  twelvedata.ts               intraday OHLC (primary)
  frankfurter.ts              ECB reference rates (fallback)
  indicators.ts               EMA, Wilder's RSI, ATR, momentum
  signal.ts                   composite scoring
  pairs.ts                    instrument definitions
```

**All fetching is server-side.** The browser never talks to a third party, the
API key stays on the server, responses are cached on our terms, and the shape
the client sees is ours — which is why adding a third provider touched one
file.

## Known limitations

- Intraday needs a Twelve Data key; without one most pairs fall back to daily
- No backtesting; the signal is a snapshot, never validated against outcomes
- No alerts, accounts or persistence
- Upstream rate limits surface as an error state rather than a retry queue
