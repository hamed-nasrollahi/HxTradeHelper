import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { errorResponse, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const rows = await query(
      `SELECT m.id, m.name, m.description, m.created_at,
              (SELECT COUNT(*) FROM trades t WHERE t.mistake_id = m.id AND t.user_id = m.user_id) AS trade_count
       FROM mistakes m WHERE m.user_id = ? ORDER BY m.name`,
      [user.id]
    );
    return NextResponse.json({ mistakes: rows });
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
    const result: any = await query("INSERT INTO mistakes (name, description, user_id) VALUES (?, ?, ?)", [
      name,
      description,
      user.id,
    ]);
    return NextResponse.json({ ok: true, id: (result as any).insertId });
  } catch (e: any) {
    if (e?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "A mistake with that name already exists" }, { status: 409 });
    }
    return errorResponse(e, "insert failed");
  }
}
