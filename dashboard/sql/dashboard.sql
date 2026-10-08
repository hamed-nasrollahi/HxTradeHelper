-- HxTradeHelper dashboard - schema additions on top of the base hx_trades
-- database (created by dotnet/schema.sql). Idempotent: safe to re-run.
--   mysql -u root -p hx_trades < dashboard.sql

CREATE TABLE IF NOT EXISTS strategies (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(64)  NOT NULL,
    description TEXT         DEFAULT NULL,
    color       VARCHAR(16)  NOT NULL DEFAULT '#2a78d6',
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_strategy_name (name)
) ENGINE = InnoDB;

ALTER TABLE trades ADD COLUMN IF NOT EXISTS strategy_id INT DEFAULT NULL;

-- Deleting a strategy unassigns its trades instead of deleting them
ALTER TABLE trades
    ADD CONSTRAINT fk_trades_strategy
    FOREIGN KEY IF NOT EXISTS (strategy_id) REFERENCES strategies (id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades (strategy_id);
CREATE INDEX IF NOT EXISTS idx_trades_close_time ON trades (close_time);

CREATE TABLE IF NOT EXISTS backtests (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    batch_id VARCHAR(80) NOT NULL,
    account BIGINT NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    strategy_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_backtest_batch (batch_id, account),
    KEY idx_backtest_symbol (symbol),
    CONSTRAINT fk_backtests_strategy FOREIGN KEY (strategy_id)
      REFERENCES strategies (id) ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS backtest_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    backtest_id BIGINT NOT NULL,
    trade_number INT NOT NULL,
    type VARCHAR(8) NOT NULL,
    result VARCHAR(16) NOT NULL,
    duration_min INT NOT NULL DEFAULT 0,
    trade_time DATETIME NOT NULL,
    UNIQUE KEY uq_backtest_trade (backtest_id, trade_number),
    KEY idx_backtest_data_time (trade_time),
    CONSTRAINT fk_backtest_data_backtest FOREIGN KEY (backtest_id)
      REFERENCES backtests (id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- Fibo anchor points, so the indicator can redraw a strategy's backtest trades
ALTER TABLE backtest_data ADD COLUMN IF NOT EXISTS time1 DATETIME DEFAULT NULL;
ALTER TABLE backtest_data ADD COLUMN IF NOT EXISTS price1 DOUBLE DEFAULT NULL;
ALTER TABLE backtest_data ADD COLUMN IF NOT EXISTS time2 DATETIME DEFAULT NULL;
ALTER TABLE backtest_data ADD COLUMN IF NOT EXISTS price2 DOUBLE DEFAULT NULL;

-- db-init.sql may have created these tables before strategies existed.
-- Add the dashboard relationship separately so existing compose databases
-- receive it as well.
CREATE INDEX IF NOT EXISTS idx_backtests_strategy ON backtests (strategy_id);
ALTER TABLE backtests
    ADD CONSTRAINT fk_backtests_strategy
    FOREIGN KEY IF NOT EXISTS (strategy_id) REFERENCES strategies (id)
    ON DELETE SET NULL;

-- GRANT SELECT, INSERT, UPDATE, DELETE ON hx_trades.backtests TO 'hx'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON hx_trades.backtest_data TO 'hx'@'localhost';

-- If the dashboard connects with the 'hx' application user created by
-- dotnet/schema.sql, give it access to the new table and column. Adjust
-- the host part ('localhost' / '%') to where the dashboard connects from.
-- GRANT SELECT, INSERT, UPDATE, DELETE ON hx_trades.strategies TO 'hx'@'localhost';
-- GRANT SELECT, INSERT, UPDATE ON hx_trades.trades TO 'hx'@'localhost';
-- FLUSH PRIVILEGES;

-- Cached ForexFactory calendar (orange/red events only), served by
-- GET /api/news and refreshed at most once an hour. event_time is GMT/UTC,
-- matching the pool's `timezone: 'Z'` setting in src/lib/db.ts.
CREATE TABLE IF NOT EXISTS news_events (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_time  DATETIME     NOT NULL,
    currency    VARCHAR(8)   NOT NULL,
    title       VARCHAR(255) NOT NULL,
    impact      VARCHAR(8)   NOT NULL,   -- High / Medium
    KEY idx_news_currency (currency),
    KEY idx_news_time (event_time)
) ENGINE = InnoDB;

-- Singleton row (id = 1): when news_events was last refreshed from
-- ForexFactory. A row older than an hour (or missing) triggers a refetch.
CREATE TABLE IF NOT EXISTS news_fetch_log (
    id          TINYINT      PRIMARY KEY,
    fetched_at  DATETIME     NOT NULL
) ENGINE = InnoDB;

-- GRANT SELECT, INSERT, DELETE ON hx_trades.news_events TO 'hx'@'localhost';
-- GRANT SELECT, INSERT, UPDATE ON hx_trades.news_fetch_log TO 'hx'@'localhost';
-- FLUSH PRIVILEGES;

-- Trade review: was the entry/exit correct, and if not, which recurring
-- mistake caused it. entry_correct/exit_correct default to 1 (assumed fine)
-- until reviewed on the Trades page.
CREATE TABLE IF NOT EXISTS mistakes (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(64)  NOT NULL,
    description TEXT         DEFAULT NULL,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_mistake_name (name)
) ENGINE = InnoDB;

ALTER TABLE trades ADD COLUMN IF NOT EXISTS entry_correct TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS exit_correct TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS mistake_id INT DEFAULT NULL;

-- Deleting a mistake unassigns any trades tagged with it instead of deleting them
ALTER TABLE trades
    ADD CONSTRAINT fk_trades_mistake
    FOREIGN KEY IF NOT EXISTS (mistake_id) REFERENCES mistakes (id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trades_mistake ON trades (mistake_id);

-- GRANT SELECT, INSERT, UPDATE, DELETE ON hx_trades.mistakes TO 'hx'@'localhost';
-- FLUSH PRIVILEGES;

-- Per-account visibility: accounts are discovered live from trades.account,
-- this table just remembers which ones are hidden from the dropdowns.
-- Missing row = visible (default), so nothing needs backfilling.
CREATE TABLE IF NOT EXISTS account_visibility (
    account BIGINT     NOT NULL PRIMARY KEY,
    visible TINYINT(1) NOT NULL DEFAULT 1
) ENGINE = InnoDB;

-- GRANT SELECT, INSERT, UPDATE ON hx_trades.account_visibility TO 'hx'@'localhost';
-- FLUSH PRIVILEGES;

-- Multi-user accounts. The dashboard applies this block automatically on
-- first start (src/lib/migrate.ts) when its DB user may ALTER/CREATE;
-- otherwise run this file manually. Nothing here deletes data: existing
-- rows get user_id = 1, the admin who signs in with DASHBOARD_USER /
-- DASHBOARD_PASSWORD from .env.
CREATE TABLE IF NOT EXISTS users (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    email             VARCHAR(255) DEFAULT NULL,
    username          VARCHAR(64)  DEFAULT NULL,
    name              VARCHAR(128) DEFAULT NULL,
    password_hash     VARCHAR(255) DEFAULT NULL,   -- scrypt; NULL for Google-only / .env admin
    google_sub        VARCHAR(64)  DEFAULT NULL,   -- Google account id
    email_verified    TINYINT(1)   NOT NULL DEFAULT 0,
    is_admin          TINYINT(1)   NOT NULL DEFAULT 0,
    disabled          TINYINT(1)   NOT NULL DEFAULT 0,
    api_key           VARCHAR(64)  DEFAULT NULL,   -- personal X-Api-Key for the MT5 indicator
    verify_code_hash  VARCHAR(64)  DEFAULT NULL,   -- pending email confirmation code (hashed)
    verify_expires_at DATETIME     DEFAULT NULL,
    verify_attempts   INT          NOT NULL DEFAULT 0,
    verify_sent_at    DATETIME     DEFAULT NULL,
    last_login_at     DATETIME     DEFAULT NULL,
    created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_username (username),
    UNIQUE KEY uq_users_google (google_sub),
    UNIQUE KEY uq_users_api_key (api_key)
) ENGINE = InnoDB;

INSERT IGNORE INTO users (id, username, name, email_verified, is_admin) VALUES (1, 'admin', 'Admin', 1, 1);

ALTER TABLE trades ADD COLUMN IF NOT EXISTS user_id INT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_trades_user ON trades (user_id);
UPDATE trades SET user_id = 1 WHERE user_id IS NULL;

ALTER TABLE strategies ADD COLUMN IF NOT EXISTS user_id INT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_strategies_user ON strategies (user_id);
UPDATE strategies SET user_id = 1 WHERE user_id IS NULL;

ALTER TABLE mistakes ADD COLUMN IF NOT EXISTS user_id INT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_mistakes_user ON mistakes (user_id);
UPDATE mistakes SET user_id = 1 WHERE user_id IS NULL;

ALTER TABLE backtests ADD COLUMN IF NOT EXISTS user_id INT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_backtests_user ON backtests (user_id);
UPDATE backtests SET user_id = 1 WHERE user_id IS NULL;

ALTER TABLE account_visibility ADD COLUMN IF NOT EXISTS user_id INT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_account_visibility_user ON account_visibility (user_id);
UPDATE account_visibility SET user_id = 1 WHERE user_id IS NULL;

-- Strategy / mistake names are unique per user instead of globally
CREATE UNIQUE INDEX IF NOT EXISTS uq_strategy_user_name ON strategies (user_id, name);
DROP INDEX IF EXISTS uq_strategy_name ON strategies;
CREATE UNIQUE INDEX IF NOT EXISTS uq_mistake_user_name ON mistakes (user_id, name);
DROP INDEX IF EXISTS uq_mistake_name ON mistakes;

-- GRANT SELECT, INSERT, UPDATE ON hx_trades.users TO 'hx'@'localhost';
-- FLUSH PRIVILEGES;

-- Notes: free-text remarks, each attachable to any number of trades and
-- backtest trades (and vice versa). Deleting a note detaches it everywhere;
-- deleting a trade / backtest trade drops its links.
CREATE TABLE IF NOT EXISTS notes (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT       NOT NULL,
    text       TEXT      NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_notes_user (user_id)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS trade_notes (
    trade_id BIGINT NOT NULL,
    note_id  INT    NOT NULL,
    PRIMARY KEY (trade_id, note_id),
    KEY idx_trade_notes_note (note_id),
    CONSTRAINT fk_trade_notes_trade FOREIGN KEY (trade_id) REFERENCES trades (id) ON DELETE CASCADE,
    CONSTRAINT fk_trade_notes_note FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS backtest_data_notes (
    backtest_data_id BIGINT NOT NULL,
    note_id          INT    NOT NULL,
    PRIMARY KEY (backtest_data_id, note_id),
    KEY idx_backtest_data_notes_note (note_id),
    CONSTRAINT fk_backtest_data_notes_data FOREIGN KEY (backtest_data_id) REFERENCES backtest_data (id) ON DELETE CASCADE,
    CONSTRAINT fk_backtest_data_notes_note FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- GRANT SELECT, INSERT, UPDATE, DELETE ON hx_trades.notes TO 'hx'@'localhost';
-- GRANT SELECT, INSERT, DELETE ON hx_trades.trade_notes TO 'hx'@'localhost';
-- GRANT SELECT, INSERT, DELETE ON hx_trades.backtest_data_notes TO 'hx'@'localhost';
-- FLUSH PRIVILEGES;
