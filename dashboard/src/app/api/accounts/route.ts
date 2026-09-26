import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { errorResponse, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const rows = await query<{ account: number; visible: number }>(
      `SELECT t.account, COALESCE(v.visible, 1) AS visible
       FROM (SELECT DISTINCT account FROM trades WHERE user_id = ?) t
       LEFT JOIN account_visibility v ON v.account = t.account
       ORDER BY t.account`,
      [user.id]
    );
    return NextResponse.json({ accounts: rows });
  } catch (e: any) {
    return errorResponse(e, "query failed");
  }
}
