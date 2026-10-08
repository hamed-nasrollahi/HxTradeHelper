"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  notes: { id: number; text: string }[];
  noteIds?: string; // comma-separated
  noteMatch?: string; // "all" | undefined (= any)
  onChange: (patch: { noteIds?: string; noteMatch?: string }) => void;
}

/** Multi-select note filter: trades with any (or all) of the checked notes. */
export default function NoteFilter({ notes, noteIds, noteMatch, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = (noteIds || "").split(",").filter(Boolean).map(Number);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = (id: number) => {
    const next = selected.includes(id) ? selected.filter((v) => v !== id) : [...selected, id];
    onChange({ noteIds: next.length ? next.join(",") : undefined, noteMatch: next.length ? noteMatch : undefined });
  };

  const label = !selected.length
    ? "All trades"
    : selected.length === 1
      ? notes.find((n) => n.id === selected[0])?.text || "1 note"
      : `${selected.length} notes (${noteMatch === "all" ? "all" : "any"})`;

  return (
    <div ref={ref} className="relative flex flex-col gap-1 text-xs" style={{ color: "var(--ink-2)" }}>
      Notes
      <button type="button" className="input max-w-56 truncate text-left" onClick={() => setOpen((o) => !o)}>
        {label}
      </button>
      {open ? (
        <div
          className="card absolute left-0 top-full z-20 mt-1 w-80 p-2 shadow-lg"
          style={{ background: "var(--surface-1)" }}
        >
          {notes.length ? (
            <>
              <div className="mb-2 flex items-center gap-3">
                <span>Match</span>
                {(["any", "all"] as const).map((m) => (
                  <label key={m} className="flex items-center gap-1">
                    <input
                      type="radio"
                      checked={(noteMatch === "all" ? "all" : "any") === m}
                      onChange={() => onChange({ noteIds, noteMatch: m === "all" ? "all" : undefined })}
                    />
                    {m === "any" ? "Any selected" : "All selected"}
                  </label>
                ))}
                {selected.length ? (
                  <button
                    className="ml-auto underline"
                    onClick={() => onChange({ noteIds: undefined, noteMatch: undefined })}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notes.map((n) => (
                  <label key={n.id} className="flex items-start gap-2 rounded px-1 py-1 text-sm" style={{ color: "var(--ink-1)" }}>
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.includes(n.id)}
                      onChange={() => toggle(n.id)}
                    />
                    <span className="break-words">{n.text}</span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <p className="p-1">No notes yet - add some on the Notes page.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
