import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query(
      "SELECT id, name, description, color, created_at FROM strategies ORDER BY name"
    );
    return NextResponse.json({ strategies: rows });
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
    const color = String(body.color || "#2a78d6");
    const result: any = await query(
      "INSERT INTO strategies (name, description, color) VALUES (?, ?, ?)",
      [name, description, color]
    );
    return NextResponse.json({ ok: true, id: (result as any).insertId });
  } catch (e: any) {
    const msg = e?.code === "ER_DUP_ENTRY" ? "A strategy with that name already exists" : e?.message;
    return NextResponse.json({ error: msg || "insert failed" }, { status: 500 });
  }
}
