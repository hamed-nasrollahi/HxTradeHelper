"use client";

import { useEffect, useState } from "react";
import AdminOnly from "@/components/AdminOnly";
import KpiCard from "@/components/KpiCard";
import SignupChart, { SignupMonth } from "@/components/charts/SignupChart";
import { fmtMoney, fmtNum, getJSON, profitColor } from "@/lib/client";

interface Ranked {
  id: number;
  name: string;
  email: string | null;
  netProfit: number;
  trades: number;
  winRate: number | null;
}

interface AdminStats {
  counts: { total: number; verified: number; unverified: number; disabled: number; active30d: number };
  signups: SignupMonth[];
  gainers: Ranked[];
  losers: Ranked[];
}

const PERIODS = [
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
  { value: "all", label: "All time" },
];

function RankTable({ title, rows, empty }: { title: string; rows: Ranked[]; empty: string }) {
  return (
    <div className="card overflow-x-auto">
      <h2 className="px-4 pt-3 text-sm font-medium" style={{ color: "var(--ink-2)" }}>
        {title}
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs" style={{ color: "var(--ink-muted)" }}>
            <th className="px-4 py-2 font-medium">#</th>
            <th className="px-4 py-2 font-medium">User</th>
            <th className="px-4 py-2 text-right font-medium">Trades</th>
            <th className="px-4 py-2 text-right font-medium">Win rate</th>
            <th className="px-4 py-2 text-right font-medium">Net P/L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
              <td className="tnum px-4 py-2" style={{ color: "var(--ink-muted)" }}>
                {i + 1}
              </td>
              <td className="px-4 py-2">
                <div>{r.name}</div>
                {r.email && r.email !== r.name ? (
                  <div className="text-xs" style={{ color: "var(--ink-muted)" }}>
                    {r.email}
                  </div>
                ) : null}
              </td>
              <td className="tnum px-4 py-2 text-right">{r.trades}</td>
              <td className="tnum px-4 py-2 text-right">{r.winRate === null ? "-" : `${fmtNum(r.winRate, 1)}%`}</td>
              <td className="tnum px-4 py-2 text-right font-medium" style={{ color: profitColor(r.netProfit) }}>
                {fmtMoney(r.netProfit)}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-center" colSpan={5} style={{ color: "var(--ink-muted)" }}>
                {empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function AdminDashboard() {
  const [period, setPeriod] = useState("30d");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJSON<AdminStats>(`/api/admin/stats?period=${period}`)
      .then((s) => {
        setStats(s);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [period]);

  const c = stats?.counts;
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Admin dashboard</h1>
      {error ? (
        <p className="mb-4 text-sm" style={{ color: "var(--bad-text)" }}>
          {error}
        </p>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Total users" value={c ? String(c.total) : "-"} />
        <KpiCard label="Confirmed" value={c ? String(c.verified) : "-"} />
        <KpiCard label="Awaiting confirmation" value={c ? String(c.unverified) : "-"} />
        <KpiCard label="Disabled" value={c ? String(c.disabled) : "-"} />
        <KpiCard label="Active (30 days)" value={c ? String(c.active30d) : "-"} sub="signed in or uploaded trades" />
      </div>

      <div className="card mb-6 p-4">
        <h2 className="mb-2 text-sm font-medium" style={{ color: "var(--ink-2)" }}>
          New users per month (last 6 months)
        </h2>
        {stats ? <SignupChart months={stats.signups} /> : <div className="h-60" />}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--ink-2)" }}>
        Ranking period:
        {PERIODS.map((p) => (
          <button
            key={p.value}
            className="rounded-md px-3 py-1.5 text-sm"
            style={{
              background: period === p.value ? "var(--s1)" : "var(--surface-1)",
              color: period === p.value ? "#fff" : "var(--ink-2)",
              border: "1px solid var(--border)",
            }}
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </button>
        ))}
        <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
          net P/L of closed trades
        </span>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <RankTable title="Top 10 gainers" rows={stats?.gainers || []} empty="No profitable users in this period" />
        <RankTable title="Top 10 losers" rows={stats?.losers || []} empty="No losing users in this period" />
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminOnly>
      <AdminDashboard />
    </AdminOnly>
  );
}
