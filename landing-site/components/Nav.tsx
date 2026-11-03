"use client";

import { useEffect, useState } from "react";
import { Wordmark } from "./Wordmark";

const links = [
  ["Services", "#services"],
  ["Scenarios", "#scenarios"],
  ["Capabilities", "#capabilities"],
  ["Process", "#process"],
  ["Security", "#security"],
  ["FAQ", "#faq"],
] as const;

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
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-200 ${
        scrolled || open
          ? "border-border bg-bg/85 backdrop-blur-md"
          : "border-transparent bg-transparent"
      }`}
    >
      <nav className="container-ov flex h-16 items-center justify-between gap-6">
        <a href="#top" aria-label="Overwatch home" className="shrink-0">
          <Wordmark size={22} />
        </a>

        <ul className="hidden items-center gap-7 lg:flex">
          {links.map(([label, href]) => (
            <li key={href}>
              <a
                href={href}
                className="mono text-[12px] uppercase tracking-[0.1em] text-text-muted transition-colors duration-150 hover:text-text"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <a href="#contact" className="btn-primary hidden !h-10 !px-4 !text-[12px] sm:inline-flex">
            Book a site survey
          </a>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center border border-border-strong text-text lg:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.6" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-border bg-bg lg:hidden">
          <ul className="container-ov flex flex-col py-3">
            {links.map(([label, href]) => (
              <li key={href}>
                <a
                  href={href}
                  onClick={() => setOpen(false)}
                  className="mono flex h-12 items-center border-b border-border text-[13px] uppercase tracking-[0.1em] text-text-muted"
                >
                  {label}
                </a>
              </li>
            ))}
            <li className="pt-4">
              <a href="#contact" onClick={() => setOpen(false)} className="btn-primary w-full">
                Book a site survey
              </a>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
