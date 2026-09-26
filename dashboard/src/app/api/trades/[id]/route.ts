import { NextRequest, NextResponse } from "next/server";
import { ownsRow, query } from "@/lib/db";
import { HttpError, errorResponse, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function idOrNull(v: unknown): number | null {
  return v === null || v === "" || v === undefined ? null : Number(v);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(req);
    const body = await req.json();
    const sets: string[] = [];
    const args: any[] = [];
    if ("strategyId" in body) {
      const strategyId = idOrNull(body.strategyId);
      if (!(await ownsRow("strategies", strategyId, user.id))) throw new HttpError(400, "unknown strategy");
      sets.push("strategy_id = ?");
      args.push(strategyId);
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
      const mistakeId = idOrNull(body.mistakeId);
      if (!(await ownsRow("mistakes", mistakeId, user.id))) throw new HttpError(400, "unknown mistake");
      sets.push("mistake_id = ?");
      args.push(mistakeId);
    }
    if (!sets.length) {
      return NextResponse.json({ error: "no fields to update" }, { status: 400 });
    }
    args.push(Number(params.id), user.id);
    const result: any = await query(`UPDATE trades SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`, args);
    if (!result.affectedRows) throw new HttpError(404, "trade not found");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return errorResponse(e, "update failed");
  }
}
