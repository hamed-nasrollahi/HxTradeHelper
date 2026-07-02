"use client";

import { TradeFilters } from "@/lib/types";

interface Props {
  filters: TradeFilters;
  onChange: (f: TradeFilters) => void;
  symbols: string[];
  strategies: { id: number; name: string }[];
}

export default function Filters({ filters, onChange, symbols, strategies }: Props) {
  const set = (patch: Partial<TradeFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-2)" }}>
        From
        <input
          type="date"
          className="input"
          value={filters.from || ""}
          onChange={(e) => set({ from: e.target.value || undefined })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-2)" }}>
        To
        <input
          type="date"
          className="input"
          value={filters.to || ""}
          onChange={(e) => set({ to: e.target.value || undefined })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-2)" }}>
        Symbol
        <select
          className="input"
          value={filters.symbol || ""}
          onChange={(e) => set({ symbol: e.target.value || undefined })}
        >
          <option value="">All symbols</option>
          {symbols.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-2)" }}>
        Strategy
        <select
          className="input"
          value={filters.strategyId || ""}
          onChange={(e) => set({ strategyId: e.target.value || undefined })}
        >
          <option value="">All strategies</option>
          <option value="none">Unassigned</option>
          {strategies.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-2)" }}>
        Direction
        <select
          className="input"
          value={filters.direction || ""}
          onChange={(e) => set({ direction: e.target.value || undefined })}
        >
          <option value="">Buy + Sell</option>
          <option value="Buy">Buy</option>
          <option value="Sell">Sell</option>
        </select>
      </label>
      <button className="btn-ghost" onClick={() => onChange({})}>
        Clear
      </button>
    </div>
  );
}
