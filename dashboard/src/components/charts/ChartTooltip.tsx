"use client";

export default function ChartTooltip({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; color?: string }[];
}) {
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-sm"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--ink-1)" }}
    >
      <div className="mb-1 font-medium">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          {r.color ? (
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />
          ) : null}
          <span style={{ color: "var(--ink-2)" }}>{r.label}</span>
          <span className="tnum ml-auto font-medium">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
