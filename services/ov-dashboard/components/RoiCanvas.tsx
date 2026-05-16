"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { roiColor } from "@/lib/roiColors";

export type Pt = { x: number; y: number }; // normalized 0..1 of the IMAGE
export type RoiLite = { id: string; name: string; polygon: Pt[] };

export interface RoiCanvasProps {
  cameraId: string;
  /** All stored ROIs — render source for every non-selected zone. */
  rois: RoiLite[];
  /** Which existing ROI is selected (null when drawing a new one / none). */
  selectedRoiId: string | null;
  /** Geometry being edited / drawn — render source for the active zone. */
  draftPolygon: Pt[] | null;
  /** "draw" = the parent armed "+ Add region". */
  mode: "select" | "draw";
  /** The canvas hit an existing ROI, or empty space (null). */
  onSelect: (id: string | null) => void;
  /** Live geometry edits + new-rectangle drawing. */
  onDraftChange: (poly: Pt[] | null) => void;
  /** A brand-new rectangle finished — parent flips mode back to "select". */
  onAddComplete: () => void;
}

const MIN = 0.03; // minimum committed new-rect size (normalized)
const HANDLE_PX = 11; // resize handle box, constant SCREEN px
const VERTEX_PX = 12; // legacy-polygon vertex dot, constant SCREEN px
const CLICK_PX = 4; // pointer travel under this = a click, not a drag

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type Handle = (typeof HANDLES)[number];

type Rect = { x: number; y: number; w: number; h: number };

type Drag =
  | { kind: "none" }
  | { kind: "new" }
  | { kind: "pan" }
  | { kind: "move"; dx: number; dy: number }
  | { kind: "resize"; h: Handle }
  | { kind: "vertex"; i: number };

/** Screen position of the image's top-left + its on-screen pixel size. */
type View = { scale: number; panX: number; panY: number };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

function bbox(poly: Pt[]): Rect | null {
  if (!poly || poly.length < 2) return null;
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function rectToPoly(r: Rect): Pt[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}

/** A 4-point polygon whose points form an axis-aligned rectangle. */
function isRect(poly: Pt[]): boolean {
  if (poly.length !== 4) return false;
  const xs = new Set(poly.map((p) => Math.round(p.x * 1e4)));
  const ys = new Set(poly.map((p) => Math.round(p.y * 1e4)));
  return xs.size === 2 && ys.size === 2;
}

function handlePos(hd: Handle, r: Rect): [number, number] {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  switch (hd) {
    case "nw": return [r.x, r.y];
    case "n": return [cx, r.y];
    case "ne": return [r.x + r.w, r.y];
    case "e": return [r.x + r.w, cy];
    case "se": return [r.x + r.w, r.y + r.h];
    case "s": return [cx, r.y + r.h];
    case "sw": return [r.x, r.y + r.h];
    case "w": return [r.x, cy];
  }
}

/** Ray-casting point-in-polygon (works for arbitrary N-point polygons). */
function pointInPoly(px: number, py: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Top vertex (lowest y; leftmost tiebreak) — anchors the name label. */
function topVertex(poly: Pt[]): Pt {
  return poly.reduce((best, p) =>
    p.y < best.y - 1e-9 || (Math.abs(p.y - best.y) < 1e-9 && p.x < best.x)
      ? p
      : best,
  );
}

/**
 * Region-of-interest editor.
 *
 * ONE canvas draws everything — the camera snapshot AND every ROI — under a
 * single zoom/pan transform. Because the image is rendered with `drawImage`
 * at its true `naturalW:naturalH` ratio (uniform `scale`, never two different
 * scales), the frame can never be aspect-distorted into a "long rectangle",
 * and an ROI can never drift out of register with the picture: they live in
 * the same coordinate space by construction.
 *
 * Coordinates: ROI points are normalized 0..1 of the IMAGE (unchanged wire
 * format). screen = pan + norm * (natural * scale). The viewport is a fixed
 * 16:9 black frame; an off-ratio camera is letterboxed (not stretched) and
 * the user can zoom (wheel / ± buttons) and pan (drag empty space, or hold
 * Space) to reach any part of the field of view.
 */
export function RoiCanvas({
  cameraId,
  rois,
  selectedRoiId,
  draftPolygon,
  mode,
  onSelect,
  onDraftChange,
  onAddComplete,
}: RoiCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [imageReady, setImageReady] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [zoomPct, setZoomPct] = useState(100);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  // Viewport adopts the camera's TRUE aspect (no fixed 16:9 → no stretched
  // "long rectangle", no giant letterbox bars for a portrait sensor like
  // 960×1088). 16:9 is only the placeholder shape before the first frame.
  const [aspect, setAspect] = useState(16 / 9);

  // The decoded snapshot + its natural pixel size.
  const imgElRef = useRef<HTMLImageElement | null>(null);
  const natRef = useRef<{ w: number; h: number } | null>(null);
  // Image top-left screen position (panX/panY) + screen-px-per-image-px.
  const viewRef = useRef<View>({ scale: 1, panX: 0, panY: 0 });
  // Once the user zooms/pans, a resize/refresh keeps their framing instead of
  // snapping back to "fit".
  const userAdjustedRef = useRef(false);

  const dragRef = useRef<Drag>({ kind: "none" });
  const anchorRef = useRef<Pt | null>(null);
  const downScreenRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const panStartRef = useRef<{ px: number; py: number; panX: number; panY: number } | null>(
    null,
  );
  const spaceRef = useRef(false);
  // Active geometry the canvas actually draws — updated SYNCHRONOUSLY in the
  // pointer handlers so the box renders the instant you drag, independent of
  // the parent round-trip (setState → prop → effect). Idle, it tracks the
  // prop so parent-driven changes (select / discard / save) still render.
  const liveDraftRef = useRef<Pt[] | null>(draftPolygon);
  const pendingNewRectRef = useRef<Rect | null>(null);
  const rafRef = useRef<number | null>(null); // draw scheduling
  const moveRafRef = useRef<number | null>(null); // pointer-move coalescing

  const cb = useRef({ onSelect, onDraftChange, onAddComplete });
  useEffect(() => {
    cb.current = { onSelect, onDraftChange, onAddComplete };
  });

  const stateRef = useRef({ rois, selectedRoiId, draftPolygon, mode });
  useEffect(() => {
    stateRef.current = { rois, selectedRoiId, draftPolygon, mode };
  });

  // ── Geometry helpers (depend on the live view transform) ────────────────
  /** Image draw box in CSS px: origin + on-screen size. */
  const disp = useCallback(() => {
    const nat = natRef.current;
    const v = viewRef.current;
    const w = (nat?.w ?? 1) * v.scale;
    const h = (nat?.h ?? 1) * v.scale;
    return { ox: v.panX, oy: v.panY, w, h };
  }, []);

  const vpSize = useCallback(() => {
    const c = canvasRef.current;
    const r = c?.getBoundingClientRect();
    return { w: Math.max(1, r?.width ?? 1), h: Math.max(1, r?.height ?? 1) };
  }, []);

  /** client (px) → normalized image coords (unclamped; caller clamps). */
  const screenToNorm = useCallback(
    (clientX: number, clientY: number): Pt => {
      const c = canvasRef.current!;
      const b = c.getBoundingClientRect();
      const d = disp();
      return {
        x: (clientX - b.left - d.ox) / (d.w || 1),
        y: (clientY - b.top - d.oy) / (d.h || 1),
      };
    },
    [disp],
  );

  const clampPan = useCallback(() => {
    const v = viewRef.current;
    const d = disp();
    const vp = vpSize();
    // Smaller-than-viewport axis → center it; larger → edge-locked pan
    // (pan ∈ [vpExt − extent, 0], i.e. you can't scroll past an edge).
    const axis = (extent: number, vpExt: number, cur: number) =>
      extent <= vpExt ? (vpExt - extent) / 2 : clamp(cur, vpExt - extent, 0);
    v.panX = axis(d.w, vp.w, v.panX);
    v.panY = axis(d.h, vp.h, v.panY);
  }, [disp, vpSize]);

  const applyZoom = useCallback(
    (nextScale: number, centerX: number, centerY: number) => {
      const nat = natRef.current;
      if (!nat) return;
      const vp = vpSize();
      const fitScale = Math.min(vp.w / nat.w, vp.h / nat.h);
      const lo = fitScale * 0.5;
      const hi = fitScale * 16;
      const v = viewRef.current;
      const ns = clamp(nextScale, lo, hi);
      // Keep the image point under (centerX,centerY) pinned across the zoom.
      const ix = (centerX - v.panX) / v.scale;
      const iy = (centerY - v.panY) / v.scale;
      v.scale = ns;
      v.panX = centerX - ix * ns;
      v.panY = centerY - iy * ns;
      userAdjustedRef.current = true;
      clampPan();
      setZoomPct(Math.round((ns / fitScale) * 100));
    },
    [vpSize, clampPan],
  );

  const fitView = useCallback(() => {
    const nat = natRef.current;
    if (!nat) return;
    const vp = vpSize();
    const scale = Math.min(vp.w / nat.w, vp.h / nat.h);
    viewRef.current = {
      scale,
      panX: (vp.w - nat.w * scale) / 2,
      panY: (vp.h - nat.h * scale) / 2,
    };
    userAdjustedRef.current = false;
    setZoomPct(100);
  }, [vpSize]);

  // ── Snapshot loading ───────────────────────────────────────────────────
  const loadSnapshot = useCallback(() => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      imgElRef.current = img;
      natRef.current = { w: img.naturalWidth || 1, h: img.naturalHeight || 1 };
      setAspect((img.naturalWidth || 16) / (img.naturalHeight || 9));
      setImageError(null);
      setImageReady(true);
      if (!userAdjustedRef.current) fitView();
      else clampPan();
      scheduleDraw();
    };
    img.onerror = () => {
      setImageReady(false);
      setImageError("Waiting for camera frames…");
      scheduleDraw();
    };
    img.src = `/api/cameras/${cameraId}/snapshot?t=${Date.now()}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraId, fitView, clampPan]);

  const refresh = useCallback(() => {
    setImageError(null);
    loadSnapshot();
  }, [loadSnapshot]);

  // Initial load + retry every 3s until the first frame arrives.
  useEffect(() => {
    loadSnapshot();
    const i = setInterval(() => {
      if (!imgElRef.current) loadSnapshot();
    }, 3000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraId]);

  // ── Rendering ──────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(1, rect.width);
    const cssH = Math.max(1, rect.height);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // DPR-sharp; draw in CSS px
    ctx.clearRect(0, 0, cssW, cssH);

    const img = imgElRef.current;
    if (!img) return; // viewport stays black; HTML overlay shows the status

    const d = disp(); // image draw box in CSS px (true aspect)
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, d.ox, d.oy, d.w, d.h);

    // norm (0..1 of image) → screen CSS px
    const sx = (nx: number) => d.ox + nx * d.w;
    const sy = (ny: number) => d.oy + ny * d.h;

    const { rois: allRois, selectedRoiId: selId } = stateRef.current;
    const draft = liveDraftRef.current;
    const dragKind = dragRef.current.kind;

    const drawPolygon = (
      poly: Pt[],
      color: string,
      opts: { active?: boolean; hover?: boolean; dashed?: boolean },
    ) => {
      if (poly.length < 2) return;
      ctx.beginPath();
      poly.forEach((p, idx) => {
        const x = sx(p.x);
        const y = sy(p.y);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = hexToRgba(
        color,
        opts.active ? 0.2 : opts.hover ? 0.16 : 0.1,
      );
      ctx.fill();
      if (opts.active) {
        ctx.setLineDash([]);
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.lineWidth = 5;
        ctx.stroke();
      }
      ctx.setLineDash(opts.dashed ? [6, 4] : []);
      ctx.strokeStyle = color;
      ctx.lineWidth = opts.active ? 2.5 : opts.hover ? 2 : 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const drawLabel = (poly: Pt[], text: string, color: string) => {
      const tv = topVertex(poly);
      const lx = sx(tv.x);
      const ly = sy(tv.y);
      ctx.font = "600 11px var(--font-mono), ui-monospace, monospace";
      const tw = ctx.measureText(text).width;
      const padX = 6;
      const bw = tw + padX * 2;
      const bh = 18;
      let bx = lx - 1;
      let by = ly - bh - 4;
      if (by < 0) by = ly + 4;
      if (bx + bw > cssW) bx = cssW - bw;
      if (bx < 0) bx = 0;
      ctx.fillStyle = "rgba(8,10,14,0.82)";
      roundRect(ctx, bx, by, bw, bh, 4);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(color, 0.7);
      ctx.lineWidth = 1;
      roundRect(ctx, bx, by, bw, bh, 4);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.textBaseline = "middle";
      ctx.fillText(text, bx + padX, by + bh / 2 + 1);
    };

    // 1) Every stored ROI except the selected one (the selected zone is drawn
    //    from the live draft so edits show immediately).
    allRois.forEach((r, i) => {
      if (r.id === selId) return;
      const color = roiColor(i);
      drawPolygon(r.polygon, color, { hover: hoverId === r.id });
      drawLabel(r.polygon, r.name, color);
    });

    // 2) Active geometry: in-progress new rectangle (dashed marquee, like a
    //    Figma frame) or the selected zone's working copy (solid + handles).
    if (draft && draft.length >= 2) {
      const selIdx = allRois.findIndex((r) => r.id === selId);
      const color = selIdx >= 0 ? roiColor(selIdx) : cssVar("--accent", "#f5ad4a");
      const drawingNew = dragKind === "new";
      drawPolygon(draft, color, { active: !drawingNew, dashed: drawingNew });
      if (selIdx >= 0) drawLabel(draft, allRois[selIdx].name, color);

      if (!drawingNew) {
        if (isRect(draft) || draft.length === 4) {
          const r = bbox(draft);
          if (r) {
            ctx.fillStyle = color;
            ctx.strokeStyle = "rgba(0,0,0,0.85)";
            ctx.lineWidth = 1;
            for (const hd of HANDLES) {
              const [hx, hy] = handlePos(hd, r);
              const px = sx(hx);
              const py = sy(hy);
              ctx.beginPath();
              ctx.rect(
                px - HANDLE_PX / 2,
                py - HANDLE_PX / 2,
                HANDLE_PX,
                HANDLE_PX,
              );
              ctx.fill();
              ctx.stroke();
            }
          }
        } else {
          ctx.fillStyle = color;
          ctx.strokeStyle = "rgba(0,0,0,0.85)";
          ctx.lineWidth = 1;
          draft.forEach((p) => {
            ctx.beginPath();
            ctx.arc(sx(p.x), sy(p.y), VERTEX_PX / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          });
        }
      }
    }
  }, [hoverId, disp]);

  const scheduleDraw = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      draw();
    });
  }, [draw]);

  const pushDraft = useCallback(
    (poly: Pt[] | null) => {
      liveDraftRef.current = poly;
      scheduleDraw();
      cb.current.onDraftChange(poly);
    },
    [scheduleDraw],
  );

  // Redraw on input change. While idle, keep the live ref synced to the prop
  // so parent-driven changes render; during a drag the handlers own it.
  useEffect(() => {
    if (dragRef.current.kind === "none") liveDraftRef.current = draftPolygon;
    scheduleDraw();
  }, [scheduleDraw, rois, selectedRoiId, draftPolygon, mode, imageReady, hoverId]);

  // Keep the overlay pixel-aligned + framing sane as the panel resizes.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (!natRef.current) {
        scheduleDraw();
        return;
      }
      if (userAdjustedRef.current) clampPan();
      else fitView();
      scheduleDraw();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [scheduleDraw, clampPan, fitView]);

  // Wheel zoom — must be a non-passive listener to preventDefault the scroll.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      if (!natRef.current) return;
      e.preventDefault();
      const b = c.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0015);
      applyZoom(
        viewRef.current.scale * factor,
        e.clientX - b.left,
        e.clientY - b.top,
      );
      scheduleDraw();
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  }, [applyZoom, scheduleDraw]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (moveRafRef.current != null) cancelAnimationFrame(moveRafRef.current);
    },
    [],
  );

  // ── Hit-testing (normalized space; tolerances are constant SCREEN px) ────
  function hitHandle(p: Pt): Handle | null {
    const draft = liveDraftRef.current;
    if (!draft || !(isRect(draft) || draft.length === 4)) return null;
    const r = bbox(draft);
    if (!r) return null;
    const d = disp();
    const tolX = (HANDLE_PX + 6) / (d.w || 1);
    const tolY = (HANDLE_PX + 6) / (d.h || 1);
    for (const hd of HANDLES) {
      const [hx, hy] = handlePos(hd, r);
      if (Math.abs(p.x - hx) <= tolX && Math.abs(p.y - hy) <= tolY) return hd;
    }
    return null;
  }

  function hitVertex(p: Pt): number | null {
    const draft = liveDraftRef.current;
    if (!draft || isRect(draft) || draft.length === 4) return null;
    const d = disp();
    const tolX = (VERTEX_PX + 6) / (d.w || 1);
    const tolY = (VERTEX_PX + 6) / (d.h || 1);
    for (let i = 0; i < draft.length; i++) {
      if (
        Math.abs(p.x - draft[i].x) <= tolX &&
        Math.abs(p.y - draft[i].y) <= tolY
      )
        return i;
    }
    return null;
  }

  function hitRoi(p: Pt): string | null {
    const all = stateRef.current.rois;
    for (let i = all.length - 1; i >= 0; i--) {
      if (pointInPoly(p.x, p.y, all[i].polygon)) return all[i].id;
    }
    return null;
  }

  // ── Pointer interaction ────────────────────────────────────────────────
  function beginPan(e: React.PointerEvent) {
    dragRef.current = { kind: "pan" };
    panStartRef.current = {
      px: e.clientX,
      py: e.clientY,
      panX: viewRef.current.panX,
      panY: viewRef.current.panY,
    };
    setPanning(true);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!imgElRef.current) return;
    canvasRef.current?.focus();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    downScreenRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;

    const m = stateRef.current.mode;
    const p = screenToNorm(e.clientX, e.clientY);

    // Middle-button or Space-held = pan, regardless of tool.
    if (e.button === 1 || spaceRef.current) {
      beginPan(e);
      return;
    }

    if (m === "draw") {
      const a = { x: clamp01(p.x), y: clamp01(p.y) };
      dragRef.current = { kind: "new" };
      anchorRef.current = a;
      pendingNewRectRef.current = { x: a.x, y: a.y, w: 0, h: 0 };
      pushDraft(rectToPoly({ x: a.x, y: a.y, w: 0, h: 0 }));
      return;
    }

    // Select mode: edit affordances on the active polygon take priority.
    const hd = hitHandle(p);
    if (hd) {
      dragRef.current = { kind: "resize", h: hd };
      return;
    }
    const vi = hitVertex(p);
    if (vi != null) {
      dragRef.current = { kind: "vertex", i: vi };
      return;
    }
    const draft = liveDraftRef.current;
    if (draft && pointInPoly(p.x, p.y, draft)) {
      const b = bbox(draft);
      dragRef.current = {
        kind: "move",
        dx: p.x - (b?.x ?? p.x),
        dy: p.y - (b?.y ?? p.y),
      };
      return;
    }
    const id = hitRoi(p);
    if (id) {
      dragRef.current = { kind: "none" };
      cb.current.onSelect(id);
      return;
    }
    // Empty space: a drag pans the field of view; a click (no travel)
    // deselects. The deselect is deferred to pointer-up so a pan never
    // clears the selection.
    beginPan(e);
  }

  function applyMove(p: Pt) {
    const d = dragRef.current;

    if (d.kind === "new") {
      const a = anchorRef.current ?? p;
      const cp = { x: clamp01(p.x), y: clamp01(p.y) };
      const nr = {
        x: Math.min(a.x, cp.x),
        y: Math.min(a.y, cp.y),
        w: Math.abs(cp.x - a.x),
        h: Math.abs(cp.y - a.y),
      };
      pendingNewRectRef.current = nr;
      pushDraft(rectToPoly(nr));
      return;
    }

    const draft = liveDraftRef.current;
    if (!draft) return;

    if (d.kind === "vertex") {
      pushDraft(
        draft.map((pt, i) =>
          i === d.i ? { x: clamp01(p.x), y: clamp01(p.y) } : pt,
        ),
      );
      return;
    }

    const r = bbox(draft);
    if (!r) return;

    if (d.kind === "move") {
      const nx = clamp01(Math.min(p.x - d.dx, 1 - r.w));
      const ny = clamp01(Math.min(p.y - d.dy, 1 - r.h));
      pushDraft(rectToPoly({ x: nx, y: ny, w: r.w, h: r.h }));
      return;
    }

    if (d.kind === "resize") {
      let { x, y, w, h } = r;
      const right = x + w;
      const bottom = y + h;
      const hd = d.h;
      if (hd.includes("n")) {
        y = Math.min(p.y, bottom - MIN);
        h = bottom - y;
      }
      if (hd.includes("s")) h = Math.max(MIN, p.y - y);
      if (hd.includes("w")) {
        x = Math.min(p.x, right - MIN);
        w = right - x;
      }
      if (hd.includes("e")) w = Math.max(MIN, p.x - x);
      pushDraft(
        rectToPoly({
          x: clamp01(x),
          y: clamp01(y),
          w: Math.min(w, 1 - clamp01(x)),
          h: Math.min(h, 1 - clamp01(y)),
        }),
      );
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;

    const down = downScreenRef.current;
    if (down && !movedRef.current) {
      if (
        Math.abs(e.clientX - down.x) > CLICK_PX ||
        Math.abs(e.clientY - down.y) > CLICK_PX
      )
        movedRef.current = true;
    }

    if (d.kind === "pan") {
      const s = panStartRef.current;
      if (!s) return;
      viewRef.current.panX = s.panX + (e.clientX - s.px);
      viewRef.current.panY = s.panY + (e.clientY - s.py);
      userAdjustedRef.current = true;
      clampPan();
      scheduleDraw();
      return;
    }

    if (d.kind === "none") {
      if (stateRef.current.mode === "select" && !spaceRef.current) {
        const p = screenToNorm(e.clientX, e.clientY);
        const draft = liveDraftRef.current;
        const overDraft = draft ? pointInPoly(p.x, p.y, draft) : false;
        const id = overDraft ? null : hitRoi(p);
        if (id !== hoverId) setHoverId(id);
      }
      return;
    }

    const p = screenToNorm(e.clientX, e.clientY);
    if (moveRafRef.current != null) cancelAnimationFrame(moveRafRef.current);
    moveRafRef.current = requestAnimationFrame(() => {
      moveRafRef.current = null;
      applyMove(p);
    });
  }

  function endDrag() {
    const d = dragRef.current;
    dragRef.current = { kind: "none" };
    anchorRef.current = null;
    panStartRef.current = null;
    if (moveRafRef.current != null) {
      cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = null;
    }
    if (d.kind === "pan") {
      setPanning(false);
      // Empty-space click with no travel = deselect.
      if (!movedRef.current && stateRef.current.mode === "select") {
        cb.current.onSelect(null);
      }
      scheduleDraw();
      return;
    }
    if (d.kind === "new") {
      const r = pendingNewRectRef.current;
      pendingNewRectRef.current = null;
      if (!r || r.w < MIN || r.h < MIN) {
        pushDraft(null); // click without a real drag — stay in draw
      } else {
        pushDraft(rectToPoly(r));
        cb.current.onAddComplete();
      }
    }
    scheduleDraw(); // repaint solid + handles now the marquee is committed
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === " " || e.code === "Space") {
      if (!spaceRef.current) {
        spaceRef.current = true;
        setSpaceHeld(true);
      }
      e.preventDefault();
      return;
    }
    const draft = liveDraftRef.current;
    if (e.key === "Escape") {
      e.preventDefault();
      cb.current.onSelect(null);
      return;
    }
    if (!draft) return;
    const step = e.shiftKey ? 0.02 : 0.005;
    let dx = 0;
    let dy = 0;
    if (e.key === "ArrowUp") dy = -step;
    else if (e.key === "ArrowDown") dy = step;
    else if (e.key === "ArrowLeft") dx = -step;
    else if (e.key === "ArrowRight") dx = step;
    else return;
    e.preventDefault();
    const minX = Math.min(...draft.map((p) => p.x));
    const maxX = Math.max(...draft.map((p) => p.x));
    const minY = Math.min(...draft.map((p) => p.y));
    const maxY = Math.max(...draft.map((p) => p.y));
    dx = Math.max(-minX, Math.min(dx, 1 - maxX));
    dy = Math.max(-minY, Math.min(dy, 1 - maxY));
    if (dx === 0 && dy === 0) return;
    pushDraft(draft.map((p) => ({ x: p.x + dx, y: p.y + dy })));
  }

  function onKeyUp(e: React.KeyboardEvent) {
    if (e.key === " " || e.code === "Space") {
      spaceRef.current = false;
      setSpaceHeld(false);
    }
  }

  const zoomBtn = (factor: number) => {
    const vp = vpSize();
    applyZoom(viewRef.current.scale * factor, vp.w / 2, vp.h / 2);
    scheduleDraw();
  };

  const cursor =
    panning
      ? "cursor-grabbing"
      : spaceHeld
        ? "cursor-grab"
        : mode === "draw"
          ? "cursor-crosshair"
          : draftPolygon
            ? "cursor-move"
            : hoverId
              ? "cursor-pointer"
              : "cursor-default";

  return (
    <div>
      <div
        ref={containerRef}
        className="relative w-full mx-auto bg-black border border-border rounded-md overflow-hidden"
        style={{ aspectRatio: String(aspect), maxHeight: "72vh" }}
      >
        <canvas
          ref={canvasRef}
          tabIndex={0}
          role="application"
          aria-label="Region of interest editor"
          className={`absolute inset-0 w-full h-full outline-none touch-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--ring)] ${cursor}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={() => {
            if (dragRef.current.kind === "none" && hoverId) setHoverId(null);
          }}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
        />
        {!imageReady && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-text-dim mono text-[11px] uppercase tracking-[0.08em]">
              {imageError ?? "loading snapshot…"}
            </div>
          </div>
        )}

        {/* Zoom / fit controls — overlaid bottom-right, out of the draw area. */}
        {imageReady && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-[rgba(8,10,14,0.78)] border border-border-strong px-1 py-1">
            <button
              type="button"
              title="Zoom out"
              className="h-7 w-7 grid place-items-center rounded text-text-muted hover:text-text hover:bg-surface-elev"
              onClick={() => zoomBtn(1 / 1.25)}
            >
              −
            </button>
            <button
              type="button"
              title="Fit to view"
              className="h-7 px-2 rounded text-[11px] mono text-text-muted hover:text-text hover:bg-surface-elev tabular-nums"
              onClick={() => {
                fitView();
                scheduleDraw();
              }}
            >
              {zoomPct}%
            </button>
            <button
              type="button"
              title="Zoom in"
              className="h-7 w-7 grid place-items-center rounded text-text-muted hover:text-text hover:bg-surface-elev"
              onClick={() => zoomBtn(1.25)}
            >
              +
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button className="btn" type="button" onClick={refresh}>
          Refresh frame
        </button>
        <span className="mono text-[11px] text-text-dim">
          {mode === "draw"
            ? "Drag to draw a region · Space-drag pans · scroll zooms · Esc cancels"
            : draftPolygon
              ? "Drag the box / handles to adjust · arrows nudge · drag empty space to pan · Esc deselect"
              : "Click a zone to edit · drag empty space (or Space) to pan · scroll to zoom"}
        </span>
      </div>

      {/* Color legend — clicking a chip selects that ROI. */}
      {rois.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {rois.map((r, i) => {
            const active = r.id === selectedRoiId;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelect(r.id)}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] mono whitespace-nowrap transition-colors ${
                  active
                    ? "border-accent text-accent bg-[color:var(--accent-soft)]"
                    : "border-border-strong text-text-muted hover:text-text hover:bg-surface-elev"
                }`}
                title={`Select ${r.name}`}
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: roiColor(i) }}
                />
                {r.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── small canvas helpers ─────────────────────────────────────────────────
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  const full =
    m.length === 3
      ? m
          .split("")
          .map((c) => c + c)
          .join("")
      : m;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}
