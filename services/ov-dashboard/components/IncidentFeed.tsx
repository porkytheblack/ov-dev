"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { ClipModal, type ClipIncident } from "@/components/ClipModal";
import { dayKey, formatClock, formatDayHeader } from "@/lib/format";

/**
 * Shared, interactive incident list. Identical behaviour everywhere it is
 * used (incidents page, home, camera page): click a row → ClipModal to
 * watch footage; "Details" → full incident page. One source of truth so
 * every surface is interoperable.
 *
 * Rows are grouped by local calendar day (viewer's timezone) with a
 * sticky-ish header between groups ("Today" / "Yesterday" / weekday /
 * explicit date). Callers still pass a flat reverse-chronological array;
 * within each day group the existing order is preserved.
 */
export function IncidentFeed({
  incidents,
  emptyText = "No incidents.",
}: {
  incidents: any[];
  emptyText?: string;
}) {
  const [active, setActive] = useState<ClipIncident | null>(null);

  // Group by local day in the order the caller provided. We re-use the
  // first opened_at we see for each day as the group key — preserves the
  // caller's sort (typically reverse-chronological by opened_at).
  const groups = useMemo(() => {
    const out: Array<{ key: string; sample: string | Date; items: any[] }> = [];
    const byKey = new Map<string, { sample: string | Date; items: any[] }>();
    for (const i of incidents ?? []) {
      const when: string | Date | undefined = i.opened_at;
      const k = when ? dayKey(when) : "unknown";
      const existing = byKey.get(k);
      if (existing) {
        existing.items.push(i);
      } else {
        const g = { sample: when ?? new Date(0), items: [i] };
        byKey.set(k, g);
        out.push({ key: k, sample: g.sample, items: g.items });
      }
    }
    return out;
  }, [incidents]);

  if (!incidents || incidents.length === 0) {
    return (
      <div className="card text-text-muted text-center py-8 text-[13px]">
        {emptyText}
      </div>
    );
  }

  const renderRow = (i: any) => (
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
                {i.opened_at ? formatClock(i.opened_at) : "—"}
              </div>
              <div className="text-[13px] truncate">{i.camera_name}</div>
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
  );

  return (
    <>
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.key}>
            <div className="text-text-muted text-[11px] uppercase tracking-wider font-medium px-1 pb-1.5">
              {formatDayHeader(g.sample)}
            </div>
            <div className="card p-0 overflow-hidden divide-y divide-border">
              {g.items.map(renderRow)}
            </div>
          </div>
        ))}
      </div>

      {active && (
        <ClipModal incident={active} onClose={() => setActive(null)} />
      )}
    </>
  );
}
