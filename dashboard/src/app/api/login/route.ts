import { NextRequest, NextResponse } from "next/server";
import { ADMIN_USER_ID, dashboardPassword, dashboardUser } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { HttpError, errorResponse, findUser, findUserByEmail, startSession } from "@/lib/session";
import { normalizeEmail } from "@/lib/users";

export const dynamic = "force-dynamic";

/**
 * { user, password }: `user` is either the .env admin username
 * (DASHBOARD_USER / DASHBOARD_PASSWORD - always user #1, unchanged from
 * the single-user dashboard) or a registered email address.
 */
export async function POST(req: NextRequest) {
  try {
    const body: any = await req.json().catch(() => ({}));
    const login = String(body?.user ?? "");
    const password = String(body?.password ?? "");

    if (login === dashboardUser() && password === dashboardPassword()) {
      const admin = await findUser(ADMIN_USER_ID);
      if (admin && Number(admin.disabled)) throw new HttpError(403, "Account disabled");
      return await startSession(NextResponse.json({ ok: true }), ADMIN_USER_ID);
    }

    const user = login.includes("@") ? await findUserByEmail(normalizeEmail(login)) : null;
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      throw new HttpError(401, "Wrong email or password");
    }
    if (Number(user.disabled)) throw new HttpError(403, "Account disabled");
    if (!Number(user.email_verified)) {
      return NextResponse.json(
        { error: "Please confirm your email first", needsVerification: true, email: user.email },
        { status: 403 }
      );
    }
    return await startSession(NextResponse.json({ ok: true }), user.id);
  } catch (e: any) {
    return errorResponse(e, "login failed");
  }
}
