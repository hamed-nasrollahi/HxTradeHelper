import type mysql from "mysql2/promise";

/**
 * Multi-user schema upgrade, applied automatically the first time the
 * dashboard talks to a database (and mirrored in sql/dashboard.sql for
 * manual use). Every statement is idempotent and none of them deletes or
 * rewrites data: existing rows only get `user_id = 1`, i.e. they stay with
 * the admin who owned the single-user dashboard.
 */

const OWNED_TABLES = ["trades", "strategies", "mistakes", "backtests", "account_visibility"];

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    email             VARCHAR(255) DEFAULT NULL,
    username          VARCHAR(64)  DEFAULT NULL,
    name              VARCHAR(128) DEFAULT NULL,
    password_hash     VARCHAR(255) DEFAULT NULL,
    google_sub        VARCHAR(64)  DEFAULT NULL,
    email_verified    TINYINT(1)   NOT NULL DEFAULT 0,
    is_admin          TINYINT(1)   NOT NULL DEFAULT 0,
    disabled          TINYINT(1)   NOT NULL DEFAULT 0,
    api_key           VARCHAR(64)  DEFAULT NULL,
    verify_code_hash  VARCHAR(64)  DEFAULT NULL,
    verify_expires_at DATETIME     DEFAULT NULL,
    verify_attempts   INT          NOT NULL DEFAULT 0,
    verify_sent_at    DATETIME     DEFAULT NULL,
    last_login_at     DATETIME     DEFAULT NULL,
    created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_username (username),
    UNIQUE KEY uq_users_google (google_sub),
    UNIQUE KEY uq_users_api_key (api_key)
  ) ENGINE = InnoDB`,
  // User #1 is the .env admin (DASHBOARD_USER / DASHBOARD_PASSWORD)
  `INSERT IGNORE INTO users (id, username, name, email_verified, is_admin) VALUES (1, 'admin', 'Admin', 1, 1)`,
  ...OWNED_TABLES.flatMap((t) => [
    `ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS user_id INT DEFAULT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_${t}_user ON ${t} (user_id)`,
    `UPDATE ${t} SET user_id = 1 WHERE user_id IS NULL`,
  ]),
  // Strategy / mistake names are unique per user instead of globally
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_strategy_user_name ON strategies (user_id, name)`,
  `DROP INDEX IF EXISTS uq_strategy_name ON strategies`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_mistake_user_name ON mistakes (user_id, name)`,
  `DROP INDEX IF EXISTS uq_mistake_name ON mistakes`,
  // Fibo anchor points of a backtest trade, so the indicator can redraw it
  `ALTER TABLE backtest_data ADD COLUMN IF NOT EXISTS time1 DATETIME DEFAULT NULL`,
  `ALTER TABLE backtest_data ADD COLUMN IF NOT EXISTS price1 DOUBLE DEFAULT NULL`,
  `ALTER TABLE backtest_data ADD COLUMN IF NOT EXISTS time2 DATETIME DEFAULT NULL`,
  `ALTER TABLE backtest_data ADD COLUMN IF NOT EXISTS price2 DOUBLE DEFAULT NULL`,
  // Free-text notes, attachable (many-to-many) to trades and backtest trades
  `CREATE TABLE IF NOT EXISTS notes (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT       NOT NULL,
    text       TEXT      NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_notes_user (user_id)
  ) ENGINE = InnoDB`,
  `CREATE TABLE IF NOT EXISTS trade_notes (
    trade_id BIGINT NOT NULL,
    note_id  INT    NOT NULL,
    PRIMARY KEY (trade_id, note_id),
    KEY idx_trade_notes_note (note_id),
    CONSTRAINT fk_trade_notes_trade FOREIGN KEY (trade_id) REFERENCES trades (id) ON DELETE CASCADE,
    CONSTRAINT fk_trade_notes_note FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE
  ) ENGINE = InnoDB`,
  `CREATE TABLE IF NOT EXISTS backtest_data_notes (
    backtest_data_id BIGINT NOT NULL,
    note_id          INT    NOT NULL,
    PRIMARY KEY (backtest_data_id, note_id),
    KEY idx_backtest_data_notes_note (note_id),
    CONSTRAINT fk_backtest_data_notes_data FOREIGN KEY (backtest_data_id) REFERENCES backtest_data (id) ON DELETE CASCADE,
    CONSTRAINT fk_backtest_data_notes_note FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE
  ) ENGINE = InnoDB`,
];

let pending: Promise<void> | null = null;
let doneFor = "";

async function run(pool: mysql.Pool): Promise<void> {
  for (const sql of STATEMENTS) {
    try {
      await pool.query(sql);
    } catch (e: any) {
      // Optional tables (strategies, mistakes, ...) may not exist yet on a
      // database that never had sql/dashboard.sql applied - skip those.
      if (e?.code === "ER_NO_SUCH_TABLE") continue;
      throw e;
    }
  }
}

/** Runs the upgrade once per pool; retried on the next request if it failed. */
export function ensureSchema(pool: mysql.Pool, poolKey: string): Promise<void> {
  if (doneFor === poolKey) return Promise.resolve();
  if (!pending) {
    pending = run(pool)
      .then(() => {
        doneFor = poolKey;
      })
      .catch((e) => {
        console.error(
          `[migrate] multi-user schema upgrade failed (${e?.message}). ` +
            "Apply dashboard/sql/dashboard.sql manually with a user that has ALTER/CREATE rights."
        );
        throw new Error(`Database schema upgrade failed: ${e?.message}. Apply sql/dashboard.sql manually.`);
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}
