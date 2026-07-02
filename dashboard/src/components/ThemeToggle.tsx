"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "hx-theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const initialTheme = getInitialTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const setSelectedTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  };

  return (
    <div
      className="ml-auto flex rounded-md border p-0.5"
      style={{ borderColor: "var(--border)", background: "var(--page)" }}
      aria-label="Theme"
    >
      {(["light", "dark"] as const).map((option) => {
        const selected = theme === option;
        return (
          <button
            key={option}
            type="button"
            className="rounded px-2.5 py-1 text-xs font-medium capitalize"
            style={{
              background: selected ? "var(--surface-1)" : "transparent",
              color: selected ? "var(--ink-1)" : "var(--ink-2)",
              boxShadow: selected ? "0 0 0 1px var(--border)" : "none",
            }}
            aria-pressed={selected}
            onClick={() => setSelectedTheme(option)}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
