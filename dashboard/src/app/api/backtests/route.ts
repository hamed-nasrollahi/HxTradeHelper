import { NextRequest, NextResponse } from "next/server";
import { fetchBacktestBatches, fetchBacktests } from "@/lib/db";
import { errorResponse, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (req.nextUrl.searchParams.get("listOnly") === "1")
      return NextResponse.json({ batches: await fetchBacktestBatches(user.id) });
    const [batches, backtests] = await Promise.all([
      fetchBacktestBatches(user.id),
      fetchBacktests(req.nextUrl.searchParams, user.id),
    ]);
    return NextResponse.json({ batches, backtests: backtests.reverse() });
  } catch (e: any) {
    return errorResponse(e, "query failed");
  }
}
