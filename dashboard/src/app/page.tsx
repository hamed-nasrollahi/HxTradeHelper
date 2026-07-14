"use client";

import { useEffect, useState } from "react";
import Filters from "@/components/Filters";
import KpiCard from "@/components/KpiCard";
import ErrorBanner from "@/components/ErrorBanner";
import EquityChart from "@/components/charts/EquityChart";
import PnlBarChart from "@/components/charts/PnlBarChart";
import { useMeta } from "@/components/useMeta";
import { filterQuery, fmtMoney, fmtNum, getJSON, profitColor } from "@/lib/client";
import { BreakdownGroup, EquityPoint, Summary, TradeFilters } from "@/lib/types";

export default function OverviewPage() {
  const { meta } = useMeta();
  const [filters, setFilters] = useState<TradeFilters>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [equity, setEquity] = useState<EquityPoint[]>([]);
  const [monthly, setMonthly] = useState<BreakdownGroup[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = filterQuery(filters);
    Promise.all([
      getJSON<{ summary: Summary }>(`/api/stats/summary${q}`),
      getJSON<{ points: EquityPoint[] }>(`/api/stats/equity${q}`),
      getJSON<{ groups: BreakdownGroup[] }>(`/api/stats/breakdown${filterQuery(filters, { groupBy: "month" })}`),
    ])
      .then(([s, e, m]) => {
        setSummary(s.summary);
        setEquity(e.points);
        setMonthly(m.groups);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [filters]);

  const s = summary;
  const streak =
    s === null || s.currentStreak === 0
      ? "-"
      : s.currentStreak > 0
        ? `${s.currentStreak} wins`
        : `${-s.currentStreak} losses`;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Overview</h1>
      {error ? <ErrorBanner message={error} /> : null}
      <Filters filters={filters} onChange={setFilters} symbols={meta.symbols} accounts={meta.accounts} strategies={meta.strategies} />

      {s ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              label="Net profit"
              value={fmtMoney(s.netProfit)}
              valueColor={profitColor(s.netProfit)}
              sub={`${s.totalTrades} closed trades`}
            />
            <KpiCard label="Win rate" value={`${fmtNum(s.winRate, 1)}%`} sub={`${s.wins}W / ${s.losses}L / ${s.breakEvens}BE`} />
            <KpiCard label="Profit factor" value={s.profitFactor === null ? "-" : fmtNum(s.profitFactor, 2)} sub="gross win / gross loss" />
            <KpiCard label="Expectancy" value={fmtMoney(s.expectancy)} sub="avg P/L per trade" />

            <KpiCard label="Avg win" value={fmtMoney(s.avgWin)} valueColor={profitColor(s.avgWin)} />
            <KpiCard label="Avg loss" value={fmtMoney(s.avgLoss)} valueColor={profitColor(s.avgLoss)} />
            <KpiCard label="Payoff ratio" value={s.payoffRatio === null ? "-" : fmtNum(s.payoffRatio, 2)} sub="avg win / avg loss" />
            <KpiCard
              label="Avg planned R:R"
              value={s.avgPlannedRR === null ? "-" : `1:${fmtNum(s.avgPlannedRR, 2)}`}
              sub="from SL/TP at entry"
            />

            <KpiCard
              label="Biggest win"
              value={s.biggestWin ? fmtMoney(s.biggestWin.profit) : "-"}
              valueColor="var(--good-text)"
              sub={s.biggestWin ? `${s.biggestWin.symbol} · ${s.biggestWin.date.slice(0, 10)}` : undefined}
            />
            <KpiCard
              label="Biggest loss"
              value={s.biggestLoss ? fmtMoney(s.biggestLoss.profit) : "-"}
              valueColor="var(--bad-text)"
              sub={s.biggestLoss ? `${s.biggestLoss.symbol} · ${s.biggestLoss.date.slice(0, 10)}` : undefined}
            />
            <KpiCard label="Max drawdown" value={fmtMoney(-s.maxDrawdown)} valueColor="var(--bad-text)" sub="peak-to-trough on equity" />
            <KpiCard
              label="Streaks"
              value={streak}
              sub={`best ${s.longestWinStreak}W · worst ${s.longestLossStreak}L · ${fmtNum(s.avgTradesPerDay, 1)} trades/day`}
            />
          </div>

          <div className="card mt-6 p-4">
            <h2 className="mb-2 text-sm font-medium" style={{ color: "var(--ink-2)" }}>
              Equity curve (cumulative P/L per closed trade)
            </h2>
            <EquityChart points={equity} />
          </div>

          <div className="card mt-6 p-4">
            <h2 className="mb-2 text-sm font-medium" style={{ color: "var(--ink-2)" }}>
              Net P/L by month
            </h2>
            <PnlBarChart groups={monthly} />
          </div>
        </>
      ) : !error ? (
        <div className="text-sm" style={{ color: "var(--ink-muted)" }}>
          Loading...
        </div>
      ) : null}
    </div>
  );
}
