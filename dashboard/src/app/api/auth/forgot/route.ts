import { NextRequest, NextResponse } from "next/server";
import { errorResponse, findUserByEmail } from "@/lib/session";
import { normalizeEmail, sendVerificationCode } from "@/lib/users";

export const dynamic = "force-dynamic";

/**
 * { email } -> emails a 6-digit password reset code (at most once a
 * minute). Always answers ok, so it doesn't reveal which addresses have
 * accounts. POST /api/auth/reset completes the reset.
 */
export async function POST(req: NextRequest) {
  try {
    const body: any = await req.json().catch(() => ({}));
    const user = await findUserByEmail(normalizeEmail(body?.email));
    if (user && !Number(user.disabled)) {
      await sendVerificationCode(user, { enforceCooldown: true, purpose: "reset" });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return errorResponse(e, "could not send code");
  }
}
