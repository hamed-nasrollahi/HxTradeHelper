import { NextRequest, NextResponse } from "next/server";
import { fetchBacktests } from "@/lib/db";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({ backtests: (await fetchBacktests(req.nextUrl.searchParams)).reverse() });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "query failed" }, { status: 500 });
  }
}
