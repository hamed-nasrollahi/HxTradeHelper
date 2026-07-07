import mysql from "mysql2/promise";
import { DbSettings, loadSettings } from "./settings";
import { TradeRecord } from "./types";

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

export function buildTradeWhere(params: URLSearchParams, closedOnly: boolean): WhereClause {
  const clauses: string[] = [];
  const args: any[] = [];
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
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", args };
}

const TRADE_SELECT = `
SELECT t.id, t.account, t.position_id, t.symbol, t.type, t.result, t.rr,
       t.entry_price, t.stop_loss, t.take_profit, t.close_price, t.profit,
       t.open_time, t.close_time, t.is_open, t.strategy_id,
       s.name AS strategy_name, s.color AS strategy_color,
       t.entry_correct, t.exit_correct, t.mistake_id, m.name AS mistake_name
FROM trades t
LEFT JOIN strategies s ON s.id = t.strategy_id
LEFT JOIN mistakes m ON m.id = t.mistake_id`;

export async function fetchTrades(params: URLSearchParams, closedOnly: boolean): Promise<TradeRecord[]> {
  const { where, args } = buildTradeWhere(params, closedOnly);
  return query<TradeRecord>(
    `${TRADE_SELECT} ${where} ORDER BY COALESCE(t.close_time, t.open_time), t.id`,
    args
  );
}
