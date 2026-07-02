"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/breakdown", label: "Breakdown" },
  { href: "/trades", label: "Trades" },
  { href: "/strategies", label: "Strategies" },
  { href: "/settings", label: "Settings" },
];

export default function Nav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  };
  return (
    <header className="border-b" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-3">
        <span className="mr-4 text-base font-semibold">HxTradeHelper</span>
        {LINKS.map((l) => {
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
        <button onClick={logout} className="rounded-md px-3 py-1.5 text-sm" style={{ color: "var(--ink-2)" }}>
          Logout
        </button>
      </div>
    </header>
  );
}
