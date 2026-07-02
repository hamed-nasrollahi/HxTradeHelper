import { NextRequest, NextResponse } from "next/server";
import { loadSettings, saveSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = loadSettings();
  // Never send the password back to the browser
  return NextResponse.json({
    host: s.host,
    port: s.port,
    database: s.database,
    user: s.user,
    hasPassword: s.password.length > 0,
  });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const current = loadSettings();
  const next = {
    host: String(body.host || "").trim() || current.host,
    port: Number(body.port) || current.port,
    database: String(body.database || "").trim() || current.database,
    user: String(body.user || "").trim() || current.user,
    // Empty password field means "keep the stored one"
    password: body.password ? String(body.password) : current.password,
  };
  saveSettings(next);
  return NextResponse.json({ ok: true });
}
