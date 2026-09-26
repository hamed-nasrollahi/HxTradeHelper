import { NextRequest, NextResponse } from "next/server";
import { fetchTrades } from "@/lib/db";
import { BREAKDOWN_DIMENSIONS, comboKey } from "@/lib/stats";
import { GroupDimension } from "@/lib/types";
import { HttpError, errorResponse, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Trades for the table, newest first. `groupBy` + `group` narrow the list
 * to one row of the Breakdown page (same dimensions, same group key), so
 * clicking a breakdown row's trade count shows exactly those trades.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const params = req.nextUrl.searchParams;
    const group = params.get("group");
    const dims = Array.from(
      new Set((params.get("groupBy") || "").split(",").map((s) => s.trim()).filter(Boolean))
    ) as GroupDimension[];
    if (group !== null) {
      if (!dims.length || dims.some((d) => !BREAKDOWN_DIMENSIONS.includes(d))) {
        throw new HttpError(400, `groupBy must be one of ${BREAKDOWN_DIMENSIONS.join(", ")}`);
      }
      // The breakdown only counts closed trades
      const trades = (await fetchTrades(params, true, user.id)).filter((t) => comboKey(t, dims) === group);
      return NextResponse.json({ trades: trades.reverse() });
    }
    const includeOpen = params.get("includeOpen") === "1";
    const trades = await fetchTrades(params, !includeOpen, user.id);
    // Newest first for the table
    return NextResponse.json({ trades: trades.slice().reverse() });
  } catch (e: any) {
    return errorResponse(e, "query failed");
  }
}
