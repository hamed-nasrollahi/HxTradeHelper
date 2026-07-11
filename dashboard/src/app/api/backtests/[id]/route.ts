import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const strategyId = body.strategyId === null || body.strategyId === "" ? null : Number(body.strategyId);
    // Strategy belongs to the backtest header; all child data inherits it.
    // Symbol is supplied by MT5 and is intentionally immutable.
    await query("UPDATE backtests SET strategy_id = ? WHERE id = ?",
      [strategyId, Number(params.id)]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "update failed" }, { status: 500 });
  }
}
