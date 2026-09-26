"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard, Field, GoogleButton } from "@/components/AuthCard";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(params.get("error") || "");
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
        if (body?.needsVerification) {
          router.push(`/register?verify=${encodeURIComponent(body.email || user)}`);
          return;
        }
        throw new Error(body?.error || "Login failed");
      }
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <AuthCard title="HxTradeHelper" subtitle="Sign in to the dashboard">
      <form onSubmit={submit}>
        <div className="flex flex-col gap-3">
          <Field
            label="Email or username"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoFocus
            autoComplete="username"
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="mt-2 text-right text-xs">
          <Link
            href={`/forgot-password${user.includes("@") ? `?email=${encodeURIComponent(user)}` : ""}`}
            className="underline"
            style={{ color: "var(--ink-2)" }}
          >
            Forgot password?
          </Link>
        </div>
        <button className="btn mt-4 w-full" type="submit" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
      {error ? (
        <p className="mt-3 text-sm" style={{ color: "var(--bad-text)" }}>
          {error}
        </p>
      ) : null}
      <GoogleButton />
      <p className="mt-4 text-center text-xs" style={{ color: "var(--ink-2)" }}>
        No account?{" "}
        <Link href="/register" className="underline" style={{ color: "var(--s1)" }}>
          Create one
        </Link>
      </p>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
