import { NextRequest, NextResponse } from "next/server";
import { ADMIN_USER_ID } from "@/lib/auth";
import { query } from "@/lib/db";
import { errorResponse, requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

/** All users (optionally filtered by ?q= on name / email / username), newest first. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const q = (req.nextUrl.searchParams.get("q") || "").trim();
    const args: any[] = [];
    let where = "";
    if (q) {
      where = "WHERE u.email LIKE ? OR u.name LIKE ? OR u.username LIKE ?";
      const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      args.push(like, like, like);
    }
    const rows = await query(
      `SELECT u.id, u.email, u.username, u.name, u.email_verified, u.is_admin, u.disabled,
              u.password_hash IS NOT NULL AS has_password, u.google_sub IS NOT NULL AS google,
              u.last_login_at, u.created_at,
              (SELECT COUNT(*) FROM trades t WHERE t.user_id = u.id) AS trade_count
       FROM users u ${where}
       ORDER BY u.created_at DESC, u.id DESC`,
      args
    );
    return NextResponse.json({
      users: rows.map((r: any) => ({
        id: r.id,
        email: r.email,
        username: r.username,
        name: r.name,
        emailVerified: !!Number(r.email_verified),
        isAdmin: !!Number(r.is_admin),
        disabled: !!Number(r.disabled),
        envAdmin: r.id === ADMIN_USER_ID,
        hasPassword: !!Number(r.has_password),
        google: !!Number(r.google),
        tradeCount: Number(r.trade_count),
        lastLoginAt: r.last_login_at,
        createdAt: r.created_at,
      })),
    });
  } catch (e: any) {
    return errorResponse(e, "query failed");
  }
}
