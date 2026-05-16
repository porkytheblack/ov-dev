"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { StatusPill } from "@/components/StatusPill";
import { ClipModal, type ClipIncident } from "@/components/ClipModal";
import { formatTime } from "@/lib/format";

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
  const [active, setActive] = useState<ClipIncident | null>(null);

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
              <div className="card p-0 overflow-hidden divide-y divide-border">
                {items.map((i: any) => (
                  <div
                    key={i.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActive(i as ClipIncident)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActive(i as ClipIncident);
                      }
                    }}
                    className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-surface-elev transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--ring)] group"
                  >
                    {/* Thumbnail */}
                    <div className="relative w-[88px] h-[50px] shrink-0 rounded bg-black overflow-hidden">
                      {i.clip_poster_key ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/clips/by-key/${encodeURIComponent(
                            i.clip_poster_key,
                          )}`}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                        />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center text-text-dim mono text-[9px] uppercase">
                          no preview
                        </div>
                      )}
                      <span className="absolute inset-0 grid place-items-center text-white text-[13px] opacity-0 group-hover:opacity-100 transition-opacity">
                        ▶
                      </span>
                    </div>

                    {/* Time + camera */}
                    <div className="min-w-0 w-[180px] shrink-0">
                      <div className="mono text-[12px] text-text">
                        {formatTime(i.opened_at).slice(11, 19)}
                      </div>
                      <div className="text-[13px] truncate">
                        {i.camera_name}
                      </div>
                    </div>

                    {/* Detected */}
                    <div className="mono text-[12px] text-text-muted w-[150px] shrink-0 truncate">
                      {(i.classes ?? []).length > 0
                        ? (i.classes ?? []).join(", ")
                        : "—"}
                    </div>

                    {/* Status */}
                    <div className="shrink-0">
                      <StatusPill status={i.status} />
                    </div>

                    {/* Summary */}
                    <div className="text-text-muted text-[13px] truncate flex-1 hidden md:block">
                      {i.summary ?? "—"}
                    </div>

                    {/* Actions */}
                    <div className="ml-auto flex items-center gap-2 shrink-0">
                      <span className="btn-primary pointer-events-none hidden sm:inline-flex">
                        ▶ Watch
                      </span>
                      <Link
                        href={`/incidents/${i.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="btn"
                      >
                        Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
      </main>

      {active && (
        <ClipModal incident={active} onClose={() => setActive(null)} />
      )}
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
