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
    const raw = (params.get("groupBy") || "strategy").split(",").map((s) => s.trim()).filter(Boolean);
    const dims = Array.from(new Set(raw)) as GroupDimension[];
    if (dims.length === 0) {
      return NextResponse.json({ error: "groupBy is required" }, { status: 400 });
    }
    const invalid = dims.find((d) => !DIMENSIONS.includes(d));
    if (invalid) {
      return NextResponse.json({ error: `groupBy must be one of ${DIMENSIONS.join(", ")}` }, { status: 400 });
    }
    const trades = await fetchTrades(params, true);
    return NextResponse.json({ groups: computeBreakdown(trades, dims) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "query failed" }, { status: 500 });
  }
}
