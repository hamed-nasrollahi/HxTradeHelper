import { NextRequest, NextResponse } from "next/server";
import { fetchBacktests } from "@/lib/db";
import { comboKey, computeBreakdown, computeEquity, computeSummary } from "@/lib/stats";
import { BacktestGroup, BacktestRecord, GroupDimension } from "@/lib/types";
import { errorResponse, requireUser } from "@/lib/session";

const DIMS: GroupDimension[] = ["strategy", "symbol", "month", "monthOfYear", "week", "weekday", "hour", "session", "direction"];
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const trades = await fetchBacktests(req.nextUrl.searchParams, user.id);
    const raw = (req.nextUrl.searchParams.get("groupBy") || "strategy").split(",").map((s) => s.trim()).filter(Boolean);
    const dims = Array.from(new Set(raw)) as GroupDimension[];
    if (dims.length === 0 || dims.some((d) => !DIMS.includes(d))) {
      return NextResponse.json({ error: "invalid groupBy" }, { status: 400 });
    }
    // Drawdown and streaks need each group's trades in time order
    const byGroup = new Map<string, BacktestRecord[]>();
    for (const t of trades) {
      const key = comboKey(t, dims);
      const list = byGroup.get(key);
      if (list) list.push(t);
      else byGroup.set(key, [t]);
    }
    const groups: BacktestGroup[] = computeBreakdown(trades, dims).map((g) => {
      const s = computeSummary(byGroup.get(g.key) || []);
      return {
        ...g,
        breakEvens: s.breakEvens,
        maxDrawdown: s.maxDrawdown,
        longestWinStreak: s.longestWinStreak,
        longestLossStreak: s.longestLossStreak,
      };
    });
    return NextResponse.json({ summary: computeSummary(trades), points: computeEquity(trades), groups });
  } catch (e: any) {
    return errorResponse(e, "query failed");
  }
}
