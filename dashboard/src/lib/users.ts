import { query } from "./db";
import { resetCodeMail, sendMail, verificationMail } from "./mail";
import { randomCode, randomToken, sha256 } from "./password";
import { HttpError, UserRow } from "./session";

export const CODE_TTL_MINUTES = 15;
export const CODE_MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 60;

export function normalizeEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

export function validEmail(email: string): boolean {
  return email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function newApiKey(): string {
  return `hx_${randomToken(20)}`;
}

/** Gives a user a personal import API key if they don't have one yet. */
export async function ensureApiKey(userId: number): Promise<void> {
  await query("UPDATE users SET api_key = ? WHERE id = ? AND api_key IS NULL", [newApiKey(), userId]);
}

/**
 * "verify" = confirm a new sign-up, "reset" = forgot password. Both share
 * the verify_* columns; the purpose is mixed into the hash so a code only
 * works for what it was sent for.
 */
export type CodePurpose = "verify" | "reset";

function codeHash(userId: number, purpose: CodePurpose, code: string): string {
  // Sign-up codes keep the original "<id>:<code>" format
  return sha256(purpose === "verify" ? `${userId}:${code}` : `${userId}:${purpose}:${code}`);
}

/**
 * Generates a fresh 6-digit code for the user and emails it.
 * Returns whether the email actually went out (false = Brevo not
 * configured; the code is only logged on the server).
 */
export async function sendVerificationCode(
  user: UserRow,
  { enforceCooldown, purpose = "verify" }: { enforceCooldown: boolean; purpose?: CodePurpose }
): Promise<boolean> {
  if (!user.email) throw new HttpError(400, "This account has no email address");
  if (enforceCooldown && user.verify_sent_at) {
    const sentAt = Date.parse(`${user.verify_sent_at.replace(" ", "T")}Z`);
    const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - (Date.now() - sentAt) / 1000);
    if (wait > 0) throw new HttpError(429, `Please wait ${wait}s before requesting another code`);
  }
  const code = randomCode();
  await query(
    `UPDATE users SET verify_code_hash = ?, verify_attempts = 0, verify_sent_at = UTC_TIMESTAMP(),
            verify_expires_at = UTC_TIMESTAMP() + INTERVAL ${CODE_TTL_MINUTES} MINUTE
     WHERE id = ?`,
    [codeHash(user.id, purpose, code), user.id]
  );
  const mail = purpose === "reset" ? resetCodeMail : verificationMail;
  return sendMail(mail(user.email, user.name, code, CODE_TTL_MINUTES));
}

/** Checks a 6-digit code; throws on a wrong/expired one. */
export async function checkCode(user: UserRow, code: string, purpose: CodePurpose): Promise<void> {
  if (!user.verify_code_hash || !user.verify_expires_at) {
    throw new HttpError(400, "No confirmation code pending - request a new one");
  }
  if (user.verify_attempts >= CODE_MAX_ATTEMPTS) {
    throw new HttpError(429, "Too many wrong codes - request a new one");
  }
  if (Date.parse(`${user.verify_expires_at.replace(" ", "T")}Z`) < Date.now()) {
    throw new HttpError(400, "The code has expired - request a new one");
  }
  if (codeHash(user.id, purpose, code.trim()) !== user.verify_code_hash) {
    await query("UPDATE users SET verify_attempts = verify_attempts + 1 WHERE id = ?", [user.id]);
    throw new HttpError(400, "Wrong code");
  }
}

/** Checks a sign-up confirmation code; on success marks the email verified. */
export async function confirmCode(user: UserRow, code: string): Promise<void> {
  if (Number(user.email_verified)) return;
  await checkCode(user, code, "verify");
  await markVerified(user.id);
}

export async function markVerified(userId: number): Promise<void> {
  await query(
    `UPDATE users SET email_verified = 1, verify_code_hash = NULL, verify_expires_at = NULL,
            verify_attempts = 0 WHERE id = ?`,
    [userId]
  );
  await ensureApiKey(userId);
}
