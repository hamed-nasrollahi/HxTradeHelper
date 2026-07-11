import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function mtTime(value: unknown): string | null {
  const m = String(value || "").match(/^(\d{4})\.(\d{2})\.(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6] || "00"}` : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const batchId = String(body?.batch_id || "").trim();
    const account = Number(body?.account);
    const symbol = String(body?.symbol || "").trim();
    const trades = Array.isArray(body?.trades) ? body.trades : null;
    if (!batchId || !Number.isFinite(account) || !symbol || !trades)
      return NextResponse.json({ error: "expected { batch_id, account, symbol, trades[] }" }, { status: 400 });

    // Store the uploaded run once. Do not touch strategy_id on re-upload,
    // because that assignment belongs to the dashboard user.
    await query(`INSERT INTO backtests (batch_id, account, symbol) VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE symbol = VALUES(symbol)`, [batchId, account, symbol]);
    const headers = await query<{ id: number }>(
      "SELECT id FROM backtests WHERE batch_id = ? AND account = ?", [batchId, account]);
    const backtestId = Number(headers[0]?.id);
    if (!Number.isFinite(backtestId)) throw new Error("could not create backtest header");

    let saved = 0;
    for (const t of trades) {
      const tradeTime = mtTime(t.trade_time);
      const tradeNumber = Number(t.trade_number);
      if (!tradeTime || !Number.isInteger(tradeNumber)) continue;
      await query(`INSERT INTO backtest_data
        (backtest_id, trade_number, type, result, duration_min, trade_time)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE type=VALUES(type), result=VALUES(result),
          duration_min=VALUES(duration_min), trade_time=VALUES(trade_time)`,
        [backtestId, tradeNumber, String(t.type || ""),
         String(t.result || ""), Number(t.duration_min) || 0, tradeTime]);
      saved++;
    }
    return NextResponse.json({ saved, batchId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "backtest import failed" }, { status: 500 });
  }
}
