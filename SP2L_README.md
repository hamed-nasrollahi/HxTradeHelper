# SP2L Spike-2-Legs indicator (`SP2L_Spike2Legs.mq5`)

An MT5 re-implementation of the "SP2L Pour Samadi" (Spike 2 Legs) setup
indicator, rebuilt **from data only**: no source code was available, so the
algorithm was reverse-engineered by fitting the indicator's exported
TradingView drawings (125 setups, 500 line objects) against the matching
US30 1-minute price history until every drawn price level was reproduced
exactly.

## The algorithm

A setup is evaluated on every bar close (the *signal bar*); the bar before
it is the *entry bar*.

1. **Leg sequence** — walk back from the entry bar through a maximal run
   of *strictly lower highs* (sell) or *strictly higher lows* (buy). The
   entry bar is the last bar of the run. Candle colors and dojis do **not**
   define the run — it is pure high/low structure.
2. **Trigger** — the signal bar must touch the entry level
   (`high >= entry` for sells, `low <= entry` for buys), which is also
   exactly the condition that ends the strict sequence.
3. **Entry** = high (sell) / low (buy) of the entry bar — the classic
   "each previous high/low becomes a sell/buy entry".
4. **Wave point A** = highest high (sell) / lowest low (buy) of the run's
   first bar and the bar before it.
5. **Stop-loss** = `A ± SLThreshold × ATR(100)` (Wilder ATR, sampled on
   the signal bar). Default threshold 0.2.
6. **Take-profit** = `entry ∓ risk × RiskReward`, where risk includes the
   threshold when *Include Stop-Loss Threshold in R:R* is on (default).
   A 50% line is drawn halfway between entry and stop.
7. **Validity filters** — run length ≥ *Minimum Spike Bars* (3), and
   movement `|A − run extreme| ≥ MovementPower × ATR(100)` sampled at the
   run's first bar (default power 3.5).

## What is exact and what is approximated

Verified **exactly** against all 125 reference setups (entry, SL, TP and
50% line reproduced to float precision):

- the strict lower-high / higher-low run definition and the entry level,
- the wave point A definition,
- SL = A ± 0.2 × ATR(100) with Wilder smoothing, ATR sampled on the
  signal bar,
- TP symmetric at R:R 1 including the threshold,
- minimum run length 3 and movement power ≥ 3.5 × ATR(100) at the run
  start (observed minimum across the reference set: 3.51),
- the trigger (the signal bar touched the entry level in 125/125 cases),
- lines extend until either SL or TP is touched.

**Approximated** (the reference data did not pin these down):

- *Doji semantics.* The original's "Max Doji in Spike Ratio" did not
  behave as a simple `dojis ≤ ratio × run length` reject filter (several
  reference setups had up to 67% doji bars). This port implements the
  simple interpretation; set `MaxDojiInSpikeRatio = 1.0` to reproduce the
  reference set exactly.
- *Gap filter.* The reference feed had no gaps, so "All Gaps" is
  implemented as "no gap restriction" and a `Require a gap` mode is
  offered as an option.
- *Trend detection.* Off in the reference settings; implemented as a
  majority-direction filter over `TrendLookback` bars.
- *Display suppression.* The original showed fewer overlapping setups
  than raw detection produces; the exact suppression rule could not be
  identified. `OnePositionAtATime` (suppress new setups while one is
  still running) and `OnlyLastPosition` are provided to control clutter.

## Inputs

| Group | Input | Default | Original setting |
|-------|-------|---------|------------------|
| Spike / movement | `MinSpikeBars` | 3 | Minimum Spike Bars |
| | `UseMovementPower`, `MovementPower` | on, 3.5 | Movement Power |
| Spike / gap | `UseGapFilter`, `GapMode` | on, All Gaps | Gap Filter |
| Spike / doji | `DojiTolerance` | on | Doji Tolerance |
| | `MaxDojiBodyRatio` | 0.35 | Max Doji Body Ratio |
| | `MaxDojiInSpikeRatio` | 0.5 | Max Doji in Spike Ratio (see note above) |
| Trend | `TrendDetection` + 3 params | off, 0.5/35/0.5 | Trend Detection |
| Position | `UseSLThreshold`, `SLThreshold` | on, 0.2 | Stop-Loss Threshold |
| | `RiskReward` | 1.0 | Risk-Reward Ratio |
| | `IncludeThresholdInRR` | on | Include Stop-Loss Threshold in R:R |
| Display | `DisplayMode` | Setup | Display Mode |
| | `OnlyLastPosition` | off | Only Display the Last Position |
| | `AtrPeriod` | 100 | (hardcoded in the original) |
| Alert | `AlertsOn`, `PushOn` | on, off | Alert |

## Installation

Copy `SP2L_Spike2Legs.mq5` into the terminal's `MQL5\Indicators` folder,
compile in MetaEditor and attach to a chart (designed for M1/M5). It has
no dependencies on the rest of this repository.

## How it was reverse-engineered (short version)

1. The TradingView export contained only line objects (bar-index ranges +
   prices). Bar indices turned out to be renumbered, so drawings were
   re-anchored by exact-matching line prices to quotes, using the broker
   feed's fractional price-grid regimes (quotes ending .49/.99 vs
   .34/.84, changing per session) as a fingerprint.
2. Each setup is 4 lines at `E, E±d, E±2d, E∓2d` — entry, 50%, SL, TP
   with R:R 1. `E` matched exact 1-minute highs/lows (fixing the chart
   timeframe to M1); `d` carried non-terminating decimals, pointing to a
   smoothed term, identified as `0.2 × RMA(TR, 100)` — the only
   combination (out of thousands of measure/period/lag variants) that
   fit, and it then reproduced all 125 setups.
3. The run rule was found by elimination: candle-color/doji-based "spike"
   definitions all produced contradictions; strict lower-high /
   higher-low sequences explained every wave point with zero exceptions.
