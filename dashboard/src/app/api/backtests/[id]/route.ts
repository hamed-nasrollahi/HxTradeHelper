import { NextRequest, NextResponse } from "next/server";
import { ownsRow, query } from "@/lib/db";
import { errorResponse, HttpError, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(req);
    const body = await req.json();
    const strategyId = body.strategyId === null || body.strategyId === "" ? null : Number(body.strategyId);
    // Strategy belongs to the backtest header; all child data inherits it.
    // Symbol is supplied by MT5 and is intentionally immutable.
    if (!(await ownsRow("strategies", strategyId, user.id))) throw new HttpError(400, "unknown strategy");
    const result: any = await query("UPDATE backtests SET strategy_id = ? WHERE id = ? AND user_id = ?",
      [strategyId, Number(params.id), user.id]);
    if (!result.affectedRows) throw new HttpError(404, "backtest not found");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return errorResponse(e, "update failed");
  }
}
