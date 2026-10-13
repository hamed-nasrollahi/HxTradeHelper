"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  /** button text when nothing is picked, e.g. "All symbols" */
  allLabel: string;
}

/** Checkbox dropdown: pick any number of values; none picked means no filter. */
export default function MultiSelect({ label, options, selected, onChange, allLabel }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  const text = !selected.length
    ? allLabel
    : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label || selected[0]
      : `${selected.length} selected`;

  return (
    <div ref={ref} className="relative flex flex-col gap-1 text-xs" style={{ color: "var(--ink-2)" }}>
      {label}
      <button
        type="button"
        className="input max-w-56 truncate text-left"
        style={selected.length ? { borderColor: "var(--s1)" } : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {text}
      </button>
      {open ? (
        <div
          className="card absolute left-0 top-full z-20 mt-1 w-72 p-2 shadow-lg"
          style={{ background: "var(--surface-1)" }}
        >
          {options.length ? (
            <>
              <div className="mb-2 flex items-center gap-3">
                <button className="underline" onClick={() => onChange(options.map((o) => o.value))}>
                  Select all
                </button>
                {selected.length ? (
                  <button className="ml-auto underline" onClick={() => onChange([])}>
                    Clear
                  </button>
                ) : null}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {options.map((o) => (
                  <label key={o.value} className="flex items-start gap-2 rounded px-1 py-1 text-sm" style={{ color: "var(--ink-1)" }}>
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.includes(o.value)}
                      onChange={() => toggle(o.value)}
                    />
                    <span className="break-words">{o.label}</span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <p className="p-1">Nothing to pick yet.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
