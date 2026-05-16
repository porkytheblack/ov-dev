"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./Wordmark";

const links = [
  { href: "/", label: "Overview" },
  { href: "/incidents", label: "Incidents" },
  { href: "/calendar", label: "Calendar" },
  { href: "/cameras/new", label: "Add Camera" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const path = usePathname() || "/";
  return (
    <header className="border-b border-border bg-bg sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-8">
        <Link
          href="/"
          className="flex items-center gap-2 shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
        >
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`relative inline-flex items-center h-9 px-3 rounded-md text-[13px] font-medium tracking-[0.01em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] ${
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
        <form action="/api/auth/logout" method="post">
          <button className="btn-ghost" type="submit">
            Sign Out
          </button>
        </form>
      </div>
    </header>
  );
}
