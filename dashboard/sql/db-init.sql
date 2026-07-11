-- Base trades table for a fresh database. Only needed when the compose
-- stack creates a brand-new MariaDB; an existing hx_trades database
-- already has this from dotnet/schema.sql.
-- (No CREATE DATABASE / CREATE USER here: docker-entrypoint-initdb.d
-- scripts run inside the database created by MARIADB_DATABASE, and the
-- MARIADB_USER env var already owns it.)

CREATE TABLE IF NOT EXISTS trades (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    account      BIGINT       NOT NULL,
    position_id  BIGINT       NOT NULL,
    symbol       VARCHAR(32)  NOT NULL,
    type         VARCHAR(8)   NOT NULL,           -- Buy / Sell
    result       VARCHAR(16)  NOT NULL,           -- Win / Lose / BreakEven / Open
    rr           VARCHAR(16)  DEFAULT NULL,       -- planned R:R, e.g. "1:2.50"
    entry_price  DOUBLE       NOT NULL,
    stop_loss    DOUBLE       DEFAULT NULL,
    take_profit  DOUBLE       DEFAULT NULL,
    close_price  DOUBLE       DEFAULT NULL,
    profit       DOUBLE       NOT NULL,           -- incl. swap and commission
    open_time    DATETIME     NOT NULL,
    close_time   DATETIME     DEFAULT NULL,
    is_open      TINYINT(1)   NOT NULL DEFAULT 0,
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_account_position (account, position_id),
    KEY idx_open_time (open_time),
    KEY idx_symbol (symbol)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS backtests (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    batch_id VARCHAR(80) NOT NULL,
    account BIGINT NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    strategy_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_backtest_batch (batch_id, account),
    KEY idx_backtest_symbol (symbol)
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
