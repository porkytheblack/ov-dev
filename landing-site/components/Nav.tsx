"use client";

import { useEffect, useState } from "react";
import { Wordmark } from "./Wordmark";

const links = [
  { href: "#how", label: "How it works" },
  { href: "#showcase", label: "Showcase" },
  { href: "#features", label: "Features" },
  { href: "#trust", label: "Trust" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-200 ${
        scrolled
          ? "border-b border-border bg-white/85 backdrop-blur-md"
          : "border-b border-transparent"
      }`}
    >
      <nav className="container-ov flex h-16 items-center justify-between">
        <a href="#top" aria-label="Overwatch home">
          <Wordmark size={22} />
        </a>
        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[14px] text-text-muted transition-colors duration-150 hover:text-text"
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="hidden md:flex">
          <a href="#waitlist" className="btn-primary">
            Join the waitlist
          </a>
        </div>
        <button
          className="flex h-10 w-10 items-center justify-center text-text md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d={open ? "M6 6l12 12M18 6L6 18" : "M3 6h18M3 12h18M3 18h18"}
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </nav>
      {open && (
        <div className="border-t border-border bg-white px-5 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-[15px] text-text-muted"
              >
                {l.label}
              </a>
            ))}
            <a
              href="#waitlist"
              onClick={() => setOpen(false)}
              className="btn-primary mt-1"
            >
              Join the waitlist
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
