import { NextRequest, NextResponse } from "next/server";
import { fetchBacktests } from "@/lib/db";
import { computeBreakdown, computeEquity, computeSummary } from "@/lib/stats";
import { GroupDimension } from "@/lib/types";

const DIMS: GroupDimension[] = ["strategy", "symbol", "month", "week", "weekday", "hour", "direction"];
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const trades = await fetchBacktests(req.nextUrl.searchParams);
    const dim = (req.nextUrl.searchParams.get("groupBy") || "strategy") as GroupDimension;
    if (!DIMS.includes(dim)) return NextResponse.json({ error: "invalid groupBy" }, { status: 400 });
    return NextResponse.json({ summary: computeSummary(trades), points: computeEquity(trades), groups: computeBreakdown(trades, dim) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "query failed" }, { status: 500 });
  }
}
