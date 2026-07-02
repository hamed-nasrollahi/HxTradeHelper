import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, dashboardUser, dashboardPassword, sessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  if (body?.user !== dashboardUser() || body?.password !== dashboardPassword()) {
    return NextResponse.json({ error: "Wrong username or password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
