"use client";

import Link from "next/link";
import { roiColor } from "@/lib/roiColors";
import { summarizeWindow, type Camera, type Roi, type Step } from "./shared";

/**
 * Step 3 — Review. Read-only recap of the camera and every detection zone,
 * with one-click jump-backs into the relevant step. The final "Done" action
 * leaves setup for the camera page.
 */
export function StepReview({
  cameraId,
  camera,
  rois,
  camDirty,
  goStep,
}: {
  cameraId: string;
  camera: Camera | null;
  rois: Roi[];
  camDirty: boolean;
  goStep: (s: Step) => void;
}) {
  const status = (camera?.status as string) ?? "unknown";

  return (
    <div className="space-y-6">
      {/* Connection summary */}
      <section className="card">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="label">Connection</div>
          <button
            type="button"
            className="text-[11px] mono text-text-dim hover:text-accent transition-colors"
            onClick={() => goStep("connection")}
          >
            Edit ↗
          </button>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <Row label="Name" value={camera?.name || "—"} />
          <Row
            label="Status"
            value={
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
            }
          />
          <Row
            label="RTSP URL"
            value={
              <span className="break-all">{camera?.rtsp_url || "—"}</span>
            }
            mono
            full
          />
          <Row
            label="Sample rate"
            value={
              camera?.sample_fps != null ? `${camera.sample_fps} fps` : "—"
            }
            mono
          />
          <Row
            label="AI analysis"
            value={
              camera?.vlm_enabled ? (
                <span className="text-success">Enabled</span>
              ) : (
                <span className="text-text-muted">Disabled</span>
              )
            }
          />
          {camera?.description ? (
            <Row label="Description" value={camera.description} full />
          ) : null}
        </dl>
        {camDirty && (
          <div className="mono text-[11px] text-danger mt-3">
            You have unsaved camera changes — go back to Connection and save
            them.
          </div>
        )}
      </section>

      {/* Zones summary */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="label">
            Detection zones ({rois.length})
          </div>
          <button
            type="button"
            className="text-[11px] mono text-text-dim hover:text-accent transition-colors"
            onClick={() => goStep("regions")}
          >
            Edit zones ↗
          </button>
        </div>
        {rois.length === 0 ? (
          <div className="card">
            <p className="text-[13px] text-text">No detection zones.</p>
            <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed">
              This camera will record video but raise no incidents. Add at
              least one zone in the{" "}
              <button
                type="button"
                className="text-accent hover:underline"
                onClick={() => goStep("regions")}
              >
                Regions
              </button>{" "}
              step if you want alerts.
            </p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="ov">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Classes</th>
                  <th>Mode</th>
                  <th>Linger</th>
                  <th>Active window</th>
                  <th>Notify</th>
                </tr>
              </thead>
              <tbody>
                {rois.map((r, i) => (
                  <tr key={r.id}>
                    <td>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: roiColor(i) }}
                        />
                        {r.name}
                      </span>
                    </td>
                    <td className="mono">
                      {(r.classes_of_interest ?? []).join(", ") || "—"}
                    </td>
                    <td className="mono">{r.match_mode}</td>
                    <td className="mono">{r.linger_threshold_seconds}s</td>
                    <td className="mono">
                      {summarizeWindow(r.detection_window)}
                    </td>
                    <td className="mono">
                      {r.notify_enabled ? "yes" : "no"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex items-center gap-2">
        <Link href={`/cameras/${cameraId}`} className="btn-primary">
          Done — view camera
        </Link>
        <button
          type="button"
          className="btn"
          onClick={() => goStep("regions")}
        >
          Back to zones
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
  full = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  full?: boolean;
}) {
  return (
    <div className={`field ${full ? "sm:col-span-2" : ""}`}>
      <dt className="label">{label}</dt>
      <dd className={`text-[13px] ${mono ? "mono" : ""}`}>{value}</dd>
    </div>
  );
}
