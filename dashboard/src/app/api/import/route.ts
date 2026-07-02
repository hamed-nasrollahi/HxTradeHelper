import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { loadSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Convert the MT5 TimeToString format "yyyy.mm.dd hh:mm:ss" to MySQL DATETIME. */
function mtTime(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})\.(\d{2})\.(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6] || "00"}`;
}

// strategy_id is deliberately not touched, so re-importing the same day
// never clears assignments made in the dashboard
const UPSERT = `
INSERT INTO trades (account, position_id, symbol, type, result, rr,
                    entry_price, stop_loss, take_profit, close_price,
                    profit, open_time, close_time, is_open)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
    symbol = VALUES(symbol),
    type = VALUES(type),
    result = VALUES(result),
    rr = VALUES(rr),
    entry_price = VALUES(entry_price),
    stop_loss = VALUES(stop_loss),
    take_profit = VALUES(take_profit),
    close_price = VALUES(close_price),
    profit = VALUES(profit),
    open_time = VALUES(open_time),
    close_time = VALUES(close_time),
    is_open = VALUES(is_open)`;

/**
 * Receives the journal payload the MT5 indicator uploads through
 * HxTradeUploader.dll and upserts it keyed by (account, position_id).
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = loadSettings().importApiKey;
    if (apiKey && req.headers.get("x-api-key") !== apiKey) {
      return NextResponse.json({ error: "invalid api key" }, { status: 401 });
    }

    const payload = await req.json().catch(() => null);
    const account = Number(payload?.account);
    const trades = Array.isArray(payload?.trades) ? payload.trades : null;
    if (!Number.isFinite(account) || !trades) {
      return NextResponse.json({ error: "expected { account, trades[] }" }, { status: 400 });
    }

    // Full-history exports set skip_existing so position ids already in the
    // db are left untouched instead of being overwritten by the upsert
    const skipExisting = payload?.skip_existing === true;
    const existing = new Set<number>();
    if (skipExisting) {
      const rows = await query<{ position_id: number }>(
        "SELECT position_id FROM trades WHERE account = ?",
        [account]
      );
      for (const r of rows) existing.add(Number(r.position_id));
    }

    let saved = 0;
    let skipped = 0;
    for (const t of trades) {
      const openTime = mtTime(t.open_time);
      const positionId = Number(t.position_id);
      if (!openTime || !Number.isFinite(positionId)) continue;
      if (skipExisting && existing.has(positionId)) {
        skipped++;
        continue;
      }
      await query(UPSERT, [
        account,
        positionId,
        String(t.symbol || ""),
        String(t.type || ""),
        String(t.result || ""),
        t.rr ? String(t.rr) : null,
        Number(t.entry_price) || 0,
        Number(t.stop_loss) || null, // 0 = never set -> NULL
        Number(t.take_profit) || null,
        Number(t.close_price) || null,
        Number(t.profit) || 0,
        openTime,
        mtTime(t.close_time),
        t.is_open ? 1 : 0,
      ]);
      saved++;
    }
    return NextResponse.json(skipExisting ? { saved, skipped } : { saved });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "import failed" }, { status: 500 });
  }
}
