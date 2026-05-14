"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { StatusPill } from "@/components/StatusPill";
import { formatTime } from "@/lib/format";

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    const q = status ? `?status=${status}&limit=100` : "?limit=100";
    fetch("/api/incidents" + q)
      .then((r) => r.json())
      .then((j) => setIncidents(j.incidents ?? []));
  }, [status]);

  const groups = groupByDay(incidents);

  return (
    <>
      <Nav />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-[18px]">Incidents</h1>
          <div className="flex-1" />
          <div className="flex gap-1">
            {["", "open", "closed", "acknowledged", "suppressed"].map((s) => (
              <button
                key={s || "all"}
                onClick={() => setStatus(s)}
                className={`mono text-[11px] px-2 h-6 border ${
                  status === s ? "border-accent text-accent" : "border-border text-text-muted"
                }`}
              >
                {(s || "ALL").toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {Object.keys(groups).length === 0 && (
          <div className="card text-text-muted">No incidents match this filter.</div>
        )}
        {Object.entries(groups).map(([day, items]) => (
          <section key={day} className="mb-5">
            <div className="mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-2">
              {day} · {items.length}
            </div>
            <div className="card p-0">
              <table className="ov">
                <thead>
                  <tr><th>TIME</th><th>CAMERA</th><th>CLASSES</th><th>STATUS</th><th>SUMMARY</th></tr>
                </thead>
                <tbody>
                  {items.map((i: any) => (
                    <tr key={i.id}>
                      <td className="mono">
                        <Link href={`/incidents/${i.id}`} className="hover:text-accent">
                          {formatTime(i.opened_at).slice(11, 19)}
                        </Link>
                      </td>
                      <td>{i.camera_name}</td>
                      <td className="mono">{(i.classes ?? []).join(", ")}</td>
                      <td><StatusPill status={i.status} /></td>
                      <td className="text-text-muted max-w-md truncate">{i.summary ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </main>
    </>
  );
}

function groupByDay(items: any[]): Record<string, any[]> {
  const out: Record<string, any[]> = {};
  for (const i of items) {
    const day = (i.opened_at ?? "").slice(0, 10);
    out[day] = out[day] ?? [];
    out[day].push(i);
  }
  return out;
}
