# HxTradeHelper Dashboard

Analytics dashboard for the HxTradeHelper trade journal. Connects to the
`hx_trades` MariaDB database that the journal exports feed, lets you define
strategies and tag every trade with one, and computes statistics overall,
per strategy, per month/week/weekday/hour/symbol/direction, or any
combination of filters.

Built with Next.js 14 (App Router, TypeScript), Recharts and Tailwind CSS.

## Pages

| Page | What it does |
|------|--------------|
| **Overview** | KPI tiles + equity curve + monthly P/L. Metrics: net profit, win rate, profit factor, expectancy, avg win/loss, payoff ratio, avg planned R:R, biggest win/loss (with symbol and date), max drawdown, win/loss streaks, trades per day |
| **Breakdown** | Group the same filtered stats by strategy, month, ISO week, symbol, day of week, hour of day, or direction — chart plus full table |
| **Trades** | Filterable trade list; assign a strategy to each trade inline |
| **Strategies** | Create/edit/delete strategies (name, description, color) with per-strategy quick stats |
| **Settings** | MariaDB host/port/database/username/password with a test-connection button |

Every page shares the same filter row (date range, symbol, strategy,
direction), so any statistic can be combined — e.g. "win rate of the
London-breakout strategy on XAUUSD, Buys only, last month".

## Quick start (Docker Compose)

```
cd dashboard
DB_PASSWORD=<pick-a-password> DB_ROOT_PASSWORD=<pick-another> docker compose up -d --build
```

This starts:

- **db** — MariaDB 11 with the `hx_trades` database. On first start it runs
  `sql/db-init.sql` (base `trades` table) and `sql/dashboard.sql`
  (strategies table + `strategy_id` column). Port 3306 is published so the
  trade API / uploader can write into the same database.
- **dashboard** — this app on <http://localhost:3000>, pre-pointed at the
  `db` service.

Data persists in the `db-data` volume; dashboard settings in `dashboard-data`.

### Using an existing MariaDB instead

1. Apply the dashboard schema to your existing database:

   ```
   mysql -u root -p hx_trades < sql/dashboard.sql
   ```

   Uncomment/adjust the `GRANT` lines at the bottom if the dashboard
   connects with the restricted `hx` user (it needs `SELECT, INSERT,
   UPDATE, DELETE` on `strategies` and `SELECT, UPDATE` on `trades`).

2. Remove the `db` service (and `depends_on`) from `docker-compose.yml`,
   or run only the dashboard:

   ```
   docker compose up -d --build dashboard
   ```

3. Open **Settings** in the dashboard, enter host/port/database/user/
   password, hit *Test connection*, then *Save*.

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
| `DATA_DIR` | `/app/data` (where settings.json lives) |

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
| `sql/db-init.sql` | Base `trades` table — only for a brand-new database (compose runs it automatically) |
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

The dashboard itself has no login — deploy it on a private network or
behind an authenticating reverse proxy (Basic Auth, Authelia, Cloudflare
Access, ...). The Settings page writes DB credentials to the server-side
data volume only.
