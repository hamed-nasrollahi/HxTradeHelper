import { NextRequest, NextResponse } from "next/server";
import { ADMIN_USER_ID } from "@/lib/auth";
import { query } from "@/lib/db";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { HttpError, errorResponse, findUser, requireUser } from "@/lib/session";
import { ensureApiKey, newApiKey } from "@/lib/users";

export const dynamic = "force-dynamic";

async function profile(userId: number) {
  await ensureApiKey(userId);
  const u = (await findUser(userId))!;
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    name: u.name,
    isAdmin: !!Number(u.is_admin),
    // User #1 signs in with DASHBOARD_USER / DASHBOARD_PASSWORD from .env
    envAdmin: u.id === ADMIN_USER_ID,
    hasPassword: !!u.password_hash,
    google: !!u.google_sub,
    apiKey: u.api_key,
  };
}

/** The signed-in user's profile, including their personal import API key. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    return NextResponse.json({ user: await profile(user.id) });
  } catch (e: any) {
    return errorResponse(e, "query failed");
  }
}

/**
 * { action: "regenerateKey" } - new personal API key (the old one stops working)
 * { action: "changePassword", current, next } - `current` is not needed
 *   when the account has no password yet (Google-only sign-in)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body: any = await req.json().catch(() => ({}));
    if (body?.action === "regenerateKey") {
      await query("UPDATE users SET api_key = ? WHERE id = ?", [newApiKey(), user.id]);
    } else if (body?.action === "changePassword") {
      if (user.id === ADMIN_USER_ID) {
        throw new HttpError(400, "The admin password is set with DASHBOARD_PASSWORD in .env");
      }
      const row = (await findUser(user.id))!;
      if (row.password_hash && !(await verifyPassword(String(body.current ?? ""), row.password_hash))) {
        throw new HttpError(400, "Current password is wrong");
      }
      const problem = passwordProblem(body.next);
      if (problem) throw new HttpError(400, problem);
      await query("UPDATE users SET password_hash = ? WHERE id = ?", [await hashPassword(body.next), user.id]);
    } else {
      throw new HttpError(400, "unknown action");
    }
    return NextResponse.json({ ok: true, user: await profile(user.id) });
  } catch (e: any) {
    return errorResponse(e, "update failed");
  }
}
