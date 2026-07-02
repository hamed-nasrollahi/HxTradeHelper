import { NextRequest, NextResponse } from "next/server";
import { fetchTrades } from "@/lib/db";
import { computeBreakdown } from "@/lib/stats";
import { GroupDimension } from "@/lib/types";

export const dynamic = "force-dynamic";

const DIMENSIONS: GroupDimension[] = [
  "strategy",
  "symbol",
  "month",
  "week",
  "weekday",
  "hour",
  "direction",
];

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const dim = (params.get("groupBy") || "strategy") as GroupDimension;
    if (!DIMENSIONS.includes(dim)) {
      return NextResponse.json({ error: `groupBy must be one of ${DIMENSIONS.join(", ")}` }, { status: 400 });
    }
    const trades = await fetchTrades(params, true);
    return NextResponse.json({ groups: computeBreakdown(trades, dim) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "query failed" }, { status: 500 });
  }
}
