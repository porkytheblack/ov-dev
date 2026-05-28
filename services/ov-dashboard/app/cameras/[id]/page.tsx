"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Nav } from "@/components/Nav";
import { StatusPill } from "@/components/StatusPill";
import { LiveViewer } from "@/components/LiveViewer";
import { IncidentFeed } from "@/components/IncidentFeed";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { formatRelative } from "@/lib/format";

export default function CameraPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [camera, setCamera] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);

  useEffect(() => {
    // Treat any non-2xx (e.g. 401 from in-app browsers with no session
    // cookie) as "no data" instead of spreading an error body into camera
    // state, where consumers like StatusPill would then read undefined
    // fields and crash.
    fetch(`/api/cameras/${id}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => setCamera(c && typeof c.id === "string" ? c : null))
      .catch(() => {});
    fetch(`/api/incidents?camera_id=${id}&limit=20`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setIncidents(Array.isArray(j?.incidents) ? j.incidents : []))
      .catch(() => {});
  }, [id]);

  return (
    <>
      <Nav />
      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            {camera ? (
              <>
                <h1 className="text-[22px] font-semibold">{camera.name}</h1>
                <StatusPill status={camera.status} />
              </>
            ) : (
              <div className="skeleton h-7 w-48" />
            )}
          </div>
          <Link href={`/cameras/${id}/setup`} className="btn shrink-0">
            Configure camera
          </Link>
        </div>

        {/* Live view + details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          {/* Live stream */}
          <div className="lg:col-span-2 card p-0 overflow-hidden">
            <ErrorBoundary
              fallback={(err, reset) => (
                <div className="aspect-video bg-black grid place-items-center text-center px-4">
                  <div>
                    <div className="mono text-[11px] uppercase tracking-wider text-text-dim mb-2">
                      Live view unavailable
                    </div>
                    <div className="text-text-muted text-[13px] mb-3 max-w-sm">
                      {err.message ||
                        "Couldn't start the live stream in this browser. Try opening the dashboard in your main browser."}
                    </div>
                    <button onClick={reset} className="btn">
                      Retry
                    </button>
                  </div>
                </div>
              )}
            >
              <LiveViewer cameraId={id} />
            </ErrorBoundary>
          </div>

          {/* Camera details */}
          <div className="card">
            <h2 className="label mb-4">Camera details</h2>
            <dl className="space-y-3">
              <div className="field">
                <dt className="label">Camera ID</dt>
                <dd className="mono text-[12px] text-text-muted break-all">{id}</dd>
              </div>
              <div className="field">
                <dt className="label">Sample rate</dt>
                <dd className="mono text-[13px]">
                  {camera?.sample_fps != null ? `${camera.sample_fps} fps` : "—"}
                </dd>
              </div>
              <div className="field">
                <dt className="label">Last frame</dt>
                <dd className="mono text-[13px]">
                  {camera?.last_frame_at ? formatRelative(camera.last_frame_at) : "No frames yet"}
                </dd>
              </div>
              <div className="field">
                <dt className="label">AI analysis</dt>
                <dd className="text-[13px]">
                  {camera?.vlm_enabled
                    ? <span className="text-success">Enabled</span>
                    : <span className="text-text-muted">Disabled</span>}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Incidents for this camera */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-semibold">Recent incidents on this camera</h2>
          </div>
          <IncidentFeed
            incidents={incidents}
            emptyText="No incidents recorded for this camera yet."
          />
        </section>
      </main>
    </>
  );
}
