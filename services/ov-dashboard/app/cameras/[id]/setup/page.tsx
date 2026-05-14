"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { RoiEditor } from "@/components/RoiEditor";

export default function SetupPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [classes, setClasses] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(["person"]);
  const [name, setName] = useState("Main zone");
  const [linger, setLinger] = useState(60);
  const [mode, setMode] = useState<"centroid" | "iou">("centroid");
  const [description, setDescription] = useState("");
  const [poly, setPoly] = useState<{ x: number; y: number }[] | null>(null);
  const [rois, setRois] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/cameras/" + id + "/rois")
      .then((r) => r.json())
      .then((j) => setRois(j.rois ?? []));
    fetch("http://ov-detector:8000/classes")
      .catch(() =>
        fetch("/api/cameras", { method: "GET" }).then(() => ({})), // ignore
      )
      .then(async (r: any) => {
        try {
          if (r?.ok) {
            const j = await r.json();
            setClasses(j.classes ?? []);
            return;
          }
        } catch {}
        // Fallback: hard-coded COCO subset
        setClasses(["person", "car", "truck", "bicycle", "motorcycle", "bus", "dog", "cat"]);
      });
  }, [id]);

  async function saveCameraContext() {
    await fetch(`/api/cameras/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ frame_context: { description } }),
    });
  }

  async function saveRoi() {
    if (!poly) {
      setErr("Draw a polygon first.");
      return;
    }
    setErr(null);
    const body = {
      name,
      polygon: poly,
      classes_of_interest: selected,
      match_mode: mode,
      linger_threshold_seconds: linger,
      notify_enabled: true,
    };
    const r = await fetch(`/api/cameras/${id}/rois`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      setErr(`HTTP ${r.status}: ${await r.text()}`);
      return;
    }
    await saveCameraContext();
    router.push(`/cameras/${id}`);
  }

  return (
    <>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-[18px] mb-4">Camera setup</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <RoiEditor cameraId={id} onSave={(p) => setPoly(p)} />
          </div>
          <div className="card space-y-3">
            <label className="block">
              <div className="mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-1">ROI NAME</div>
              <input className="input-text w-full" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div>
              <div className="mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-1">CLASSES OF INTEREST</div>
              <div className="flex flex-wrap gap-1">
                {classes.map((cls) => {
                  const active = selected.includes(cls);
                  return (
                    <button
                      key={cls}
                      onClick={() =>
                        setSelected((s) => (s.includes(cls) ? s.filter((c) => c !== cls) : [...s, cls]))
                      }
                      className={`mono text-[11px] px-2 h-6 border ${
                        active ? "border-accent text-accent" : "border-border text-text-muted"
                      }`}
                    >
                      {cls}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="block">
              <div className="mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-1">LINGER THRESHOLD (S)</div>
              <input
                type="number"
                min={0}
                className="input w-24"
                value={linger}
                onChange={(e) => setLinger(Number(e.target.value))}
              />
            </label>
            <div>
              <div className="mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-1">MATCH MODE</div>
              <div className="flex gap-2">
                {(["centroid", "iou"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`mono text-[11px] px-2 h-6 border ${
                      mode === m ? "border-accent text-accent" : "border-border text-text-muted"
                    }`}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <div className="mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-1">SCENE DESCRIPTION (FOR VLM)</div>
              <textarea
                className="input-text w-full h-20"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Driveway leading to the gate. North-east corner is a flowerbed."
              />
            </label>
            {err && <div className="mono text-[11px] text-danger">{err}</div>}
            <div className="flex justify-end pt-2">
              <button className="btn-primary" onClick={saveRoi}>SAVE ROI</button>
            </div>
          </div>
        </div>

        <section className="mt-6">
          <div className="mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-2">EXISTING ROIS</div>
          <div className="card p-0">
            <table className="ov">
              <thead>
                <tr><th>NAME</th><th>CLASSES</th><th>MODE</th><th>LINGER</th><th>NOTIFY</th></tr>
              </thead>
              <tbody>
                {rois.length === 0 && <tr><td colSpan={5} className="text-text-muted">None.</td></tr>}
                {rois.map((r: any) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td className="mono">{(r.classes_of_interest ?? []).join(", ")}</td>
                    <td className="mono">{r.match_mode}</td>
                    <td className="mono">{r.linger_threshold_seconds}s</td>
                    <td className="mono">{r.notify_enabled ? "yes" : "no"}</td>
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
