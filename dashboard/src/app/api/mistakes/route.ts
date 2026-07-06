import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query(
      `SELECT m.id, m.name, m.description, m.created_at,
              (SELECT COUNT(*) FROM trades t WHERE t.mistake_id = m.id) AS trade_count
       FROM mistakes m ORDER BY m.name`
    );
    return NextResponse.json({ mistakes: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "query failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const description = body.description ? String(body.description) : null;
    const result: any = await query("INSERT INTO mistakes (name, description) VALUES (?, ?)", [
      name,
      description,
    ]);
    return NextResponse.json({ ok: true, id: (result as any).insertId });
  } catch (e: any) {
    const msg = e?.code === "ER_DUP_ENTRY" ? "A mistake with that name already exists" : e?.message;
    return NextResponse.json({ error: msg || "insert failed" }, { status: 500 });
  }
}
