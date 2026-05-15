"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LoginPage />
    </Suspense>
  );
}

function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const initialWizard = params.get("wizard") === "1";
  const [wizard, setWizard] = useState(initialWizard);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // If already signed in, bounce home.
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.user) router.replace("/");
      })
      .catch(() => {});
    // Sync the wizard toggle with the system state so refreshing the page
    // after admin creation drops back to the sign-in form.
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((j) => {
        if (j.initialized) setWizard(false);
        else if (!params.get("wizard")) setWizard(true);
      })
      .catch(() => {});
  }, [router, params]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const endpoint = wizard ? "/api/auth/wizard" : "/api/auth/login";
      const r = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${r.status}`);
      }
      // Hard reload so the SSR root sees the new cookie.
      window.location.href = "/";
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="mb-8 flex items-center gap-2">
          <span className="mono uppercase tracking-[0.12em] text-accent font-semibold text-[15px]">Overwatch</span>
          <span
            aria-hidden="true"
            style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "var(--accent)" }}
          />
        </div>

        <h1 className="text-[22px] font-semibold mb-1">
          {wizard ? "Create admin account" : "Sign in"}
        </h1>
        <p className="text-text-muted text-[13px] mb-6">
          {wizard
            ? "This is a first-boot setup. Set a username and password to secure your dashboard."
            : "Enter your credentials to access the Overwatch dashboard."}
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div className="field">
            <label className="label" htmlFor="username">Username</label>
            <input
              id="username"
              className="input-text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="password">
              {wizard ? "Choose a password" : "Password"}
            </label>
            <input
              id="password"
              className="input-text"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={wizard ? "new-password" : "current-password"}
              minLength={wizard ? 8 : undefined}
            />
            {wizard && (
              <p className="text-text-dim text-[12px]">Must be at least 8 characters.</p>
            )}
          </div>

          {err && (
            <div
              className="px-3 py-2 rounded-md border border-danger text-danger text-[13px]"
              style={{ backgroundColor: "var(--danger-soft)" }}
              role="alert"
            >
              {err}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? (wizard ? "Creating account…" : "Signing in…") : (wizard ? "Create account" : "Sign in")}
          </button>
        </form>

        <div className="mt-5 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setWizard((w) => !w)}
            className="btn-ghost text-[13px] w-full"
          >
            {wizard ? "Already have an account? Sign in" : "First time setup? Create admin account"}
          </button>
        </div>
      </div>
    </main>
  );
}
