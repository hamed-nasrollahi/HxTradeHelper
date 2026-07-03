"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Login failed");
      }
      const next = params.get("next");
      router.replace(next && next.startsWith("/") ? next : "/");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <form className="card w-80 p-6" onSubmit={submit}>
        <h1 className="mb-1 text-lg font-semibold">HxTradeHelper</h1>
        <p className="mb-5 text-xs" style={{ color: "var(--ink-muted)" }}>
          Sign in to the dashboard
        </p>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-2)" }}>
            Username
            <input
              className="input"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-2)" }}>
            Password
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
        </div>
        <button className="btn mt-5 w-full" type="submit" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
        {error ? (
          <p className="mt-3 text-sm" style={{ color: "var(--bad-text)" }}>
            {error}
          </p>
        ) : null}
        <a
          className="mt-5 block text-center text-xs"
          style={{ color: "var(--ink-muted)" }}
          href="https://github.com/hamed-nasrollahi/HxTradeHelper"
          target="_blank"
          rel="noopener noreferrer"
        >
          github.com/hamed-nasrollahi/HxTradeHelper
        </a>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
