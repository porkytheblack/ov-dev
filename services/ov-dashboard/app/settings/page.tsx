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
    const r = await fetch("/api/subscribers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(newSub),
    });
    if (!r.ok) {
      setErr(await r.text());
      return;
    }
    setNewSub({ channel: "whatsapp", handle: "", camera_ids: [] });
    await load();
  }

  async function removeSub(id: string) {
    await fetch(`/api/subscribers/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <section>
          <h2 className="mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-2">SYSTEM STATUS</h2>
          <div className="card p-0">
            <table className="ov">
              <thead><tr><th>SERVICE</th><th>STATUS</th></tr></thead>
              <tbody>
                {(system?.services ?? []).map((s: any) => (
                  <tr key={s.name}>
                    <td className="mono">{s.name}</td>
                    <td><StatusPill status={s.ok ? "online" : "offline"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-2">SUBSCRIBERS</h2>
          <form onSubmit={addSub} className="card flex flex-wrap items-end gap-2 mb-3">
            <label className="block">
              <div className="mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-1">CHANNEL</div>
              <select
                className="input"
                value={newSub.channel}
                onChange={(e) => setNewSub({ ...newSub, channel: e.target.value })}
              >
                <option value="whatsapp">whatsapp</option>
                <option value="telegram">telegram</option>
              </select>
            </label>
            <label className="block flex-1 min-w-[200px]">
              <div className="mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-1">
                HANDLE ({newSub.channel === "whatsapp" ? "+E.164" : "TG chat id"})
              </div>
              <input
                className="input w-full"
                value={newSub.handle}
                onChange={(e) => setNewSub({ ...newSub, handle: e.target.value })}
                required
              />
            </label>
            <button type="submit" className="btn-primary">ADD</button>
            {err && <div className="mono text-[11px] text-danger">{err}</div>}
          </form>
          <div className="card p-0">
            <table className="ov">
              <thead><tr><th>CHANNEL</th><th>HANDLE</th><th>CAMERAS</th><th /></tr></thead>
              <tbody>
                {subs.length === 0 && <tr><td colSpan={4} className="text-text-muted">None.</td></tr>}
                {subs.map((s: any) => (
                  <tr key={s.id}>
                    <td className="mono">{s.channel}</td>
                    <td className="mono">{s.handle}</td>
                    <td className="mono">{(s.camera_ids ?? []).length === 0 ? "all" : `${(s.camera_ids ?? []).length} selected`}</td>
                    <td><button className="btn" onClick={() => removeSub(s.id)}>REMOVE</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <Link href="/settings/account" className="btn">CHANGE PASSWORD →</Link>
        </section>
      </main>
    </>
  );
}
