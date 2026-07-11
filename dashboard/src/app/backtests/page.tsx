"use client";

import { useEffect, useState } from "react";
import ErrorBanner from "@/components/ErrorBanner";
import KpiCard from "@/components/KpiCard";
import PnlBarChart from "@/components/charts/PnlBarChart";
import { useMeta } from "@/components/useMeta";
import { filterQuery, fmtNum, getJSON, sendJSON } from "@/lib/client";
import { BacktestBatch, BacktestRecord, BreakdownGroup, GroupDimension, Summary } from "@/lib/types";

const DIMENSIONS: { value: GroupDimension; label: string }[] = [
  { value: "strategy", label: "Strategy" }, { value: "symbol", label: "Symbol" },
  { value: "month", label: "Month" }, { value: "week", label: "Week" },
  { value: "weekday", label: "Day of week" }, { value: "hour", label: "Hour" },
  { value: "direction", label: "Direction" },
];

export default function BacktestsPage() {
  const { meta } = useMeta();
  const [batches, setBatches] = useState<BacktestBatch[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rows, setRows] = useState<BacktestRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [groups, setGroups] = useState<BreakdownGroup[]>([]);
  const [groupBy, setGroupBy] = useState<GroupDimension>("strategy");
  const [error, setError] = useState<string | null>(null);

  const loadBatches = () => getJSON<{ batches: BacktestBatch[] }>("/api/backtests?listOnly=1")
    .then((r) => {
      setBatches(r.batches);
      setSelectedId((current) => current && r.batches.some((b) => b.id === current) ? current : r.batches[0]?.id || null);
      setError(null);
    }).catch((e) => setError(e.message));

  const loadAnalysis = () => {
    if (!selectedId) { setRows([]); setSummary(null); setGroups([]); return Promise.resolve(); }
    const extra = { backtestId: String(selectedId) };
    return Promise.all([
    getJSON<{ backtests: BacktestRecord[] }>(`/api/backtests${filterQuery({}, extra)}`),
    getJSON<{ summary: Summary; groups: BreakdownGroup[] }>(`/api/backtests/stats${filterQuery({}, { ...extra, groupBy })}`),
  ]).then(([r, s]) => { setRows(r.backtests); setSummary(s.summary); setGroups(s.groups); setError(null); })
    .catch((e) => setError(e.message));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadBatches(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAnalysis(); }, [selectedId, groupBy]);

  const assign = async (strategyId: string) => {
    if (!selectedId) return;
    try {
      await sendJSON(`/api/backtests/${selectedId}`, "PATCH", { strategyId: strategyId || null });
      await Promise.all([loadBatches(), loadAnalysis()]);
    } catch (e: any) { setError(e.message); }
  };

  const selected = batches.find((b) => b.id === selectedId) || null;

  return <div>
    <h1 className="mb-4 text-xl font-semibold">Backtests</h1>
    {error ? <ErrorBanner message={error} /> : null}
    <div className="card mb-5 flex flex-wrap items-end gap-4 p-4">
      <label className="flex min-w-72 flex-col gap-1 text-xs" style={{color:"var(--ink-2)"}}>Uploaded batch
        <select className="input" value={selectedId || ""} onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}>
          {!batches.length ? <option value="">No uploaded backtests</option> : null}
          {batches.map((b) => <option key={b.id} value={b.id}>{b.created_at.slice(0, 16)} · {b.symbol} · {b.trade_count} trades</option>)}
        </select>
      </label>
      <label className="flex min-w-52 flex-col gap-1 text-xs" style={{color:"var(--ink-2)"}}>Strategy
        <select className="input" disabled={!selected} value={selected?.strategy_id ? String(selected.strategy_id) : ""} onChange={(e) => assign(e.target.value)}>
          <option value="">Unassigned</option>{meta.strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      {selected ? <div className="pb-2 text-sm" style={{color:"var(--ink-2)"}}>Symbol: <strong style={{color:"var(--ink-1)"}}>{selected.symbol}</strong></div> : null}
    </div>
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
        <th className="px-3 py-2">Time</th><th>Trade #</th><th>Type</th><th>Result</th><th>Duration</th>
      </tr></thead><tbody>{rows.map((r) => <tr key={r.id} style={{borderTop:"1px solid var(--border)"}}>
        <td className="whitespace-nowrap px-3 py-2">{r.open_time.slice(0,16)}</td><td>{r.trade_number}</td><td>{r.type}</td><td>{r.result}</td><td>{r.duration_min} min</td>
      </tr>)}{!rows.length ? <tr><td colSpan={5} className="px-4 py-6 text-center">No data for this backtest batch</td></tr> : null}</tbody>
    </table></div>
  </div>;
}
