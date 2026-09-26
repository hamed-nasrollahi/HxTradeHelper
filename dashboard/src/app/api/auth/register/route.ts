import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { hashPassword, passwordProblem } from "@/lib/password";
import { HttpError, errorResponse, findUserByEmail } from "@/lib/session";
import { normalizeEmail, sendVerificationCode, validEmail } from "@/lib/users";

export const dynamic = "force-dynamic";

/**
 * { email, password, name } -> creates an unconfirmed account and emails a
 * 6-digit confirmation code (POST /api/auth/verify completes sign-up).
 * Re-registering an address that is still unconfirmed replaces its
 * password and sends a new code.
 */
export async function POST(req: NextRequest) {
  try {
    const body: any = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);
    const name = String(body?.name ?? "").trim().slice(0, 128) || null;
    if (!validEmail(email)) throw new HttpError(400, "Enter a valid email address");
    const problem = passwordProblem(body?.password);
    if (problem) throw new HttpError(400, problem);
    const passwordHash = await hashPassword(body.password);

    let user = await findUserByEmail(email);
    if (user && Number(user.email_verified)) {
      throw new HttpError(409, "An account with this email already exists - sign in instead");
    }
    const existing = !!user;
    if (user) {
      await query("UPDATE users SET password_hash = ?, name = COALESCE(?, name) WHERE id = ?", [
        passwordHash,
        name,
        user.id,
      ]);
    } else {
      await query("INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)", [email, name, passwordHash]);
    }
    user = (await findUserByEmail(email))!;
    const sent = await sendVerificationCode(user, { enforceCooldown: existing });
    return NextResponse.json({ ok: true, email, sent });
  } catch (e: any) {
    if (e?.code === "ER_DUP_ENTRY") return errorResponse(new HttpError(409, "Account already exists"), "");
    return errorResponse(e, "registration failed");
  }
}
