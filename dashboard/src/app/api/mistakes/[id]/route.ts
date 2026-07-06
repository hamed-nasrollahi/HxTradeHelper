import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    await query("UPDATE mistakes SET name = ?, description = ? WHERE id = ?", [
      name,
      body.description ? String(body.description) : null,
      id,
    ]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.code === "ER_DUP_ENTRY" ? "A mistake with that name already exists" : e?.message;
    return NextResponse.json({ error: msg || "update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // FK is ON DELETE SET NULL, so tagged trades simply become unassigned
    await query("DELETE FROM mistakes WHERE id = ?", [Number(params.id)]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "delete failed" }, { status: 500 });
  }
}
