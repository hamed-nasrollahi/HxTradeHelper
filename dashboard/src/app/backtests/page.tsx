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
  { value: "weekday", label: "Day of week" }, { value: "session", label: "Session" },
  { value: "direction", label: "Direction" },
];

// Backtests run on different days arrive as separate batches. They are
// analysed together per strategy + symbol; a single batch can still be picked.
interface BacktestGroup {
  key: string;
  strategyId: number | null;
  strategyName: string;
  symbol: string;
  batches: BacktestBatch[];
  tradeCount: number;
}

const groupKey = (strategyId: number | null, symbol: string) => `${strategyId ?? "none"}|${symbol}`;

function groupBatches(batches: BacktestBatch[]): BacktestGroup[] {
  const map = new Map<string, BacktestGroup>();
  for (const b of batches) {
    const key = groupKey(b.strategy_id, b.symbol);
    let g = map.get(key);
    if (!g) {
      g = { key, strategyId: b.strategy_id, strategyName: b.strategy_name || "Unassigned", symbol: b.symbol, batches: [], tradeCount: 0 };
      map.set(key, g);
    }
    g.batches.push(b);
    g.tradeCount += (Number(b.trade_count) || 0) - (Number(b.duplicate_count) || 0);
  }
  return Array.from(map.values()); // batches arrive newest first, so groups do too
}

export default function BacktestsPage() {
  const { meta } = useMeta();
  const [batches, setBatches] = useState<BacktestBatch[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rows, setRows] = useState<BacktestRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [groups, setGroups] = useState<BreakdownGroup[]>([]);
  const [groupBys, setGroupBys] = useState<GroupDimension[]>(["strategy"]);
  const [error, setError] = useState<string | null>(null);

  const toggleDim = (d: GroupDimension) => {
    setGroupBys((prev) => {
      if (prev.includes(d)) {
        return prev.length > 1 ? prev.filter((x) => x !== d) : prev;
      }
      return [...prev, d];
    });
  };

  const moveDim = (index: number, dir: -1 | 1) => {
    setGroupBys((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const backtestGroups = groupBatches(batches);
  const selectedGroup = backtestGroups.find((g) => g.key === selectedKey) || null;
  const selected = selectedGroup?.batches.find((b) => b.id === selectedId) || null;

  const loadBatches = () => getJSON<{ batches: BacktestBatch[] }>("/api/backtests?listOnly=1")
    .then((r) => {
      const fresh = groupBatches(r.batches);
      setBatches(r.batches);
      setSelectedKey((current) => current && fresh.some((g) => g.key === current) ? current : fresh[0]?.key || null);
      setSelectedId((current) => current && r.batches.some((b) => b.id === current) ? current : null);
      setError(null);
    }).catch((e) => setError(e.message));

  const loadAnalysis = () => {
    if (!selectedGroup) { setRows([]); setSummary(null); setGroups([]); return Promise.resolve(); }
    const extra: Record<string, string> = selected
      ? { backtestId: String(selected.id) }
      : { strategyId: selectedGroup.strategyId ? String(selectedGroup.strategyId) : "none", symbol: selectedGroup.symbol };
    return Promise.all([
    getJSON<{ backtests: BacktestRecord[] }>(`/api/backtests${filterQuery({}, extra)}`),
    getJSON<{ summary: Summary; groups: BreakdownGroup[] }>(`/api/backtests/stats${filterQuery({}, { ...extra, groupBy: groupBys.join(",") })}`),
  ]).then(([r, s]) => { setRows(r.backtests); setSummary(s.summary); setGroups(s.groups); setError(null); })
    .catch((e) => setError(e.message));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadBatches(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAnalysis(); }, [selectedKey, selectedId, groupBys]);

  // Assigns the picked batch, or every batch in the group when "All batches"
  // is selected, then follows them into their new strategy + symbol group.
  const assign = async (strategyId: string) => {
    if (!selectedGroup) return;
    const targets = selected ? [selected] : selectedGroup.batches;
    try {
      await Promise.all(targets.map((b) =>
        sendJSON(`/api/backtests/${b.id}`, "PATCH", { strategyId: strategyId || null })));
      setSelectedKey(groupKey(strategyId ? Number(strategyId) : null, selectedGroup.symbol));
      await loadBatches();
    } catch (e: any) { setError(e.message); }
  };

  return <div>
    <h1 className="mb-4 text-xl font-semibold">Backtests</h1>
    {error ? <ErrorBanner message={error} /> : null}
    <div className="card mb-5 flex flex-wrap items-end gap-4 p-4">
      <label className="flex min-w-72 flex-col gap-1 text-xs" style={{color:"var(--ink-2)"}}>Backtest (strategy · symbol)
        <select className="input" value={selectedKey || ""} onChange={(e) => { setSelectedKey(e.target.value || null); setSelectedId(null); }}>
          {!backtestGroups.length ? <option value="">No uploaded backtests</option> : null}
          {backtestGroups.map((g) => <option key={g.key} value={g.key}>{g.strategyName} · {g.symbol} · {g.batches.length} batch{g.batches.length === 1 ? "" : "es"} · {g.tradeCount} trades</option>)}
        </select>
      </label>
      <label className="flex min-w-64 flex-col gap-1 text-xs" style={{color:"var(--ink-2)"}}>Batch
        <select className="input" disabled={!selectedGroup} value={selectedId || ""} onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">All batches{selectedGroup ? ` (${selectedGroup.batches.length})` : ""}</option>
          {selectedGroup?.batches.map((b) => <option key={b.id} value={b.id}>{b.created_at.slice(0, 16)} · {b.trade_count} trades{Number(b.duplicate_count) ? ` (${b.duplicate_count} already in group, ignored)` : ""}</option>)}
        </select>
      </label>
      <label className="flex min-w-52 flex-col gap-1 text-xs" style={{color:"var(--ink-2)"}}>{selected || selectedGroup?.batches.length === 1 ? "Strategy" : "Strategy (all batches)"}
        <select className="input" disabled={!selectedGroup} value={selectedGroup?.strategyId ? String(selectedGroup.strategyId) : ""} onChange={(e) => assign(e.target.value)}>
          <option value="">Unassigned</option>{meta.strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
    </div>
    {summary ? <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <KpiCard label="Test trades" value={String(summary.totalTrades)} />
      <KpiCard label="Win rate" value={`${fmtNum(summary.winRate, 1)}%`} sub={`${summary.wins}W / ${summary.losses}L`} />
      <KpiCard label="Normalized result" value={`${summary.netProfit > 0 ? "+" : ""}${summary.netProfit}R`} sub="wins minus losses" />
      <KpiCard label="Longest streaks" value={`${summary.longestWinStreak}W / ${summary.longestLossStreak}L`} />
    </div> : null}
    <div className="mt-6 flex flex-wrap gap-2">{DIMENSIONS.map(d => {
      const idx = groupBys.indexOf(d.value);
      const active = idx !== -1;
      return <button key={d.value} className="rounded-md px-3 py-1.5 text-sm" style={{background:active ? "var(--s1)" : "var(--surface-1)", color:active ? "#fff" : "var(--ink-2)", border:"1px solid var(--border)"}} onClick={() => toggleDim(d.value)}>{active ? `${idx + 1}. ` : ""}{d.label}</button>;
    })}</div>
    <div className="mb-2 mt-2 flex flex-wrap items-center gap-2 text-xs" style={{color:"var(--ink-2)"}}>
      Grouped by:
      {groupBys.map((d, i) => (
        <span key={d} className="flex items-center gap-1 rounded-md px-2 py-1" style={{border:"1px solid var(--border)"}}>
          {DIMENSIONS.find((x) => x.value === d)?.label}
          {i > 0 ? <button aria-label="move earlier" onClick={() => moveDim(i, -1)}>↑</button> : null}
          {i < groupBys.length - 1 ? <button aria-label="move later" onClick={() => moveDim(i, 1)}>↓</button> : null}
          {groupBys.length > 1 ? <button aria-label="remove" onClick={() => toggleDim(d)}>×</button> : null}
        </span>
      ))}
    </div>
    <div className="card mt-2 p-4"><h2 className="mb-2 text-sm font-medium">Normalized result by {groupBys.map(d => DIMENSIONS.find(x => x.value === d)?.label.toLowerCase()).join(", then ")}</h2><PnlBarChart groups={groups} /></div>
    <div className="card mt-6 overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="text-left text-xs" style={{color:"var(--ink-muted)"}}>
        <th className="px-3 py-2">Time</th><th>Trade #</th><th>Type</th><th>Result</th><th>Duration</th>
      </tr></thead><tbody>{rows.map((r) => <tr key={r.id} style={{borderTop:"1px solid var(--border)"}}>
        <td className="whitespace-nowrap px-3 py-2">{r.open_time.slice(0,16)}</td><td>{r.trade_number}</td><td>{r.type}</td><td>{r.result}</td><td>{r.duration_min} min</td>
      </tr>)}{!rows.length ? <tr><td colSpan={5} className="px-4 py-6 text-center">No data for this backtest</td></tr> : null}</tbody>
    </table></div>
  </div>;
}
