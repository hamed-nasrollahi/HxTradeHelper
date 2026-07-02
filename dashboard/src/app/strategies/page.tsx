"use client";

import { useEffect, useState } from "react";
import ErrorBanner from "@/components/ErrorBanner";
import { fmtMoney, fmtNum, getJSON, profitColor, sendJSON } from "@/lib/client";
import { BreakdownGroup, Strategy } from "@/lib/types";

// Fixed categorical slot order from the validated palette
const COLORS = ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"];

interface Draft {
  id: number | null;
  name: string;
  description: string;
  color: string;
}

const EMPTY: Draft = { id: null, name: "", description: "", color: COLORS[0] };

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [stats, setStats] = useState<Map<string, BreakdownGroup>>(new Map());
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    Promise.all([
      getJSON<{ strategies: Strategy[] }>("/api/strategies"),
      getJSON<{ groups: BreakdownGroup[] }>("/api/stats/breakdown?groupBy=strategy"),
    ])
      .then(([s, b]) => {
        setStrategies(s.strategies);
        setStats(new Map(b.groups.map((g) => [g.key, g])));
        setError(null);
      })
      .catch((e) => setError(e.message));
  };

  useEffect(load, []);

  const submit = async () => {
    if (!draft.name.trim()) return;
    try {
      if (draft.id === null) {
        await sendJSON("/api/strategies", "POST", draft);
      } else {
        await sendJSON(`/api/strategies/${draft.id}`, "PUT", draft);
      }
      setDraft(EMPTY);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const remove = async (s: Strategy) => {
    if (!confirm(`Delete strategy "${s.name}"? Its trades become unassigned.`)) return;
    try {
      await sendJSON(`/api/strategies/${s.id}`, "DELETE", {});
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Strategies</h1>
      {error ? <ErrorBanner message={error} /> : null}

      <div className="card mb-6 p-4">
        <h2 className="mb-3 text-sm font-medium" style={{ color: "var(--ink-2)" }}>
          {draft.id === null ? "Add strategy" : `Edit "${draft.name}"`}
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-2)" }}>
            Name
            <input
              className="input"
              value={draft.name}
              placeholder="e.g. London breakout"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="flex min-w-64 flex-1 flex-col gap-1 text-xs" style={{ color: "var(--ink-2)" }}>
            Description
            <input
              className="input"
              value={draft.description}
              placeholder="Entry rules, session, setup..."
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </label>
          <div className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-2)" }}>
            Color
            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  aria-label={`color ${c}`}
                  className="h-6 w-6 rounded-full"
                  style={{
                    background: c,
                    outline: draft.color === c ? "2px solid var(--ink-1)" : "1px solid var(--border)",
                    outlineOffset: 2,
                  }}
                  onClick={() => setDraft({ ...draft, color: c })}
                />
              ))}
            </div>
          </div>
          <button className="btn" onClick={submit}>
            {draft.id === null ? "Add" : "Save"}
          </button>
          {draft.id !== null ? (
            <button className="btn-ghost" onClick={() => setDraft(EMPTY)}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs" style={{ color: "var(--ink-muted)" }}>
              <th className="px-4 py-2 font-medium">Strategy</th>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 text-right font-medium">Trades</th>
              <th className="px-4 py-2 text-right font-medium">Win rate</th>
              <th className="px-4 py-2 text-right font-medium">Net P/L</th>
              <th className="px-4 py-2 text-right font-medium">Avg P/L</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {strategies.map((s) => {
              const g = stats.get(`s${s.id}`);
              return (
                <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                      {s.name}
                    </span>
                  </td>
                  <td className="px-4 py-2" style={{ color: "var(--ink-2)" }}>
                    {s.description || "-"}
                  </td>
                  <td className="tnum px-4 py-2 text-right">{g?.trades ?? 0}</td>
                  <td className="tnum px-4 py-2 text-right">{g ? `${fmtNum(g.winRate, 1)}%` : "-"}</td>
                  <td className="tnum px-4 py-2 text-right" style={{ color: profitColor(g?.netProfit ?? 0) }}>
                    {g ? fmtMoney(g.netProfit) : "-"}
                  </td>
                  <td className="tnum px-4 py-2 text-right">{g ? fmtMoney(g.avgProfit) : "-"}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      className="btn-ghost mr-2"
                      onClick={() =>
                        setDraft({ id: s.id, name: s.name, description: s.description || "", color: s.color })
                      }
                    >
                      Edit
                    </button>
                    <button className="btn-ghost" style={{ color: "var(--bad-text)" }} onClick={() => remove(s)}>
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {strategies.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center" colSpan={7} style={{ color: "var(--ink-muted)" }}>
                  No strategies yet - add your first one above, then assign trades on the Trades page.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
