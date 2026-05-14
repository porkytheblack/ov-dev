import type { Bbox } from "@overwatch/schemas/events";

export type Point = { x: number; y: number };
export type Polygon = Point[];

/**
 * ROIs in the DB store polygons as either:
 *   - [[x,y], [x,y], ...]
 *   - [{x, y}, ...]
 * Normalize to {x,y}[].
 */
export function normalizePolygon(raw: unknown): Polygon {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => {
      if (Array.isArray(p) && p.length >= 2) return { x: Number(p[0]), y: Number(p[1]) };
      if (p && typeof p === "object" && "x" in p && "y" in p) {
        const o = p as { x: number; y: number };
        return { x: Number(o.x), y: Number(o.y) };
      }
      return null;
    })
    .filter((p): p is Point => p !== null);
}

export function centroid(b: Bbox): Point {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/** Even-odd rule point-in-polygon test. */
export function pointInPolygon(p: Point, poly: Polygon): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    const intersect =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || Number.EPSILON) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Approximate IoU between bbox and polygon's axis-aligned bounding box. */
export function bboxIou(bbox: Bbox, poly: Polygon): number {
  if (poly.length === 0) return 0;
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const px = Math.min(...xs);
  const py = Math.min(...ys);
  const pw = Math.max(...xs) - px;
  const ph = Math.max(...ys) - py;
  const ix1 = Math.max(bbox.x, px);
  const iy1 = Math.max(bbox.y, py);
  const ix2 = Math.min(bbox.x + bbox.w, px + pw);
  const iy2 = Math.min(bbox.y + bbox.h, py + ph);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  const union = bbox.w * bbox.h + pw * ph - inter;
  if (union <= 0) return 0;
  return inter / union;
}

export function matchesRoi(
  bbox: Bbox,
  poly: Polygon,
  mode: "centroid" | "iou",
  iouThreshold = 0.1,
): boolean {
  if (mode === "centroid") return pointInPolygon(centroid(bbox), poly);
  return bboxIou(bbox, poly) >= iouThreshold;
}

export type DetectionWindow =
  | { type: "always" }
  | {
      type: "time";
      start: string;
      end: string;
      tz: string;
      days: number[];
    };

export function isWithinDetectionWindow(window: DetectionWindow | undefined, when: Date): boolean {
  if (!window || window.type === "always") return true;
  const tz = window.tz || "UTC";
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(when);
  let hh = "00";
  let mm = "00";
  let wk = "Sun";
  for (const p of parts) {
    if (p.type === "hour") hh = p.value;
    else if (p.type === "minute") mm = p.value;
    else if (p.type === "weekday") wk = p.value;
  }
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const day = weekdayMap[wk] ?? new Date(when).getUTCDay();
  if (window.days && window.days.length > 0 && !window.days.includes(day)) return false;
  const cur = `${hh}:${mm}`;
  if (window.start <= window.end) {
    return cur >= window.start && cur <= window.end;
  }
  // Wraps midnight (e.g. 18:00 → 06:00).
  return cur >= window.start || cur <= window.end;
}
