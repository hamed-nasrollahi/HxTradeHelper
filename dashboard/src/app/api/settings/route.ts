import { NextRequest, NextResponse } from "next/server";
import { loadSettings, saveSettings } from "@/lib/settings";
import { errorResponse, requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Server-wide database settings: admins only. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (e) {
    return errorResponse(e, "forbidden");
  }
  const s = loadSettings();
  // Never send secrets back to the browser
  return NextResponse.json({
    host: s.host,
    port: s.port,
    database: s.database,
    user: s.user,
    hasPassword: s.password.length > 0,
    hasImportKey: s.importApiKey.length > 0,
  });
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (e) {
    return errorResponse(e, "forbidden");
  }
  const body = await req.json();
  const current = loadSettings();
  const next = {
    host: String(body.host || "").trim() || current.host,
    port: Number(body.port) || current.port,
    database: String(body.database || "").trim() || current.database,
    user: String(body.user || "").trim() || current.user,
    // Empty secret fields mean "keep the stored one"
    password: body.password ? String(body.password) : current.password,
    importApiKey: body.importApiKey ? String(body.importApiKey) : current.importApiKey,
  };
  saveSettings(next);
  return NextResponse.json({ ok: true });
}
