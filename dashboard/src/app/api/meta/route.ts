import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const symbols = await query<{ symbol: string }>(
      "SELECT symbol FROM (SELECT DISTINCT symbol FROM trades UNION SELECT DISTINCT symbol FROM backtests) x ORDER BY symbol"
    );
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
      strategies,
      mistakes,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "query failed" }, { status: 500 });
  }
}
