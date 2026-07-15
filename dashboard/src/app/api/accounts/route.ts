import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query<{ account: number; visible: number }>(
      `SELECT t.account, COALESCE(v.visible, 1) AS visible
       FROM (SELECT DISTINCT account FROM trades) t
       LEFT JOIN account_visibility v ON v.account = t.account
       ORDER BY t.account`
    );
    return NextResponse.json({ accounts: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "query failed" }, { status: 500 });
  }
}
