"use client";

import { useMe } from "./useMe";

/** Renders children only for admins (the APIs enforce this too). */
export default function AdminOnly({ children }: { children: React.ReactNode }) {
  const { me, loaded } = useMe();
  if (!loaded) return null;
  if (!me?.isAdmin) {
    return (
      <div className="card p-6 text-sm" style={{ color: "var(--ink-2)" }}>
        Not authorised - this page is for administrators.
      </div>
    );
  }
  return <>{children}</>;
}
