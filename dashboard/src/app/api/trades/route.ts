import { NextRequest, NextResponse } from "next/server";
import { fetchTrades } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const includeOpen = params.get("includeOpen") === "1";
    const trades = await fetchTrades(params, !includeOpen);
    // Newest first for the table
    return NextResponse.json({ trades: trades.slice().reverse() });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "query failed" }, { status: 500 });
  }
}
