"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EquityPoint } from "@/lib/types";
import { fmtMoney } from "@/lib/client";
import ChartTooltip from "./ChartTooltip";

export default function EquityChart({ points }: { points: EquityPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm" style={{ color: "var(--ink-muted)" }}>
        No closed trades in this range
      </div>
    );
  }
  const data = points.map((p, i) => ({ ...p, idx: i + 1 }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--s1)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--s1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--grid)" strokeWidth={1} vertical={false} />
        <XAxis
          dataKey="time"
          tickFormatter={(v: string) => v.slice(0, 10)}
          tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--axis)" }}
          tickLine={false}
          minTickGap={48}
        />
        <YAxis
          tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={64}
          tickFormatter={(v: number) => v.toLocaleString("en-US")}
        />
        <Tooltip
          cursor={{ stroke: "var(--axis)", strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as EquityPoint & { idx: number };
            return (
              <ChartTooltip
                title={p.time}
                rows={[
                  { label: "Equity", value: fmtMoney(p.equity), color: "var(--s1)" },
                  { label: `Trade (${p.symbol})`, value: fmtMoney(p.profit) },
                ]}
              />
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="equity"
          stroke="var(--s1)"
          strokeWidth={2}
          fill="url(#equityFill)"
          dot={false}
          activeDot={{ r: 4, stroke: "var(--surface-1)", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
