import { NextRequest, NextResponse } from "next/server";
import { loadSettings } from "@/lib/settings";
import { testConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const current = loadSettings();
  const candidate = {
    host: String(body.host || "").trim() || current.host,
    port: Number(body.port) || current.port,
    database: String(body.database || "").trim() || current.database,
    user: String(body.user || "").trim() || current.user,
    password: body.password ? String(body.password) : current.password,
  };
  const result = await testConnection(candidate);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
