"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./Wordmark";
import { ThemeToggle } from "./ThemeToggle";

const links = [
  { href: "/", label: "Overview" },
  { href: "/incidents", label: "Incidents" },
  { href: "/calendar", label: "Calendar" },
  { href: "/cameras/new", label: "Add Camera" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const path = usePathname() || "/";
  const [open, setOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [path]);

  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  return (
    <header className="border-b border-border bg-bg sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4 sm:gap-8">
        <Link
          href="/"
          className="flex items-center gap-2 shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
        >
          <Wordmark />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`relative inline-flex items-center h-10 px-3 rounded-md text-[14px] font-medium tracking-[0.01em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] ${
                  active
                    ? "text-accent bg-[color:var(--accent-soft)]"
                    : "text-text-muted hover:text-text hover:bg-surface-elev"
                }`}
              >
                {l.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          <form action="/api/auth/logout" method="post">
            <button className="btn-ghost" type="submit">
              Sign Out
            </button>
          </form>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center h-10 w-10 -mr-2 rounded-md text-text-muted hover:text-text hover:bg-surface-elev focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {open ? (
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile dropdown panel — large tap targets */}
      {open && (
        <div className="md:hidden border-t border-border bg-bg">
          <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
            {links.map((l) => {
              const active = isActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center h-12 px-3 rounded-md text-[16px] font-medium transition-colors ${
                    active
                      ? "text-accent bg-[color:var(--accent-soft)]"
                      : "text-text hover:bg-surface-elev"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
            <div className="flex items-center justify-between gap-3 pt-3 mt-2 border-t border-border">
              <ThemeToggle />
              <form action="/api/auth/logout" method="post">
                <button className="btn-ghost" type="submit">
                  Sign Out
                </button>
              </form>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
