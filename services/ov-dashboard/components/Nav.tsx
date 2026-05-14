"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./Wordmark";

const links = [
  { href: "/", label: "OVERVIEW" },
  { href: "/incidents", label: "INCIDENTS" },
  { href: "/calendar", label: "CALENDAR" },
  { href: "/cameras/new", label: "ADD CAMERA" },
  { href: "/settings", label: "SETTINGS" },
];

export function Nav() {
  const path = usePathname() || "/";
  return (
    <header className="border-b border-border bg-bg sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 h-12 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2"><Wordmark /></Link>
        <nav className="flex items-center gap-1">
          {links.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`mono uppercase tracking-[0.04em] text-[11px] px-3 h-8 flex items-center border ${
                  active
                    ? "border-accent text-accent"
                    : "border-transparent text-text-muted hover:text-text hover:border-border-strong"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex-1" />
        <form action="/api/auth/logout" method="post">
          <button className="btn" type="submit">SIGN OUT</button>
        </form>
      </div>
    </header>
  );
}
