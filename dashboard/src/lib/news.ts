import { getPool, query } from "./db";
import { NewsEvent } from "./types";

const FEED_URL =
  process.env.NEWS_FEED_URL || "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const REFRESH_MS = 60 * 60 * 1000; // re-fetch ForexFactory at most once an hour

interface FeedEvent {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
}

async function getLastFetchedAt(): Promise<Date | null> {
  const rows = await query<{ fetched_at: string }>(
    "SELECT fetched_at FROM news_fetch_log WHERE id = 1"
  );
  return rows[0] ? new Date(rows[0].fetched_at + "Z") : null;
}

async function refreshFromForexFactory(): Promise<void> {
  const res = await fetch(FEED_URL, {
    headers: { "User-Agent": "HxTradeHelper/1.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ForexFactory feed returned HTTP ${res.status}`);
  const raw = (await res.json()) as FeedEvent[];
  const events = (Array.isArray(raw) ? raw : []).filter(
    (e) => e?.impact === "High" || e?.impact === "Medium"
  );

  const now = new Date();
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM news_events");
    if (events.length) {
      const values = events
        .map((e) => {
          const d = new Date(e.date || "");
          return Number.isNaN(d.getTime())
            ? null
            : [d, String(e.country || "").toUpperCase(), String(e.title || ""), String(e.impact)];
        })
        .filter((v): v is [Date, string, string, string] => v !== null);
      if (values.length) {
        await conn.query(
          "INSERT INTO news_events (event_time, currency, title, impact) VALUES ?",
          [values]
        );
      }
    }
    await conn.query(
      "INSERT INTO news_fetch_log (id, fetched_at) VALUES (1, ?) " +
        "ON DUPLICATE KEY UPDATE fetched_at = ?",
      [now, now]
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function queryStoredEvents(currencies: string[]): Promise<NewsEvent[]> {
  let sql = "SELECT event_time, currency, title, impact FROM news_events";
  const args: any[] = [];
  if (currencies.length) {
    sql += ` WHERE currency IN (${currencies.map(() => "?").join(",")})`;
    args.push(...currencies);
  }
  sql += " ORDER BY event_time";
  const rows = await query<{
    event_time: string;
    currency: string;
    title: string;
    impact: string;
  }>(sql, args);
  return rows.map((r) => ({
    title: r.title,
    country: r.currency,
    date: r.event_time.replace(" ", "T") + "Z",
    impact: r.impact,
  }));
}

/**
 * Serves the cached ForexFactory calendar, refreshing it first when the
 * cache is missing or older than an hour. Currency filtering happens here,
 * not on the feed, so multiple indicator instances share one cached fetch.
 */
export async function getNews(currencies: string[]): Promise<NewsEvent[]> {
  const lastFetch = await getLastFetchedAt();
  const isFresh = lastFetch !== null && Date.now() - lastFetch.getTime() < REFRESH_MS;
  if (!isFresh) {
    try {
      await refreshFromForexFactory();
    } catch (e) {
      if (!lastFetch) throw e; // nothing cached to fall back to
      // keep serving the stale cache rather than failing the request
    }
  }
  return queryStoredEvents(currencies);
}
