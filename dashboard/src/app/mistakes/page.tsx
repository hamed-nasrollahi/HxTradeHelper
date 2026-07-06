"use client";

import { useEffect, useState } from "react";
import ErrorBanner from "@/components/ErrorBanner";
import { getJSON, sendJSON } from "@/lib/client";
import { Mistake } from "@/lib/types";

interface Draft {
  id: number | null;
  name: string;
  description: string;
}

const EMPTY: Draft = { id: null, name: "", description: "" };

export default function MistakesPage() {
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    getJSON<{ mistakes: Mistake[] }>("/api/mistakes")
      .then((r) => {
        setMistakes(r.mistakes);
        setError(null);
      })
      .catch((e) => setError(e.message));
  };

  useEffect(load, []);

  const submit = async () => {
    if (!draft.name.trim()) return;
    try {
      if (draft.id === null) {
        await sendJSON("/api/mistakes", "POST", draft);
      } else {
        await sendJSON(`/api/mistakes/${draft.id}`, "PUT", draft);
      }
      setDraft(EMPTY);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const remove = async (m: Mistake) => {
    if (!confirm(`Delete mistake "${m.name}"? Trades tagged with it become untagged.`)) return;
    try {
      await sendJSON(`/api/mistakes/${m.id}`, "DELETE", {});
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Mistakes</h1>
      {error ? <ErrorBanner message={error} /> : null}

      <div className="card mb-6 p-4">
        <h2 className="mb-3 text-sm font-medium" style={{ color: "var(--ink-2)" }}>
          {draft.id === null ? "Add mistake" : `Edit "${draft.name}"`}
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-2)" }}>
            Name
            <input
              className="input"
              value={draft.name}
              placeholder="e.g. Chased entry"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="flex min-w-64 flex-1 flex-col gap-1 text-xs" style={{ color: "var(--ink-2)" }}>
            Description
            <input
              className="input"
              value={draft.description}
              placeholder="What went wrong, when to watch for it..."
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </label>
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
              <th className="px-4 py-2 font-medium">Mistake</th>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 text-right font-medium">Trades</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {mistakes.map((m) => (
              <tr key={m.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-4 py-2 font-medium">{m.name}</td>
                <td className="px-4 py-2" style={{ color: "var(--ink-2)" }}>
                  {m.description || "-"}
                </td>
                <td className="tnum px-4 py-2 text-right">{m.trade_count}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    className="btn-ghost mr-2"
                    onClick={() => setDraft({ id: m.id, name: m.name, description: m.description || "" })}
                  >
                    Edit
                  </button>
                  <button className="btn-ghost" style={{ color: "var(--bad-text)" }} onClick={() => remove(m)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {mistakes.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center" colSpan={4} style={{ color: "var(--ink-muted)" }}>
                  No mistakes yet - add your first one above, then tag trades on the Trades page.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
