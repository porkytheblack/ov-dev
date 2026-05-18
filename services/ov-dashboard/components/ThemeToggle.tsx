"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
const KEY = "ov-theme";

/** Resolve + apply the effective theme to <html data-theme>. */
function apply(t: Theme) {
  const effective =
    t === "system"
      ? window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : t;
  document.documentElement.dataset.theme = effective;
}

const OPTIONS: Array<{ v: Theme; label: string }> = [
  { v: "light", label: "Light" },
  { v: "dark", label: "Dark" },
  { v: "system", label: "Auto" },
];

/**
 * Segmented Light / Dark / Auto control. The actual pre-paint theme is set
 * by the inline script in layout.tsx (no flash); this just lets the
 * operator change + persist it. "Auto" follows the OS setting live.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Theme | null) ?? "system";
    setTheme(saved);
    apply(saved);
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onSys = () => {
      if (((localStorage.getItem(KEY) as Theme | null) ?? "system") === "system")
        apply("system");
    };
    mq.addEventListener("change", onSys);
    return () => mq.removeEventListener("change", onSys);
  }, []);

  function choose(t: Theme) {
    setTheme(t);
    localStorage.setItem(KEY, t);
    apply(t);
  }

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="inline-flex items-center rounded-md border border-border bg-surface-elev p-0.5"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => choose(o.v)}
          aria-pressed={theme === o.v}
          className={`px-3 h-8 rounded text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] ${
            theme === o.v
              ? "bg-accent text-[color:var(--on-accent)]"
              : "text-text-muted hover:text-text"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
