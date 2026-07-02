# HxTradeHelper Trade API

Small companion service that stores the journal exports produced by the
**Journal** button in MariaDB.

## Setup

1. Create the database, table and application user (the script lives next
   to the .NET uploader):

   ```
   mysql -u root -p < ../dotnet/schema.sql
   ```

2. Install dependencies (Python 3.9+):

   ```
   pip install -r requirements.txt
   ```

3. Configure the connection through environment variables and start the API:

   | Variable         | Default     | Meaning                       |
   |------------------|-------------|-------------------------------|
   | `HX_DB_HOST`     | `127.0.0.1` | MariaDB host                  |
   | `HX_DB_PORT`     | `3306`      | MariaDB port                  |
   | `HX_DB_USER`     | `hx`        | MariaDB user                  |
   | `HX_DB_PASSWORD` | *(empty)*   | MariaDB password              |
   | `HX_DB_NAME`     | `hx_trades` | Database name                 |
   | `HX_API_KEY`     | *(empty)*   | If set, requests must send it in the `X-Api-Key` header |

   ```
   uvicorn app:app --host 0.0.0.0 --port 8000
   ```

## Getting trades into the database

The Journal button writes two machine-readable exports per day under
`MQL5\Files\TradesHistory\<date>\` (`trades_<date>.csv` and
`trades_<date>.json`) and then POSTs the JSON payload to this API through
the .NET `HxTradeUploader.dll` (inputs `ApiUrl`, `ApiKey`, `UploadToApi`).
See `dotnet/README.md` for building and installing the DLL.

Trades are upserted by `(account, position_id)`, so re-exporting the same
day is safe: open trades are updated once they close. If an upload fails,
the JSON file remains on disk and is re-sent simply by clicking Journal
again.
