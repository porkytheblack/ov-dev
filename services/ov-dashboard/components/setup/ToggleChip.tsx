"use client";

import type { ReactNode } from "react";

/**
 * One DS-compliant pill toggle. Active state matches the app's accent
 * language: `border-accent text-accent bg-[color:var(--accent-soft)]`.
 * Replaces the four hand-rolled inline-styled toggle groups in the old
 * single-page setup.
 */
export function ToggleChip({
  active,
  onClick,
  children,
  mono = false,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center justify-center min-h-8 px-3 rounded-md border text-[11px] whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] ${
        mono ? "mono" : ""
      } ${
        active
          ? "border-accent text-accent bg-[color:var(--accent-soft)]"
          : "border-border-strong text-text-muted hover:text-text hover:bg-surface-elev"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/** Thin layout wrapper for a row/wrap of ToggleChips. */
export function ToggleGroup({
  children,
  wrap = false,
}: {
  children: ReactNode;
  wrap?: boolean;
}) {
  return (
    <div className={`flex gap-1.5 ${wrap ? "flex-wrap" : ""}`}>{children}</div>
  );
}
