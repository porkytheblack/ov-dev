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

  // Camera-level fields.
  const [camera, setCamera] = useState<any>(null);
  const [camName, setCamName] = useState("");
  const [camRtsp, setCamRtsp] = useState("");
  const [camFps, setCamFps] = useState(25);
  const [camVlm, setCamVlm] = useState(false);
  const [camSaving, setCamSaving] = useState(false);
  const [camSavedAt, setCamSavedAt] = useState<number | null>(null);
  const [camErr, setCamErr] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    | { ok: true; info?: { codec?: string; width?: number; height?: number; fps?: number; format?: string } }
    | { ok: false; error: string }
    | null
  >(null);

  function hydrateCamera(c: any) {
    setCamera(c);
    setCamName(c?.name ?? "");
    setCamRtsp(c?.rtsp_url ?? "");
    setCamFps(Number(c?.sample_fps ?? 25));
    setCamVlm(Boolean(c?.vlm_enabled));
  }

  async function saveCamera() {
    setCamSaving(true);
    setCamErr(null);
    try {
      const r = await fetch(`/api/cameras/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: camName.trim(),
          rtsp_url: camRtsp.trim(),
          sample_fps: camFps,
          vlm_enabled: camVlm,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      const data = (await r.json()) as { ok: boolean; camera?: any };
      if (data.camera) {
        hydrateCamera(data.camera);
      } else {
        const fresh = await fetch(`/api/cameras/${id}`).then((x) => x.json());
        hydrateCamera(fresh);
      }
      setCamSavedAt(Date.now());
    } catch (e) {
      setCamErr((e as Error).message);
    } finally {
      setCamSaving(false);
    }
  }

  const camDirty =
    camera !== null &&
    (camera.name !== camName ||
      camera.rtsp_url !== camRtsp ||
      Number(camera.sample_fps) !== camFps ||
      Boolean(camera.vlm_enabled) !== camVlm);

  const [deleting, setDeleting] = useState(false);

  async function deleteCamera() {
    if (!window.confirm(
      "Delete this camera?\n\n" +
      "This also removes all of its ROIs, incidents, segments, and clips. " +
      "This cannot be undone.",
    )) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/cameras/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      router.replace("/");
    } catch (e) {
      setCamErr((e as Error).message);
      setDeleting(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch(`/api/cameras/${id}/test`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rtsp_url: camRtsp.trim() }),
      });
      const text = await r.text();
      let data: any = null;
      if (text) {
        try { data = JSON.parse(text); } catch { /* not JSON */ }
      }
      if (data && typeof data === "object" && "ok" in data) {
        setTestResult(data);
      } else if (data && typeof data === "object" && data.error) {
        setTestResult({ ok: false, error: String(data.error) });
      } else {
        setTestResult({
          ok: false,
          error: `HTTP ${r.status}${
            text ? `: ${text.slice(0, 240)}` : " (empty response — is ov-api rebuilt?)"
          }`,
        });
      }
    } catch (e) {
      setTestResult({ ok: false, error: (e as Error).message });
    } finally {
      setTesting(false);
    }
  }

  // Poll the camera doc every 5s so the on-page status pill stays fresh.
  useEffect(() => {
    const i = setInterval(() => {
      fetch(`/api/cameras/${id}`)
        .then((r) => r.json())
        .then((c) => {
          if (!c) return;
          setCamera((prev: any) => ({ ...prev, ...c }));
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(i);
  }, [id]);

  useEffect(() => {
    fetch(`/api/cameras/${id}`)
      .then((r) => r.json())
      .then(hydrateCamera);
    fetch("/api/cameras/" + id + "/rois")
      .then((r) => r.json())
      .then((j) => setRois(j.rois ?? []));
    // Try the detector's class list; fall back to the COCO classes Overwatch
    // ships with so a misconfigured detector doesn't block setup.
    fetch("/api/system/status")
      .then(() => fetch("/api/cameras"))
      .then(() => null)
      .catch(() => null)
      .finally(() => {
        setClasses([
          "person", "car", "truck", "bicycle", "motorcycle", "bus",
          "dog", "cat", "bird", "backpack",
        ]);
      });
  }, [id]);

  async function saveRoi() {
    if (!poly) {
      setErr("Draw a polygon first.");
      return;
    }
    setErr(null);
    const body = {
      name,
      description,
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
    router.push(`/cameras/${id}`);
  }

  return (
    <>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-[18px] mb-4">Camera setup</h1>

        <section className="card mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="font-mono uppercase tracking-[0.08em] text-text-dim text-[11px]">
              CAMERA SETTINGS
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className={`pill ${
                camera?.status === "online"
                  ? "pill-live"
                  : camera?.status === "offline"
                  ? "pill-offline"
                  : "pill-connecting"
              }`}>
                {(camera?.status ?? "unknown").toUpperCase()}
              </span>
              <span className="text-text-dim">
                {camera?.last_frame_at
                  ? `last frame ${new Date(camera.last_frame_at).toISOString().slice(11, 19)}`
                  : "no frames received"}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <div className="font-mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-1">
                NAME
              </div>
              <input
                className="input-text w-full"
                value={camName}
                onChange={(e) => setCamName(e.target.value)}
                placeholder="Front gate"
              />
            </label>
            <label className="block">
              <div className="font-mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-1">
                RTSP URL
              </div>
              <input
                className="input w-full"
                value={camRtsp}
                onChange={(e) => setCamRtsp(e.target.value)}
                placeholder="rtsp://user:pass@host:554/Streaming/Channels/101"
              />
            </label>
            <label className="block">
              <div className="font-mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-1">
                SAMPLE FPS
              </div>
              <input
                type="number"
                min={1}
                max={60}
                className="input w-32"
                value={camFps}
                onChange={(e) => setCamFps(Number(e.target.value))}
              />
              <div className="font-mono text-[10px] text-text-dim mt-1">
                Restarts the stream; takes effect within ~15s.
              </div>
            </label>
            <label className="flex items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={camVlm}
                onChange={(e) => setCamVlm(e.target.checked)}
              />
              <span className="font-mono uppercase tracking-[0.08em] text-text-dim text-[11px]">
                VLM SUMMARIES
              </span>
            </label>
          </div>
          {camErr && (
            <div className="mt-3 font-mono text-[11px] text-danger">{camErr}</div>
          )}
          {testResult && (
            <div className={`mt-3 font-mono text-[11px] ${
              testResult.ok ? "text-success" : "text-danger"
            }`}>
              {testResult.ok ? (
                <>
                  REACHABLE ·{" "}
                  {testResult.info?.codec ?? "?"} ·{" "}
                  {testResult.info?.width ?? "?"}×{testResult.info?.height ?? "?"} ·{" "}
                  {testResult.info?.fps ?? "?"} fps
                </>
              ) : (
                <>FAILED · {testResult.error}</>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              className="btn-primary"
              disabled={!camDirty || camSaving || !camName.trim() || !camRtsp.trim()}
              onClick={saveCamera}
            >
              {camSaving ? "SAVING…" : "SAVE CHANGES"}
            </button>
            {camera && (
              <button
                type="button"
                className="btn"
                disabled={!camDirty || camSaving}
                onClick={() => hydrateCamera(camera)}
              >
                REVERT
              </button>
            )}
            <button
              type="button"
              className="btn"
              disabled={!camRtsp.trim() || testing}
              onClick={testConnection}
            >
              {testing ? "TESTING…" : "TEST CONNECTION"}
            </button>
            {camSavedAt && !camDirty && (
              <span className="font-mono text-[11px] text-success">SAVED</span>
            )}
            <div className="flex-1" />
            <button
              type="button"
              className="btn"
              style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
              disabled={deleting}
              onClick={deleteCamera}
            >
              {deleting ? "DELETING…" : "DELETE CAMERA"}
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <RoiEditor cameraId={id} onSave={(p) => setPoly(p)} />
          </div>
          <div className="card space-y-3">
            <label className="block">
              <div className="font-mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-1">ROI NAME</div>
              <input className="input-text w-full" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block">
              <div className="font-mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-1">
                ROI DESCRIPTION
              </div>
              <textarea
                className="input-text w-full h-20"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this region covers — e.g. 'the driveway between the gate and the carport'. Used by the VLM when summarizing incidents in this ROI."
              />
            </label>
            <div>
              <div className="font-mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-1">CLASSES OF INTEREST</div>
              <div className="flex flex-wrap gap-1">
                {classes.map((cls) => {
                  const active = selected.includes(cls);
                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() =>
                        setSelected((s) => (s.includes(cls) ? s.filter((c) => c !== cls) : [...s, cls]))
                      }
                      className={`font-mono text-[11px] px-2 h-6 border ${
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
              <div className="font-mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-1">LINGER THRESHOLD (S)</div>
              <input
                type="number"
                min={0}
                className="input w-24"
                value={linger}
                onChange={(e) => setLinger(Number(e.target.value))}
              />
            </label>
            <div>
              <div className="font-mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-1">MATCH MODE</div>
              <div className="flex gap-2">
                {(["centroid", "iou"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`font-mono text-[11px] px-2 h-6 border ${
                      mode === m ? "border-accent text-accent" : "border-border text-text-muted"
                    }`}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            {err && <div className="font-mono text-[11px] text-danger">{err}</div>}
            <div className="flex justify-end pt-2">
              <button className="btn-primary" type="button" onClick={saveRoi}>SAVE ROI</button>
            </div>
          </div>
        </div>

        <section className="mt-6">
          <div className="font-mono uppercase tracking-[0.08em] text-text-dim text-[11px] mb-2">EXISTING ROIS</div>
          <div className="card p-0">
            <table className="ov">
              <thead>
                <tr><th>NAME</th><th>DESCRIPTION</th><th>CLASSES</th><th>MODE</th><th>LINGER</th><th>NOTIFY</th></tr>
              </thead>
              <tbody>
                {rois.length === 0 && <tr><td colSpan={6} className="text-text-muted">None.</td></tr>}
                {rois.map((r: any) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td className="text-text-muted max-w-sm truncate">{r.description || "—"}</td>
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
