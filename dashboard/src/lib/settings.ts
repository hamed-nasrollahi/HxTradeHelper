import fs from "fs";
import path from "path";

export interface DbSettings {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  /** X-Api-Key required on POST /api/import; empty = no auth */
  importApiKey: string;
}

function dataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), "data");
}

function settingsFile(): string {
  return path.join(dataDir(), "settings.json");
}

function envDefaults(): DbSettings {
  return {
    host: process.env.HX_DB_HOST || "127.0.0.1",
    port: Number(process.env.HX_DB_PORT || 3306),
    database: process.env.HX_DB_NAME || "hx_trades",
    user: process.env.HX_DB_USER || "hx",
    password: process.env.HX_DB_PASSWORD || "",
    importApiKey: process.env.HX_API_KEY || "",
  };
}

export function loadSettings(): DbSettings {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsFile(), "utf8"));
    return { ...envDefaults(), ...raw };
  } catch {
    return envDefaults();
  }
}

export function saveSettings(settings: DbSettings): void {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2), {
    mode: 0o600,
  });
}
