"use client";

import { useEffect, useState } from "react";
import ErrorBanner from "@/components/ErrorBanner";
import { getJSON, sendJSON } from "@/lib/client";
import { AccountVisibility } from "@/lib/types";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountVisibility[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    getJSON<{ accounts: AccountVisibility[] }>("/api/accounts")
      .then((r) => {
        setAccounts(r.accounts);
        setError(null);
      })
      .catch((e) => setError(e.message));
  };

  useEffect(load, []);

  const toggle = async (a: AccountVisibility) => {
    const visible = a.visible ? 0 : 1;
    setAccounts((prev) => prev.map((x) => (x.account === a.account ? { ...x, visible } : x)));
    try {
      await sendJSON(`/api/accounts/${a.account}`, "PUT", { visible: !!visible });
    } catch (e: any) {
      setError(e.message);
      load();
    }
  };

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Accounts</h1>
      <p className="mb-4 text-sm" style={{ color: "var(--ink-2)" }}>
        Choose which accounts show up in the account dropdown and filters elsewhere in the dashboard.
        Hidden accounts keep their trade history - they just stay out of the picker.
      </p>
      {error ? <ErrorBanner message={error} /> : null}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs" style={{ color: "var(--ink-muted)" }}>
              <th className="px-4 py-2 font-medium">Account</th>
              <th className="px-4 py-2 font-medium">Visible in dropdown</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.account} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-4 py-2 font-medium">{a.account}</td>
                <td className="px-4 py-2" style={{ color: a.visible ? "var(--good-text)" : "var(--ink-muted)" }}>
                  {a.visible ? "Visible" : "Hidden"}
                </td>
                <td className="px-4 py-2 text-right">
                  <button className="btn-ghost" onClick={() => toggle(a)}>
                    {a.visible ? "Hide" : "Show"}
                  </button>
                </td>
              </tr>
            ))}
            {accounts.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center" colSpan={3} style={{ color: "var(--ink-muted)" }}>
                  No accounts found yet - accounts appear here once trades have synced.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
