"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { formatTime } from "@/lib/format";

/** Incident shape used by the list/board views and this player. */
export type ClipIncident = {
  id: string;
  camera_name?: string;
  opened_at?: string;
  status?: string;
  classes?: string[];
  roi_name?: string | null;
  summary?: string | null;
  clip_poster_key?: string | null;
  clip_kind?: string | null;
};

/**
 * The /footage endpoint builds a short MP4 from the recording segments around
 * the incident; the detection sits this many seconds in (server FOOTAGE_PRE_S
 * − FOOTAGE_LEAD_S), so we start playback right there — no empty frames.
 */
export const FOOTAGE_SEEK = 4;

/** Segment-accurate, seekable footage for an incident (302 → cached MP4). */
export function footageSrc(id: string): string {
  return `/api/incidents/${id}/footage#t=${FOOTAGE_SEEK}`;
}

function byKey(k?: string | null): string | undefined {
  return k ? `/api/clips/by-key/${encodeURIComponent(k)}` : undefined;
}

/** Full-screen, dismissible clip player for a single incident. */
export function ClipModal({
  incident,
  onClose,
}: {
  incident: ClipIncident;
  onClose: () => void;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const src = footageSrc(incident.id);
  const poster = byKey(incident.clip_poster_key);
  const classes = incident.classes ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Incident clip"
    >
      <div
        className="card w-full max-w-3xl p-0 overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <h2 className="text-[15px] font-semibold truncate">
              {incident.camera_name ?? "Incident"}
            </h2>
            {incident.status && <StatusPill status={incident.status} />}
            {incident.opened_at && (
              <span className="mono text-[12px] text-text-dim">
                {formatTime(incident.opened_at)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost shrink-0 h-8 px-2.5"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Video */}
        <div className="bg-black flex-1 min-h-0">
          {!failed ? (
            <>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                key={src}
                controls
                autoPlay
                playsInline
                poster={poster}
                src={src}
                onError={() => setFailed(true)}
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  if (
                    Number.isFinite(v.duration) &&
                    FOOTAGE_SEEK < v.duration - 0.5 &&
                    Math.abs(v.currentTime - FOOTAGE_SEEK) > 1
                  ) {
                    try {
                      v.currentTime = FOOTAGE_SEEK;
                    } catch {
                      /* ignore */
                    }
                  }
                }}
                className="w-full max-h-[60vh] block bg-black"
              />
              <div className="px-4 py-1.5 text-[11px] text-text-dim mono border-t border-border bg-bg">
                ▶ Trimmed to the detection — scrub left for the few seconds
                of lead-up
              </div>
            </>
          ) : (
            <div className="aspect-video flex flex-col items-center justify-center gap-2 text-text-muted">
              <p className="text-[14px]">No footage for this moment.</p>
              <p className="text-[12px] text-text-dim">
                The recording that covers this incident isn’t available.
              </p>
            </div>
          )}
        </div>

        {/* Meta + actions */}
        <div className="px-4 py-3 border-t border-border flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1.5 min-w-0">
            {classes.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="label">Detected</span>
                <span className="mono text-[12px]">{classes.join(", ")}</span>
              </div>
            )}
            {incident.roi_name && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="label">Zone</span>
                <span className="text-[12px] text-text-muted">
                  {incident.roi_name}
                </span>
              </div>
            )}
            {incident.summary && (
              <p className="text-[13px] text-text-muted leading-relaxed max-w-xl">
                {incident.summary}
              </p>
            )}
          </div>
          <Link href={`/incidents/${incident.id}`} className="btn shrink-0">
            Open full details →
          </Link>
        </div>
      </div>
    </div>
  );
}
