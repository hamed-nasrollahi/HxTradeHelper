"use client";

import { useEffect, useState } from "react";
import ErrorBanner from "@/components/ErrorBanner";
import { getJSON, sendJSON } from "@/lib/client";
import { Note } from "@/lib/types";

interface Draft {
  id: number | null;
  text: string;
}

const EMPTY: Draft = { id: null, text: "" };

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    getJSON<{ notes: Note[] }>("/api/notes")
      .then((r) => {
        setNotes(r.notes);
        setError(null);
      })
      .catch((e) => setError(e.message));
  };

  useEffect(load, []);

  const submit = async () => {
    if (!draft.text.trim()) return;
    try {
      if (draft.id === null) {
        await sendJSON("/api/notes", "POST", draft);
      } else {
        await sendJSON(`/api/notes/${draft.id}`, "PUT", draft);
      }
      setDraft(EMPTY);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const remove = async (n: Note) => {
    const used = Number(n.trade_count) + Number(n.backtest_count);
    if (!confirm(`Delete this note?${used ? ` It is removed from ${used} trade(s).` : ""}`)) return;
    try {
      await sendJSON(`/api/notes/${n.id}`, "DELETE", {});
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Notes</h1>
      {error ? <ErrorBanner message={error} /> : null}

      <div className="card mb-6 p-4">
        <h2 className="mb-3 text-sm font-medium" style={{ color: "var(--ink-2)" }}>
          {draft.id === null ? "Add note" : "Edit note"}
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <textarea
            className="input min-h-[4.5rem] min-w-64 flex-1"
            value={draft.text}
            placeholder="e.g. Entered before the 4H candle closed"
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
            }}
          />
          <button className="btn" onClick={submit}>
            {draft.id === null ? "Add" : "Save"}
          </button>
          {draft.id !== null ? (
            <button className="btn-ghost" onClick={() => setDraft(EMPTY)}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs" style={{ color: "var(--ink-muted)" }}>
              <th className="px-4 py-2 font-medium">Note</th>
              <th className="px-4 py-2 text-right font-medium">Trades</th>
              <th className="px-4 py-2 text-right font-medium">Backtest trades</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {notes.map((n) => (
              <tr key={n.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="whitespace-pre-wrap break-words px-4 py-2">{n.text}</td>
                <td className="tnum px-4 py-2 text-right">{n.trade_count}</td>
                <td className="tnum px-4 py-2 text-right">{n.backtest_count}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right">
                  <button className="btn-ghost mr-2" onClick={() => setDraft({ id: n.id, text: n.text })}>
                    Edit
                  </button>
                  <button className="btn-ghost" style={{ color: "var(--bad-text)" }} onClick={() => remove(n)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {notes.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center" colSpan={4} style={{ color: "var(--ink-muted)" }}>
                  No notes yet - add your first one above, then attach notes on the Trades and Backtests pages.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
