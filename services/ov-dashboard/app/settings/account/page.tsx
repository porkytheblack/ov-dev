"use client";

import { Nav } from "@/components/Nav";

export default function AccountPage() {
  return (
    <>
      <Nav />
      <main className="max-w-md mx-auto px-4 py-6">
        <h1 className="text-[18px] mb-3">Account</h1>
        <div className="card mono text-[12px] text-text-muted">
          Password reset is operator-only via CLI:{" "}
          <span className="text-text">pnpm run reset-password &lt;username&gt;</span>.
        </div>
      </main>
    </>
  );
}
