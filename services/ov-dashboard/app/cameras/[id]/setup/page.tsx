"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { RoiEditor } from "@/components/RoiEditor";

// Day-of-week numbering MUST match the incident engine's
// isWithinDetectionWindow (services/ov-incident-engine/src/matching/geometry.ts):
// Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6.
const DAYS: { label: string; value: number }[] = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

const DAY_LABEL: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

type DetectionWindow =
  | { type: "always" }
  | { type: "time"; start: string; end: string; tz: string; days: number[] };

function browserTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Human-readable summary of a stored detection_window for the ROI table. */
function summarizeWindow(w: unknown): string {
  if (!w || typeof w !== "object") return "Always";
  const dw = w as Partial<DetectionWindow> & { type?: string };
  if (dw.type !== "time") return "Always";
  const days = Array.isArray(dw.days) ? (dw.days as number[]) : [];
  let dayStr = "Every day";
  if (days.length > 0 && days.length < 7) {
    const sorted = [...days].sort((a, b) => {
      // Order Mon..Sun for display.
      const order = (d: number) => (d === 0 ? 7 : d);
      return order(a) - order(b);
    });
    dayStr = sorted.map((d) => DAY_LABEL[d] ?? d).join(", ");
  }
  const tz = dw.tz || "UTC";
  return `${dayStr} ${dw.start ?? "?"}–${dw.end ?? "?"} (${tz})`;
}

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

  // ROI detection-window form state.
  const [windowed, setWindowed] = useState(false);
  const [winStart, setWinStart] = useState("18:00");
  const [winEnd, setWinEnd] = useState("06:00");
  const [winTz, setWinTz] = useState(browserTz());
  const [winDays, setWinDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // Camera-level fields.
  const [camera, setCamera] = useState<any>(null);
  const [camName, setCamName] = useState("");
  const [camRtsp, setCamRtsp] = useState("");
  const [camDescription, setCamDescription] = useState("");
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
    setCamDescription(c?.description ?? "");
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
          description: camDescription,
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
      (camera.description ?? "") !== camDescription ||
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

  function buildDetectionWindow(): DetectionWindow {
    if (!windowed) return { type: "always" };
    return {
      type: "time",
      start: winStart,
      end: winEnd,
      tz: winTz.trim() || "UTC",
      // Engine numbering: Sun=0..Sat=6. Empty array => engine treats as every day.
      days: [...winDays].sort((a, b) => a - b),
    };
  }

  async function saveRoi() {
    if (!poly) {
      setErr("Draw and close a polygon on the snapshot first.");
      return;
    }
    if (selected.length === 0) {
      setErr("Pick at least one class of interest.");
      return;
    }
    if (windowed && (!winStart || !winEnd)) {
      setErr("Set both a start and end time for the detection window.");
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
      detection_window: buildDetectionWindow(),
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

  function toggleDay(d: number) {
    setWinDays((cur) =>
      cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d],
    );
  }

  return (
    <>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-4">
          <h1 className="text-[18px]">Camera setup</h1>
          <p className="text-text-dim text-[12px] mt-1">
            Configure the camera connection, then draw one or more regions of
            interest (ROIs) and choose what triggers an incident.
          </p>
        </div>

        {/* ── Section 1: Camera settings ─────────────────────────── */}
        <section className="card mb-6">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="label">Camera settings</div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className={`pill ${
                camera?.status === "online"
                  ? "pill-live"
                  : camera?.status === "offline"
                  ? "pill-offline"
                  : "pill-connecting"
              }`}>
                {(camera?.status ?? "unknown").toUpperCase()}
              </span>
              <span className="text-text-dim mono">
                {camera?.last_frame_at
                  ? `last frame ${new Date(camera.last_frame_at).toISOString().slice(11, 19)}`
                  : "no frames received"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="field">
              <label className="label" htmlFor="cam-name">Name</label>
              <input
                id="cam-name"
                className="input-text"
                value={camName}
                onChange={(e) => setCamName(e.target.value)}
                placeholder="Front gate"
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="cam-rtsp">RTSP URL</label>
              <input
                id="cam-rtsp"
                className="input"
                value={camRtsp}
                onChange={(e) => setCamRtsp(e.target.value)}
                placeholder="rtsp://user:pass@host:554/Streaming/Channels/101"
              />
            </div>
            <div className="field md:col-span-2">
              <label className="label" htmlFor="cam-desc">Description</label>
              <textarea
                id="cam-desc"
                className="input-text h-20"
                value={camDescription}
                onChange={(e) => setCamDescription(e.target.value)}
                placeholder="What this camera sees and where it is — e.g. 'mounted above the front door, facing the driveway and street'. Used as context by the VLM when summarizing incidents."
              />
              <span className="text-text-dim text-[10px]">
                Plain language. Helps the VLM describe what it is looking at.
              </span>
            </div>
            <div className="field">
              <label className="label" htmlFor="cam-fps">
                Detection sample rate (FPS)
              </label>
              <div className="w-32">
                <input
                  id="cam-fps"
                  type="number"
                  min={1}
                  max={15}
                  className="input"
                  value={camFps}
                  onChange={(e) => setCamFps(Number(e.target.value))}
                />
              </div>
              <span className="text-text-dim text-[10px] leading-snug">
                How many frames per second are sent to the AI detector — <b>not</b>{" "}
                the camera&apos;s stream FPS shown by Probe. The CPU detector
                processes only a few FPS total across all cameras, so keep this
                low (3–8 is plenty to catch a person). Higher values just queue
                frames that get dropped — they do not make detection more
                responsive. Restarts the stream; takes effect within ~15s.
              </span>
            </div>
            <div className="field">
              <span className="label">Analysis</span>
              <label className="flex items-center gap-2 select-none h-9">
                <input
                  type="checkbox"
                  checked={camVlm}
                  onChange={(e) => setCamVlm(e.target.checked)}
                />
                <span className="text-[12px]">
                  Generate VLM summaries for incidents on this camera
                </span>
              </label>
            </div>
          </div>

          {camErr && (
            <div className="mt-3 mono text-[11px] text-danger">{camErr}</div>
          )}
          {testResult && (
            <div className={`mt-3 mono text-[11px] ${
              testResult.ok ? "text-success" : "text-danger"
            }`}>
              {testResult.ok ? (
                <>
                  REACHABLE ·{" "}
                  {testResult.info?.codec ?? "?"} ·{" "}
                  {testResult.info?.width ?? "?"}×{testResult.info?.height ?? "?"} ·{" "}
                  {testResult.info?.fps ?? "?"} fps native stream
                  <span className="text-text-dim">
                    {" "}
                    (informational — this is the camera&apos;s stream rate, not
                    the detection sample rate above)
                  </span>
                </>
              ) : (
                <>FAILED · {testResult.error}</>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <button
              type="button"
              className="btn-primary"
              disabled={!camDirty || camSaving || !camName.trim() || !camRtsp.trim()}
              onClick={saveCamera}
            >
              {camSaving ? "Saving…" : "Save changes"}
            </button>
            {camera && (
              <button
                type="button"
                className="btn"
                disabled={!camDirty || camSaving}
                onClick={() => hydrateCamera(camera)}
              >
                Revert
              </button>
            )}
            <button
              type="button"
              className="btn"
              disabled={!camRtsp.trim() || testing}
              onClick={testConnection}
            >
              {testing ? "Probing…" : "Probe RTSP"}
            </button>
            {camSavedAt && !camDirty && (
              <span className="mono text-[11px] text-success">Saved</span>
            )}
            <div className="flex-1" />
            <button
              type="button"
              className="btn-danger"
              disabled={deleting}
              onClick={deleteCamera}
            >
              {deleting ? "Deleting…" : "Delete camera"}
            </button>
          </div>
        </section>

        {/* ── Section 2 + 3: Draw ROI  +  ROI properties ─────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="card">
              <div className="label mb-3">Draw region of interest</div>
              <p className="text-text-dim text-[12px] mb-3">
                Click on the snapshot to add polygon points, then double-click
                (or “Close polygon”) to finish the shape.
              </p>
              <RoiEditor cameraId={id} onSave={(p) => setPoly(p)} />
            </div>
          </div>

          <div className="card space-y-4">
            <div className="label">ROI properties</div>

            <div className="field">
              <label className="label" htmlFor="roi-name">ROI name</label>
              <input
                id="roi-name"
                className="input-text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="roi-desc">ROI description</label>
              <textarea
                id="roi-desc"
                className="input-text h-20"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this region covers — e.g. 'the driveway between the gate and the carport'. Used by the VLM when summarizing incidents in this ROI."
              />
            </div>

            <div className="field">
              <span className="label">Classes of interest</span>
              <div className="flex flex-wrap gap-1.5">
                {classes.map((cls) => {
                  const active = selected.includes(cls);
                  return (
                    <button
                      key={cls}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setSelected((s) => (s.includes(cls) ? s.filter((c) => c !== cls) : [...s, cls]))
                      }
                      className="inline-flex items-center justify-center min-h-8 px-3 rounded mono text-[11px] border whitespace-nowrap transition-colors"
                      style={
                        active
                          ? {
                              borderColor: "var(--accent)",
                              color: "var(--accent)",
                              backgroundColor: "var(--accent-soft)",
                            }
                          : undefined
                      }
                    >
                      {cls}
                    </button>
                  );
                })}
              </div>
              <span className="text-text-dim text-[10px]">
                An incident fires when one of these object types lingers in the ROI.
              </span>
            </div>

            <div className="field">
              <label className="label" htmlFor="roi-linger">Linger threshold (seconds)</label>
              <div className="w-24">
                <input
                  id="roi-linger"
                  type="number"
                  min={0}
                  className="input"
                  value={linger}
                  onChange={(e) => setLinger(Number(e.target.value))}
                />
              </div>
              <span className="text-text-dim text-[10px]">
                How long an object must stay before it counts as an incident.
              </span>
            </div>

            <div className="field">
              <span className="label">Match mode</span>
              <div className="flex gap-2">
                {(["centroid", "iou"] as const).map((m) => {
                  const active = mode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setMode(m)}
                      className="inline-flex items-center justify-center min-h-8 px-3 rounded mono text-[11px] border whitespace-nowrap transition-colors"
                      style={
                        active
                          ? {
                              borderColor: "var(--accent)",
                              color: "var(--accent)",
                              backgroundColor: "var(--accent-soft)",
                            }
                          : undefined
                      }
                    >
                      {m.toUpperCase()}
                    </button>
                  );
                })}
              </div>
              <span className="text-text-dim text-[10px]">
                Centroid: object center inside the ROI. IoU: bounding box overlaps the ROI.
              </span>
            </div>

            {/* ── ROI active time range ────────────────────────── */}
            <div className="field">
              <span className="label">Active time range</span>
              <div className="flex gap-2">
                {[
                  { v: false, t: "Always active" },
                  { v: true, t: "During a time window" },
                ].map((opt) => {
                  const active = windowed === opt.v;
                  return (
                    <button
                      key={String(opt.v)}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setWindowed(opt.v)}
                      className="inline-flex items-center justify-center min-h-8 px-3 rounded text-[11px] border whitespace-nowrap transition-colors"
                      style={
                        active
                          ? {
                              borderColor: "var(--accent)",
                              color: "var(--accent)",
                              backgroundColor: "var(--accent-soft)",
                            }
                          : undefined
                      }
                    >
                      {opt.t}
                    </button>
                  );
                })}
              </div>

              {windowed && (
                <div className="mt-2 space-y-3 border border-border rounded p-3 bg-surface">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="field">
                      <label className="label" htmlFor="win-start">Start</label>
                      <input
                        id="win-start"
                        type="time"
                        className="input"
                        value={winStart}
                        onChange={(e) => setWinStart(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="win-end">End</label>
                      <input
                        id="win-end"
                        type="time"
                        className="input"
                        value={winEnd}
                        onChange={(e) => setWinEnd(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <span className="label">Active on</span>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS.map((d) => {
                        const active = winDays.includes(d.value);
                        return (
                          <button
                            key={d.value}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggleDay(d.value)}
                            className="inline-flex items-center justify-center min-h-8 w-12 rounded mono text-[11px] border whitespace-nowrap transition-colors"
                            style={
                              active
                                ? {
                                    borderColor: "var(--accent)",
                                    color: "var(--accent)",
                                    backgroundColor: "var(--accent-soft)",
                                  }
                                : undefined
                            }
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-text-dim text-[10px]">
                      {winDays.length === 0
                        ? "No days selected — the ROI will be active every day."
                        : "ROI is only active on the selected days."}
                    </span>
                  </div>

                  <div className="field">
                    <label className="label" htmlFor="win-tz">Timezone</label>
                    <input
                      id="win-tz"
                      className="input"
                      value={winTz}
                      onChange={(e) => setWinTz(e.target.value)}
                      placeholder="Africa/Nairobi"
                    />
                    <span className="text-text-dim text-[10px]">
                      IANA name. Start/end times are interpreted in this timezone.
                      An end before the start wraps past midnight
                      (e.g. 18:00 → 06:00 = overnight).
                    </span>
                  </div>
                </div>
              )}
            </div>

            {err && <div className="mono text-[11px] text-danger">{err}</div>}
            <div className="flex justify-end pt-1">
              <button className="btn-primary" type="button" onClick={saveRoi}>
                Save ROI
              </button>
            </div>
          </div>
        </div>

        {/* ── Section 4: Existing ROIs ───────────────────────────── */}
        <section className="mt-6">
          <div className="label mb-2">Existing ROIs</div>
          <div className="card p-0">
            <table className="ov">
              <thead>
                <tr>
                  <th>NAME</th>
                  <th>DESCRIPTION</th>
                  <th>CLASSES</th>
                  <th>MODE</th>
                  <th>LINGER</th>
                  <th>ACTIVE WINDOW</th>
                  <th>NOTIFY</th>
                </tr>
              </thead>
              <tbody>
                {rois.length === 0 && (
                  <tr><td colSpan={7} className="text-text-muted">No ROIs yet.</td></tr>
                )}
                {rois.map((r: any) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td className="text-text-muted max-w-sm truncate">{r.description || "—"}</td>
                    <td className="mono">{(r.classes_of_interest ?? []).join(", ")}</td>
                    <td className="mono">{r.match_mode}</td>
                    <td className="mono">{r.linger_threshold_seconds}s</td>
                    <td className="mono">{summarizeWindow(r.detection_window)}</td>
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
