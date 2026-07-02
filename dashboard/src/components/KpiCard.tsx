interface Props {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}

export default function KpiCard({ label, value, sub, valueColor }: Props) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs" style={{ color: "var(--ink-muted)" }}>
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold" style={{ color: valueColor || "var(--ink-1)" }}>
        {value}
      </div>
      {sub ? (
        <div className="mt-0.5 text-xs" style={{ color: "var(--ink-2)" }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}
