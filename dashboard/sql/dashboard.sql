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
    ADD CONSTRAINT IF NOT EXISTS fk_trades_strategy
    FOREIGN KEY (strategy_id) REFERENCES strategies (id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades (strategy_id);
CREATE INDEX IF NOT EXISTS idx_trades_close_time ON trades (close_time);

-- If the dashboard connects with the 'hx' application user created by
-- dotnet/schema.sql, give it access to the new table and column. Adjust
-- the host part ('localhost' / '%') to where the dashboard connects from.
-- GRANT SELECT, INSERT, UPDATE, DELETE ON hx_trades.strategies TO 'hx'@'localhost';
-- GRANT SELECT, INSERT, UPDATE ON hx_trades.trades TO 'hx'@'localhost';
-- FLUSH PRIVILEGES;
