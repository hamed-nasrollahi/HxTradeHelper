import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { HttpError, errorResponse, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(req);
    const body = await req.json();
    const text = String(body.text || "").trim();
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    const result: any = await query("UPDATE notes SET text = ? WHERE id = ? AND user_id = ?", [
      text,
      Number(params.id),
      user.id,
    ]);
    if (!result.affectedRows) throw new HttpError(404, "note not found");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return errorResponse(e, "update failed");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(req);
    // FKs are ON DELETE CASCADE, so the note is detached from every trade
    await query("DELETE FROM notes WHERE id = ? AND user_id = ?", [Number(params.id), user.id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return errorResponse(e, "delete failed");
  }
}
