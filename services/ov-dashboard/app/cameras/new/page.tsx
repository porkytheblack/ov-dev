"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import Link from "next/link";

export default function NewCameraPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [rtsp, setRtsp] = useState("");
  // Default 25 fps — HikVision (and most PAL-region IP cameras) push 25 fps
  // by default; NTSC pushes 30. Adjust per camera.
  const [fps, setFps] = useState(25);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/cameras", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, rtsp_url: rtsp, sample_fps: fps }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      const data = (await r.json()) as { id: string };
      router.push(`/cameras/${data.id}/setup`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-6">
          <Link href="/" className="text-text-dim text-[13px] hover:text-text transition-colors">
            ← Back to overview
          </Link>
          <h1 className="text-[22px] font-semibold mt-3">Add a camera</h1>
          <p className="text-text-muted text-[14px] mt-1">
            Connect an IP camera using its RTSP stream URL. After saving, you can configure
            detection zones and alert settings.
          </p>
        </div>

        <form onSubmit={submit} className="card space-y-5">
          <div className="field">
            <label className="label" htmlFor="cam-name">Camera name</label>
            <input
              id="cam-name"
              className="input-text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Front gate, Parking lot"
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="cam-rtsp">RTSP stream URL</label>
            <input
              id="cam-rtsp"
              className="input"
              value={rtsp}
              onChange={(e) => setRtsp(e.target.value)}
              required
              placeholder="rtsp://user:pass@192.168.1.10:554/stream"
            />
            <p className="text-text-dim text-[12px]">
              Found in your camera&apos;s network settings. Includes credentials if required.
            </p>
          </div>

          <div className="field">
            <label className="label" htmlFor="cam-fps">Sample rate (frames per second)</label>
            <div className="w-32">
              <input
                id="cam-fps"
                className="input"
                type="number"
                min={1}
                max={60}
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
              />
            </div>
            <p className="text-text-dim text-[12px]">
              Use 25 for HikVision / PAL cameras, 30 for NTSC. Lower values (5–10) reduce CPU usage.
            </p>
          </div>

          {err && (
            <div
              className="px-3 py-2 rounded-md border border-danger text-danger text-[13px]"
              style={{ backgroundColor: "var(--danger-soft)" }}
              role="alert"
            >
              <span className="font-medium">Error:</span> {err}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1 border-t border-border">
            <button type="button" className="btn" onClick={() => router.back()}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Adding camera…" : "Add camera"}
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
