import { NextRequest, NextResponse } from "next/server";
import { BACKTEST_DUPLICATE, query } from "@/lib/db";
import { errorResponse, HttpError, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const MT_TIME = "'%Y.%m.%d %H:%i:%s'"; // what MQL5 StringToTime() parses

/**
 * Backtest trades of one strategy + symbol for the MT5 indicator to redraw
 * on a chart (Test tab "Load"). Each trade appears once even if several
 * batches uploaded it. Trades uploaded by indicator builds that did not
 * send fibo anchors can't be drawn and are only counted in `skipped`.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const strategyId = Number(req.nextUrl.searchParams.get("strategyId"));
    const symbol = String(req.nextUrl.searchParams.get("symbol") || "").trim();
    if (!Number.isInteger(strategyId) || strategyId <= 0 || !symbol)
      throw new HttpError(400, "expected strategyId and symbol");

    const rows = await query<any>(`
      SELECT d.type, d.result,
             DATE_FORMAT(d.trade_time, ${MT_TIME}) AS trade_time,
             DATE_FORMAT(d.time1, ${MT_TIME}) AS time1, d.price1,
             DATE_FORMAT(d.time2, ${MT_TIME}) AS time2, d.price2
      FROM backtests b JOIN backtest_data d ON d.backtest_id = b.id
      WHERE b.user_id = ? AND b.strategy_id = ? AND b.symbol = ?
        AND NOT ${BACKTEST_DUPLICATE}
      ORDER BY d.trade_time, d.id`, [user.id, strategyId, symbol]);

    const drawable = rows.filter((r) => r.time1 && r.time2 && r.price1 !== null && r.price2 !== null);
    return NextResponse.json({
      trades: drawable.map((r) => ({ ...r, price1: Number(r.price1), price2: Number(r.price2) })),
      skipped: rows.length - drawable.length,
    });
  } catch (e: any) {
    return errorResponse(e, "query failed");
  }
}
