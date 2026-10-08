import mysql from "mysql2/promise";
import { DbSettings, loadSettings } from "./settings";
import { BacktestBatch, BacktestRecord, TradeRecord } from "./types";
import { ensureSchema } from "./migrate";

let pool: mysql.Pool | null = null;
let poolKey = "";

export async function getPool(): Promise<mysql.Pool> {
  const s = loadSettings();
  const key = JSON.stringify(s);
  if (!pool || key !== poolKey) {
    if (pool) await pool.end().catch(() => {});
    pool = mysql.createPool({
      host: s.host,
      port: s.port,
      user: s.user,
      password: s.password,
      database: s.database,
      connectionLimit: 5,
      dateStrings: true,
      timezone: "Z", // store/read DATETIME columns as UTC, matching the indicator's TimeGMT()
    });
    poolKey = key;
  }
  return pool;
}

export async function query<T = any>(sql: string, args: any[] = []): Promise<T[]> {
  const p = await getPool();
  await ensureSchema(p, poolKey);
  const [rows] = await p.query(sql, args);
  return rows as T[];
}

export async function testConnection(s: DbSettings): Promise<{ ok: boolean; message: string }> {
  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection({
      host: s.host,
      port: s.port,
      user: s.user,
      password: s.password,
      database: s.database,
      connectTimeout: 5000,
    });
    const [trades] = await conn.query("SELECT COUNT(*) AS n FROM trades");
    const n = (trades as any[])[0]?.n ?? 0;
    let strategiesOk = true;
    try {
      await conn.query("SELECT COUNT(*) FROM strategies");
    } catch {
      strategiesOk = false;
    }
    return {
      ok: true,
      message: `Connected. ${n} trade(s) found.${strategiesOk ? "" : " Warning: strategies table missing - apply sql/dashboard.sql."}`,
    };
  } catch (e: any) {
    return { ok: false, message: e?.message || "Connection failed" };
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}

interface WhereClause {
  where: string;
  args: any[];
}

export function buildTradeWhere(params: URLSearchParams, closedOnly: boolean, userId: number): WhereClause {
  const clauses: string[] = [
    "t.user_id = ?",
    "t.account NOT IN (SELECT account FROM account_visibility WHERE visible = 0 AND user_id = ?)",
  ];
  const args: any[] = [userId, userId];
  if (closedOnly) {
    clauses.push("t.is_open = 0", "t.close_time IS NOT NULL");
  }
  const from = params.get("from");
  if (from) {
    clauses.push("COALESCE(t.close_time, t.open_time) >= ?");
    args.push(`${from} 00:00:00`);
  }
  const to = params.get("to");
  if (to) {
    clauses.push("COALESCE(t.close_time, t.open_time) <= ?");
    args.push(`${to} 23:59:59`);
  }
  const account = params.get("account");
  if (account) {
    clauses.push("t.account = ?");
    args.push(Number(account));
  }
  const symbol = params.get("symbol");
  if (symbol) {
    clauses.push("t.symbol = ?");
    args.push(symbol);
  }
  const strategyId = params.get("strategyId");
  if (strategyId === "none") {
    clauses.push("t.strategy_id IS NULL");
  } else if (strategyId) {
    clauses.push("t.strategy_id = ?");
    args.push(Number(strategyId));
  }
  const direction = params.get("direction");
  if (direction) {
    clauses.push("t.type = ?");
    args.push(direction);
  }
  if (params.get("excludeMistakes") === "1") {
    clauses.push("t.entry_correct = 1", "t.exit_correct = 1");
  }
  const notes = noteClause(params, "t.id", "trade_notes", "trade_id");
  if (notes) {
    clauses.push(notes.sql);
    args.push(...notes.args);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", args };
}

/** Parses `noteIds=1,2,3` into distinct positive ids. */
export function parseNoteIds(raw: string | null): number[] {
  return Array.from(
    new Set((raw || "").split(",").map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))
  );
}

/**
 * `noteIds` filter: rows linked to any of the notes, or to every one of them
 * with `noteMatch=all`. `linkTable.linkColumn` references `idColumn`.
 */
function noteClause(
  params: URLSearchParams,
  idColumn: string,
  linkTable: "trade_notes" | "backtest_data_notes",
  linkColumn: string
): { sql: string; args: any[] } | null {
  const ids = parseNoteIds(params.get("noteIds"));
  if (!ids.length) return null;
  if (params.get("noteMatch") === "all") {
    return {
      sql: `(SELECT COUNT(*) FROM ${linkTable} n WHERE n.${linkColumn} = ${idColumn} AND n.note_id IN (?)) = ?`,
      args: [ids, ids.length],
    };
  }
  return { sql: `EXISTS (SELECT 1 FROM ${linkTable} n WHERE n.${linkColumn} = ${idColumn} AND n.note_id IN (?))`, args: [ids] };
}

/** GROUP_CONCAT'ed note ids ("3,7" / null) -> [3, 7] */
function withNoteIds<T extends { note_ids: unknown }>(rows: T[]): T[] {
  for (const r of rows) {
    r.note_ids = r.note_ids ? String(r.note_ids).split(",").map(Number) : [];
  }
  return rows;
}

const TRADE_SELECT = `
SELECT t.id, t.account, t.position_id, t.symbol, t.type, t.result, t.rr,
       t.entry_price, t.stop_loss, t.take_profit, t.close_price, t.profit,
       t.open_time, t.close_time, t.is_open, t.strategy_id,
       s.name AS strategy_name, s.color AS strategy_color,
       t.entry_correct, t.exit_correct, t.mistake_id, m.name AS mistake_name,
       (SELECT GROUP_CONCAT(tn.note_id ORDER BY tn.note_id) FROM trade_notes tn WHERE tn.trade_id = t.id) AS note_ids
FROM trades t
LEFT JOIN strategies s ON s.id = t.strategy_id
LEFT JOIN mistakes m ON m.id = t.mistake_id`;

export async function fetchTrades(params: URLSearchParams, closedOnly: boolean, userId: number): Promise<TradeRecord[]> {
  const { where, args } = buildTradeWhere(params, closedOnly, userId);
  return withNoteIds(
    await query<TradeRecord>(`${TRADE_SELECT} ${where} ORDER BY COALESCE(t.close_time, t.open_time), t.id`, args)
  );
}

// True when the same trade (time, direction, result, duration) was already
// uploaded in an earlier batch of the same strategy + symbol. Trade numbers
// restart with every run, so they are not part of the match.
export const BACKTEST_DUPLICATE = `EXISTS (
  SELECT 1 FROM backtest_data d2 JOIN backtests b2 ON b2.id = d2.backtest_id
  WHERE b2.user_id = b.user_id AND b2.symbol = b.symbol
    AND b2.strategy_id <=> b.strategy_id
    AND d2.trade_time = d.trade_time AND d2.type = d.type
    AND d2.result = d.result AND d2.duration_min = d.duration_min
    AND d2.id < d.id)`;

export async function fetchBacktests(params: URLSearchParams, userId: number): Promise<BacktestRecord[]> {
  const clauses: string[] = [
    "b.user_id = ?",
    "b.account NOT IN (SELECT account FROM account_visibility WHERE visible = 0 AND user_id = ?)",
  ];
  const args: any[] = [userId, userId];
  const add = (sql: string, value: any) => { clauses.push(sql); args.push(value); };
  // A single batch is shown whole; combined views count each trade once.
  if (params.get("backtestId")) add("b.id = ?", Number(params.get("backtestId")));
  else clauses.push(`NOT ${BACKTEST_DUPLICATE}`);
  if (params.get("from")) add("d.trade_time >= ?", `${params.get("from")} 00:00:00`);
  if (params.get("to")) add("d.trade_time <= ?", `${params.get("to")} 23:59:59`);
  if (params.get("symbol")) add("b.symbol = ?", params.get("symbol"));
  if (params.get("direction")) add("d.type = ?", params.get("direction"));
  const strategyId = params.get("strategyId");
  if (strategyId === "none") clauses.push("b.strategy_id IS NULL");
  else if (strategyId) add("b.strategy_id = ?", Number(strategyId));
  const notes = noteClause(params, "d.id", "backtest_data_notes", "backtest_data_id");
  if (notes) {
    clauses.push(notes.sql);
    args.push(...notes.args);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return withNoteIds(await query<BacktestRecord>(`
    SELECT d.id, b.id AS backtest_id, b.batch_id, b.account, d.trade_number, b.symbol, d.type,
           d.result, d.duration_min, d.trade_time AS open_time,
           d.trade_time AS close_time, 0 AS position_id, NULL AS rr,
           0 AS entry_price, NULL AS stop_loss, NULL AS take_profit,
           NULL AS close_price,
           CASE d.result WHEN 'Win' THEN 1 WHEN 'Lose' THEN -1 ELSE 0 END AS profit,
           0 AS is_open, b.strategy_id, s.name AS strategy_name,
           s.color AS strategy_color,
           (SELECT GROUP_CONCAT(dn.note_id ORDER BY dn.note_id) FROM backtest_data_notes dn
            WHERE dn.backtest_data_id = d.id) AS note_ids
    FROM backtests b JOIN backtest_data d ON d.backtest_id = b.id
    LEFT JOIN strategies s ON s.id = b.strategy_id
    ${where} ORDER BY d.trade_time, d.id`, args));
}

export async function fetchBacktestBatches(userId: number): Promise<BacktestBatch[]> {
  return query<BacktestBatch>(`
    SELECT b.id, b.batch_id, b.account, b.symbol, b.strategy_id,
           b.created_at, s.name AS strategy_name, s.color AS strategy_color,
           COUNT(d.id) AS trade_count,
           COALESCE(SUM(d.is_duplicate), 0) AS duplicate_count
    FROM backtests b
    LEFT JOIN strategies s ON s.id = b.strategy_id
    LEFT JOIN (
      SELECT d.id, d.backtest_id, ${BACKTEST_DUPLICATE} AS is_duplicate
      FROM backtest_data d JOIN backtests b ON b.id = d.backtest_id
      WHERE b.user_id = ?
    ) d ON d.backtest_id = b.id
    WHERE b.user_id = ?
      AND b.account NOT IN (SELECT account FROM account_visibility WHERE visible = 0 AND user_id = ?)
    GROUP BY b.id, b.batch_id, b.account, b.symbol, b.strategy_id,
             b.created_at, s.name, s.color
    ORDER BY b.created_at DESC, b.id DESC`, [userId, userId, userId]);
}

/**
 * An MT5 account belongs to whichever user first uploaded it. Imports for
 * an account another user already owns are refused, so the
 * (account, position_id) / (batch_id, account) upserts can never touch
 * someone else's rows.
 */
export async function accountOwnedByOther(account: number, userId: number): Promise<boolean> {
  const rows = await query(
    `SELECT 1 FROM trades WHERE account = ? AND user_id <> ?
     UNION ALL
     SELECT 1 FROM backtests WHERE account = ? AND user_id <> ?
     LIMIT 1`,
    [account, userId, account, userId]
  );
  return rows.length > 0;
}

/** True when the strategy/mistake id is null or belongs to the user. */
export async function ownsRow(table: "strategies" | "mistakes", id: number | null, userId: number): Promise<boolean> {
  if (id === null) return true;
  const rows = await query(`SELECT 1 FROM ${table} WHERE id = ? AND user_id = ?`, [id, userId]);
  return rows.length > 0;
}

/**
 * Replaces the notes linked to one trade / backtest trade (the caller has
 * checked the row belongs to the user). Returns the new sorted note ids, or
 * null when a note id is not one of the user's.
 */
export async function setLinkedNotes(
  linkTable: "trade_notes" | "backtest_data_notes",
  linkColumn: "trade_id" | "backtest_data_id",
  rowId: number,
  noteIds: number[],
  userId: number
): Promise<number[] | null> {
  const owned = noteIds.length
    ? (await query<{ id: number }>("SELECT id FROM notes WHERE user_id = ? AND id IN (?)", [userId, noteIds])).map(
        (r) => Number(r.id)
      )
    : [];
  if (owned.length !== noteIds.length) return null;
  const p = await getPool();
  await ensureSchema(p, poolKey);
  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`DELETE FROM ${linkTable} WHERE ${linkColumn} = ?`, [rowId]);
    if (owned.length) {
      await conn.query(`INSERT INTO ${linkTable} (${linkColumn}, note_id) VALUES ?`, [owned.map((id) => [rowId, id])]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
  return owned.sort((a, b) => a - b);
}
