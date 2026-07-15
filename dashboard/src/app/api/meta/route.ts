import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const symbols = await query<{ symbol: string }>(
      "SELECT symbol FROM (SELECT DISTINCT symbol FROM trades UNION SELECT DISTINCT symbol FROM backtests) x ORDER BY symbol"
    );
    let accounts: { account: number }[] = [];
    try {
      accounts = await query<{ account: number }>(
        `SELECT DISTINCT t.account
         FROM trades t
         LEFT JOIN account_visibility v ON v.account = t.account
         WHERE COALESCE(v.visible, 1) = 1
         ORDER BY t.account`
      );
    } catch {
      // account_visibility table not created yet - fall back to unfiltered accounts
      accounts = await query<{ account: number }>("SELECT DISTINCT account FROM trades ORDER BY account");
    }
    let strategies: any[] = [];
    try {
      strategies = await query("SELECT id, name, color FROM strategies ORDER BY name");
    } catch {
      // strategies table not created yet - dashboard still works read-only
    }
    let mistakes: any[] = [];
    try {
      mistakes = await query("SELECT id, name FROM mistakes ORDER BY name");
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
    return NextResponse.json({ error: e?.message || "query failed" }, { status: 500 });
  }
}
