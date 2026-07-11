import { NextRequest, NextResponse } from "next/server";
import { fetchBacktestBatches, fetchBacktests } from "@/lib/db";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    if (req.nextUrl.searchParams.get("listOnly") === "1")
      return NextResponse.json({ batches: await fetchBacktestBatches() });
    const [batches, backtests] = await Promise.all([
      fetchBacktestBatches(),
      fetchBacktests(req.nextUrl.searchParams),
    ]);
    return NextResponse.json({ batches, backtests: backtests.reverse() });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "query failed" }, { status: 500 });
  }
}
