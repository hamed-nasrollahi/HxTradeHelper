# HxTradeHelper

A MetaTrader 5 chart panel for intraday traders: reference levels and
session tools for live trading, a manual back-testing workflow with
win/lose statistics, and a one-click trade journal that exports your day's
trades with clean chart screenshots and stores them in MariaDB.

The panel is an MQL5 indicator (`hx_trade_helper.mq5`) with three tabs:

| Tab | Purpose |
|-----|---------|
| **Trade** | Chart preparation and live-trading tools |
| **Test** | Manual back-testing markers and statistics |
| **Jrnl** | End-of-day journal export |

## Features

### Trade tab

- **Reference lines** — yesterday's open/high/low/close, the day before
  yesterday's close, last week's close, and a "week map" (last week's
  high/low with 25/50/75% levels)
- **Round-number levels** — three configurable step grids (L1/L2/L3,
  defaults tuned for XAU/USD) drawn across today's range
- **ATR bands** — yesterday's close ± daily ATR
- **Sessions** — Tokyo/London/New York vertical session lines plus
  countdown labels (open/close timers), and a candle-close countdown and
  spread display (input toggles)
- **Order blocks** — one-click rectangles for daily / H4 / H1 /
  support-resistance zones
- **Moving averages** — EMA 20/60/200 toggles
- **Fib tools** — two fib variants with SL/E/TP1..TP7 levels

### Test tab (manual back-testing)

- **Sell / Buy planners** — drag-adjustable trade elements showing SL/TP
  zones, pip distances and R:R live while you move them
- **W-B / L-B / W-S / L-S** — mark a win/lose buy/sell at the chart
  center; markers are fib objects you can reposition
- **Stats** — on-chart W/L count, win % and R-sum overlay
- **Export** — writes all markers to `backTest_<date>.csv` (+ JSON
  sidecar), sorted chronologically
- **Rst / CLC** — reset markers and counters, or recount from the chart

### Jrnl tab (trade journal)

One click on **Export Journal**:

1. Collects **today's trades from the account history** (closed positions
   plus still-open positions opened today) — all symbols, not just the
   current chart
2. Writes `trades_<date>.csv` and `trades_<date>.json` with symbol, type,
   win/lose result, planned R:R, entry/SL/TP/close prices, profit and
   open/close times
3. Captures **H1, M5 and M1 screenshots per trade**, scrolled to the
   trade's entry bar, on freshly opened charts with a clean black & white
   scheme — objects drawn on your working charts never appear in them
4. **POSTs the JSON to the trade API**, which upserts into MariaDB
   (re-exporting is safe; open trades update once they close)

Output layout under `MQL5\Files`:

```
TradesHistory\
└── 2026.07.02\
    ├── trades_2026.07.02.csv
    ├── trades_2026.07.02.json
    └── XAUUSD\
        └── 09_30_987654321\
            ├── PERIOD_H1.png
            ├── PERIOD_M5.png
            └── PERIOD_M1.png
```

## Repository layout

| Path | Contents |
|------|----------|
| `hx_trade_helper.mq5` | The indicator (panel, tools, journal export) |
| `DialogHx.mqh`, `TradeElement.mqh` | Dialog subclass and the drag-adjustable trade planner element |
| `dotnet/HxTradeUploader/` | .NET 8 Native AOT library the indicator calls to POST the journal to the API |
| `dotnet/schema.sql` | MariaDB setup: database, `trades` table, application user |
| `dotnet/README.md` | DLL build/install details |
| `api/` | FastAPI service that receives journal exports and upserts them into MariaDB |
| `api/README.md` | API setup details |

## Installation

### 1. Indicator

Copy `hx_trade_helper.mq5`, `DialogHx.mqh` and `TradeElement.mqh` into the
terminal's `MQL5\Indicators` folder (keep them together) and compile in
MetaEditor. Note: the `#import "HxTradeUploader.dll"` requires the DLL from
step 2 to be present in `MQL5\Libraries` before compiling.

### 2. Uploader DLL

Requires the .NET 8 SDK and the Visual Studio 2022 C++ workload (Native
AOT uses the MSVC linker):

```
cd dotnet/HxTradeUploader
dotnet publish -c Release -r win-x64
```

Copy `bin\Release\net8.0\win-x64\publish\HxTradeUploader.dll` into
`MQL5\Libraries`, then enable *Tools → Options → Expert Advisors → Allow
DLL imports* (and the same option on the indicator's Common tab when
attaching it). The DLL is self-contained — no .NET runtime needed on the
trading machine.

### 3. Database and API (optional, for the MariaDB journal)

```
mysql -u root -p < dotnet/schema.sql        # edit the password first
cd api
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

Connection settings come from `HX_DB_*` environment variables and the API
key from `HX_API_KEY` — see `api/README.md`. Without the API running, the
journal still writes the CSV/JSON files and screenshots locally; only the
upload step is skipped (with a note in the Experts log).

## Key inputs

| Input | Default | Meaning |
|-------|---------|---------|
| `JournalBasePath` | `TradesHistory` | Base folder for all exports/screenshots (under `MQL5\Files`) |
| `ApiUrl` | `http://127.0.0.1:8000/api/trades` | Trade API endpoint |
| `ApiKey` | *(empty)* | Sent as `X-Api-Key` header when set |
| `UploadToApi` | `true` | POST the journal to the API after export |
| `showCandleTime` / `showSessions` / `showSlipage` | `false` | Candle-close countdown, session timers, spread label (1-second timer starts only if one is enabled) |
| `Level1/2/3` | 1.25 / 2.50 / 5.00 | Round-number grid steps (price units) |
| `ATR_Period` | 14 | Daily ATR period for the bands |
| `SummerTime` | `false` | DST adjustment for session times |
| `tradeRisk` | 1.0 | R multiple a win counts for in the back-test stats |

Colors, line styles and widths for every drawn element are exposed as
inputs as well.

## Notes

- The indicator is multi-instance safe: attach it to several charts of
  different symbols at once; all drawn objects and the panel are
  per-chart. The journal export is account-wide regardless of which chart
  triggers it.
- The journal reads **real account trade history** (deals), so results,
  prices and times match your broker statement; R:R is computed from the
  SL/TP recorded on the deals.
- MQL5 indicators may not call `WebRequest`, which is why the upload goes
  through the native DLL instead.
