import {
  BreakdownGroup,
  EquityPoint,
  GroupDimension,
  Summary,
  TradeRecord,
} from "./types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Parse the planned R:R stored as "1:2.50" (or plain "2.5"). */
export function parseRR(rr: string | null): number | null {
  if (!rr) return null;
  const m = rr.match(/^\s*1\s*:\s*([\d.]+)\s*$/);
  if (m) return Number(m[1]);
  const plain = Number(rr);
  return Number.isFinite(plain) && plain > 0 ? plain : null;
}

function tradeTime(t: TradeRecord): string {
  return t.close_time || t.open_time;
}

export function computeSummary(trades: TradeRecord[]): Summary {
  let wins = 0;
  let losses = 0;
  let breakEvens = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let netProfit = 0;
  let biggestWin: Summary["biggestWin"] = null;
  let biggestLoss: Summary["biggestLoss"] = null;
  let rrSum = 0;
  let rrCount = 0;

  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;

  let winStreak = 0;
  let lossStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;

  const days = new Set<string>();

  for (const t of trades) {
    const profit = num(t.profit);
    netProfit += profit;
    days.add(tradeTime(t).slice(0, 10));

    if (profit > 0) {
      wins++;
      grossProfit += profit;
      winStreak++;
      lossStreak = 0;
      longestWinStreak = Math.max(longestWinStreak, winStreak);
      if (!biggestWin || profit > biggestWin.profit)
        biggestWin = { profit, symbol: t.symbol, date: tradeTime(t) };
    } else if (profit < 0) {
      losses++;
      grossLoss += profit;
      lossStreak++;
      winStreak = 0;
      longestLossStreak = Math.max(longestLossStreak, lossStreak);
      if (!biggestLoss || profit < biggestLoss.profit)
        biggestLoss = { profit, symbol: t.symbol, date: tradeTime(t) };
    } else {
      breakEvens++;
    }

    equity += profit;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);

    const rr = parseRR(t.rr);
    if (rr !== null) {
      rrSum += rr;
      rrCount++;
    }
  }

  const total = trades.length;
  const decided = wins + losses;
  const avgWin = wins > 0 ? grossProfit / wins : 0;
  const avgLoss = losses > 0 ? grossLoss / losses : 0;

  return {
    totalTrades: total,
    wins,
    losses,
    breakEvens,
    winRate: decided > 0 ? (wins * 100) / decided : 0,
    netProfit,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss < 0 ? grossProfit / -grossLoss : null,
    expectancy: total > 0 ? netProfit / total : 0,
    avgWin,
    avgLoss,
    payoffRatio: avgLoss < 0 ? avgWin / -avgLoss : null,
    biggestWin,
    biggestLoss,
    avgPlannedRR: rrCount > 0 ? rrSum / rrCount : null,
    maxDrawdown,
    longestWinStreak,
    longestLossStreak,
    currentStreak: winStreak > 0 ? winStreak : -lossStreak,
    activeDays: days.size,
    avgTradesPerDay: days.size > 0 ? total / days.size : 0,
  };
}

export function computeEquity(trades: TradeRecord[]): EquityPoint[] {
  let equity = 0;
  return trades.map((t) => {
    equity += num(t.profit);
    return {
      time: tradeTime(t),
      equity: Math.round(equity * 100) / 100,
      profit: num(t.profit),
      symbol: t.symbol,
    };
  });
}

function isoWeekKey(dateStr: string): string {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00Z`);
  // ISO week: Thursday of the current week decides the year
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function weekdayKey(dateStr: string): string {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00Z`);
  const day = d.getUTCDay() || 7; // 1 = Mon ... 7 = Sun
  return WEEKDAYS[day - 1];
}

function groupKey(t: TradeRecord, dim: GroupDimension): { key: string; label: string; color?: string } {
  const time = tradeTime(t);
  switch (dim) {
    case "strategy":
      return t.strategy_id
        ? { key: `s${t.strategy_id}`, label: t.strategy_name || `#${t.strategy_id}`, color: t.strategy_color || undefined }
        : { key: "none", label: "Unassigned" };
    case "symbol":
      return { key: t.symbol, label: t.symbol };
    case "month":
      return { key: time.slice(0, 7), label: time.slice(0, 7) };
    case "monthOfYear": {
      const m = time.slice(5, 7); // "01".."12", aggregated across years
      return { key: m, label: MONTHS[Number(m) - 1] };
    }
    case "week": {
      const wk = isoWeekKey(time);
      return { key: wk, label: wk };
    }
    case "weekday": {
      const wd = weekdayKey(time);
      return { key: wd, label: wd };
    }
    case "hour": {
      const hour = time.slice(11, 13) || "00";
      return { key: hour, label: `${hour}:00` };
    }
    case "direction":
      return { key: t.type, label: t.type };
    case "mistake":
      return t.mistake_id
        ? { key: `m${t.mistake_id}`, label: t.mistake_name || `#${t.mistake_id}` }
        : { key: "none", label: "No mistake" };
  }
}

export function computeBreakdown(trades: TradeRecord[], dim: GroupDimension): BreakdownGroup[] {
  const groups = new Map<string, BreakdownGroup>();

  for (const t of trades) {
    const { key, label, color } = groupKey(t, dim);
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        label,
        color,
        trades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        netProfit: 0,
        grossProfit: 0,
        grossLoss: 0,
        profitFactor: null,
        avgProfit: 0,
        biggestWin: 0,
        biggestLoss: 0,
      };
      groups.set(key, g);
    }
    const profit = num(t.profit);
    g.trades++;
    g.netProfit += profit;
    if (profit > 0) {
      g.wins++;
      g.grossProfit += profit;
      g.biggestWin = Math.max(g.biggestWin, profit);
    } else if (profit < 0) {
      g.losses++;
      g.grossLoss += profit;
      g.biggestLoss = Math.min(g.biggestLoss, profit);
    }
  }

  const result = Array.from(groups.values());
  for (const g of result) {
    const decided = g.wins + g.losses;
    g.winRate = decided > 0 ? (g.wins * 100) / decided : 0;
    g.avgProfit = g.trades > 0 ? g.netProfit / g.trades : 0;
    g.profitFactor = g.grossLoss < 0 ? g.grossProfit / -g.grossLoss : null;
  }

  // Time-like and cyclic dimensions sort by key; entity dimensions by net P/L
  if (dim === "month" || dim === "monthOfYear" || dim === "week" || dim === "hour") {
    result.sort((a, b) => a.key.localeCompare(b.key));
  } else if (dim === "weekday") {
    result.sort((a, b) => WEEKDAYS.indexOf(a.key) - WEEKDAYS.indexOf(b.key));
  } else {
    result.sort((a, b) => b.netProfit - a.netProfit);
  }
  return result;
}
