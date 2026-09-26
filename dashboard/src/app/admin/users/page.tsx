"use client";

import { Fragment, useEffect, useState } from "react";
import AdminOnly from "@/components/AdminOnly";
import { getJSON, sendJSON } from "@/lib/client";

interface AdminUser {
  id: number;
  email: string | null;
  username: string | null;
  name: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
  disabled: boolean;
  envAdmin: boolean;
  hasPassword: boolean;
  google: boolean;
  tradeCount: number;
  lastLoginAt: string | null;
  createdAt: string;
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ color, border: "1px solid var(--border)" }}>
      {text}
    </span>
  );
}

function signInMethod(u: AdminUser): string {
  if (u.envAdmin) return ".env admin";
  return [u.hasPassword ? "Password" : null, u.google ? "Google" : null].filter(Boolean).join(" + ") || "-";
}

function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [resetFor, setResetFor] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [emailIt, setEmailIt] = useState(true);

  const load = () =>
    getJSON<{ users: AdminUser[] }>(`/api/admin/users${search ? `?q=${encodeURIComponent(search)}` : ""}`)
      .then((r) => setUsers(r.users))
      .catch((e) => setStatus({ ok: false, message: e.message }));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(), [search]);

  const act = async (u: AdminUser, body: Record<string, unknown>, done: string) => {
    setBusy(u.id);
    setStatus(null);
    try {
      const r = await sendJSON<{ emailed?: boolean }>(`/api/admin/users/${u.id}`, "PATCH", body);
      const mailNote = r.emailed === false ? " (email not sent - Brevo is not configured)" : r.emailed ? " and emailed" : "";
      setStatus({ ok: true, message: `${done}${mailNote}.` });
      setResetFor(null);
      setNewPassword("");
      await load();
    } catch (e: any) {
      setStatus({ ok: false, message: e.message });
    } finally {
      setBusy(null);
    }
  };

  const label = (u: AdminUser) => u.name || u.email || u.username || `#${u.id}`;

  const randomPassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    setNewPassword(Array.from(bytes, (b) => chars[b % chars.length]).join(""));
  };

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Users</h1>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
        }}
      >
        <input className="input w-72" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-ghost" type="submit">
          Search
        </button>
      </form>
      {status ? (
        <p className="mb-3 text-sm" style={{ color: status.ok ? "var(--good-text)" : "var(--bad-text)" }}>
          {status.message}
        </p>
      ) : null}

      <div className="card overflow-x-auto">
        <table className="w-max min-w-full text-sm">
          <thead>
            <tr className="whitespace-nowrap text-left text-xs" style={{ color: "var(--ink-muted)" }}>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Sign-in</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Trades</th>
              <th className="px-3 py-2 font-medium">Joined</th>
              <th className="px-3 py-2 font-medium">Last login</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <Fragment key={u.id}>
                <tr style={{ borderTop: "1px solid var(--border)", opacity: u.disabled ? 0.6 : 1 }}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{label(u)}</div>
                    {label(u) !== (u.email || u.username) ? (
                      <div className="text-xs" style={{ color: "var(--ink-muted)" }}>
                        {u.email || u.username}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs">{signInMethod(u)}</td>
                  <td className="space-x-1 whitespace-nowrap px-3 py-2">
                    {u.disabled ? <Badge text="Disabled" color="var(--bad-text)" /> : null}
                    {u.emailVerified ? (
                      <Badge text="Confirmed" color="var(--good-text)" />
                    ) : (
                      <Badge text="Unconfirmed" color="var(--s3)" />
                    )}
                    {u.isAdmin ? <Badge text="Admin" color="var(--s5)" /> : null}
                  </td>
                  <td className="tnum px-3 py-2 text-right">{u.tradeCount}</td>
                  <td className="tnum whitespace-nowrap px-3 py-2 text-xs">{u.createdAt?.slice(0, 10)}</td>
                  <td className="tnum whitespace-nowrap px-3 py-2 text-xs">
                    {u.lastLoginAt ? u.lastLoginAt.slice(0, 16) : "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex gap-1">
                      {!u.emailVerified ? (
                        <button className="btn-ghost" disabled={busy === u.id} onClick={() => act(u, { action: "confirm" }, `${label(u)} confirmed`)}>
                          Confirm
                        </button>
                      ) : null}
                      {!u.envAdmin ? (
                        u.disabled ? (
                          <button className="btn-ghost" disabled={busy === u.id} onClick={() => act(u, { action: "enable" }, `${label(u)} enabled`)}>
                            Enable
                          </button>
                        ) : (
                          <button
                            className="btn-ghost"
                            disabled={busy === u.id}
                            onClick={() =>
                              confirm(`Disable ${label(u)}? They are signed out and their API key stops working.`) &&
                              act(u, { action: "disable" }, `${label(u)} disabled`)
                            }
                          >
                            Disable
                          </button>
                        )
                      ) : null}
                      {!u.envAdmin ? (
                        <button
                          className="btn-ghost"
                          disabled={busy === u.id}
                          onClick={() => {
                            setResetFor(resetFor === u.id ? null : u.id);
                            setNewPassword("");
                            setEmailIt(!!u.email);
                          }}
                        >
                          Reset password
                        </button>
                      ) : null}
                      {!u.envAdmin ? (
                        <button
                          className="btn-ghost"
                          disabled={busy === u.id}
                          onClick={() =>
                            u.isAdmin
                              ? act(u, { action: "removeAdmin" }, `${label(u)} is no longer an admin`)
                              : confirm(`Make ${label(u)} an admin? Admins can see all users and change server settings.`) &&
                                act(u, { action: "makeAdmin" }, `${label(u)} is now an admin`)
                          }
                        >
                          {u.isAdmin ? "Remove admin" : "Make admin"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
                {resetFor === u.id ? (
                  <tr>
                    <td colSpan={7} className="px-3 pb-3">
                      <form
                        className="flex flex-wrap items-center gap-2 text-sm"
                        onSubmit={(e) => {
                          e.preventDefault();
                          act(u, { action: "resetPassword", password: newPassword, sendEmail: emailIt }, `Password of ${label(u)} reset`);
                        }}
                      >
                        <input
                          className="input w-64 font-mono"
                          placeholder="New password (min. 8 characters)"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <button type="button" className="btn-ghost" onClick={randomPassword}>
                          Generate
                        </button>
                        <label className="flex items-center gap-1 text-xs" style={{ color: "var(--ink-2)" }}>
                          <input type="checkbox" checked={emailIt} disabled={!u.email} onChange={(e) => setEmailIt(e.target.checked)} />
                          Email it to the user
                        </label>
                        <button className="btn" type="submit" disabled={busy === u.id || newPassword.length < 8}>
                          Set password
                        </button>
                        <button type="button" className="btn-ghost" onClick={() => setResetFor(null)}>
                          Cancel
                        </button>
                      </form>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
            {users.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center" colSpan={7} style={{ color: "var(--ink-muted)" }}>
                  No users found
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <AdminOnly>
      <UserManagement />
    </AdminOnly>
  );
}
