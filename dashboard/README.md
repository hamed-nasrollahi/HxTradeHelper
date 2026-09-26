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
| **Breakdown** | Group the same filtered stats by strategy, month, month of year (seasonality across years), ISO week, symbol, day of week, hour of day, direction, or mistake tag — chart plus full table; optionally add a second "then by" dimension for a combined breakdown (e.g. strategy, then hour of day), and optionally exclude trades with entry or exit marked wrong. Click a row's trade count to open those exact trades on the Trades page |
| **Trades** | Filterable trade list; assign a strategy to each trade inline, and review entry/exit correctness with a mistake tag |
| **Strategies** | Create/edit/delete strategies (name, description, color) with per-strategy quick stats |
| **Mistakes** | Create/edit/delete recurring-mistake tags (name, description) with a count of tagged trades |
| **Settings** | Your account: personal import API key (show / copy / regenerate) and password. Admins also get the MariaDB connection with a test-connection button and the legacy global import key |
| **Admin** *(admins)* | User counts, new users per month for the last 6 months, top 10 gainers and losers by net P/L (30 days / 90 days / 1 year / all time) |
| **Users** *(admins)* | Search users; confirm an account manually, disable / enable, reset a password (optionally emailed via Brevo), grant / remove admin |

Every page shares the same filter row (date range, symbol, strategy,
direction), so any statistic can be combined — e.g. "win rate of the
London-breakout strategy on XAUUSD, Buys only, last month".

## Quick start (Docker Compose)

The stack expects an existing MariaDB server (there is no bundled database
service). One-time database preparation:

```
mysql -u root -p <your-db> < sql/db-init.sql     # base trades table (new DB only)
mysql -u root -p <your-db> < sql/dashboard.sql   # strategies + mistakes tables, trade review columns
```

Then:

```
cd dashboard
cp .env.sample .env    # fill in HX_DB_* and the dashboard login
docker compose up -d --build
```

This starts the dashboard on <http://localhost:3000>, reading its DB
connection, import API key and Basic Auth login from `.env`.

To run the prebuilt GitHub Container Registry image instead of building
from source:

```
cd dashboard
cp .env.sample .env    # fill in HX_DB_* and the dashboard login
docker compose -f docker-compose.image.yml up -d
```

The default image is
`ghcr.io/hamed-nasrollahi/hx-trade-dashboard:latest`. Set
`DASHBOARD_IMAGE=ghcr.io/hamed-nasrollahi/hx-trade-dashboard:1.0.0`
or
`DASHBOARD_IMAGE=ghcr.io/hamed-nasrollahi/hx-trade-dashboard:v1.0.0`
to pin a specific dashboard version. Every published version also updates
the `latest` tag to that same image. Publishing is manual through the
**Publish dashboard Docker image** GitHub Action; enter the version you
want to publish, matching `dashboard/package.json`.

## Users and sign-in

The dashboard is multi-user; every user sees only their own trades,
accounts, strategies, mistakes and backtests.

- **Main admin (user #1)** signs in with `DASHBOARD_USER` /
  `DASHBOARD_PASSWORD` exactly as before, and owns every record that existed
  before multi-user support. Sessions from before the upgrade stay valid.
- **Email sign-up** at `/register`: name, email, password → a 6-digit code
  is emailed through [Brevo](https://www.brevo.com) (`BREVO_API_KEY`,
  `MAIL_FROM_EMAIL` — a verified Brevo sender). Codes expire after 15
  minutes, allow 5 attempts, and can be re-sent once a minute. Without
  Brevo configured the code is only printed in the server log; an admin can
  confirm the account on the **Users** page instead.
- **Forgot password** at `/forgot-password` (linked from the login page):
  a 6-digit reset code is emailed via Brevo (same expiry/attempt limits);
  entering it with a new password signs the user in. An admin can also
  reset a password on the **Users** page. The main admin's password is
  `DASHBOARD_PASSWORD` in `.env`.
- **Google sign-in**: set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and
  `APP_URL`, and add `${APP_URL}/api/auth/google/callback` as an authorised
  redirect URI of the OAuth client. A Google login with the same email as
  an existing account signs into (and links) that account.
- **MT5 accounts** belong to the user who first uploads them; uploads of an
  account owned by someone else are rejected with 403.
- **Upgrading** needs no manual step when the dashboard's DB user may
  `CREATE`/`ALTER` — the schema upgrade runs on first start. It only adds
  the `users` table and `user_id` columns (existing rows get `user_id = 1`);
  nothing is deleted. Otherwise apply `sql/dashboard.sql` by hand. Taking a
  backup first (`mysqldump hx_trades > backup.sql`) never hurts.

## Journal import endpoint

The MT5 indicator uploads through `HxTradeUploader.dll` to:

```
POST /api/import
Content-Type: application/json
X-Api-Key: <your personal API key from Settings>

{ "account": 1234567, "trades": [ { "position_id": ..., "symbol": "...",
  "type": "Buy", "result": "Win", "rr": "1:2.50", "entry_price": ...,
  "stop_loss": ..., "take_profit": ..., "close_price": ..., "profit": ...,
  "open_time": "yyyy.mm.dd hh:mm:ss", "close_time": "...", "is_open": false } ] }
```

Set the indicator's `ApiUrl` input to
`http://<dashboard-host>:3000/api/import` and `ApiKey` to your personal
key from the Settings page — the trades are saved to your account. The
legacy global key (`HX_API_KEY` / admin Settings) keeps working and saves
to the main admin. Uploads without a valid key are always rejected with
401. Trades are upserted by `(account, position_id)`,
so re-exporting the same day is safe: open trades update once they close,
and strategy assignments made in the dashboard are never overwritten by a
re-import.

Dashboard settings persist in the `dashboard-data` volume.

## News calendar endpoint

```
GET /api/news?currencies=USD,EUR
```

Returns a flat JSON array of orange/red-impact ForexFactory events
(`title`, `country`, `date`, `impact`), shaped like ForexFactory's own feed
so the indicator can parse it identically. Omit `currencies` to get every
cached event. The dashboard caches the calendar in `news_events` and only
re-fetches ForexFactory (`NEWS_FEED_URL`, default
`https://nfs.faireconomy.media/ff_calendar_thisweek.json`) when the cache
is missing or older than an hour (tracked in `news_fetch_log`) — so any
number of indicator instances polling this endpoint only cost ForexFactory
one request per hour. Set the indicator's `NewsFeedUrl` input to
`http://<dashboard-host>:3000/api/news`. Unlike `/api/import`, this
endpoint is unauthenticated (no `X-Api-Key`) since it only serves public
calendar data.

When the dashboard connects with a restricted DB user, uncomment/adjust
the `GRANT` lines at the bottom of `sql/dashboard.sql` (it needs `SELECT,
INSERT, UPDATE, DELETE` on `strategies` and `mistakes`, `SELECT, UPDATE` on
`trades`, `SELECT, INSERT, DELETE` on `news_events` and `SELECT, INSERT,
UPDATE` on `news_fetch_log`). Connection details can also be changed at
runtime on the **Settings** page (*Test connection*, then *Save*).

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
| `HX_API_KEY` | *(empty)* — legacy global import key (uploads go to the main admin) |
| `DASHBOARD_USER` | `admin` — main admin login |
| `DASHBOARD_PASSWORD` | `admin` — main admin password |
| `SESSION_SECRET` | *(derived from the admin login)* — signs session cookies; set a long random value |
| `APP_URL` | *(empty)* — public base URL, needed for Google sign-in |
| `BREVO_API_KEY` / `MAIL_FROM_EMAIL` / `MAIL_FROM_NAME` | *(empty)* — Brevo transactional email for confirmation codes |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | *(empty)* — enables "Continue with Google" |
| `DATA_DIR` | `/app/data` (where settings.json lives) |
| `NEWS_FEED_URL` | `https://nfs.faireconomy.media/ff_calendar_thisweek.json` — ForexFactory feed `/api/news` fetches from |

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
| `sql/dashboard.sql` | Dashboard additions: `strategies` table, `trades.strategy_id` FK, `mistakes` table, `trades.entry_correct`/`exit_correct`/`mistake_id` review columns, `news_events`/`news_fetch_log` tables, `users` table and per-user `user_id` columns, indexes. Idempotent — safe to re-run on an existing database |

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

Every page and API route requires a signed-in user (session cookie signed
with `SESSION_SECRET`, verified by `src/middleware.ts`; every API route
then scopes its queries to that user and rejects disabled accounts) or a
valid `X-Api-Key`. Change the default `admin`/`admin` before exposing the
dashboard. The indicator endpoints (`POST /api/import`,
`POST /api/backtests/import`, `GET /api/news`) authenticate with
`X-Api-Key`; uploads without a valid key are rejected, while `/api/news`
stays open as long as no global import key is set. Passwords are stored as scrypt hashes and confirmation codes as
SHA-256 hashes. Login forms send credentials in cleartext, so put the
dashboard behind HTTPS (reverse proxy) when it is reachable from the
internet. The Settings page writes DB credentials to the server-side data
volume only.
