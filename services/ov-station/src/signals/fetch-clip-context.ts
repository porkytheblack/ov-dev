/**
 * Root signal of the vision broadcast. Loads the incident / camera / ROI
 * context for a freshly-built incident clip and decides whether to analyse
 * it. Skips when the camera has VLM disabled or the Mimo vision model is
 * not configured — downstream nodes are guarded on `skip`.
 */
import { signal, z } from "station-signal";
import { mimoConfigured } from "@overwatch/ai";
import { sql, log } from "../config.js";

const Input = z.object({
  incident_id: z.string(),
  camera_id: z.string(),
  storage_key: z.string(),
  poster_key: z.string().optional(),
  // Manual dashboard triggers set this to analyse regardless of the
  // camera's vlm_enabled flag (auto/Redis triggers leave it false).
  force: z.boolean().optional(),
});

const Output = z.object({
  skip: z.boolean(),
  incident_id: z.string(),
  storage_key: z.string(),
  poster_key: z.string().optional(),
  prompt: z.string(),
});

function buildPrompt(ctx: {
  cameraName: string;
  cameraDesc: string;
  roiName: string;
  roiDesc: string;
  classes: string[];
  durationSeconds: number;
}): string {
  const sceneLines: string[] = [];
  if (ctx.cameraDesc) sceneLines.push(`Camera (${ctx.cameraName}) scene: ${ctx.cameraDesc}`);
  if (ctx.roiDesc) sceneLines.push(`ROI (${ctx.roiName}): ${ctx.roiDesc}`);
  const scene =
    sceneLines.join("\n") || `Scene context not provided. ROI: ${ctx.roiName}.`;

  // When the operator has described the camera's field of view, that
  // description is the canonical frame of reference: position subjects
  // relative to its named landmarks/areas rather than raw frame quadrants.
  const positioning = ctx.cameraDesc
    ? "When describing where subjects are or how they move, locate them using the " +
      "named landmarks and areas from the camera scene description above " +
      "(e.g. \"by the well\", \"in front of the kitchen window\", \"toward the green house\"). " +
      "Do NOT use generic frame positions like \"bottom-left\" or \"top-right\" when a " +
      "named location applies. Only fall back to generic frame positions for areas the " +
      "description does not name.\n\n"
    : "";

  return (
    "Routine monitoring log for a fixed camera on the operator's own " +
    "property. Record only what is visible in the highlighted zone; ignore " +
    "the rest of the frame.\n\n" +
    `${scene}\n\n` +
    positioning +
    `Object detector flagged: ${ctx.classes.join(", ")}. ` +
    `Clip length: ${ctx.durationSeconds.toFixed(0)}s.\n\n` +
    "Call report_scene with neutral, factual observations (activity, the " +
    "objects/people seen and their location & motion). Do not speculate or " +
    "add commentary."
  );
}

export const fetchClipContext = signal("fetch-clip-context")
  .input(Input)
  .output(Output)
  .timeout(30_000)
  .retries(2)
  .run(async (input) => {
    const skipResult = {
      skip: true,
      incident_id: input.incident_id,
      storage_key: input.storage_key,
      poster_key: input.poster_key,
      prompt: "",
    };

    if (!mimoConfigured("vision")) {
      log.info({ incident_id: input.incident_id }, "mimo vision not configured; skipping analysis");
      return skipResult;
    }

    const rows = await sql<
      Array<{
        vlm_enabled: boolean;
        camera_description: string | null;
        frame_context: { description?: string } | null;
        camera_name: string;
        roi_name: string;
        roi_description: string;
        classes: string[];
        status: string;
        opened_at: Date;
        closed_at: Date | null;
      }>
    >`
      SELECT c.vlm_enabled, c.description AS camera_description,
             c.frame_context, c.name AS camera_name,
             r.name AS roi_name, r.description AS roi_description,
             i.classes, i.status, i.opened_at, i.closed_at
        FROM incidents i
        JOIN cameras c ON c.id = i.camera_id
        JOIN rois r    ON r.id = i.roi_id
       WHERE i.id = ${input.incident_id}::uuid
    `;
    const row = rows[0];
    if (!row) return skipResult;
    if (!row.vlm_enabled && !input.force) return skipResult;
    // Auto path: only analyse genuine in-window incidents. The engine marks
    // an incident 'suppressed' when it never met the ROI linger threshold
    // (false alarm / out of the defined detection window). A manual
    // dashboard trigger (force) overrides this.
    if (row.status === "suppressed" && !input.force) return skipResult;

    const opened = row.opened_at ? new Date(row.opened_at) : null;
    const closed = row.closed_at ? new Date(row.closed_at) : null;
    const durationSeconds =
      opened && closed ? Math.max(0, (closed.getTime() - opened.getTime()) / 1000) : 0;

    return {
      skip: false,
      incident_id: input.incident_id,
      storage_key: input.storage_key,
      poster_key: input.poster_key,
      prompt: buildPrompt({
        cameraName: row.camera_name || "the camera",
        // The operator-defined camera scene description lives in the
        // cameras.description column; frame_context.description is the
        // legacy fallback.
        cameraDesc: (row.camera_description?.trim() || row.frame_context?.description || "").trim(),
        roiName: row.roi_name || "the region",
        roiDesc: (row.roi_description ?? "").trim(),
        classes: row.classes ?? [],
        durationSeconds,
      }),
    };
  });
