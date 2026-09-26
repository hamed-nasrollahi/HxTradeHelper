import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { errorResponse, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const symbols = await query<{ symbol: string }>(
      `SELECT symbol FROM (SELECT DISTINCT symbol FROM trades WHERE user_id = ?
                           UNION SELECT DISTINCT symbol FROM backtests WHERE user_id = ?) x ORDER BY symbol`,
      [user.id, user.id]
    );
    let accounts: { account: number }[] = [];
    try {
      accounts = await query<{ account: number }>(
        `SELECT DISTINCT t.account
         FROM trades t
         LEFT JOIN account_visibility v ON v.account = t.account
         WHERE t.user_id = ? AND COALESCE(v.visible, 1) = 1
         ORDER BY t.account`,
        [user.id]
      );
    } catch {
      // account_visibility table not created yet - fall back to unfiltered accounts
      accounts = await query<{ account: number }>(
        "SELECT DISTINCT account FROM trades WHERE user_id = ? ORDER BY account",
        [user.id]
      );
    }
    let strategies: any[] = [];
    try {
      strategies = await query("SELECT id, name, color FROM strategies WHERE user_id = ? ORDER BY name", [user.id]);
    } catch {
      // strategies table not created yet - dashboard still works read-only
    }
    let mistakes: any[] = [];
    try {
      mistakes = await query("SELECT id, name FROM mistakes WHERE user_id = ? ORDER BY name", [user.id]);
    } catch {
      // mistakes table not created yet - dashboard still works read-only
    }
    return NextResponse.json({
      symbols: symbols.map((r) => r.symbol),
      accounts: accounts.map((r) => r.account),
      strategies,
      mistakes,
    });
  } catch (e: any) {
    return errorResponse(e, "query failed");
  }
}
