import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";
import { loadSettings } from "@/lib/settings";

/**
 * Session-cookie auth for the browser dashboard. /login and /api/login are
 * always open (so you can sign in). Every other /api/* route additionally
 * accepts X-Api-Key as an alternate credential (checked against the import
 * API key from Settings), so scripts and the MT5 indicator can call any
 * endpoint without a browser session. /api/import and /api/news are called
 * by the indicator, which has no session cookie: they stay reachable
 * without one, gated purely by the key - open when no key is configured
 * (matching the pre-existing behavior), required once one is set.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const alwaysOpen = pathname === "/login" || pathname === "/api/login";
  const headless = pathname === "/api/import" || pathname === "/api/news";

  const apiKey = loadSettings().importApiKey;
  const validKey = !!apiKey && req.headers.get("x-api-key") === apiKey;
  const authedSession = req.cookies.get(SESSION_COOKIE)?.value === (await sessionToken());

  if (authedSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (alwaysOpen) return NextResponse.next();

  if (headless) {
    if (authedSession || !apiKey || validKey) return NextResponse.next();
    return NextResponse.json({ error: "invalid api key" }, { status: 401 });
  }

  if (authedSession || (isApi && validKey)) return NextResponse.next();

  if (isApi) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const login = new URL("/login", req.url);
  if (pathname !== "/") login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
