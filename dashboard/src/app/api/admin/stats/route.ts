import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { errorResponse, requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const PERIOD_DAYS: Record<string, number | null> = { "30d": 30, "90d": 90, "1y": 365, all: null };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface RankRow {
  id: number;
  name: string | null;
  email: string | null;
  username: string | null;
  net: number;
  trades: number;
  wins: number;
  losses: number;
}

function ranked(rows: RankRow[]) {
  return rows.map((r) => {
    const decided = Number(r.wins) + Number(r.losses);
    return {
      id: r.id,
      name: r.name || r.email || r.username || `#${r.id}`,
      email: r.email,
      netProfit: Number(r.net),
      trades: Number(r.trades),
      winRate: decided > 0 ? (Number(r.wins) * 100) / decided : null,
    };
  });
}

/**
 * Admin dashboard numbers: user counts, sign-ups per month for the last
 * six months, and the ten users with the highest / lowest net P/L on
 * closed trades in the chosen period (?period=30d|90d|1y|all).
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const period = req.nextUrl.searchParams.get("period") || "30d";
    const days = period in PERIOD_DAYS ? PERIOD_DAYS[period] : 30;

    const [counts] = await query(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(email_verified = 1), 0) AS verified,
              COALESCE(SUM(email_verified = 0), 0) AS unverified,
              COALESCE(SUM(disabled = 1), 0) AS disabled
       FROM users`
    );
    const [activeRow] = await query(
      `SELECT COUNT(*) AS n FROM users u
       WHERE u.last_login_at >= UTC_TIMESTAMP() - INTERVAL 30 DAY
          OR EXISTS (SELECT 1 FROM trades t WHERE t.user_id = u.id
                     AND t.updated_at >= NOW() - INTERVAL 30 DAY)`
    );

    // Sign-ups per calendar month (UTC), current month + the five before it
    const now = new Date();
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const signupRows = await query<{ month: string; n: number }>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS n
       FROM users WHERE created_at >= ? GROUP BY month`,
      [first.toISOString().slice(0, 10)]
    );
    const byMonth = new Map(signupRows.map((r) => [r.month, Number(r.n)]));
    const signups = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + i, 1));
      const key = d.toISOString().slice(0, 7);
      return { key, label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`, count: byMonth.get(key) || 0 };
    });

    const since = days === null ? "" : `AND t.close_time >= UTC_TIMESTAMP() - INTERVAL ${days} DAY`;
    const rankSql = (having: string, order: string) => `
      SELECT u.id, u.name, u.email, u.username, SUM(t.profit) AS net, COUNT(*) AS trades,
             SUM(t.profit > 0) AS wins, SUM(t.profit < 0) AS losses
      FROM trades t JOIN users u ON u.id = t.user_id
      WHERE t.is_open = 0 AND t.close_time IS NOT NULL ${since}
      GROUP BY u.id, u.name, u.email, u.username
      HAVING ${having}
      ORDER BY net ${order}
      LIMIT 10`;
    const [gainers, losers] = await Promise.all([
      query<RankRow>(rankSql("net > 0", "DESC")),
      query<RankRow>(rankSql("net < 0", "ASC")),
    ]);

    return NextResponse.json({
      period,
      counts: {
        total: Number(counts.total),
        verified: Number(counts.verified),
        unverified: Number(counts.unverified),
        disabled: Number(counts.disabled),
        active30d: Number(activeRow.n),
      },
      signups,
      gainers: ranked(gainers),
      losers: ranked(losers),
    });
  } catch (e: any) {
    return errorResponse(e, "query failed");
  }
}
