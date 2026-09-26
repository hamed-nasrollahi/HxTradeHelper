/**
 * Cookie-session auth shared by the login routes (Node runtime) and the
 * middleware (edge runtime), so it only uses Web Crypto.
 *
 * Session tokens are `v2.<userId>.<expiresEpochSec>.<hmac>` signed with
 * SESSION_SECRET (or, when that is unset, a secret derived from the .env
 * admin credentials, so no new setting is required).
 *
 * The pre-multi-user token (a SHA-256 digest of the .env admin
 * credentials, prefix-less) is still accepted and maps to user #1, so
 * browsers that were signed in before the upgrade stay signed in.
 */

export const SESSION_COOKIE = "hx_session";
/** Set by the middleware on the forwarded request once the cookie is verified. */
export const USER_HEADER = "x-hx-user-id";
/** The admin user that owns every record created before multi-user support. */
export const ADMIN_USER_ID = 1;
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function dashboardUser(): string {
  return process.env.DASHBOARD_USER || "admin";
}

export function dashboardPassword(): string {
  return process.env.DASHBOARD_PASSWORD || "admin";
}

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The old single-user session token; still honoured for user #1. */
export async function legacySessionToken(): Promise<string> {
  const data = new TextEncoder().encode(`hx1:${dashboardUser()}:${dashboardPassword()}`);
  return hex(await crypto.subtle.digest("SHA-256", data));
}

function sessionSecret(): string {
  return process.env.SESSION_SECRET || `hx2-derived:${dashboardUser()}:${dashboardPassword()}`;
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(userId: number, maxAge = SESSION_MAX_AGE): Promise<string> {
  const payload = `v2.${userId}.${Math.floor(Date.now() / 1000) + maxAge}`;
  return `${payload}.${await sign(payload)}`;
}

/** Returns the signed-in user id, or null for a missing/invalid/expired token. */
export async function verifySessionToken(token: string | undefined | null): Promise<number | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length === 4 && parts[0] === "v2") {
    const [, id, exp, sig] = parts;
    const userId = Number(id);
    if (!Number.isInteger(userId) || userId <= 0) return null;
    if (!(Number(exp) > Date.now() / 1000)) return null;
    return safeEqual(sig, await sign(`v2.${id}.${exp}`)) ? userId : null;
  }
  return safeEqual(token, await legacySessionToken()) ? ADMIN_USER_ID : null;
}
