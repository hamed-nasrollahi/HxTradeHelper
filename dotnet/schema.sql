-- HxTradeHelper trade journal - MariaDB setup
-- Run as root:  mysql -u root -p < schema.sql
-- Creates the database, the trades table and the application user the
-- trade API connects with (change the password before running!).

CREATE DATABASE IF NOT EXISTS hx_trades CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

USE hx_trades;

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
    UNIQUE KEY uq_backtest_batch (batch_id, account)
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
    CONSTRAINT fk_backtest_data_backtest FOREIGN KEY (backtest_id)
      REFERENCES backtests (id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- Application user for the dashboard (matches the HX_DB_USER / HX_DB_PASSWORD
-- defaults in dashboard/README.md). CHANGE THE PASSWORD.
CREATE USER IF NOT EXISTS 'hx'@'localhost' IDENTIFIED BY 'change-me';
GRANT SELECT, INSERT, UPDATE ON hx_trades.trades TO 'hx'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON hx_trades.backtests TO 'hx'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON hx_trades.backtest_data TO 'hx'@'localhost';
FLUSH PRIVILEGES;
