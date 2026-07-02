import Link from "next/link";

export default function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="mb-4 rounded-lg px-4 py-3 text-sm"
      style={{ background: "var(--surface-1)", border: "1px solid var(--neg)", color: "var(--ink-1)" }}
    >
      <span className="font-medium">Database error:</span> {message}{" "}
      <Link href="/settings" className="underline" style={{ color: "var(--s1)" }}>
        Check connection settings
      </Link>
    </div>
  );
}
