"use client";

import { useEffect, useState } from "react";
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
        <main className="max-w-5xl mx-auto px-4 py-6">
          <div className="skeleton h-6 w-64 mb-3" />
          <div className="skeleton h-72 w-full" />
        </main>
      </>
    );
  }

  const clip = (incident.clips ?? [])[0];

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-[18px]">{incident.camera_name}</h1>
          <StatusPill status={incident.status} />
          <div className="flex-1" />
          {incident.status !== "acknowledged" && (
            <button onClick={ack} className="btn-primary">ACKNOWLEDGE</button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 card p-0">
            {clip ? (
              <video
                controls
                src={`/api/clips/by-key/${encodeURIComponent(clip.storage_key)}`}
                poster={clip.poster_key ? `/api/clips/by-key/${encodeURIComponent(clip.poster_key)}` : undefined}
                className="w-full block bg-black"
              />
            ) : (
              <div className="aspect-video flex items-center justify-center text-text-muted">
                Clip not ready yet.
              </div>
            )}
          </div>
          <aside className="card space-y-3 mono text-[12px]">
            <div><span className="text-text-dim">opened </span>{formatTime(incident.opened_at)}</div>
            {incident.closed_at && <div><span className="text-text-dim">closed </span>{formatTime(incident.closed_at)}</div>}
            <div><span className="text-text-dim">roi    </span>{incident.roi_name}</div>
            <div><span className="text-text-dim">classes</span> {(incident.classes ?? []).join(", ")}</div>
            {incident.track_id && <div><span className="text-text-dim">track  </span>{incident.track_id}</div>}
            <div className="border-t border-border pt-2 text-text-muted leading-relaxed">
              {incident.summary ?? "Summary not generated."}
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
