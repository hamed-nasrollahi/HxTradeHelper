import crypto from "crypto";

const KEY_LEN = 64;

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, KEY_LEN, (err, key) => (err ? reject(err) : resolve(key)))
  );
}

/** Hash as `scrypt$<salt hex>$<key hex>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const [algo, saltHex, keyHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string" || password.length < 8) return "Password must be at least 8 characters";
  if (password.length > 200) return "Password is too long";
  return null;
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/** Six-digit numeric confirmation code. */
export function randomCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}
