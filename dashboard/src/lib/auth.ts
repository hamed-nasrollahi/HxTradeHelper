/**
 * Cookie-session auth shared by the login route (Node runtime) and the
 * middleware (edge runtime), so it only uses Web Crypto.
 *
 * The session token is a SHA-256 digest keyed by the configured
 * credentials: it cannot be forged without knowing them, and changing
 * DASHBOARD_USER / DASHBOARD_PASSWORD invalidates all existing sessions.
 */

export const SESSION_COOKIE = "hx_session";

export function dashboardUser(): string {
  return process.env.DASHBOARD_USER || "admin";
}

export function dashboardPassword(): string {
  return process.env.DASHBOARD_PASSWORD || "admin";
}

export async function sessionToken(): Promise<string> {
  const data = new TextEncoder().encode(
    `hx1:${dashboardUser()}:${dashboardPassword()}`
  );
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
