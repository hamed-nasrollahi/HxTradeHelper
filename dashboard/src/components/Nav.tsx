"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import { Me } from "./useMe";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/breakdown", label: "Breakdown" },
  { href: "/trades", label: "Trades" },
  { href: "/backtests", label: "Backtests" },
  { href: "/strategies", label: "Strategies" },
  { href: "/mistakes", label: "Mistakes" },
  { href: "/accounts", label: "Accounts" },
  { href: "/settings", label: "Settings" },
];

const ADMIN_LINKS = [
  { href: "/admin", label: "Admin" },
  { href: "/admin/users", label: "Users" },
];

export default function Nav() {
  const pathname = usePathname();
  const authPage = pathname === "/login" || pathname === "/register";
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (authPage) return;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (res) => {
        // Session no longer valid (e.g. the account was disabled)
        if (res.status === 401) {
          const body = await res.json().catch(() => ({}));
          window.location.href = `/login?error=${encodeURIComponent(body?.error || "Please sign in again")}`;
          return;
        }
        if (res.ok) setMe((await res.json()).user);
      })
      .catch(() => {});
  }, [authPage]);

  if (authPage) return null;
  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  };
  return (
    <header className="border-b" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <div className="mx-auto flex max-w-[96rem] items-center gap-1 px-4 py-3">
        <span className="mr-4 text-base font-semibold">HxTradeHelper</span>
        {[...LINKS, ...(me?.isAdmin ? ADMIN_LINKS : [])].map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-1.5 text-sm"
              style={{
                color: active ? "var(--ink-1)" : "var(--ink-2)",
                background: active ? "var(--page)" : "transparent",
                fontWeight: active ? 600 : 400,
              }}
            >
              {l.label}
            </Link>
          );
        })}
        <ThemeToggle />
        {me ? (
          <span className="ml-3 max-w-[14rem] truncate text-xs" style={{ color: "var(--ink-muted)" }} title={me.email || ""}>
            {me.name || me.email || me.username}
          </span>
        ) : null}
        <button onClick={logout} className="rounded-md px-3 py-1.5 text-sm" style={{ color: "var(--ink-2)" }}>
          Logout
        </button>
      </div>
    </header>
  );
}
