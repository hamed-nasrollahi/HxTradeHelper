"use client";

interface Props {
  notes: { id: number; text: string }[];
  value: number[];
  disabled?: boolean;
  onChange: (noteIds: number[]) => void;
}

/** Notes attached to one trade: removable chips plus a picker to add more. */
export default function NotePicker({ notes, value, disabled, onChange }: Props) {
  const byId = new Map(notes.map((n) => [n.id, n.text]));
  const available = notes.filter((n) => !value.includes(n.id));
  return (
    <div className="flex min-w-48 max-w-80 flex-wrap items-center gap-1">
      {value.map((id) => {
        const text = byId.get(id) || `#${id}`;
        return (
          <span
            key={id}
            className="flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs"
            style={{ border: "1px solid var(--border)", background: "var(--page)" }}
            title={text}
          >
            <span className="truncate">{text}</span>
            <button
              aria-label="remove note"
              disabled={disabled}
              style={{ color: "var(--ink-muted)" }}
              onClick={() => onChange(value.filter((v) => v !== id))}
            >
              ×
            </button>
          </span>
        );
      })}
      {available.length ? (
        <select
          className="input max-w-40 py-0.5 text-xs"
          value=""
          disabled={disabled}
          onChange={(e) => e.target.value && onChange([...value, Number(e.target.value)])}
        >
          <option value="">+ Note</option>
          {available.map((n) => (
            <option key={n.id} value={String(n.id)}>
              {n.text.length > 60 ? `${n.text.slice(0, 60)}…` : n.text}
            </option>
          ))}
        </select>
      ) : !notes.length ? (
        <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
          -
        </span>
      ) : null}
    </div>
  );
}
