"use client";

import Link from "next/link";
import { Nav } from "@/components/Nav";

export default function AccountPage() {
  return (
    <>
      <Nav />
      <main className="max-w-md mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link href="/settings" className="text-text-dim text-[13px] hover:text-text transition-colors">
            ← Back to settings
          </Link>
        </div>

        <h1 className="text-[22px] font-semibold mb-1">Account settings</h1>
        <p className="text-text-muted text-[14px] mb-6">Manage your administrator account.</p>

        {/* Password reset info */}
        <div className="card space-y-3">
          <h2 className="label">Password reset</h2>
          <p className="text-[14px] text-text-muted">
            For security, passwords can only be reset via the server CLI. This ensures no
            web-based password change can be triggered by a compromised session.
          </p>
          <div
            className="rounded-md border px-3 py-3"
            style={{ borderColor: "var(--border-strong)", backgroundColor: "var(--surface-elev)" }}
          >
            <p className="label mb-1.5">Run this command on the server</p>
            <code className="mono text-[12px] text-accent break-all">
              pnpm run reset-password &lt;username&gt;
            </code>
          </div>
          <p className="text-text-dim text-[12px]">
            Contact your system administrator if you do not have server access.
          </p>
        </div>
      </main>
    </>
  );
}
