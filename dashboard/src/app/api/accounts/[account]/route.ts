import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { HttpError, errorResponse, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: { account: string } }) {
  try {
    const user = await requireUser(req);
    const account = Number(params.account);
    if (!Number.isFinite(account)) {
      return NextResponse.json({ error: "invalid account" }, { status: 400 });
    }
    const owned = await query("SELECT 1 FROM trades WHERE account = ? AND user_id = ? LIMIT 1", [account, user.id]);
    if (!owned.length) throw new HttpError(404, "account not found");
    const body = await req.json();
    const visible = body.visible ? 1 : 0;
    await query(
      `INSERT INTO account_visibility (account, visible, user_id) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE visible = VALUES(visible), user_id = VALUES(user_id)`,
      [account, visible, user.id]
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return errorResponse(e, "update failed");
  }
}
