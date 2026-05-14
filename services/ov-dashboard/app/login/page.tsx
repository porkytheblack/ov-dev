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
    // Discover whether the wizard is still needed.
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        if (j.user) router.replace("/");
      })
      .catch(() => {});
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const endpoint = wizard ? "/api/auth/wizard" : "/api/auth/login";
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${r.status}`);
      }
      router.replace("/");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 mono uppercase tracking-[0.08em] flex items-center gap-2">
          <span>OVERWATCH</span>
          <span style={{ width: 6, height: 6, backgroundColor: "var(--accent)" }} />
        </div>
        <h1 className="text-[18px] mb-4">
          {wizard ? "First-boot setup" : "Sign in"}
        </h1>
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <div className="mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-1">
              USERNAME
            </div>
            <input
              className="input-text w-full"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </label>
          <label className="block">
            <div className="mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-1">
              PASSWORD
            </div>
            <input
              className="input-text w-full"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={wizard ? "new-password" : "current-password"}
              minLength={wizard ? 8 : undefined}
            />
          </label>
          {err && <div className="mono text-[11px] text-danger">{err}</div>}
          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={() => setWizard((w) => !w)}
              className="mono uppercase tracking-[0.04em] text-[11px] text-text-muted hover:text-text"
            >
              {wizard ? "← BACK TO SIGN IN" : "FIRST BOOT? CREATE ADMIN →"}
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {wizard ? "CREATE ADMIN" : "SIGN IN"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
