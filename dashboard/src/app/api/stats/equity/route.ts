import { NextRequest, NextResponse } from "next/server";
import { fetchTrades } from "@/lib/db";
import { errorResponse, requireUser } from "@/lib/session";
import { computeEquity } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const trades = await fetchTrades(req.nextUrl.searchParams, true, user.id);
    return NextResponse.json({ points: computeEquity(trades) });
  } catch (e: any) {
    return errorResponse(e, "query failed");
  }
}
