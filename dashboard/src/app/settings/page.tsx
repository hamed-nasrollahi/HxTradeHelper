"use client";

import { useEffect, useState } from "react";
import { getJSON, sendJSON } from "@/lib/client";

interface Form {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
}

export default function SettingsPage() {
  const [form, setForm] = useState<Form>({ host: "", port: "3306", database: "", user: "", password: "" });
  const [hasPassword, setHasPassword] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getJSON("/api/settings").then((s: any) => {
      setForm({ host: s.host, port: String(s.port), database: s.database, user: s.user, password: "" });
      setHasPassword(s.hasPassword);
    });
  }, []);

  const test = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const r = await sendJSON<{ ok: boolean; message: string }>("/api/settings/test", "POST", form);
      setStatus(r);
    } catch (e: any) {
      setStatus({ ok: false, message: e.message });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await sendJSON("/api/settings", "PUT", form);
      setStatus({ ok: true, message: "Settings saved." });
      if (form.password) setHasPassword(true);
      setForm((f) => ({ ...f, password: "" }));
    } catch (e: any) {
      setStatus({ ok: false, message: e.message });
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, key: keyof Form, type = "text", placeholder = "") => (
    <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-2)" }}>
      {label}
      <input
        className="input w-72"
        type={type}
        value={form[key]}
        placeholder={placeholder}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </label>
  );

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Settings</h1>
      <div className="card max-w-xl p-5">
        <h2 className="mb-1 text-sm font-medium">MariaDB connection</h2>
        <p className="mb-4 text-xs" style={{ color: "var(--ink-muted)" }}>
          Credentials are stored server-side in the dashboard&apos;s data volume, never in the browser.
        </p>
        <div className="flex flex-col gap-3">
          {field("Host", "host")}
          {field("Port", "port")}
          {field("Database", "database")}
          {field("Username", "user")}
          {field(
            "Password",
            "password",
            "password",
            hasPassword ? "•••••• (leave empty to keep current)" : ""
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <button className="btn-ghost" onClick={test} disabled={busy}>
            Test connection
          </button>
          <button className="btn" onClick={save} disabled={busy}>
            Save
          </button>
        </div>
        {status ? (
          <p className="mt-3 text-sm" style={{ color: status.ok ? "var(--good-text)" : "var(--bad-text)" }}>
            {status.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
