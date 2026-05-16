"use client";

import type { Camera } from "./shared";

export interface ConnectionForm {
  name: string;
  rtsp: string;
  description: string;
  fps: number;
  vlm: boolean;
}

type TestResult =
  | {
      ok: true;
      info?: {
        codec?: string;
        width?: number;
        height?: number;
        fps?: number;
        format?: string;
      };
    }
  | { ok: false; error: string }
  | null;

/**
 * Step 1 — Connection. The camera-settings card from the old single page,
 * unchanged in behavior (name / rtsp / description / sample fps / vlm,
 * status pill, last-frame, Save / Revert / Probe), plus a clearly separated
 * Danger zone for Delete camera.
 */
export function StepConnection({
  camera,
  form,
  setForm,
  dirty,
  saving,
  savedAt,
  camErr,
  testing,
  testResult,
  deleting,
  mode,
  onSave,
  onRevert,
  onProbe,
  onDelete,
}: {
  camera: Camera | null;
  form: ConnectionForm;
  setForm: (patch: Partial<ConnectionForm>) => void;
  dirty: boolean;
  saving: boolean;
  savedAt: number | null;
  camErr: string | null;
  testing: boolean;
  testResult: TestResult;
  deleting: boolean;
  mode: "setup" | "edit";
  onSave: () => void;
  onRevert: () => void;
  onProbe: () => void;
  onDelete: () => void;
}) {
  const status = (camera?.status as string) ?? "unknown";
  const canSave = dirty && !saving && !!form.name.trim() && !!form.rtsp.trim();

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="label">Camera settings</div>
          <div className="flex items-center gap-3 text-[11px]">
            <span
              className={`pill ${
                status === "online"
                  ? "pill-live"
                  : status === "offline"
                    ? "pill-offline"
                    : "pill-connecting"
              }`}
            >
              {status.toUpperCase()}
            </span>
            <span className="text-text-dim mono">
              {camera?.last_frame_at
                ? `last frame ${new Date(camera.last_frame_at)
                    .toISOString()
                    .slice(11, 19)}`
                : "no frames received"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="field">
            <label className="label" htmlFor="cam-name">
              Name
            </label>
            <input
              id="cam-name"
              className="input-text"
              value={form.name}
              onChange={(e) => setForm({ name: e.target.value })}
              placeholder="Front gate"
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="cam-rtsp">
              RTSP URL
            </label>
            <input
              id="cam-rtsp"
              className="input"
              value={form.rtsp}
              onChange={(e) => setForm({ rtsp: e.target.value })}
              placeholder="rtsp://user:pass@host:554/Streaming/Channels/101"
            />
          </div>
          <div className="field md:col-span-2">
            <label className="label" htmlFor="cam-desc">
              Description
            </label>
            <textarea
              id="cam-desc"
              className="input-text h-16"
              value={form.description}
              onChange={(e) => setForm({ description: e.target.value })}
              placeholder="What this camera sees and where it is. Used as VLM context."
            />
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
                value={form.fps}
                onChange={(e) => setForm({ fps: Number(e.target.value) })}
              />
            </div>
            <span className="text-text-dim text-[10px] leading-snug">
              Frames/sec sent to the detector (not the stream FPS). Keep low —
              3–8 is plenty. Restarts the stream (~15s).
            </span>
          </div>
          <div className="field">
            <span className="label">Analysis</span>
            <label className="flex items-center gap-2 select-none h-9">
              <input
                type="checkbox"
                checked={form.vlm}
                onChange={(e) => setForm({ vlm: e.target.checked })}
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
          <div
            className={`mt-3 mono text-[11px] ${
              testResult.ok ? "text-success" : "text-danger"
            }`}
          >
            {testResult.ok ? (
              <>
                REACHABLE · {testResult.info?.codec ?? "?"} ·{" "}
                {testResult.info?.width ?? "?"}×
                {testResult.info?.height ?? "?"} ·{" "}
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
            disabled={!canSave}
            onClick={onSave}
          >
            {saving
              ? "Saving…"
              : mode === "setup"
                ? "Save & continue"
                : "Save changes"}
          </button>
          {camera && (
            <button
              type="button"
              className="btn"
              disabled={!dirty || saving}
              onClick={onRevert}
            >
              Revert
            </button>
          )}
          <button
            type="button"
            className="btn"
            disabled={!form.rtsp.trim() || testing}
            onClick={onProbe}
          >
            {testing ? "Probing…" : "Probe RTSP"}
          </button>
          {savedAt && !dirty && (
            <span className="mono text-[11px] text-success">Saved ✓</span>
          )}
          {dirty && (
            <span className="mono text-[11px] text-text-dim">
              Unsaved changes
            </span>
          )}
        </div>
      </section>

      {/* ── Danger zone ──────────────────────────────────────────────── */}
      {camera && (
        <section className="border border-danger rounded-lg p-5 bg-[color:var(--danger-soft)]">
          <div className="label !text-danger mb-1">Danger zone</div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-[12px] text-text-muted max-w-lg">
              Deleting this camera also removes all of its ROIs, incidents,
              segments, and clips. This cannot be undone.
            </p>
            <button
              type="button"
              className="btn-danger shrink-0"
              disabled={deleting}
              onClick={onDelete}
            >
              {deleting ? "Deleting…" : "Delete camera"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
