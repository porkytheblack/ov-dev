/**
 * Shared types + pure helpers for the camera-setup flow.
 *
 * The detection-window logic here (DAYS ordering, day numbering, build/
 * summarize) is lifted VERBATIM from the previous single-page setup. Day
 * numbering MUST stay Sun=0, Mon=1 … Sat=6 to match the incident engine's
 * isWithinDetectionWindow (services/ov-incident-engine/src/matching/geometry.ts).
 */

export type Pt = { x: number; y: number };

export type DetectionWindow =
  | { type: "always" }
  | { type: "time"; start: string; end: string; tz: string; days: number[] };

/** An ROI as returned by GET /api/cameras/:id/rois. */
export interface Roi {
  id: string;
  camera_id: string;
  name: string;
  description: string | null;
  polygon: Pt[];
  classes_of_interest: string[];
  match_mode: "centroid" | "iou";
  detection_window: DetectionWindow | null;
  linger_threshold_seconds: number;
  notify_enabled: boolean;
  kind?: "include" | "exclude";
  created_at: string;
}

export interface Camera {
  id: string;
  name: string;
  rtsp_url: string;
  description: string | null;
  sample_fps: number;
  vlm_enabled: boolean;
  status?: string;
  last_frame_at?: string | null;
  [k: string]: unknown;
}

/** Editable shape of an ROI form (no id while drafting a brand-new zone). */
export interface RoiDraft {
  name: string;
  description: string;
  kind: "include" | "exclude";
  polygon: Pt[] | null;
  classes_of_interest: string[];
  match_mode: "centroid" | "iou";
  linger_threshold_seconds: number;
  notify_enabled: boolean;
  windowed: boolean;
  winStart: string;
  winEnd: string;
  winTz: string;
  winDays: number[];
}

export type Step = "connection" | "regions" | "review";
export const STEPS: Step[] = ["connection", "regions", "review"];
export const STEP_LABEL: Record<Step, string> = {
  connection: "Connection",
  regions: "Regions",
  review: "Review",
};

// Day-of-week numbering MUST match the incident engine. Sun=0..Sat=6.
export const DAYS: { label: string; value: number }[] = [
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

export function browserTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Tolerant polygon parse. ROIs written by older code are double-encoded:
 * the `polygon` jsonb holds a JSON *string* (`jsonb_typeof = string`), not a
 * jsonb array — so the API returns `polygon` as a string. New ROIs come back
 * as an array. Points may be `{x,y}` or `[x,y]` (matches the incident
 * engine's normalizePolygon). Returns [] when nothing usable is present.
 */
export function parsePolygon(raw: unknown): Pt[] {
  let v: unknown = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(v)) return [];
  const out: Pt[] = [];
  for (const p of v) {
    if (
      Array.isArray(p) &&
      p.length >= 2 &&
      Number.isFinite(Number(p[0])) &&
      Number.isFinite(Number(p[1]))
    ) {
      out.push({ x: Number(p[0]), y: Number(p[1]) });
    } else if (p && typeof p === "object" && "x" in p && "y" in p) {
      const o = p as { x: unknown; y: unknown };
      if (Number.isFinite(Number(o.x)) && Number.isFinite(Number(o.y)))
        out.push({ x: Number(o.x), y: Number(o.y) });
    }
  }
  return out;
}

/** Tolerant detection_window parse (same string/object double-encoding). */
export function parseWindow(raw: unknown): DetectionWindow | null {
  let v: unknown = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  const w = v as { type?: string; start?: unknown; end?: unknown; tz?: unknown; days?: unknown };
  if (w.type === "time") {
    return {
      type: "time",
      start: String(w.start ?? ""),
      end: String(w.end ?? ""),
      tz: String(w.tz || "UTC"),
      days: Array.isArray(w.days) ? w.days.map(Number) : [],
    };
  }
  if (w.type === "always") return { type: "always" };
  return null;
}

/** Human-readable summary of a stored detection_window. */
export function summarizeWindow(raw: unknown): string {
  const dw = parseWindow(raw);
  if (!dw || dw.type !== "time") return "Always";
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

/** Build the detection_window payload from form state. */
export function buildDetectionWindow(d: RoiDraft): DetectionWindow {
  if (!d.windowed) return { type: "always" };
  return {
    type: "time",
    start: d.winStart,
    end: d.winEnd,
    tz: d.winTz.trim() || "UTC",
    // Engine numbering: Sun=0..Sat=6. Empty array => engine treats as every day.
    days: [...d.winDays].sort((a, b) => a - b),
  };
}

/** A fresh draft for a brand-new zone. `name` defaults to "Zone N". */
export function freshDraft(zoneNumber: number): RoiDraft {
  return {
    name: `Zone ${zoneNumber}`,
    description: "",
    kind: "include",
    polygon: null,
    classes_of_interest: ["person"],
    match_mode: "centroid",
    linger_threshold_seconds: 60,
    notify_enabled: true,
    windowed: false,
    winStart: "18:00",
    winEnd: "06:00",
    winTz: browserTz(),
    winDays: [1, 2, 3, 4, 5],
  };
}

/** Hydrate the form from a stored ROI (tolerant of string-encoded fields). */
export function draftFromRoi(r: Roi): RoiDraft {
  const w = parseWindow(r.detection_window as unknown);
  const tw = w && w.type === "time" ? w : null;
  const poly = parsePolygon(r.polygon as unknown);
  return {
    name: r.name,
    description: r.description ?? "",
    kind: r.kind === "exclude" ? "exclude" : "include",
    polygon: poly.length >= 3 ? poly : null,
    classes_of_interest: [...(r.classes_of_interest ?? [])],
    match_mode: r.match_mode === "iou" ? "iou" : "centroid",
    linger_threshold_seconds: Number(r.linger_threshold_seconds ?? 60),
    notify_enabled: r.notify_enabled !== false,
    windowed: !!tw,
    winStart: tw ? tw.start : "18:00",
    winEnd: tw ? tw.end : "06:00",
    winTz: tw ? tw.tz || browserTz() : browserTz(),
    winDays: tw ? [...tw.days] : [1, 2, 3, 4, 5],
  };
}

/** Stable serialization of a draft for dirty comparison. */
function draftKey(d: RoiDraft): string {
  return JSON.stringify({
    name: d.name,
    description: d.description,
    kind: d.kind,
    polygon: d.polygon,
    classes: [...d.classes_of_interest].sort(),
    match_mode: d.match_mode,
    linger: d.linger_threshold_seconds,
    notify: d.notify_enabled,
    win: d.windowed
      ? {
          s: d.winStart,
          e: d.winEnd,
          tz: d.winTz.trim(),
          days: [...d.winDays].sort((a, b) => a - b),
        }
      : null,
  });
}

/** True if `draft` differs from the stored ROI it was hydrated from. */
export function draftDirty(draft: RoiDraft, base: RoiDraft | null): boolean {
  if (!base) {
    // New (unsaved) zone: dirty once any geometry exists. Fresh-but-untouched
    // defaults shouldn't trip the unsaved guard before a box is drawn.
    return draft.polygon != null && draft.polygon.length >= 3;
  }
  return draftKey(draft) !== draftKey(base);
}

/** Client-side mirror of the backend Zod ROI validation. */
export function validateDraft(d: RoiDraft): string | null {
  if (!d.name.trim()) return "Give the zone a name.";
  if (!d.polygon || d.polygon.length < 3)
    return "Draw a region: drag a box on the snapshot.";
  // Exclusion zones ignore everything inside them — classes/window/linger
  // don't apply.
  if (d.kind !== "exclude" && d.classes_of_interest.length === 0)
    return "Pick at least one class of interest.";
  if (
    !Number.isFinite(d.linger_threshold_seconds) ||
    d.linger_threshold_seconds < 0 ||
    d.linger_threshold_seconds > 3600
  )
    return "Linger threshold must be between 0 and 3600 seconds.";
  if (d.windowed && (!d.winStart || !d.winEnd))
    return "Set both a start and end time for the detection window.";
  return null;
}

/** Body for POST/PATCH /rois built from a draft. */
export function roiPayload(d: RoiDraft) {
  return {
    name: d.name.trim(),
    description: d.description,
    kind: d.kind,
    polygon: d.polygon ?? [],
    // Exclusion zones ignore everything inside them regardless of class.
    classes_of_interest:
      d.kind === "exclude" ? [] : d.classes_of_interest,
    match_mode: d.match_mode,
    linger_threshold_seconds: d.linger_threshold_seconds,
    notify_enabled: d.notify_enabled,
    detection_window: buildDetectionWindow(d),
  };
}

/** COCO-ish class list Overwatch ships with (detector fallback). */
export const DEFAULT_CLASSES = [
  "person",
  "car",
  "truck",
  "bicycle",
  "motorcycle",
  "bus",
  "dog",
  "cat",
  "bird",
  "backpack",
];
