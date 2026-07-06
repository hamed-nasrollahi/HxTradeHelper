import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const sets: string[] = [];
    const args: any[] = [];
    if ("strategyId" in body) {
      sets.push("strategy_id = ?");
      args.push(body.strategyId === null || body.strategyId === "" ? null : Number(body.strategyId));
    }
    if ("entryCorrect" in body) {
      sets.push("entry_correct = ?");
      args.push(body.entryCorrect ? 1 : 0);
    }
    if ("exitCorrect" in body) {
      sets.push("exit_correct = ?");
      args.push(body.exitCorrect ? 1 : 0);
    }
    if ("mistakeId" in body) {
      sets.push("mistake_id = ?");
      args.push(body.mistakeId === null || body.mistakeId === "" ? null : Number(body.mistakeId));
    }
    if (!sets.length) {
      return NextResponse.json({ error: "no fields to update" }, { status: 400 });
    }
    args.push(Number(params.id));
    await query(`UPDATE trades SET ${sets.join(", ")} WHERE id = ?`, args);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "update failed" }, { status: 500 });
  }
}
