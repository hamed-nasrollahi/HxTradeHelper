import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { errorResponse, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const rows = await query(
      `SELECT n.id, n.text, n.created_at,
              (SELECT COUNT(*) FROM trade_notes tn WHERE tn.note_id = n.id) AS trade_count,
              (SELECT COUNT(*) FROM backtest_data_notes dn WHERE dn.note_id = n.id) AS backtest_count
       FROM notes n WHERE n.user_id = ? ORDER BY n.created_at DESC, n.id DESC`,
      [user.id]
    );
    return NextResponse.json({ notes: rows });
  } catch (e: any) {
    return errorResponse(e, "query failed");
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await req.json();
    const text = String(body.text || "").trim();
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    const result: any = await query("INSERT INTO notes (text, user_id) VALUES (?, ?)", [text, user.id]);
    return NextResponse.json({ ok: true, id: (result as any).insertId });
  } catch (e: any) {
    return errorResponse(e, "insert failed");
  }
}
