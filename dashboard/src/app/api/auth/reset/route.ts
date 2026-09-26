import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { hashPassword, passwordProblem } from "@/lib/password";
import { HttpError, errorResponse, findUserByEmail, startSession } from "@/lib/session";
import { checkCode, markVerified, normalizeEmail } from "@/lib/users";

export const dynamic = "force-dynamic";

/**
 * { email, code, password } -> sets a new password with the code from
 * POST /api/auth/forgot and signs the user in. The code proves the user
 * owns the inbox, so an unconfirmed sign-up is confirmed too.
 */
export async function POST(req: NextRequest) {
  try {
    const body: any = await req.json().catch(() => ({}));
    const problem = passwordProblem(body?.password);
    if (problem) throw new HttpError(400, problem);
    const user = await findUserByEmail(normalizeEmail(body?.email));
    if (!user || Number(user.disabled)) throw new HttpError(400, "Wrong code");
    await checkCode(user, String(body?.code ?? ""), "reset");
    await query("UPDATE users SET password_hash = ? WHERE id = ?", [await hashPassword(body.password), user.id]);
    await markVerified(user.id); // also clears the used code
    return await startSession(NextResponse.json({ ok: true }), user.id);
  } catch (e: any) {
    return errorResponse(e, "password reset failed");
  }
}
