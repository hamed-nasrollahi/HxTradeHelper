import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";

/**
 * Session-cookie auth for the whole dashboard. /login and /api/login are
 * open (so you can sign in), and /api/import is open because the MT5
 * uploader authenticates with its own X-Api-Key instead.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const open =
    pathname === "/login" || pathname === "/api/login" || pathname === "/api/import";

  const authed = req.cookies.get(SESSION_COOKIE)?.value === (await sessionToken());

  if (authed && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (authed || open) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const login = new URL("/login", req.url);
  if (pathname !== "/") login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
