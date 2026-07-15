import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: { account: string } }) {
  try {
    const account = Number(params.account);
    if (!Number.isFinite(account)) {
      return NextResponse.json({ error: "invalid account" }, { status: 400 });
    }
    const body = await req.json();
    const visible = body.visible ? 1 : 0;
    await query(
      "INSERT INTO account_visibility (account, visible) VALUES (?, ?) ON DUPLICATE KEY UPDATE visible = VALUES(visible)",
      [account, visible]
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "update failed" }, { status: 500 });
  }
}
