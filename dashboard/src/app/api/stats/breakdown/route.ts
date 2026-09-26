import { NextRequest, NextResponse } from "next/server";
import { fetchTrades } from "@/lib/db";
import { BREAKDOWN_DIMENSIONS as DIMENSIONS, computeBreakdown } from "@/lib/stats";
import { GroupDimension } from "@/lib/types";
import { errorResponse, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
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
    const trades = await fetchTrades(params, true, user.id);
    return NextResponse.json({ groups: computeBreakdown(trades, dims) });
  } catch (e: any) {
    return errorResponse(e, "query failed");
  }
}
