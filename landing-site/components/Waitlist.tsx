"use client";

import { useState } from "react";
import { Reveal } from "./Reveal";

type State = "idle" | "loading" | "done" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Waitlist() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) {
      setState("error");
      return;
    }
    setState("loading");

    const endpoint = process.env.NEXT_PUBLIC_WAITLIST_ENDPOINT;
    try {
      if (endpoint) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (!res.ok) throw new Error("request failed");
      }
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <section id="waitlist" className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            "radial-gradient(ellipse 60% 70% at 50% 0%, var(--accent-soft), transparent 65%)",
        }}
      />
      <div className="container-ov relative py-28 text-center">
        <Reveal>
          <span className="eyebrow justify-center">Early access</span>
        </Reveal>
        <Reveal delay={60}>
          <h2 className="mx-auto mt-4 max-w-3xl text-[clamp(2.1rem,5vw,3.4rem)] font-medium leading-[1.06] tracking-[-0.025em]">
            Be first to deploy.
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <p className="lead mx-auto mt-5 max-w-xl">
            We&apos;re onboarding a limited group before launch. Join the
            waitlist and we&apos;ll reach out when your spot opens.
          </p>
        </Reveal>

        <Reveal delay={180}>
          <div className="mx-auto mt-10 max-w-md">
            {state === "done" ? (
              <div className="card flex items-center justify-center gap-3 p-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-accent">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 13l4 4 10-12"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <p className="text-[15px] text-text">
                  You&apos;re on the list. We&apos;ll be in touch when your spot
                  opens.
                </p>
              </div>
            ) : (
              <form
                onSubmit={submit}
                noValidate
                className="flex flex-col gap-3 sm:flex-row"
              >
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (state === "error") setState("idle");
                  }}
                  aria-label="Email address"
                  aria-invalid={state === "error"}
                  className="h-12 flex-1 rounded-full border border-border-strong bg-surface px-5 text-[15px] text-text outline-none transition-colors duration-150 placeholder:text-text-dim focus:border-accent focus:ring-2 focus:ring-[color:var(--ring)]"
                />
                <button
                  type="submit"
                  disabled={state === "loading"}
                  className="btn-primary disabled:opacity-60"
                >
                  {state === "loading" ? "Joining…" : "Join the waitlist"}
                </button>
              </form>
            )}

            <p
              className={`mt-3 text-[13px] ${
                state === "error" ? "text-danger" : "text-text-dim"
              }`}
            >
              {state === "error"
                ? "Enter a valid email address."
                : "One email about early access. No spam, never shared."}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
