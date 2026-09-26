"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartTooltip from "./ChartTooltip";

export interface SignupMonth {
  key: string;
  label: string;
  count: number;
}

/** New users per month (single series, so one color and no legend). */
export default function SignupChart({ months }: { months: SignupMonth[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={months} margin={{ top: 20, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
        <CartesianGrid stroke="var(--grid)" strokeWidth={1} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--axis)" }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip
          cursor={{ fill: "var(--grid)", opacity: 0.4 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const m = payload[0].payload as SignupMonth;
            return <ChartTooltip title={m.label} rows={[{ label: "New users", value: String(m.count), color: "var(--s1)" }]} />;
          }}
        />
        <Bar dataKey="count" fill="var(--s1)" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
          <LabelList dataKey="count" position="top" style={{ fill: "var(--ink-2)", fontSize: 11 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
