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
