/**
 * "Sign in with Google" via the OAuth 2.0 authorization-code flow
 * (https://developers.google.com/identity/protocols/oauth2/web-server).
 * Needs GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and APP_URL (the public
 * base URL; the authorised redirect URI in Google Cloud Console must be
 * `${APP_URL}/api/auth/google/callback`).
 */

export const GOOGLE_STATE_COOKIE = "hx_oauth_state";

export function googleConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET && !!process.env.APP_URL;
}

export function googleRedirectUri(): string {
  return `${process.env.APP_URL!.replace(/\/+$/, "")}/api/auth/google/callback`;
}

export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
}

export async function googleProfile(code: string): Promise<GoogleProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const token: any = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !token.access_token) {
    throw new Error(`Google sign-in failed: ${token.error_description || token.error || tokenRes.status}`);
  }
  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  const info: any = await infoRes.json().catch(() => ({}));
  if (!infoRes.ok || !info.sub || !info.email) throw new Error("Google sign-in failed: no profile returned");
  return {
    sub: String(info.sub),
    email: String(info.email).toLowerCase(),
    email_verified: info.email_verified === true || info.email_verified === "true",
    name: info.name ? String(info.name) : undefined,
  };
}
