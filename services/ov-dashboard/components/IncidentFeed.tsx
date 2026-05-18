"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { ClipModal, type ClipIncident } from "@/components/ClipModal";
import { formatClock } from "@/lib/format";

/**
 * Shared, interactive incident list. Identical behaviour everywhere it is
 * used (incidents page, home, camera page): click a row → ClipModal to
 * watch footage; "Details" → full incident page. One source of truth so
 * every surface is interoperable.
 *
 * `incidents` is rendered in the order given — callers sort as needed
 * (e.g. reverse-chronological feed).
 */
export function IncidentFeed({
  incidents,
  emptyText = "No incidents.",
}: {
  incidents: any[];
  emptyText?: string;
}) {
  const [active, setActive] = useState<ClipIncident | null>(null);

  if (!incidents || incidents.length === 0) {
    return (
      <div className="card text-text-muted text-center py-8 text-[13px]">
        {emptyText}
      </div>
    );
  }

  return (
    <>
      <div className="card p-0 overflow-hidden divide-y divide-border">
        {incidents.map((i: any) => (
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
        ))}
      </div>

      {active && (
        <ClipModal incident={active} onClose={() => setActive(null)} />
      )}
    </>
  );
}
