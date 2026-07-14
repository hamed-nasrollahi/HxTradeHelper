"use client";

import { useEffect, useState } from "react";
import Filters from "@/components/Filters";
import ErrorBanner from "@/components/ErrorBanner";
import PnlBarChart from "@/components/charts/PnlBarChart";
import { useMeta } from "@/components/useMeta";
import { filterQuery, fmtMoney, fmtNum, getJSON, profitColor } from "@/lib/client";
import { BreakdownGroup, GroupDimension, TradeFilters } from "@/lib/types";

const DIMENSIONS: { value: GroupDimension; label: string }[] = [
  { value: "strategy", label: "Strategy" },
  { value: "month", label: "Month" },
  { value: "monthOfYear", label: "Month of year" },
  { value: "week", label: "Week" },
  { value: "symbol", label: "Symbol" },
  { value: "weekday", label: "Day of week" },
  { value: "hour", label: "Hour of day" },
  { value: "direction", label: "Direction" },
  { value: "mistake", label: "Mistake" },
];

export default function BreakdownPage() {
  const { meta } = useMeta();
  const [filters, setFilters] = useState<TradeFilters>({});
  const [groupBy, setGroupBy] = useState<GroupDimension>("strategy");
  const [groupBy2, setGroupBy2] = useState<GroupDimension | "">("");
  const [excludeMistakes, setExcludeMistakes] = useState(false);
  const [groups, setGroups] = useState<BreakdownGroup[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const extra: Record<string, string> = { groupBy };
    if (groupBy2) extra.groupBy2 = groupBy2;
    if (excludeMistakes) extra.excludeMistakes = "1";
    getJSON<{ groups: BreakdownGroup[] }>(`/api/stats/breakdown${filterQuery(filters, extra)}`)
      .then((r) => {
        setGroups(r.groups);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [filters, groupBy, groupBy2, excludeMistakes]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Breakdown</h1>
      {error ? <ErrorBanner message={error} /> : null}

      <div className="mb-2 flex flex-wrap items-center gap-2">
        {DIMENSIONS.map((d) => (
          <button
            key={d.value}
            className="rounded-md px-3 py-1.5 text-sm"
            style={{
              background: groupBy === d.value ? "var(--s1)" : "var(--surface-1)",
              color: groupBy === d.value ? "#fff" : "var(--ink-2)",
              border: "1px solid var(--border)",
            }}
            onClick={() => {
              setGroupBy(d.value);
              if (d.value === groupBy2) setGroupBy2("");
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      <label className="mb-2 flex items-center gap-2 text-sm" style={{ color: "var(--ink-2)" }}>
        Then by
        <select
          className="input"
          value={groupBy2}
          onChange={(e) => setGroupBy2(e.target.value as GroupDimension | "")}
        >
          <option value="">None</option>
          {DIMENSIONS.filter((d) => d.value !== groupBy).map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </label>

      <Filters filters={filters} onChange={setFilters} symbols={meta.symbols} accounts={meta.accounts} strategies={meta.strategies} />
      <label className="mb-3 flex items-center gap-2 text-sm" style={{ color: "var(--ink-2)" }}>
        <input
          type="checkbox"
          checked={excludeMistakes}
          onChange={(e) => setExcludeMistakes(e.target.checked)}
        />
        Exclude mistaken trades (entry or exit marked wrong)
      </label>

      <div className="card p-4">
        <h2 className="mb-2 text-sm font-medium" style={{ color: "var(--ink-2)" }}>
          Net P/L by {DIMENSIONS.find((d) => d.value === groupBy)?.label.toLowerCase()}
          {groupBy2 ? `, then ${DIMENSIONS.find((d) => d.value === groupBy2)?.label.toLowerCase()}` : ""}
        </h2>
        <PnlBarChart groups={groups} />
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs" style={{ color: "var(--ink-muted)" }}>
              <th className="px-4 py-2 font-medium">Group</th>
              <th className="px-4 py-2 text-right font-medium">Trades</th>
              <th className="px-4 py-2 text-right font-medium">Win rate</th>
              <th className="px-4 py-2 text-right font-medium">Net P/L</th>
              <th className="px-4 py-2 text-right font-medium">Avg P/L</th>
              <th className="px-4 py-2 text-right font-medium">Profit factor</th>
              <th className="px-4 py-2 text-right font-medium">Biggest win</th>
              <th className="px-4 py-2 text-right font-medium">Biggest loss</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2">
                    {g.color ? (
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: g.color }} />
                    ) : null}
                    {g.label}
                  </span>
                </td>
                <td className="tnum px-4 py-2 text-right">{g.trades}</td>
                <td className="tnum px-4 py-2 text-right">{fmtNum(g.winRate, 1)}%</td>
                <td className="tnum px-4 py-2 text-right" style={{ color: profitColor(g.netProfit) }}>
                  {fmtMoney(g.netProfit)}
                </td>
                <td className="tnum px-4 py-2 text-right">{fmtMoney(g.avgProfit)}</td>
                <td className="tnum px-4 py-2 text-right">{g.profitFactor === null ? "-" : fmtNum(g.profitFactor, 2)}</td>
                <td className="tnum px-4 py-2 text-right" style={{ color: "var(--good-text)" }}>
                  {fmtMoney(g.biggestWin)}
                </td>
                <td className="tnum px-4 py-2 text-right" style={{ color: "var(--bad-text)" }}>
                  {fmtMoney(g.biggestLoss)}
                </td>
              </tr>
            ))}
            {groups.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center" colSpan={8} style={{ color: "var(--ink-muted)" }}>
                  No closed trades in this range
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
