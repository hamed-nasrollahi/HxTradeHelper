# HxTradeHelper Trade API

Small companion service that stores the journal exports produced by the
**Journal** button in MariaDB.

## Setup

1. Create the database and table:

   ```
   mysql -u root -p < schema.sql
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
`MQL5\Files\TradesHistory\<date>\`: `trades_<date>.csv` and
`trades_<date>.json`.

**Recommended: the uploader script.** MQL5 indicators are not allowed to
call `WebRequest`, so run the uploader after your session (manually or as a
scheduled task):

```
python uploader.py --files "C:\Users\<you>\AppData\Roaming\MetaQuotes\Terminal\<id>\MQL5\Files" --api http://127.0.0.1:8000/api/trades --api-key <key>
```

Each successfully uploaded export is marked with a `.uploaded` file next to
it, so the script only sends new exports. Use `--force` to re-send.

**Direct upload from the terminal.** The chart program also tries to POST
the payload itself (inputs `ApiUrl`, `ApiKey`, `UploadToApi`). This only
works if the program runs as an Expert Advisor, and the endpoint URL must be
whitelisted in *Tools → Options → Expert Advisors → Allow WebRequest for
listed URL*. When the terminal rejects the call, the JSON file is still
written and the uploader picks it up.

Trades are upserted by `(account, position_id)`, so re-exporting the same
day is safe: open trades are updated once they close.
