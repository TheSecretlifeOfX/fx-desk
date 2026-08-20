# FX Desk

**Live demo → [fx-desk-live.vercel.app](https://fx-desk-live.vercel.app)**

Forex prices with a composite signal-strength score and automatically detected
order blocks drawn on the chart. Built with Next.js 15, TypeScript and
Tailwind CSS.

> **Not financial advice.** Signal scores are arithmetic on past prices — they
> predict nothing. Order blocks are a charting convention, not a fact about the
> market. This is a demonstration of data fetching, charting and algorithm
> design. Do not trade from it.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3002.

## What it does

- **11 instruments** — 7 majors, 3 crosses, and gold
- **Interactive chart** — scroll to zoom, drag to pan, pinch on touch
- **Five timeframes** — 5m, 15m, 1H, 4H, 1D
- **Live prices**, polled every 20 seconds and folded into the forming candle
- **Signal strength** from −100 to +100, with a separate confidence figure
- **Order blocks** drawn as real zones that stay pinned to their prices while
  you scroll and zoom

## Data

Three providers, tried in order, because no single free source is reliable
from a serverless platform:

| Provider | Data | Notes |
| --- | --- | --- |
| **Twelve Data** | Intraday OHLC, all timeframes | Primary. Needs a key for full coverage |
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

### On TradingView

The chart is built with **[Lightweight Charts](https://github.com/tradingview/lightweight-charts)**,
TradingView's open-source charting library (Apache-2.0). The *data* is not
TradingView's: they have no public data API, their feed is exchange-licensed,
and scraping it would breach their terms. Their embeddable widget does carry
real TradingView data, but it's an iframe — custom order blocks can't be drawn
on it. Since drawing the zones was the point, this uses their renderer with
independent data.

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

## How order block detection works

An order block is the last opposing candle before an impulsive move. Detection
requires three things:

1. The origin candle closes **against** the move that follows it
2. The following move travels at least **1.6× ATR** within 5 candles
3. The move **breaks structure** — it takes out the origin candle's extreme
   and a later candle *closes* beyond it, rather than merely wicking through

Measuring impulse in ATR rather than pips is what lets identical thresholds
work on EURUSD (ATR ≈ 0.0034) and gold (ATR ≈ 103) without hand-tuning.

Zones shorter than 0.2× ATR are discarded — a doji origin candle produces a
technically valid but useless sub-pip band that renders as a hairline. A block
is marked **mitigated** once price has traded back into its range, drawn with
a dashed border and reduced opacity.

## Architecture

```
app/
  api/pairs/route.ts          live quotes for all instruments
  api/candles/[pair]/route.ts candles + indicators + signal + blocks
  page.tsx                    dashboard
components/
  Dashboard.tsx               state, polling, selection
  Chart.tsx                   Lightweight Charts setup, live updates
  OrderBlockPrimitive.ts      custom canvas primitive drawing the zones
  SignalGauge.tsx             score bar and component breakdown
lib/
  source.ts                   provider chain and failover
  twelvedata.ts               intraday OHLC (primary)
  frankfurter.ts              ECB reference rates (fallback)
  indicators.ts               EMA, Wilder's RSI, ATR, momentum
  signal.ts                   composite scoring
  orderBlocks.ts              detection
  pairs.ts                    instrument definitions
```

**All fetching is server-side.** The browser never talks to a third party, the
API key stays on the server, responses are cached on our terms, and the shape
the client sees is ours — which is why adding a third provider touched one
file.

**Order blocks are a chart primitive, not an overlay.** Lightweight Charts has
no rectangle shape, so `components/OrderBlockPrimitive.ts` implements its
series-primitive interface: every frame, each zone's price range and origin
time are re-projected into pixels through the chart's own scales. That's why
the zones stay locked to their prices while you scroll and zoom, instead of
drifting the way a static overlay would.

**The chart instance is created once** and driven imperatively — `setData` for
history, `update` for live ticks. React never re-renders it, which is the
difference between a chart that ticks smoothly and one that rebuilds itself
twice a minute.

## Known limitations

- Intraday needs a Twelve Data key; without one most pairs fall back to daily
- No backtesting; the signal is a snapshot, never validated against outcomes
- No alerts, accounts or persistence
- Upstream rate limits surface as an error state rather than a retry queue
