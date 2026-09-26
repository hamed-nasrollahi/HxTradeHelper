import { NextResponse } from "next/server";
import { googleConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

/** Which sign-in options the login page should offer. */
export async function GET() {
  return NextResponse.json({ google: googleConfigured() });
}
