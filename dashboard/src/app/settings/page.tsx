"use client";

import { useEffect, useState } from "react";
import { getJSON, sendJSON } from "@/lib/client";
import { Me, useMe } from "@/components/useMe";

interface Form {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  importApiKey: string;
}

type Status = { ok: boolean; message: string } | null;

function StatusLine({ status }: { status: Status }) {
  return status ? (
    <p className="mt-3 text-sm" style={{ color: status.ok ? "var(--good-text)" : "var(--bad-text)" }}>
      {status.message}
    </p>
  ) : null;
}

/** Personal API key for the MT5 indicator + password change. */
function AccountCard({ me, setMe }: { me: Me; setMe: (m: Me) => void }) {
  const [showKey, setShowKey] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);

  const act = async (body: Record<string, string>, done: string) => {
    setBusy(true);
    setStatus(null);
    try {
      const r = await sendJSON<{ user: Me }>("/api/auth/me", "POST", body);
      setMe(r.user);
      setStatus({ ok: true, message: done });
      setCurrent("");
      setNext("");
    } catch (e: any) {
      setStatus({ ok: false, message: e.message });
    } finally {
      setBusy(false);
    }
  };

  const regenerate = () => {
    if (confirm("Generate a new API key? The old key stops working immediately - update the indicator's ApiKey input."))
      act({ action: "regenerateKey" }, "New API key generated.");
  };

  return (
    <div className="card mb-6 max-w-xl p-5">
      <h2 className="mb-1 text-sm font-medium">My account</h2>
      <p className="mb-4 text-xs" style={{ color: "var(--ink-muted)" }}>
        Signed in as <strong>{me.name || me.email || me.username}</strong>
        {me.email ? ` (${me.email})` : ""}
        {me.google ? " · Google linked" : ""}
        {me.isAdmin ? " · admin" : ""}
      </p>

      <h3 className="mb-1 text-xs font-medium" style={{ color: "var(--ink-2)" }}>
        Personal API key
      </h3>
      <p className="mb-2 text-xs" style={{ color: "var(--ink-muted)" }}>
        Paste this into the MT5 indicator&apos;s <code>ApiKey</code> input: trades it uploads to{" "}
        <code>/api/import</code> are saved to your account.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-80 font-mono text-xs" readOnly value={showKey ? me.apiKey || "" : "•".repeat(24)} />
        <button className="btn-ghost" onClick={() => setShowKey((v) => !v)}>
          {showKey ? "Hide" : "Show"}
        </button>
        <button
          className="btn-ghost"
          onClick={() => navigator.clipboard?.writeText(me.apiKey || "").then(() => setStatus({ ok: true, message: "Copied." }))}
        >
          Copy
        </button>
        <button className="btn-ghost" onClick={regenerate} disabled={busy}>
          Regenerate
        </button>
      </div>

      {me.envAdmin ? (
        <p className="mt-5 text-xs" style={{ color: "var(--ink-muted)" }}>
          This is the main admin account: its username and password are DASHBOARD_USER / DASHBOARD_PASSWORD in .env.
        </p>
      ) : (
        <>
          <h3 className="mb-2 mt-5 text-xs font-medium" style={{ color: "var(--ink-2)" }}>
            {me.hasPassword ? "Change password" : "Set a password (to also sign in with email)"}
          </h3>
          <div className="flex flex-col gap-3">
            {me.hasPassword ? (
              <input
                className="input w-72"
                type="password"
                placeholder="Current password"
                value={current}
                autoComplete="current-password"
                onChange={(e) => setCurrent(e.target.value)}
              />
            ) : null}
            <input
              className="input w-72"
              type="password"
              placeholder="New password (min. 8 characters)"
              value={next}
              autoComplete="new-password"
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <button
            className="btn mt-3"
            disabled={busy || next.length < 8}
            onClick={() => act({ action: "changePassword", current, next }, "Password updated.")}
          >
            Save password
          </button>
        </>
      )}
      <StatusLine status={status} />
    </div>
  );
}

export default function SettingsPage() {
  const { me, setMe } = useMe();
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Settings</h1>
      {me ? <AccountCard me={me} setMe={setMe} /> : null}
      {me?.isAdmin ? <DatabaseSettings /> : null}
    </div>
  );
}

/** Server-wide settings, admins only. */
function DatabaseSettings() {
  const [form, setForm] = useState<Form>({
    host: "",
    port: "3306",
    database: "",
    user: "",
    password: "",
    importApiKey: "",
  });
  const [hasPassword, setHasPassword] = useState(false);
  const [hasImportKey, setHasImportKey] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getJSON("/api/settings").then((s: any) => {
      setForm({
        host: s.host,
        port: String(s.port),
        database: s.database,
        user: s.user,
        password: "",
        importApiKey: "",
      });
      setHasPassword(s.hasPassword);
      setHasImportKey(s.hasImportKey);
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
      if (form.importApiKey) setHasImportKey(true);
      setForm((f) => ({ ...f, password: "", importApiKey: "" }));
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
      <div className="card max-w-xl p-5">
        <h2 className="mb-1 text-sm font-medium">MariaDB connection (admin)</h2>
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
        <h2 className="mb-1 mt-6 text-sm font-medium">Legacy global import key</h2>
        <p className="mb-4 text-xs" style={{ color: "var(--ink-muted)" }}>
          The key used before multi-user support. Uploads sent with it (in the <code>X-Api-Key</code> header)
          are saved to the main admin account. While it is empty, the indicator endpoints accept uploads
          without a key and save them to the admin - set one to close that. Each user&apos;s personal key
          (above) always works.
        </p>
        <div className="flex flex-col gap-3">
          {field(
            "Import API key",
            "importApiKey",
            "password",
            hasImportKey ? "•••••• (leave empty to keep current)" : "empty = no key required for the admin"
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
