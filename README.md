# FX Desk

**Live demo → [fx-desk.vercel.app](https://fx-desk.vercel.app)**

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
- **Live prices**, polled every 20 seconds
- **Signal strength** from −100 to +100, with a separate confidence figure
- **Order block detection** drawn as zones on the chart
- **Candlestick chart** with EMA 9/21 overlays and a hover crosshair

## Data

Prices come from [AwesomeAPI](https://docs.awesomeapi.com.br/api-de-moedas),
which needs no key. Candles are **end-of-day**, and the live quote refreshes
every 20 seconds — so the price ticks in real time while the chart itself is
daily. The upstream caps intraday history at roughly 100 quotes (~1.3 hours),
which isn't enough for the analysis, hence daily.

The API returns high, low, close and the day's change but no explicit open.
Open is recovered as `close − change`; the derived value falls inside the
session's high/low on every candle tested, and the route handler clamps it
regardless.

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
  Chart.tsx                   SVG candlesticks, EMAs, order block zones
  SignalGauge.tsx             score bar and component breakdown
lib/
  source.ts                   every outbound request lives here
  indicators.ts               EMA, Wilder's RSI, ATR, momentum
  signal.ts                   composite scoring
  orderBlocks.ts              detection
  pairs.ts                    instrument definitions
```

**All fetching is server-side.** The upstream needs no key, but routing through
route handlers still means the browser never talks to a third party, responses
are cached on our terms (30s for quotes, 15min for candles), and the shape the
client sees is ours — so swapping providers touches `lib/source.ts` and
nothing else.

**The chart is hand-drawn SVG**, no charting library. Everything projects
through two scale functions, so the same code renders EURUSD at 1.16 and gold
at 4,100 without special cases.

## Known limitations

- Daily candles only — intraday history isn't available from this source
- No backtesting; the signal is a snapshot, never validated against outcomes
- No alerts, accounts or persistence
- Upstream rate limits surface as an error state rather than a retry queue
