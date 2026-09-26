import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { GOOGLE_STATE_COOKIE, googleConfigured, googleProfile } from "@/lib/google";
import { UserRow, findUserByEmail, startSession } from "@/lib/session";
import { markVerified } from "@/lib/users";

export const dynamic = "force-dynamic";

function appUrl(path: string): string {
  return `${process.env.APP_URL!.replace(/\/+$/, "")}${path}`;
}

function fail(message: string): NextResponse {
  const res = NextResponse.redirect(appUrl(`/login?error=${encodeURIComponent(message)}`));
  res.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
  return res;
}

/**
 * Google redirects back here. The account is matched by Google id, then by
 * (verified) email - linking Google to an existing email/password account -
 * and otherwise a new, already-confirmed account is created.
 */
export async function GET(req: NextRequest) {
  if (!googleConfigured()) return NextResponse.json({ error: "Google sign-in is not configured" }, { status: 404 });
  const params = req.nextUrl.searchParams;
  if (params.get("error")) return fail("Google sign-in was cancelled");
  const state = params.get("state");
  const code = params.get("code");
  if (!state || !code || state !== req.cookies.get(GOOGLE_STATE_COOKIE)?.value) {
    return fail("Google sign-in expired - please try again");
  }

  try {
    const profile = await googleProfile(code);
    if (!profile.email_verified) return fail("Your Google email address is not verified");

    let user: UserRow | null =
      (await query<UserRow>("SELECT * FROM users WHERE google_sub = ?", [profile.sub]))[0] || null;
    if (!user) {
      user = await findUserByEmail(profile.email);
      if (user) {
        await query("UPDATE users SET google_sub = ?, name = COALESCE(name, ?) WHERE id = ?", [
          profile.sub,
          profile.name || null,
          user.id,
        ]);
        // Google has confirmed the address, so a pending sign-up is complete
        // too - but its password was never proven to belong to this person
        // (anyone can start a sign-up with any address), so drop it.
        if (!Number(user.email_verified)) {
          await query("UPDATE users SET password_hash = NULL WHERE id = ?", [user.id]);
          await markVerified(user.id);
        }
      } else {
        await query("INSERT INTO users (email, name, google_sub, email_verified) VALUES (?, ?, ?, 1)", [
          profile.email,
          profile.name || null,
          profile.sub,
        ]);
        user = (await findUserByEmail(profile.email))!;
      }
    }
    if (Number(user.disabled)) return fail("Account disabled");

    const res = NextResponse.redirect(appUrl("/"));
    res.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
    return await startSession(res, user.id);
  } catch (e: any) {
    console.error("[google]", e);
    return fail(e?.message || "Google sign-in failed");
  }
}
