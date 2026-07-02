# HxTradeHelper Dashboard

Analytics dashboard for the HxTradeHelper trade journal. It receives the
journal uploads from the MT5 indicator (`POST /api/import`), stores them in
the `hx_trades` MariaDB database, lets you define strategies and tag every
trade with one, and computes statistics overall, per strategy, per
month/week/weekday/hour/symbol/direction, or any combination of filters.

Built with Next.js 14 (App Router, TypeScript), Recharts and Tailwind CSS.

## Pages

| Page | What it does |
|------|--------------|
| **Overview** | KPI tiles + equity curve + monthly P/L. Metrics: net profit, win rate, profit factor, expectancy, avg win/loss, payoff ratio, avg planned R:R, biggest win/loss (with symbol and date), max drawdown, win/loss streaks, trades per day |
| **Breakdown** | Group the same filtered stats by strategy, month, ISO week, symbol, day of week, hour of day, or direction — chart plus full table |
| **Trades** | Filterable trade list; assign a strategy to each trade inline |
| **Strategies** | Create/edit/delete strategies (name, description, color) with per-strategy quick stats |
| **Settings** | MariaDB host/port/database/username/password with a test-connection button, plus the journal import API key |

Every page shares the same filter row (date range, symbol, strategy,
direction), so any statistic can be combined — e.g. "win rate of the
London-breakout strategy on XAUUSD, Buys only, last month".

## Quick start (Docker Compose)

The stack expects an existing MariaDB server (there is no bundled database
service). One-time database preparation:

```
mysql -u root -p <your-db> < sql/db-init.sql     # base trades table (new DB only)
mysql -u root -p <your-db> < sql/dashboard.sql   # strategies table + strategy_id
```

Then:

```
cd dashboard
cp .env.sample .env    # fill in HX_DB_* and the dashboard login
docker compose up -d --build
```

This starts the dashboard on <http://localhost:3000>, reading its DB
connection, import API key and Basic Auth login from `.env`.

## Journal import endpoint

The MT5 indicator uploads through `HxTradeUploader.dll` to:

```
POST /api/import
Content-Type: application/json
X-Api-Key: <Import API key from Settings, if set>

{ "account": 1234567, "trades": [ { "position_id": ..., "symbol": "...",
  "type": "Buy", "result": "Win", "rr": "1:2.50", "entry_price": ...,
  "stop_loss": ..., "take_profit": ..., "close_price": ..., "profit": ...,
  "open_time": "yyyy.mm.dd hh:mm:ss", "close_time": "...", "is_open": false } ] }
```

Set the indicator's `ApiUrl` input to
`http://<dashboard-host>:3000/api/import` (and `ApiKey` to the import key
if you configured one). Trades are upserted by `(account, position_id)`,
so re-exporting the same day is safe: open trades update once they close,
and strategy assignments made in the dashboard are never overwritten by a
re-import.

Dashboard settings persist in the `dashboard-data` volume.

When the dashboard connects with a restricted DB user, uncomment/adjust
the `GRANT` lines at the bottom of `sql/dashboard.sql` (it needs `SELECT,
INSERT, UPDATE, DELETE` on `strategies` and `SELECT, UPDATE` on `trades`).
Connection details can also be changed at runtime on the **Settings** page
(*Test connection*, then *Save*).

## Configuration

Database credentials are entered on the **Settings** page and stored
server-side in `/app/data/settings.json` (the `dashboard-data` volume,
file mode 0600) — never in the browser. Environment variables provide the
initial defaults only:

| Variable | Default |
|----------|---------|
| `HX_DB_HOST` | `127.0.0.1` |
| `HX_DB_PORT` | `3306` |
| `HX_DB_NAME` | `hx_trades` |
| `HX_DB_USER` | `hx` |
| `HX_DB_PASSWORD` | *(empty)* |
| `HX_API_KEY` | *(empty)* — initial journal import key |
| `DASHBOARD_USER` | `admin` — Basic Auth login |
| `DASHBOARD_PASSWORD` | `admin` — Basic Auth password |
| `DATA_DIR` | `/app/data` (where settings.json lives) |

Copy `.env.sample` to `.env` and fill in real values; `.env` is gitignored
and both `next dev`/`next start` and Docker Compose (`env_file`) read it.

## Local development

```
cd dashboard
npm install
npm run dev        # http://localhost:3000
```

Point the Settings page (or `HX_DB_*` env vars) at any MariaDB with the
`hx_trades` schema.

## SQL scripts

| Script | Purpose |
|--------|---------|
| `sql/db-init.sql` | Base `trades` table — only for a brand-new database |
| `sql/dashboard.sql` | Dashboard additions: `strategies` table, `trades.strategy_id` FK, indexes. Idempotent — safe to re-run on an existing database |

## How the statistics are defined

- Statistics use **closed trades only** (`is_open = 0`); the Trades page
  can additionally show open positions.
- **Win rate** ignores break-even trades (wins / (wins + losses)).
- **Profit factor** = gross profit / |gross loss|.
- **Expectancy** = net profit / total trades.
- **Payoff ratio** = average win / |average loss|.
- **Avg planned R:R** parses the `rr` column ("1:2.50") recorded from the
  SL/TP at trade time.
- **Max drawdown** is the largest peak-to-trough drop of the cumulative
  P/L curve (money, not percent — the DB doesn't know your balance).
- Profit numbers include swap and commission, as exported by the journal.

## Security note

Every page and API route requires signing in at `/login` with
`DASHBOARD_USER` / `DASHBOARD_PASSWORD` (session cookie, enforced by
`src/middleware.ts`) — change the default `admin`/`admin` before exposing
the dashboard; changing them also invalidates existing sessions. The only
exception is `POST /api/import`, which the MT5 uploader authenticates
with its own `X-Api-Key`. The login form sends credentials in cleartext,
so put the dashboard behind HTTPS (reverse proxy) when it is reachable
from the internet. The Settings page writes DB credentials to the
server-side data volume only.
