"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Nav } from "@/components/Nav";
import { StatusPill } from "@/components/StatusPill";
import { LiveViewer } from "@/components/LiveViewer";
import { formatRelative } from "@/lib/format";

export default function CameraPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [camera, setCamera] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/cameras/${id}`).then((r) => r.json()).then(setCamera).catch(() => {});
    fetch(`/api/incidents?camera_id=${id}&limit=20`)
      .then((r) => r.json())
      .then((j) => setIncidents(j.incidents ?? []))
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
            <LiveViewer cameraId={id} />
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
          <div className="card p-0">
            <table className="ov">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Detected</th>
                  <th>Status</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {incidents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-text-muted text-center py-8">
                      No incidents recorded for this camera yet.
                    </td>
                  </tr>
                ) : (
                  incidents.map((i: any) => (
                    <tr key={i.id}>
                      <td className="mono whitespace-nowrap">
                        <Link href={`/incidents/${i.id}`} className="hover:text-accent transition-colors">
                          {formatRelative(i.opened_at)}
                        </Link>
                      </td>
                      <td className="mono text-text-muted">
                        {(i.classes ?? []).length > 0 ? (i.classes ?? []).join(", ") : "—"}
                      </td>
                      <td><StatusPill status={i.status} /></td>
                      <td className="text-text-muted max-w-xs truncate">{i.summary ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
