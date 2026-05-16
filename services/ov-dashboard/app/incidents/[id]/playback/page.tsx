"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { formatTime } from "@/lib/format";

/**
 * Token-gated, no-nav playback target for messenger deep links.
 * No authentication required — the signed token is the credential.
 */
export default function PlaybackWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <PlaybackPage />
    </Suspense>
  );
}

function PlaybackPage() {
  const params = useParams<{ id: string }>();
  const sp = useSearchParams();
  const token = sp.get("token") ?? "";
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setErr("No access token provided.");
      return;
    }
    fetch(`/api/incidents/${params.id}/playback?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then(setData)
      .catch((e) => setErr((e as Error).message));
  }, [params.id, token]);

  if (err) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div
          className="card max-w-sm w-full text-center"
          style={{ borderColor: "var(--danger)" }}
        >
          <p className="text-danger font-medium mb-1">Access denied</p>
          <p className="text-text-muted text-[13px]">{err}</p>
          <p className="text-text-dim text-[12px] mt-3">
            This link may have expired or is invalid. Contact the system operator.
          </p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-3xl space-y-3">
          <div className="skeleton h-5 w-32" />
          <div className="skeleton aspect-video w-full" />
        </div>
      </main>
    );
  }

  const incident = data.incident;

  return (
    <main className="min-h-screen bg-bg text-text">
      <div className="max-w-3xl mx-auto p-4 pt-8">
        {/* Minimal branding */}
        <div className="mb-5 flex items-center gap-2">
          <span className="mono uppercase tracking-[0.12em] text-accent font-semibold text-[13px]">Overwatch</span>
          <span
            aria-hidden="true"
            style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--accent)" }}
          />
        </div>

        {/* Incident header */}
        <h1 className="text-[18px] font-semibold mb-1">{incident?.camera_name ?? "Incident Playback"}</h1>
        {incident?.opened_at && (
          <p className="text-text-dim mono text-[12px] mb-4">{formatTime(incident.opened_at)}</p>
        )}

        {/* Video */}
        {data.stream_url ? (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              controls
              autoPlay
              playsInline
              poster={data.poster_url ?? undefined}
              src={`${data.stream_url}${
                data.start_offset_seconds > 0
                  ? `#t=${data.start_offset_seconds}`
                  : ""
              }`}
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                const s = Number(data.start_offset_seconds) || 0;
                if (
                  s > 0 &&
                  Number.isFinite(v.duration) &&
                  s < v.duration - 0.5 &&
                  Math.abs(v.currentTime - s) > 1
                ) {
                  try {
                    v.currentTime = s;
                  } catch {
                    /* ignore */
                  }
                }
              }}
              className="w-full bg-black rounded-md"
            />
            {data.start_offset_seconds > 0 && (
              <p className="text-text-dim mono text-[11px] mt-2">
                ▶ Skipped to the detection · scrub back for the full clip
              </p>
            )}
          </>
        ) : (
          <div className="card text-center py-8">
            <p className="text-text-muted">Clip not ready yet.</p>
            <p className="text-text-dim text-[13px] mt-1">The recording may still be processing.</p>
          </div>
        )}

        {/* Metadata */}
        {incident && (
          <div className="mt-4 space-y-2">
            {(incident.classes ?? []).length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <span className="label">Detected:</span>
                <span className="mono text-[12px]">{(incident.classes ?? []).join(", ")}</span>
              </div>
            )}
            {incident.summary && (
              <p className="text-text-muted text-[14px] leading-relaxed mt-3">{incident.summary}</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
