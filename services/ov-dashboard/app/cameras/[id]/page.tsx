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
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-[18px]">{camera?.name ?? "Camera"}</h1>
          {camera && <StatusPill status={camera.status} />}
          <div className="flex-1" />
          <Link href={`/cameras/${id}/setup`} className="btn">CONFIGURE</Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2 card p-0 overflow-hidden">
            <LiveViewer cameraId={id} />
          </div>
          <div className="card">
            <div className="mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-2">DETAILS</div>
            <dl className="mono text-[12px] space-y-1">
              <div><span className="text-text-dim">id  </span>{id}</div>
              <div><span className="text-text-dim">fps </span>{camera?.sample_fps ?? "—"}</div>
              <div><span className="text-text-dim">last</span> {camera?.last_frame_at ? formatRelative(camera.last_frame_at) : "—"}</div>
              <div><span className="text-text-dim">vlm </span>{camera?.vlm_enabled ? "on" : "off"}</div>
            </dl>
          </div>
        </div>

        <section>
          <div className="mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-2">RECENT INCIDENTS</div>
          <div className="card p-0">
            <table className="ov">
              <thead>
                <tr><th>TIME</th><th>CLASSES</th><th>STATUS</th><th>SUMMARY</th></tr>
              </thead>
              <tbody>
                {incidents.length === 0 && (
                  <tr><td colSpan={4} className="text-text-muted">None yet.</td></tr>
                )}
                {incidents.map((i: any) => (
                  <tr key={i.id}>
                    <td className="mono">
                      <Link href={`/incidents/${i.id}`} className="hover:text-accent">
                        {formatRelative(i.opened_at)}
                      </Link>
                    </td>
                    <td className="mono">{(i.classes ?? []).join(", ")}</td>
                    <td><StatusPill status={i.status} /></td>
                    <td className="text-text-muted max-w-md truncate">{i.summary ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
