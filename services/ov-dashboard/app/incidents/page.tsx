"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { IncidentFeed } from "@/components/IncidentFeed";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "suppressed", label: "Suppressed" },
];

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = status ? `?status=${status}&limit=100` : "?limit=100";
    fetch("/api/incidents" + q)
      .then((r) => r.json())
      .then((j) => setIncidents(j.incidents ?? []))
      .finally(() => setLoading(false));
  }, [status]);

  const groups = groupByDay(incidents);
  const totalCount = incidents.length;

  return (
    <>
      <Nav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-[22px] font-semibold">Incidents</h1>
            <p className="text-text-dim text-[13px] mt-0.5">
              Click any incident to watch its footage
            </p>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="label mr-1">Filter:</span>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value || "all"}
                onClick={() => setStatus(f.value)}
                className={status === f.value ? "btn-primary" : "btn"}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results summary */}
        {!loading && (
          <p className="text-text-dim text-[13px] mb-4">
            {totalCount === 0
              ? "No incidents match this filter."
              : `${totalCount} incident${totalCount !== 1 ? "s" : ""} found`}
          </p>
        )}

        {/* Loading state */}
        {loading && (
          <div className="space-y-4">
            <div className="skeleton h-4 w-32" />
            <div className="card p-0">
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="skeleton h-12 w-full" />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && Object.keys(groups).length === 0 && (
          <div className="card flex flex-col items-center text-center py-12 gap-2">
            <p className="text-text-muted">No incidents match this filter.</p>
            {status && (
              <button
                onClick={() => setStatus("")}
                className="btn-ghost text-[13px] mt-1"
              >
                Clear filter
              </button>
            )}
          </div>
        )}

        {/* Incident groups by day */}
        {!loading &&
          Object.entries(groups).map(([day, items]) => (
            <section key={day} className="mb-6">
              <div className="flex items-baseline gap-2 mb-2">
                <h2 className="text-[14px] font-semibold">
                  {formatDayLabel(day)}
                </h2>
                <span className="label">
                  {items.length} incident{items.length !== 1 ? "s" : ""}
                </span>
              </div>
              <IncidentFeed incidents={items} />
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

function formatDayLabel(dateStr: string): string {
  if (!dateStr) return "Unknown date";
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
