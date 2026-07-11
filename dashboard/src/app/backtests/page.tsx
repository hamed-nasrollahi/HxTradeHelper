"use client";

import { useEffect, useState } from "react";
import Filters from "@/components/Filters";
import ErrorBanner from "@/components/ErrorBanner";
import KpiCard from "@/components/KpiCard";
import PnlBarChart from "@/components/charts/PnlBarChart";
import { useMeta } from "@/components/useMeta";
import { filterQuery, fmtNum, getJSON, sendJSON } from "@/lib/client";
import { BacktestRecord, BreakdownGroup, GroupDimension, Summary, TradeFilters } from "@/lib/types";

const DIMENSIONS: { value: GroupDimension; label: string }[] = [
  { value: "strategy", label: "Strategy" }, { value: "symbol", label: "Symbol" },
  { value: "month", label: "Month" }, { value: "week", label: "Week" },
  { value: "weekday", label: "Day of week" }, { value: "hour", label: "Hour" },
  { value: "direction", label: "Direction" },
];

export default function BacktestsPage() {
  const { meta } = useMeta();
  const [filters, setFilters] = useState<TradeFilters>({});
  const [rows, setRows] = useState<BacktestRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [groups, setGroups] = useState<BreakdownGroup[]>([]);
  const [groupBy, setGroupBy] = useState<GroupDimension>("strategy");
  const [error, setError] = useState<string | null>(null);

  const load = () => Promise.all([
    getJSON<{ backtests: BacktestRecord[] }>(`/api/backtests${filterQuery(filters)}`),
    getJSON<{ summary: Summary; groups: BreakdownGroup[] }>(`/api/backtests/stats${filterQuery(filters, { groupBy })}`),
  ]).then(([r, s]) => { setRows(r.backtests); setSummary(s.summary); setGroups(s.groups); setError(null); })
    .catch((e) => setError(e.message));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [filters, groupBy]);

  const assign = async (row: BacktestRecord, strategyId: string) => {
    try {
      await sendJSON(`/api/backtests/${row.backtest_id}`, "PATCH", { strategyId: strategyId || null });
      await load();
    } catch (e: any) { setError(e.message); }
  };

  return <div>
    <h1 className="mb-4 text-xl font-semibold">Backtests</h1>
    {error ? <ErrorBanner message={error} /> : null}
    <Filters filters={filters} onChange={setFilters} symbols={meta.symbols} strategies={meta.strategies} />
    {summary ? <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <KpiCard label="Test trades" value={String(summary.totalTrades)} />
      <KpiCard label="Win rate" value={`${fmtNum(summary.winRate, 1)}%`} sub={`${summary.wins}W / ${summary.losses}L`} />
      <KpiCard label="Normalized result" value={`${summary.netProfit > 0 ? "+" : ""}${summary.netProfit}R`} sub="wins minus losses" />
      <KpiCard label="Longest streaks" value={`${summary.longestWinStreak}W / ${summary.longestLossStreak}L`} />
    </div> : null}
    <div className="mt-6 flex flex-wrap gap-2">{DIMENSIONS.map(d => <button key={d.value} className="rounded-md px-3 py-1.5 text-sm" style={{background:groupBy === d.value ? "var(--s1)" : "var(--surface-1)", color:groupBy === d.value ? "#fff" : "var(--ink-2)", border:"1px solid var(--border)"}} onClick={() => setGroupBy(d.value)}>{d.label}</button>)}</div>
    <div className="card mt-2 p-4"><h2 className="mb-2 text-sm font-medium">Normalized result by {DIMENSIONS.find(d => d.value === groupBy)?.label.toLowerCase()}</h2><PnlBarChart groups={groups} /></div>
    <div className="card mt-6 overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="text-left text-xs" style={{color:"var(--ink-muted)"}}>
        <th className="px-3 py-2">Time</th><th>Batch</th><th>Type</th><th>Result</th><th>Duration</th><th>Symbol</th><th>Strategy</th>
      </tr></thead><tbody>{rows.map((r) => <tr key={r.id} style={{borderTop:"1px solid var(--border)"}}>
        <td className="whitespace-nowrap px-3 py-2">{r.open_time.slice(0,16)}</td><td className="px-2">{r.batch_id}</td><td>{r.type}</td><td>{r.result}</td><td>{r.duration_min} min</td>
        <td className="px-2 font-medium">{r.symbol}</td>
        <td className="px-2"><select className="input" value={r.strategy_id ? String(r.strategy_id) : ""} onChange={(e) => assign(r, e.target.value)}><option value="">Unassigned</option>{meta.strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
      </tr>)}{!rows.length ? <tr><td colSpan={7} className="px-4 py-6 text-center">No backtests in this range</td></tr> : null}</tbody>
    </table></div>
  </div>;
}
