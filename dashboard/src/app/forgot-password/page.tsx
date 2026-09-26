"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard, Field } from "@/components/AuthCard";
import { sendJSON } from "@/lib/client";

/** Forgot password: email -> 6-digit code (via Brevo) + new password. */
function ForgotForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [step, setStep] = useState<"email" | "reset">("email");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const requestCode = (e?: FormEvent) => {
    e?.preventDefault();
    run(async () => {
      await sendJSON("/api/auth/forgot", "POST", { email });
      setInfo(`If ${email} has an account, we emailed it a 6-digit code. It expires in 15 minutes.`);
      setStep("reset");
    });
  };

  const reset = (e: FormEvent) => {
    e.preventDefault();
    if (password !== password2) {
      setError("Passwords don't match");
      return;
    }
    run(async () => {
      await sendJSON("/api/auth/reset", "POST", { email, code, password });
      router.replace("/");
      router.refresh();
    });
  };

  return (
    <AuthCard title="Forgot password" subtitle="Reset your HxTradeHelper password">
      {step === "email" ? (
        <form onSubmit={requestCode}>
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
            required
          />
          <button className="btn mt-5 w-full" type="submit" disabled={busy}>
            {busy ? "Sending..." : "Send reset code"}
          </button>
        </form>
      ) : (
        <form onSubmit={reset}>
          <p className="mb-3 text-xs" style={{ color: "var(--ink-2)" }}>
            {info}
          </p>
          <div className="flex flex-col gap-3">
            <Field
              label="Reset code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
            />
            <Field
              label="New password (min. 8 characters)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <Field
              label="Repeat new password"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <button className="btn mt-5 w-full" type="submit" disabled={busy || code.length !== 6 || password.length < 8}>
            {busy ? "Saving..." : "Set new password"}
          </button>
          <div className="mt-3 flex justify-between text-xs">
            <button type="button" className="underline" style={{ color: "var(--s1)" }} onClick={() => requestCode()} disabled={busy}>
              Send a new code
            </button>
            <button type="button" className="underline" style={{ color: "var(--ink-2)" }} onClick={() => setStep("email")}>
              Change email
            </button>
          </div>
        </form>
      )}
      {error ? (
        <p className="mt-3 text-sm" style={{ color: "var(--bad-text)" }}>
          {error}
        </p>
      ) : null}
      <p className="mt-4 text-center text-xs" style={{ color: "var(--ink-2)" }}>
        <Link href="/login" className="underline" style={{ color: "var(--s1)" }}>
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotForm />
    </Suspense>
  );
}
