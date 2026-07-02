import { NextRequest, NextResponse } from "next/server";
import { fetchTrades } from "@/lib/db";
import { computeSummary } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const trades = await fetchTrades(req.nextUrl.searchParams, true);
    return NextResponse.json({ summary: computeSummary(trades) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "query failed" }, { status: 500 });
  }
}
