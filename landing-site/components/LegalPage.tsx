import { ReactNode } from "react";
import { Wordmark } from "./Wordmark";
import { Footer } from "./Footer";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <>
      <header className="border-b border-border">
        <nav className="container-ov flex h-16 items-center justify-between">
          <a href="/" aria-label="Overwatch home">
            <Wordmark size={22} />
          </a>
          <a
            href="/"
            className="mono inline-flex items-center gap-2 text-[13px] uppercase tracking-[0.06em] text-text-muted transition-colors duration-150 hover:text-text"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 5l-7 7 7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to site
          </a>
        </nav>
      </header>

      <main className="container-ov max-w-[820px] py-16 lg:py-20">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-3 text-[clamp(2rem,5vw,2.8rem)] font-medium tracking-[-0.02em]">
          {title}
        </h1>
        <p className="mono mt-3 text-[13px] text-text-dim">
          Last updated: {updated}
        </p>
        <div className="mt-10 legal">{children}</div>
      </main>

      <Footer />
    </>
  );
}
