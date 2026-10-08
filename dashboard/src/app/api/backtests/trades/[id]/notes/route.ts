import { NextRequest, NextResponse } from "next/server";
import { parseNoteIds, query, setLinkedNotes } from "@/lib/db";
import { HttpError, errorResponse, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Replaces a backtest trade's (backtest_data row's) notes: body `{ noteIds: number[] }`. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(req);
    const body = await req.json();
    if (!Array.isArray(body.noteIds)) throw new HttpError(400, "noteIds must be an array");
    const id = Number(params.id);
    const rows = await query(
      "SELECT 1 FROM backtest_data d JOIN backtests b ON b.id = d.backtest_id WHERE d.id = ? AND b.user_id = ?",
      [id, user.id]
    );
    if (!rows.length) throw new HttpError(404, "backtest trade not found");
    const noteIds = await setLinkedNotes(
      "backtest_data_notes",
      "backtest_data_id",
      id,
      parseNoteIds(body.noteIds.join(",")),
      user.id
    );
    if (!noteIds) throw new HttpError(400, "unknown note");
    return NextResponse.json({ ok: true, noteIds });
  } catch (e: any) {
    return errorResponse(e, "update failed");
  }
}
