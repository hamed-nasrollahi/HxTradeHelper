import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, USER_HEADER, verifySessionToken } from "@/lib/auth";

/**
 * Session-cookie auth for the browser dashboard. The verified user id is
 * forwarded to route handlers in the x-hx-user-id request header (any
 * client-supplied value is stripped first); handlers resolve and scope
 * everything through requireUser() in src/lib/session.ts, which also
 * rejects disabled accounts.
 *
 * Sign-in / sign-up pages and /api/auth/* are always open. Every other
 * /api/* route also accepts an X-Api-Key header (a user's personal key, or
 * the legacy global import key = admin); that key is checked in the route,
 * since the edge runtime can't reach the database. /api/import,
 * /api/backtests/import and /api/news are called by the MT5 indicator and
 * are always passed through - the route decides (uploads always need a
 * valid key; /api/news is open while no global key is configured).
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const authPage = pathname === "/login" || pathname === "/register" || pathname === "/forgot-password";
  const alwaysOpen =
    authPage || pathname === "/api/login" || pathname === "/api/logout" || pathname.startsWith("/api/auth/");
  const headless = pathname === "/api/import" || pathname === "/api/backtests/import" || pathname === "/api/news";

  const userId = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  const headers = new Headers(req.headers);
  headers.delete(USER_HEADER);
  if (userId) headers.set(USER_HEADER, String(userId));
  const pass = () => NextResponse.next({ request: { headers } });

  if (userId && authPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (alwaysOpen || headless) return pass();
  if (userId || (isApi && req.headers.get("x-api-key"))) return pass();

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
