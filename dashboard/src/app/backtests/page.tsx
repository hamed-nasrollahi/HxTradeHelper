"use client";

import { useEffect, useState } from "react";
import ErrorBanner from "@/components/ErrorBanner";
import KpiCard from "@/components/KpiCard";
import MultiSelect from "@/components/MultiSelect";
import NoteFilter from "@/components/NoteFilter";
import NotePicker from "@/components/NotePicker";
import EquityChart from "@/components/charts/EquityChart";
import PnlBarChart from "@/components/charts/PnlBarChart";
import { useMeta } from "@/components/useMeta";
import { filterQuery, fmtNum, fmtR, getJSON, profitColor, sendJSON } from "@/lib/client";
import { SESSION_OPTIONS, sessionOf } from "@/lib/sessions";
import { BacktestBatch, BacktestGroup as GroupRow, BacktestRecord, EquityPoint, GroupDimension, Summary } from "@/lib/types";

const DIMENSIONS: { value: GroupDimension; label: string }[] = [
  { value: "strategy", label: "Strategy" }, { value: "symbol", label: "Symbol" },
  { value: "month", label: "Month" }, { value: "monthOfYear", label: "Month of year" },
  { value: "week", label: "Week" }, { value: "weekday", label: "Day of week" },
  { value: "hour", label: "Hour" }, { value: "session", label: "Session" },
  { value: "direction", label: "Direction" },
];

const WEEKDAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => ({ value: d, label: d }));
const MONTH_OPTIONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  .map((m, i) => ({ value: String(i + 1).padStart(2, "0"), label: m }));
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => {
  const hh = String(h).padStart(2, "0");
  return { value: hh, label: `${hh}:00–${hh}:59` };
});
const SESSION_PICKS = SESSION_OPTIONS.map((s) => ({ value: s.key, label: s.label }));

/**
 * Analysis filters, applied together: symbol(s) › strategy(ies) ›
 * session(s) › note(s), narrowed further by calendar and direction.
 * Empty lists mean "no filter". Not tied to any MT5 account.
 */
interface BtFilters {
  symbols: string[];
  strategies: string[]; // strategy ids, "none" = unassigned
  sessions: string[];
  noteIds?: string;
  noteMatch?: string;
  weekdays: string[];
  months: string[];
  hours: string[];
  direction?: string;
  from?: string;
  to?: string;
  backtestId?: number; // a single uploaded batch
}

const EMPTY: BtFilters = { symbols: [], strategies: [], sessions: [], weekdays: [], months: [], hours: [] };
const STORAGE_KEY = "hx.backtests.filters";

function loadStoredFilters(): BtFilters {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw), backtestId: undefined } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function filterParams(f: BtFilters): Record<string, string> {
  return {
    symbol: f.symbols.join(","),
    strategyId: f.strategies.join(","),
    sessions: f.sessions.join(","),
    weekdays: f.weekdays.join(","),
    months: f.months.join(","),
    hours: f.hours.join(","),
    noteIds: f.noteIds || "",
    noteMatch: f.noteMatch || "",
    direction: f.direction || "",
    from: f.from || "",
    to: f.to || "",
    backtestId: f.backtestId ? String(f.backtestId) : "",
  };
}

// Backtests run on different days arrive as separate batches. They are
// managed together per strategy + symbol; a single batch can still be picked.
// A batch whose trades are all already in the group (e.g. the same trades
// re-uploaded) adds nothing, so it is not listed - but it still moves and is
// deleted with the group, hence `allBatches`.
interface BacktestGroup {
  key: string;
  strategyId: number | null;
  strategyName: string;
  symbol: string;
  batches: BacktestBatch[];
  allBatches: BacktestBatch[];
  tradeCount: number;
}

const isRepeat = (b: BacktestBatch) =>
  Number(b.trade_count) > 0 && Number(b.duplicate_count) >= Number(b.trade_count);

const groupKey = (strategyId: number | null, symbol: string) => `${strategyId ?? "none"}|${symbol}`;

function groupBatches(batches: BacktestBatch[]): BacktestGroup[] {
  const map = new Map<string, BacktestGroup>();
  for (const b of batches) {
    const key = groupKey(b.strategy_id, b.symbol);
    let g = map.get(key);
    if (!g) {
      g = { key, strategyId: b.strategy_id, strategyName: b.strategy_name || "Unassigned", symbol: b.symbol, batches: [], allBatches: [], tradeCount: 0 };
      map.set(key, g);
    }
    g.allBatches.push(b);
    if (!isRepeat(b)) g.batches.push(b);
    g.tradeCount += (Number(b.trade_count) || 0) - (Number(b.duplicate_count) || 0);
  }
  return Array.from(map.values()); // batches arrive newest first, so groups do too
}

const Step = () => <span className="self-end pb-2 text-sm" style={{ color: "var(--ink-muted)" }}>›</span>;

export default function BacktestsPage() {
  const { meta } = useMeta();
  const [batches, setBatches] = useState<BacktestBatch[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filters, setFilters] = useState<BtFilters>(EMPTY);
  const [filtersReady, setFiltersReady] = useState(false);
  const [rows, setRows] = useState<BacktestRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [points, setPoints] = useState<EquityPoint[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupBys, setGroupBys] = useState<GroupDimension[]>(["strategy"]);
  const [savingRow, setSavingRow] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<BtFilters>) => setFilters((f) => ({ ...f, ...patch }));

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
  const filterBatch = filters.backtestId ? batches.find((b) => b.id === filters.backtestId) : null;

  const symbolOptions = Array.from(new Set(batches.map((b) => b.symbol))).sort().map((s) => ({ value: s, label: s }));
  const strategyOptions = [
    ...meta.strategies.map((s) => ({ value: String(s.id), label: s.name })),
    { value: "none", label: "Unassigned" },
  ];

  const loadBatches = () => getJSON<{ batches: BacktestBatch[] }>("/api/backtests?listOnly=1")
    .then((r) => {
      const fresh = groupBatches(r.batches);
      setBatches(r.batches);
      setSelectedKey((current) => current && fresh.some((g) => g.key === current) ? current : fresh[0]?.key || null);
      setSelectedId((current) => current && r.batches.some((b) => b.id === current) ? current : null);
      setFilters((f) => f.backtestId && !r.batches.some((b) => b.id === f.backtestId) ? { ...f, backtestId: undefined } : f);
      setError(null);
    }).catch((e) => setError(e.message));

  const loadAnalysis = () => {
    const params = filterParams(filters);
    return Promise.all([
      getJSON<{ backtests: BacktestRecord[] }>(`/api/backtests${filterQuery({}, params)}`),
      getJSON<{ summary: Summary; points: EquityPoint[]; groups: GroupRow[] }>(`/api/backtests/stats${filterQuery({}, { ...params, groupBy: groupBys.join(",") })}`),
    ]).then(([r, s]) => { setRows(r.backtests); setSummary(s.summary); setPoints(s.points); setGroups(s.groups); setError(null); })
      .catch((e) => setError(e.message));
  };

  useEffect(() => { setFilters(loadStoredFilters()); setFiltersReady(true); }, []);
  useEffect(() => {
    if (!filtersReady) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters)); } catch { /* storage unavailable */ }
  }, [filters, filtersReady]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadBatches(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (filtersReady) loadAnalysis(); }, [batches, filters, groupBys, filtersReady]);

  // Assigns the picked batch, or every batch in the group when "All batches"
  // is selected, then follows them into their new strategy + symbol group.
  const assign = async (strategyId: string) => {
    if (!selectedGroup) return;
    const targets = selected ? [selected] : selectedGroup.allBatches;
    try {
      await Promise.all(targets.map((b) =>
        sendJSON(`/api/backtests/${b.id}`, "PATCH", { strategyId: strategyId || null })));
      setSelectedKey(groupKey(strategyId ? Number(strategyId) : null, selectedGroup.symbol));
      await loadBatches();
    } catch (e: any) { setError(e.message); }
  };

  // Deletes the picked batch, or the whole strategy + symbol group when
  // "All batches" is selected.
  const removeBatches = async () => {
    if (!selectedGroup) return;
    const targets = selected ? [selected] : selectedGroup.allBatches;
    const trades = targets.reduce((n, b) => n + (Number(b.trade_count) || 0), 0);
    const what = selected
      ? `batch ${selected.created_at.slice(0, 16)}`
      : `all ${targets.length} batch${targets.length === 1 ? "" : "es"} of ${selectedGroup.strategyName} · ${selectedGroup.symbol}`;
    if (!confirm(`Delete ${what}? Its ${trades} trade record(s) and their notes are removed permanently.`)) return;
    try {
      for (const b of targets) await sendJSON(`/api/backtests/${b.id}`, "DELETE", {});
      setSelectedId(null);
      await loadBatches(); // the analysis effect follows the new batch list
    } catch (e: any) { setError(e.message); await loadBatches(); }
  };

  // Points the analysis at the managed strategy + symbol (and batch, if one is picked).
  const analyseSelected = () => {
    if (!selectedGroup) return;
    set({
      symbols: [selectedGroup.symbol],
      strategies: [selectedGroup.strategyId ? String(selectedGroup.strategyId) : "none"],
      backtestId: selected?.id,
    });
  };

  const setRowNotes = async (row: BacktestRecord, noteIds: number[]) => {
    setSavingRow(row.id);
    try {
      const r = await sendJSON<{ noteIds: number[] }>(`/api/backtests/trades/${row.id}/notes`, "PUT", { noteIds });
      setRows((rs) => rs.map((x) => x.id === row.id ? { ...x, note_ids: r.noteIds } : x));
    } catch (e: any) { setError(e.message); } finally { setSavingRow(null); }
  };

  const hasFilters = JSON.stringify(filterParams(filters)) !== JSON.stringify(filterParams(EMPTY));
  const avgDuration = rows.length ? rows.reduce((n, r) => n + (Number(r.duration_min) || 0), 0) / rows.length : 0;
  const worst = summary?.worstLossStreak;

  return <div>
    <h1 className="mb-4 text-xl font-semibold">Backtests</h1>
    {error ? <ErrorBanner message={error} /> : null}

    <div className="card mb-4 p-4">
      <h2 className="mb-3 text-sm font-medium" style={{color:"var(--ink-2)"}}>Filters</h2>
      <div className="flex flex-wrap items-end gap-3">
        <MultiSelect label="Symbol" allLabel="All symbols" options={symbolOptions} selected={filters.symbols} onChange={(symbols) => set({ symbols })} />
        <Step />
        <MultiSelect label="Strategy" allLabel="All strategies" options={strategyOptions} selected={filters.strategies} onChange={(strategies) => set({ strategies })} />
        <Step />
        <MultiSelect label="Session" allLabel="All sessions" options={SESSION_PICKS} selected={filters.sessions} onChange={(sessions) => set({ sessions })} />
        <Step />
        <NoteFilter notes={meta.notes} noteIds={filters.noteIds} noteMatch={filters.noteMatch} onChange={(p) => set({ noteIds: p.noteIds, noteMatch: p.noteMatch })} />
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <MultiSelect label="Day of week" allLabel="Every day" options={WEEKDAY_OPTIONS} selected={filters.weekdays} onChange={(weekdays) => set({ weekdays })} />
        <MultiSelect label="Month of year" allLabel="Every month" options={MONTH_OPTIONS} selected={filters.months} onChange={(months) => set({ months })} />
        <MultiSelect label="Hour" allLabel="Every hour" options={HOUR_OPTIONS} selected={filters.hours} onChange={(hours) => set({ hours })} />
        <label className="flex flex-col gap-1 text-xs" style={{color:"var(--ink-2)"}}>Direction
          <select className="input" value={filters.direction || ""} onChange={(e) => set({ direction: e.target.value || undefined })}>
            <option value="">Buy + Sell</option><option value="Buy">Buy</option><option value="Sell">Sell</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{color:"var(--ink-2)"}}>From
          <input type="date" className="input" value={filters.from || ""} onChange={(e) => set({ from: e.target.value || undefined })} />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{color:"var(--ink-2)"}}>To
          <input type="date" className="input" value={filters.to || ""} onChange={(e) => set({ to: e.target.value || undefined })} />
        </label>
        <button className="btn-ghost" disabled={!hasFilters} onClick={() => setFilters(EMPTY)}>Clear all</button>
      </div>
      {filterBatch ? <div className="mt-3 flex items-center gap-2 text-xs" style={{color:"var(--ink-2)"}}>
        <span className="rounded-md px-2 py-1" style={{border:"1px solid var(--s1)"}}>
          Only batch {filterBatch.created_at.slice(0, 16)} ({filterBatch.symbol})
          <button className="ml-2" aria-label="remove batch filter" onClick={() => set({ backtestId: undefined })}>×</button>
        </span>
      </div> : null}
    </div>

    {summary ? <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <KpiCard label="Test trades" value={String(summary.totalTrades)} sub={`${summary.activeDays} days · ${fmtNum(summary.avgTradesPerDay, 1)}/day`} />
        <KpiCard label="Win rate" value={`${fmtNum(summary.winRate, 1)}%`} sub={`${summary.wins}W / ${summary.losses}L${summary.breakEvens ? ` / ${summary.breakEvens}BE` : ""}`} />
        <KpiCard label="Net result" value={fmtR(summary.netProfit, 0)} valueColor={profitColor(summary.netProfit)} sub="+1R per win, -1R per loss" />
        <KpiCard label="Expectancy" value={fmtR(summary.expectancy)} sub="per trade" />
        <KpiCard label="Profit factor" value={summary.profitFactor === null ? "-" : fmtNum(summary.profitFactor, 2)} sub="wins / losses" />
        <KpiCard label="Max drawdown" value={summary.maxDrawdown ? `-${fmtNum(summary.maxDrawdown, 0)}R` : "0R"} valueColor={summary.maxDrawdown ? "var(--bad-text)" : undefined} sub="peak to trough" />
        <KpiCard label="Max consecutive wins" value={String(summary.longestWinStreak)} valueColor={summary.longestWinStreak ? "var(--good-text)" : undefined} />
        <KpiCard label="Max consecutive losses" value={String(summary.longestLossStreak)} valueColor={summary.longestLossStreak ? "var(--bad-text)" : undefined}
          sub={worst ? `${worst.from.slice(0, 10)} → ${worst.to.slice(0, 10)}` : undefined} />
        <KpiCard label="Current streak" value={summary.currentStreak > 0 ? `${summary.currentStreak}W` : summary.currentStreak < 0 ? `${-summary.currentStreak}L` : "-"} />
        <KpiCard label="Avg duration" value={`${fmtNum(avgDuration, 0)} min`} />
      </div>
      <div className="card mt-6 p-4"><h2 className="mb-2 text-sm font-medium">Cumulative result (R)</h2><EquityChart points={points} /></div>
    </> : null}

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
        <th className="px-4 py-2 font-medium">Group</th>
        <th className="px-4 py-2 text-right font-medium">Trades</th>
        <th className="px-4 py-2 text-right font-medium">W / L / BE</th>
        <th className="px-4 py-2 text-right font-medium">Win rate</th>
        <th className="px-4 py-2 text-right font-medium">Net</th>
        <th className="px-4 py-2 text-right font-medium">Expectancy</th>
        <th className="px-4 py-2 text-right font-medium">Profit factor</th>
        <th className="px-4 py-2 text-right font-medium">Max DD</th>
        <th className="px-4 py-2 text-right font-medium">Max cons. wins</th>
        <th className="px-4 py-2 text-right font-medium">Max cons. losses</th>
      </tr></thead>
      <tbody>{groups.map((g) => <tr key={g.key} style={{borderTop:"1px solid var(--border)"}}>
        <td className="px-4 py-2"><span className="flex items-center gap-2">
          {g.color ? <span className="inline-block h-2.5 w-2.5 rounded-full" style={{background:g.color}} /> : null}{g.label}
        </span></td>
        <td className="tnum px-4 py-2 text-right">{g.trades}</td>
        <td className="tnum px-4 py-2 text-right">{g.wins} / {g.losses} / {g.breakEvens}</td>
        <td className="tnum px-4 py-2 text-right">{fmtNum(g.winRate, 1)}%</td>
        <td className="tnum px-4 py-2 text-right" style={{color:profitColor(g.netProfit)}}>{fmtR(g.netProfit, 0)}</td>
        <td className="tnum px-4 py-2 text-right">{fmtR(g.avgProfit)}</td>
        <td className="tnum px-4 py-2 text-right">{g.profitFactor === null ? "-" : fmtNum(g.profitFactor, 2)}</td>
        <td className="tnum px-4 py-2 text-right" style={{color:g.maxDrawdown ? "var(--bad-text)" : undefined}}>{g.maxDrawdown ? `-${fmtNum(g.maxDrawdown, 0)}R` : "0R"}</td>
        <td className="tnum px-4 py-2 text-right">{g.longestWinStreak}</td>
        <td className="tnum px-4 py-2 text-right">{g.longestLossStreak}</td>
      </tr>)}{!groups.length ? <tr><td colSpan={10} className="px-4 py-6 text-center" style={{color:"var(--ink-muted)"}}>No backtest trades match these filters</td></tr> : null}</tbody>
    </table></div>

    <div className="card mt-6 overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="text-left text-xs" style={{color:"var(--ink-muted)"}}>
        <th className="px-3 py-2">Time</th><th>Symbol</th><th>Strategy</th><th>Session</th><th>Trade #</th><th>Type</th><th>Result</th><th>Duration</th><th className="px-3 py-2">Notes</th>
      </tr></thead><tbody>{rows.map((r) => <tr key={r.id} style={{borderTop:"1px solid var(--border)"}}>
        <td className="whitespace-nowrap px-3 py-2">{r.open_time.slice(0,16)}</td><td>{r.symbol}</td><td>{r.strategy_name || "Unassigned"}</td>
        <td className="whitespace-nowrap">{sessionOf(r.open_time).label}</td><td>{r.trade_number}</td><td>{r.type}</td><td>{r.result}</td><td>{r.duration_min} min</td>
        <td className="px-3 py-2"><NotePicker notes={meta.notes} value={r.note_ids || []} disabled={savingRow === r.id} onChange={(ids) => setRowNotes(r, ids)} /></td>
      </tr>)}{!rows.length ? <tr><td colSpan={9} className="px-4 py-6 text-center">{hasFilters ? "No backtest trades match these filters" : "No uploaded backtests"}</td></tr> : null}</tbody>
    </table></div>

    <div className="card mt-6 p-4">
      <h2 className="mb-3 text-sm font-medium" style={{color:"var(--ink-2)"}}>Manage uploads</h2>
      <div className="flex flex-wrap items-end gap-4">
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
        <button className="btn-ghost" disabled={!selectedGroup} onClick={analyseSelected}>Analyse {selected ? "this batch" : "these"}</button>
        <button className="btn-ghost" disabled={!selectedGroup} style={{ color: "var(--bad-text)" }} onClick={removeBatches}>
          {selected || selectedGroup?.allBatches.length === 1 ? "Delete batch" : "Delete all batches"}
        </button>
      </div>
    </div>
  </div>;
}
