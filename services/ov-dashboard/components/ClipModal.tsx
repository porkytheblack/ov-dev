"use client";

import { useEffect } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { formatTime } from "@/lib/format";

/**
 * The incident shape every list endpoint now returns. `clip_storage_key`
 * resolves to the incident's own clip, or the regular recording segment that
 * covers the incident's time window (see ov-api incidents clipResolver).
 */
export type ClipIncident = {
  id: string;
  camera_name?: string;
  opened_at?: string;
  status?: string;
  classes?: string[];
  roi_name?: string | null;
  summary?: string | null;
  clip_storage_key?: string | null;
  clip_poster_key?: string | null;
  clip_kind?: string | null;
};

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

  const src = byKey(incident.clip_storage_key);
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
            {incident.clip_kind === "regular" && src && (
              <span
                className="mono text-[10px] text-text-dim uppercase tracking-[0.08em]"
                title="No dedicated incident clip — showing the continuous recording that covers this moment"
              >
                recording
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
          {src ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              key={src}
              controls
              autoPlay
              playsInline
              poster={poster}
              src={src}
              className="w-full max-h-[64vh] block bg-black"
            />
          ) : (
            <div className="aspect-video flex flex-col items-center justify-center gap-2 text-text-muted">
              <p className="text-[14px]">Clip not ready yet.</p>
              <p className="text-[12px] text-text-dim">
                The recording for this moment is still processing.
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
