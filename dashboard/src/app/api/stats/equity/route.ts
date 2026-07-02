import { NextRequest, NextResponse } from "next/server";
import { fetchTrades } from "@/lib/db";
import { computeEquity } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const trades = await fetchTrades(req.nextUrl.searchParams, true);
    return NextResponse.json({ points: computeEquity(trades) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "query failed" }, { status: 500 });
  }
}
