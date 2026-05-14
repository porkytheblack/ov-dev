"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";

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
      <main className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-[18px] mb-4">Add camera</h1>
        <form onSubmit={submit} className="space-y-3 card">
          <label className="block">
            <div className="mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-1">NAME</div>
            <input
              className="input-text w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Front gate"
            />
          </label>
          <label className="block">
            <div className="mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-1">RTSP URL</div>
            <input
              className="input w-full"
              value={rtsp}
              onChange={(e) => setRtsp(e.target.value)}
              required
              placeholder="rtsp://user:pass@host:554/stream"
            />
          </label>
          <label className="block">
            <div className="font-mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-1">SAMPLE FPS</div>
            <input
              className="input w-32"
              type="number"
              min={1}
              max={60}
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
            />
            <div className="font-mono text-[10px] text-text-dim mt-1">
              25 for HikVision / most PAL cameras · 30 for NTSC · lower (5–10) saves CPU
            </div>
          </label>
          {err && <div className="mono text-[11px] text-danger">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn" onClick={() => router.back()}>CANCEL</button>
            <button type="submit" className="btn-primary" disabled={busy}>ADD</button>
          </div>
        </form>
      </main>
    </>
  );
}
