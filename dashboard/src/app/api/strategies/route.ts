import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { errorResponse, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const rows = await query(
      "SELECT id, name, description, color, created_at FROM strategies WHERE user_id = ? ORDER BY name",
      [user.id]
    );
    return NextResponse.json({ strategies: rows });
  } catch (e: any) {
    return errorResponse(e, "query failed");
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const description = body.description ? String(body.description) : null;
    const color = String(body.color || "#2a78d6");
    const result: any = await query(
      "INSERT INTO strategies (name, description, color, user_id) VALUES (?, ?, ?, ?)",
      [name, description, color, user.id]
    );
    return NextResponse.json({ ok: true, id: (result as any).insertId });
  } catch (e: any) {
    if (e?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "A strategy with that name already exists" }, { status: 409 });
    }
    return errorResponse(e, "insert failed");
  }
}
