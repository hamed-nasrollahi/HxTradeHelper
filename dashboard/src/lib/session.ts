import { NextRequest, NextResponse } from "next/server";
import { query } from "./db";
import { ADMIN_USER_ID, SESSION_COOKIE, SESSION_MAX_AGE, USER_HEADER, createSessionToken } from "./auth";
import { loadSettings } from "./settings";

/** Server-side (Node runtime) helpers for resolving the calling user. */

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface UserRow {
  id: number;
  email: string | null;
  username: string | null;
  name: string | null;
  password_hash: string | null;
  google_sub: string | null;
  email_verified: number;
  is_admin: number;
  disabled: number;
  api_key: string | null;
  verify_code_hash: string | null;
  verify_expires_at: string | null;
  verify_attempts: number;
  verify_sent_at: string | null;
  last_login_at: string | null;
  created_at: string;
}

export interface SessionUser {
  id: number;
  email: string | null;
  username: string | null;
  name: string | null;
  isAdmin: boolean;
}

export async function findUser(id: number): Promise<UserRow | null> {
  const rows = await query<UserRow>("SELECT * FROM users WHERE id = ?", [id]);
  return rows[0] || null;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const rows = await query<UserRow>("SELECT * FROM users WHERE email = ?", [email.trim().toLowerCase()]);
  return rows[0] || null;
}

function toSessionUser(u: UserRow): SessionUser {
  return { id: u.id, email: u.email, username: u.username, name: u.name, isAdmin: !!Number(u.is_admin) };
}

function active(u: UserRow | null): SessionUser {
  if (!u) throw new HttpError(401, "Not signed in");
  if (Number(u.disabled)) throw new HttpError(401, "Account disabled");
  return toSessionUser(u);
}

interface Options {
  /**
   * Routes the MT5 indicator calls (/api/import, /api/backtests/import,
   * /api/news). Before multi-user support these were open whenever no
   * import API key was configured; that still holds, and such anonymous
   * calls are attributed to the admin (user #1) who owns the old data.
   */
  headless?: boolean;
}

/**
 * The calling user, from (in order): the session cookie verified by the
 * middleware, a personal API key, the legacy global import key (= admin),
 * or - headless routes only, while no global key is set - the admin.
 * Disabled users are rejected on every request.
 */
export async function requireUser(req: NextRequest, opts: Options = {}): Promise<SessionUser> {
  const fromSession = Number(req.headers.get(USER_HEADER));
  if (Number.isInteger(fromSession) && fromSession > 0) return active(await findUser(fromSession));

  const apiKey = req.headers.get("x-api-key")?.trim();
  if (apiKey) {
    const rows = await query<UserRow>("SELECT * FROM users WHERE api_key = ?", [apiKey]);
    if (rows[0]) return active(rows[0]);
  }
  const globalKey = loadSettings().importApiKey;
  if (apiKey && globalKey && apiKey === globalKey) return active(await findUser(ADMIN_USER_ID));
  if (opts.headless && !globalKey) return active(await findUser(ADMIN_USER_ID));

  throw new HttpError(401, apiKey ? "invalid api key" : "Not signed in");
}

export async function requireAdmin(req: NextRequest): Promise<SessionUser> {
  const user = await requireUser(req);
  if (!user.isAdmin) throw new HttpError(403, "Admins only");
  return user;
}

/** JSON error response; 401s also clear the session cookie. */
export function errorResponse(e: any, fallback: string): NextResponse {
  const status = e instanceof HttpError ? e.status : 500;
  let message = e?.message || fallback;
  if (e?.code === "ER_BAD_FIELD_ERROR" && /user_id/.test(message)) {
    message = "Database schema is out of date - apply sql/dashboard.sql";
  }
  const res = NextResponse.json({ error: message }, { status });
  if (status === 401) res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

/** Signs the user in on `res` and records the login time. */
export async function startSession(res: NextResponse, userId: number): Promise<NextResponse> {
  res.cookies.set(SESSION_COOKIE, await createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && (process.env.APP_URL || "").startsWith("https://"),
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  await query("UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?", [userId]).catch(() => {});
  return res;
}
