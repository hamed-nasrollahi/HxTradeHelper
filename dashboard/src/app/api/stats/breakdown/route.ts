import { NextRequest, NextResponse } from "next/server";
import { fetchTrades } from "@/lib/db";
import { computeBreakdown } from "@/lib/stats";
import { GroupDimension } from "@/lib/types";

export const dynamic = "force-dynamic";

const DIMENSIONS: GroupDimension[] = [
  "strategy",
  "symbol",
  "month",
  "monthOfYear",
  "week",
  "weekday",
  "hour",
  "direction",
  "mistake",
];

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const dim = (params.get("groupBy") || "strategy") as GroupDimension;
    if (!DIMENSIONS.includes(dim)) {
      return NextResponse.json({ error: `groupBy must be one of ${DIMENSIONS.join(", ")}` }, { status: 400 });
    }
    const dim2Raw = params.get("groupBy2");
    let dim2: GroupDimension | undefined;
    if (dim2Raw) {
      if (!DIMENSIONS.includes(dim2Raw as GroupDimension)) {
        return NextResponse.json({ error: `groupBy2 must be one of ${DIMENSIONS.join(", ")}` }, { status: 400 });
      }
      if (dim2Raw === dim) {
        return NextResponse.json({ error: "groupBy2 must differ from groupBy" }, { status: 400 });
      }
      dim2 = dim2Raw as GroupDimension;
    }
    const trades = await fetchTrades(params, true);
    return NextResponse.json({ groups: computeBreakdown(trades, dim, dim2) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "query failed" }, { status: 500 });
  }
}
