"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Nav } from "@/components/Nav";
import { StatusPill } from "@/components/StatusPill";
import { ClipModal, type ClipIncident } from "@/components/ClipModal";
import { roiColor } from "@/lib/roiColors";

function shiftDay(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + delta);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function CalendarDayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <CalendarDayInner />
    </Suspense>
  );
}

function CalendarDayInner() {
  const params = useParams<{ date: string }>();
  const date = params.date; // YYYY-MM-DD
  // Recap deep links land here scoped to one camera (?camera=<id>).
  const cameraId = useSearchParams().get("camera");
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ClipIncident | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const from = new Date(`${date}T00:00:00`).toISOString();
    const to = new Date(`${date}T23:59:59.999`).toISOString();
    fetch(
      `/api/incidents?from=${encodeURIComponent(from)}&to=${encodeURIComponent(
        to,
      )}&limit=200`,
    )
      .then((r) => r.json())
      .then((j) => {
        if (alive) setIncidents(j.incidents ?? []);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [date]);

  // Group by camera; each camera's column is a reverse-chronological feed
  // (newest → oldest), and columns are ordered by most-recent activity.
  // Scope to one camera when arriving from a recap deep link.
  const scoped = useMemo(
    () =>
      cameraId ? incidents.filter((i) => i.camera_id === cameraId) : incidents,
    [incidents, cameraId],
  );
  const scopedCameraName = cameraId
    ? (scoped[0]?.camera_name ??
      incidents.find((i) => i.camera_id === cameraId)?.camera_name ??
      null)
    : null;

  const columns = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const i of scoped) {
      const k = i.camera_name ?? "Unknown camera";
      (m.get(k) ?? m.set(k, []).get(k))!.push(i);
    }
    const desc = (a: any, b: any) =>
      new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime();
    for (const [, items] of m) items.sort(desc);
    return Array.from(m.entries()).sort(
      ([, a], [, b]) => desc(a[0], b[0]),
    );
  }, [scoped]);

  const title = (() => {
    const d = new Date(`${date}T00:00:00`);
    const ds = Number.isNaN(d.getTime())
      ? date
      : d.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        });
    return scopedCameraName ? `${ds} · ${scopedCameraName}` : ds;
  })();

  return (
    <>
      <Nav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-2">
          <Link
            href="/calendar"
            className="text-text-dim text-[13px] hover:text-text transition-colors"
          >
            ← Calendar
          </Link>
        </div>
        <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-[22px] font-semibold">{title}</h1>
            <p className="text-text-dim text-[13px] mt-0.5">
              {loading
                ? "Loading incidents…"
                : scoped.length === 0
                  ? "No incidents this day"
                  : `${scoped.length} incident${
                      scoped.length !== 1 ? "s" : ""
                    } across ${columns.length} camera${
                      columns.length !== 1 ? "s" : ""
                    }`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              className="btn"
              href={`/calendar/${shiftDay(date, -1)}`}
              aria-label="Previous day"
            >
              ← Prev day
            </Link>
            <Link
              className="btn"
              href={`/calendar/${shiftDay(date, 1)}`}
              aria-label="Next day"
            >
              Next day →
            </Link>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex gap-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="w-[320px] shrink-0 space-y-3">
                <div className="skeleton h-6 w-40" />
                <div className="skeleton h-28 w-full" />
                <div className="skeleton h-28 w-full" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && scoped.length === 0 && (
          <div className="card flex flex-col items-center text-center py-12 gap-2">
            <p className="text-text-muted">Nothing was detected on this day.</p>
            <Link href="/calendar" className="btn-ghost text-[13px] mt-1">
              Back to calendar
            </Link>
          </div>
        )}

        {/* Camera columns */}
        {!loading && scoped.length > 0 && (
          <div className="flex gap-4 overflow-x-auto pb-3">
            {columns.map(([camera, items], ci) => (
              <section
                key={camera}
                className="w-[320px] shrink-0 flex flex-col"
              >
                <div className="flex items-center gap-2 px-1 mb-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: roiColor(ci) }}
                  />
                  <h2 className="text-[14px] font-semibold truncate">
                    {camera}
                  </h2>
                  <span className="label ml-auto">{items.length}</span>
                </div>
                <div className="space-y-2.5">
                  {items.map((i: any) => (
                    <IncidentCard
                      key={i.id}
                      incident={i}
                      onOpen={() => setActive(i as ClipIncident)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {active && (
        <ClipModal incident={active} onClose={() => setActive(null)} />
      )}
    </>
  );
}

function IncidentCard({
  incident,
  onOpen,
}: {
  incident: any;
  onOpen: () => void;
}) {
  const time = new Date(incident.opened_at).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const classes: string[] = incident.classes ?? [];
  const poster = incident.clip_poster_key
    ? `/api/clips/by-key/${encodeURIComponent(incident.clip_poster_key)}`
    : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="card p-0 overflow-hidden w-full text-left hover:border-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] group"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-black">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-text-dim mono text-[10px] uppercase tracking-[0.08em]">
            no preview
          </div>
        )}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="h-9 w-9 rounded-full bg-black/60 grid place-items-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
            ▶
          </span>
        </span>
        <span className="absolute top-1.5 right-1.5">
          <StatusPill status={incident.status} />
        </span>
      </div>
      {/* Meta */}
      <div className="p-2.5 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="mono text-[12px] text-text">{time}</span>
          <span className="mono text-[10px] text-accent opacity-0 group-hover:opacity-100 transition-opacity">
            Watch →
          </span>
        </div>
        <div className="mono text-[11px] text-text-muted truncate">
          {classes.length > 0 ? classes.join(", ") : "—"}
        </div>
        {incident.summary && (
          <p className="text-[11px] text-text-dim leading-snug line-clamp-2">
            {incident.summary}
          </p>
        )}
      </div>
    </button>
  );
}
