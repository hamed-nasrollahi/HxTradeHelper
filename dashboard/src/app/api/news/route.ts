import { NextRequest, NextResponse } from "next/server";
import { getNews } from "@/lib/news";

export const dynamic = "force-dynamic";

/**
 * Calendar feed for the MT5 indicator (and anyone else on the dashboard).
 * Returns a flat array shaped like ForexFactory's own feed - the indicator
 * parses it with the exact same code it used against ForexFactory directly.
 * Authenticated by src/middleware.ts (X-Api-Key, since the indicator has
 * no session cookie - open only when no key is configured).
 *
 * ?currencies=USD,EUR filters the response; omit it to get every cached
 * orange/red event. The cache itself refreshes from ForexFactory at most
 * once an hour, regardless of which currencies are requested.
 */
export async function GET(req: NextRequest) {
  try {
    const currencies = (req.nextUrl.searchParams.get("currencies") || "")
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    const events = await getNews(currencies);
    return NextResponse.json(events);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "news fetch failed" }, { status: 500 });
  }
}
