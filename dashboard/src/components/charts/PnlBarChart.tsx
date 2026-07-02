"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BreakdownGroup } from "@/lib/types";
import { fmtMoney, fmtNum } from "@/lib/client";
import ChartTooltip from "./ChartTooltip";

/**
 * Net P/L by group. Polarity encoding: diverging pair, blue = profit,
 * red = loss, baseline at zero. Rounded corners sit on the data end of
 * each bar (top for gains, bottom for losses), anchored to the baseline.
 */
export default function PnlBarChart({ groups }: { groups: BreakdownGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm" style={{ color: "var(--ink-muted)" }}>
        No closed trades in this range
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={groups} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barCategoryGap="25%">
        <CartesianGrid stroke="var(--grid)" strokeWidth={1} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--axis)" }}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={12}
        />
        <YAxis
          tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={64}
          tickFormatter={(v: number) => v.toLocaleString("en-US")}
        />
        <ReferenceLine y={0} stroke="var(--axis)" />
        <Tooltip
          cursor={{ fill: "var(--grid)", opacity: 0.4 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const g = payload[0].payload as BreakdownGroup;
            return (
              <ChartTooltip
                title={g.label}
                rows={[
                  {
                    label: "Net P/L",
                    value: fmtMoney(g.netProfit),
                    color: g.netProfit >= 0 ? "var(--pos)" : "var(--neg)",
                  },
                  { label: "Trades", value: String(g.trades) },
                  { label: "Win rate", value: `${fmtNum(g.winRate, 1)}%` },
                  { label: "Avg P/L", value: fmtMoney(g.avgProfit) },
                ]}
              />
            );
          }}
        />
        <Bar dataKey="netProfit" maxBarSize={48} isAnimationActive={false}>
          {groups.map((g) => (
            <Cell
              key={g.key}
              fill={g.netProfit >= 0 ? "var(--pos)" : "var(--neg)"}
              {...({ radius: g.netProfit >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4] } as any)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
