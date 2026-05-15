"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { StatusPill } from "@/components/StatusPill";
import { formatTime } from "@/lib/format";

export default function IncidentDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [incident, setIncident] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/incidents/${id}`).then((r) => r.json()).then(setIncident);
  }, [id]);

  async function ack() {
    await fetch(`/api/incidents/${id}/acknowledge`, { method: "POST" });
    router.refresh();
    fetch(`/api/incidents/${id}`).then((r) => r.json()).then(setIncident);
  }

  if (!incident) {
    return (
      <>
        <Nav />
        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="skeleton h-5 w-32 mb-6" />
          <div className="skeleton h-8 w-64 mb-4" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 skeleton aspect-video" />
            <div className="skeleton h-64" />
          </div>
        </main>
      </>
    );
  }

  const clip = (incident.clips ?? [])[0];

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="mb-4">
          <Link href="/incidents" className="text-text-dim text-[13px] hover:text-text transition-colors">
            ← All incidents
          </Link>
        </div>

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[22px] font-semibold">{incident.camera_name}</h1>
            <StatusPill status={incident.status} />
          </div>
          {incident.status !== "acknowledged" && (
            <button onClick={ack} className="btn-primary shrink-0">
              Acknowledge incident
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Video clip */}
          <div className="lg:col-span-2 card p-0 overflow-hidden">
            {clip ? (
              <video
                controls
                src={`/api/clips/by-key/${encodeURIComponent(clip.storage_key)}`}
                poster={clip.poster_key ? `/api/clips/by-key/${encodeURIComponent(clip.poster_key)}` : undefined}
                className="w-full block bg-black"
              />
            ) : (
              <div className="aspect-video flex flex-col items-center justify-center gap-2 text-text-muted">
                <p>Clip not ready yet.</p>
                <p className="text-[13px] text-text-dim">The recording may still be processing.</p>
              </div>
            )}
          </div>

          {/* Incident details */}
          <aside className="card space-y-4">
            <h2 className="label">Incident details</h2>

            <div className="field">
              <dt className="label">Opened</dt>
              <dd className="mono text-[12px]">{formatTime(incident.opened_at)}</dd>
            </div>

            {incident.closed_at && (
              <div className="field">
                <dt className="label">Closed</dt>
                <dd className="mono text-[12px]">{formatTime(incident.closed_at)}</dd>
              </div>
            )}

            {incident.roi_name && (
              <div className="field">
                <dt className="label">Detection zone</dt>
                <dd className="text-[13px]">{incident.roi_name}</dd>
              </div>
            )}

            <div className="field">
              <dt className="label">Detected objects</dt>
              <dd className="mono text-[12px]">
                {(incident.classes ?? []).length > 0
                  ? (incident.classes ?? []).join(", ")
                  : <span className="text-text-dim">None recorded</span>}
              </dd>
            </div>

            {incident.track_id && (
              <div className="field">
                <dt className="label">Track ID</dt>
                <dd className="mono text-[12px] text-text-muted">{incident.track_id}</dd>
              </div>
            )}

            {incident.summary && (
              <div className="border-t border-border pt-4">
                <dt className="label mb-1.5">AI summary</dt>
                <dd className="text-[13px] text-text-muted leading-relaxed">{incident.summary}</dd>
              </div>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}
