"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard, Field, GoogleButton } from "@/components/AuthCard";
import { sendJSON } from "@/lib/client";

/**
 * Sign-up in two steps: name/email/password, then the 6-digit code emailed
 * via Brevo. /register?verify=<email> jumps straight to the code step
 * (used when an unconfirmed user tries to sign in).
 */
function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(params.get("verify") || "");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"details" | "code">(params.get("verify") ? "code" : "details");
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

  const sentMessage = (sent: boolean) =>
    sent
      ? `We emailed a 6-digit code to ${email}. It expires in 15 minutes.`
      : "Email delivery isn't set up on this server - ask the administrator to confirm your account.";

  const register = (e: FormEvent) => {
    e.preventDefault();
    if (password !== password2) {
      setError("Passwords don't match");
      return;
    }
    run(async () => {
      const r = await sendJSON<{ sent: boolean }>("/api/auth/register", "POST", { name, email, password });
      setInfo(sentMessage(r.sent));
      setStep("code");
    });
  };

  const verify = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await sendJSON("/api/auth/verify", "POST", { email, code });
      router.replace("/");
      router.refresh();
    });
  };

  const resend = () =>
    run(async () => {
      const r = await sendJSON<{ sent: boolean }>("/api/auth/resend", "POST", { email });
      setInfo(sentMessage(r.sent));
    });

  return (
    <AuthCard
      title="Create account"
      subtitle={step === "details" ? "Sign up for HxTradeHelper" : "Confirm your email address"}
    >
      {step === "details" ? (
        <form onSubmit={register}>
          <div className="flex flex-col gap-3">
            <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus />
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <Field
              label="Password (min. 8 characters)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <Field
              label="Repeat password"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <button className="btn mt-5 w-full" type="submit" disabled={busy}>
            {busy ? "Creating account..." : "Create account"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify}>
          <p className="mb-3 text-xs" style={{ color: "var(--ink-2)" }}>
            {info || `Enter the 6-digit code we emailed to ${email}.`}
          </p>
          <div className="flex flex-col gap-3">
            <Field
              label="Confirmation code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
            />
          </div>
          <button className="btn mt-5 w-full" type="submit" disabled={busy || code.length !== 6}>
            {busy ? "Checking..." : "Confirm"}
          </button>
          <div className="mt-3 flex justify-between text-xs">
            <button type="button" className="underline" style={{ color: "var(--s1)" }} onClick={resend} disabled={busy}>
              Send a new code
            </button>
            <button
              type="button"
              className="underline"
              style={{ color: "var(--ink-2)" }}
              onClick={() => {
                setStep("details");
                setInfo("");
                setError("");
              }}
            >
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
      {step === "details" ? <GoogleButton /> : null}
      <p className="mt-4 text-center text-xs" style={{ color: "var(--ink-2)" }}>
        Already have an account?{" "}
        <Link href="/login" className="underline" style={{ color: "var(--s1)" }}>
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
