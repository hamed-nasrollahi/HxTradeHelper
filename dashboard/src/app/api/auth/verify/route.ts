import { NextRequest, NextResponse } from "next/server";
import { HttpError, errorResponse, findUserByEmail, startSession } from "@/lib/session";
import { confirmCode, normalizeEmail } from "@/lib/users";

export const dynamic = "force-dynamic";

/** { email, code } -> confirms the email address and signs the user in. */
export async function POST(req: NextRequest) {
  try {
    const body: any = await req.json().catch(() => ({}));
    const user = await findUserByEmail(normalizeEmail(body?.email));
    if (!user) throw new HttpError(400, "Wrong code");
    if (Number(user.disabled)) throw new HttpError(403, "Account disabled");
    await confirmCode(user, String(body?.code ?? ""));
    return await startSession(NextResponse.json({ ok: true }), user.id);
  } catch (e: any) {
    return errorResponse(e, "verification failed");
  }
}
