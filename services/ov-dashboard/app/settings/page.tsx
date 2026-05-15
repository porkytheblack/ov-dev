"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { StatusPill } from "@/components/StatusPill";

export default function SettingsPage() {
  const [subs, setSubs] = useState<any[]>([]);
  const [system, setSystem] = useState<any>(null);
  const [cameras, setCameras] = useState<any[]>([]);
  const [newSub, setNewSub] = useState({ channel: "whatsapp", handle: "", camera_ids: [] as string[] });
  const [err, setErr] = useState<string | null>(null);
  const [subBusy, setSubBusy] = useState(false);

  async function load() {
    const [s, sys, cm] = await Promise.all([
      fetch("/api/subscribers").then((r) => r.json()),
      fetch("/api/system/status").then((r) => r.json()),
      fetch("/api/cameras").then((r) => r.json()),
    ]);
    setSubs(s.subscribers ?? []);
    setSystem(sys);
    setCameras(cm.cameras ?? []);
  }

  useEffect(() => { load(); }, []);

  async function addSub(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubBusy(true);
    const r = await fetch("/api/subscribers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(newSub),
    });
    if (!r.ok) {
      setErr(await r.text());
      setSubBusy(false);
      return;
    }
    setNewSub({ channel: "whatsapp", handle: "", camera_ids: [] });
    setSubBusy(false);
    await load();
  }

  async function removeSub(id: string) {
    await fetch(`/api/subscribers/${id}`, { method: "DELETE" });
    await load();
  }

  const handlePlaceholder = newSub.channel === "whatsapp" ? "+1 234 567 8900" : "Chat ID (e.g. 123456789)";
  const handleHint = newSub.channel === "whatsapp"
    ? "International format with country code, e.g. +1 234 567 8900"
    : "Your Telegram chat ID. Start a chat with @userinfobot to find it.";

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* System status */}
        <section>
          <div className="mb-3">
            <h2 className="text-[17px] font-semibold">System status</h2>
            <p className="text-text-dim text-[13px] mt-0.5">Health of background services</p>
          </div>
          <div className="card p-0">
            {system ? (
              <table className="ov">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(system?.services ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={2} className="text-text-muted text-center py-6">
                        No services reported.
                      </td>
                    </tr>
                  ) : (
                    (system?.services ?? []).map((s: any) => (
                      <tr key={s.name}>
                        <td className="font-medium">{s.name}</td>
                        <td><StatusPill status={s.ok ? "online" : "offline"} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((n) => <div key={n} className="skeleton h-10 w-full" />)}
              </div>
            )}
          </div>
        </section>

        {/* Notification subscribers */}
        <section>
          <div className="mb-3">
            <h2 className="text-[17px] font-semibold">Notification subscribers</h2>
            <p className="text-text-dim text-[13px] mt-0.5">
              People who receive incident alerts via WhatsApp or Telegram
            </p>
          </div>

          {/* Add subscriber form */}
          <form onSubmit={addSub} className="card mb-4">
            <h3 className="label mb-4">Add subscriber</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="field">
                <label className="label" htmlFor="sub-channel">Channel</label>
                <select
                  id="sub-channel"
                  className="input"
                  value={newSub.channel}
                  onChange={(e) => setNewSub({ ...newSub, channel: e.target.value })}
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="telegram">Telegram</option>
                </select>
              </div>
              <div className="field">
                <label className="label" htmlFor="sub-handle">
                  {newSub.channel === "whatsapp" ? "Phone number" : "Chat ID"}
                </label>
                <input
                  id="sub-handle"
                  className="input"
                  value={newSub.handle}
                  onChange={(e) => setNewSub({ ...newSub, handle: e.target.value })}
                  placeholder={handlePlaceholder}
                  required
                />
                <p className="text-text-dim text-[12px]">{handleHint}</p>
              </div>
            </div>
            {err && (
              <div
                className="mt-3 px-3 py-2 rounded-md border border-danger text-danger text-[13px]"
                style={{ backgroundColor: "var(--danger-soft)" }}
                role="alert"
              >
                {err}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button type="submit" className="btn-primary" disabled={subBusy}>
                {subBusy ? "Adding…" : "Add subscriber"}
              </button>
            </div>
          </form>

          {/* Subscribers list */}
          <div className="card p-0">
            <table className="ov">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Contact</th>
                  <th>Cameras</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {subs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-text-muted text-center py-8">
                      No subscribers yet. Add someone above to start sending alerts.
                    </td>
                  </tr>
                ) : (
                  subs.map((s: any) => (
                    <tr key={s.id}>
                      <td className="capitalize">{s.channel}</td>
                      <td className="mono">{s.handle}</td>
                      <td className="text-text-muted">
                        {(s.camera_ids ?? []).length === 0
                          ? "All cameras"
                          : `${(s.camera_ids ?? []).length} camera${(s.camera_ids ?? []).length !== 1 ? "s" : ""}`}
                      </td>
                      <td>
                        <button className="btn-danger" onClick={() => removeSub(s.id)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Account */}
        <section>
          <div className="mb-3">
            <h2 className="text-[17px] font-semibold">Account</h2>
            <p className="text-text-dim text-[13px] mt-0.5">Manage your administrator account</p>
          </div>
          <div className="card flex items-center justify-between gap-4">
            <div>
              <p className="text-[14px]">Change password or manage account settings</p>
              <p className="text-text-dim text-[13px] mt-0.5">
                Password changes require CLI access for security.
              </p>
            </div>
            <Link href="/settings/account" className="btn shrink-0">Account settings</Link>
          </div>
        </section>
      </main>
    </>
  );
}
