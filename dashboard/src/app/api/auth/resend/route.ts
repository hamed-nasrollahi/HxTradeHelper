import { NextRequest, NextResponse } from "next/server";
import { errorResponse, findUserByEmail } from "@/lib/session";
import { normalizeEmail, sendVerificationCode } from "@/lib/users";

export const dynamic = "force-dynamic";

/** { email } -> sends a new confirmation code (at most once a minute). */
export async function POST(req: NextRequest) {
  try {
    const body: any = await req.json().catch(() => ({}));
    const user = await findUserByEmail(normalizeEmail(body?.email));
    // Don't reveal whether an address is registered
    if (!user || Number(user.email_verified) || Number(user.disabled)) {
      return NextResponse.json({ ok: true, sent: true });
    }
    const sent = await sendVerificationCode(user, { enforceCooldown: true });
    return NextResponse.json({ ok: true, sent });
  } catch (e: any) {
    return errorResponse(e, "could not send code");
  }
}
