import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { errorResponse, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(req);
    const id = Number(params.id);
    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    await query("UPDATE strategies SET name = ?, description = ?, color = ? WHERE id = ? AND user_id = ?", [
      name,
      body.description ? String(body.description) : null,
      String(body.color || "#2a78d6"),
      id,
      user.id,
    ]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "A strategy with that name already exists" }, { status: 409 });
    }
    return errorResponse(e, "update failed");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(req);
    // FK is ON DELETE SET NULL, so assigned trades simply become unassigned
    await query("DELETE FROM strategies WHERE id = ? AND user_id = ?", [Number(params.id), user.id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return errorResponse(e, "delete failed");
  }
}
