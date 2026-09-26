import { NextResponse } from "next/server";
import { GOOGLE_STATE_COOKIE, googleAuthUrl, googleConfigured } from "@/lib/google";
import { randomToken } from "@/lib/password";

export const dynamic = "force-dynamic";

/** Starts "Sign in with Google": redirect to Google's consent screen. */
export async function GET() {
  if (!googleConfigured()) {
    return NextResponse.json({ error: "Google sign-in is not configured" }, { status: 404 });
  }
  const state = randomToken(16);
  const res = NextResponse.redirect(googleAuthUrl(state));
  res.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_URL!.startsWith("https://"),
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
}
