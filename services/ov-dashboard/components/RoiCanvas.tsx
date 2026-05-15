"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { roiColor } from "@/lib/roiColors";

export type Pt = { x: number; y: number }; // normalized 0..1
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

const MIN = 0.03; // minimum new-rect size (normalized)
const HANDLE_PX = 11; // touch-friendly (>=10px)
const VERTEX_PX = 12; // legacy-polygon vertex dot hit size

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type Handle = (typeof HANDLES)[number];

type Rect = { x: number; y: number; w: number; h: number };

type Drag =
  | { kind: "none" }
  | { kind: "new" }
  | { kind: "move"; dx: number; dy: number }
  | { kind: "resize"; h: Handle }
  | { kind: "vertex"; i: number };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

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
 * Multi-ROI editing canvas. Renders the live camera snapshot at its natural
 * aspect (shrink-wrap wrapper + absolutely-positioned overlay canvas, exactly
 * as the old RoiEditor) so normalized 0..1 coordinates map 1:1 to pixels.
 *
 * Every frame draws ALL stored ROIs (colored by their palette index) plus the
 * active geometry (`draftPolygon`) emphasized on top. Rectangles get 8 resize
 * handles + move; legacy non-rectangular polygons get draggable vertex dots.
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
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [imageReady, setImageReady] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const dragRef = useRef<Drag>({ kind: "none" });
  const anchorRef = useRef<Pt | null>(null);
  const rafRef = useRef<number | null>(null);

  // Stable callback refs so a changing parent identity never re-fires effects
  // or detaches listeners mid-drag.
  const cb = useRef({ onSelect, onDraftChange, onAddComplete });
  useEffect(() => {
    cb.current = { onSelect, onDraftChange, onAddComplete };
  });

  // Latest geometry/selection in refs for pointer handlers (avoids stale
  // closures without re-binding listeners).
  const stateRef = useRef({ rois, selectedRoiId, draftPolygon, mode });
  useEffect(() => {
    stateRef.current = { rois, selectedRoiId, draftPolygon, mode };
  });

  const refresh = useCallback(() => {
    if (!imgRef.current) return;
    setImageError(null);
    imgRef.current.src = `/api/cameras/${cameraId}/snapshot?t=${Date.now()}`;
  }, [cameraId]);

  // Initial load + retry-until-frame every 3s while no frame has arrived
  // (preserved from the old RoiEditor).
  useEffect(() => {
    refresh();
    const i = setInterval(() => {
      if (!imageReady) refresh();
    }, 3000);
    return () => clearInterval(i);
  }, [refresh, imageReady]);

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

    const { rois: allRois, selectedRoiId: selId, draftPolygon: draft } =
      stateRef.current;

    const drawPolygon = (
      poly: Pt[],
      color: string,
      opts: { active?: boolean; hover?: boolean },
    ) => {
      if (poly.length < 2) return;
      ctx.beginPath();
      poly.forEach((p, idx) => {
        const x = p.x * cssW;
        const y = p.y * cssH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();

      // Translucent fill (slightly stronger when active / hovered).
      ctx.fillStyle = hexToRgba(color, opts.active ? 0.2 : opts.hover ? 0.16 : 0.1);
      ctx.fill();

      // Dark casing under an emphasized active stroke keeps it legible on
      // bright scenes.
      if (opts.active) {
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.lineWidth = 5;
        ctx.stroke();
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = opts.active ? 2.5 : opts.hover ? 2 : 1.5;
      ctx.stroke();
    };

    const drawLabel = (poly: Pt[], text: string, color: string) => {
      const tv = topVertex(poly);
      const lx = tv.x * cssW;
      const ly = tv.y * cssH;
      ctx.font =
        "600 11px var(--font-mono), ui-monospace, monospace";
      const tw = ctx.measureText(text).width;
      const padX = 6;
      const padY = 4;
      const bw = tw + padX * 2;
      const bh = 18;
      // Clamp the pill inside the canvas; sit it just above the vertex.
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
      ctx.fillText(text, bx + padX, by + bh / 2 + padY / 2 - 1);
    };

    // 1) All stored ROIs except the selected one (selected is drawn from the
    //    live draft on top so edits are visible immediately).
    allRois.forEach((r, i) => {
      if (r.id === selId) return;
      const color = roiColor(i);
      drawPolygon(r.polygon, color, { hover: hoverId === r.id });
      drawLabel(r.polygon, r.name, color);
    });

    // 2) Active geometry: the selected ROI's working copy, or an in-progress
    //    new rectangle. Drawn emphasized, on top.
    if (draft && draft.length >= 2) {
      const selIdx = allRois.findIndex((r) => r.id === selId);
      const color = selIdx >= 0 ? roiColor(selIdx) : "var(--accent)";
      const resolved =
        color === "var(--accent)" ? cssVar("--accent", "#f5ad4a") : color;
      drawPolygon(draft, resolved, { active: true });
      const selName =
        selIdx >= 0 ? allRois[selIdx].name : undefined;
      if (selName) drawLabel(draft, selName, resolved);

      // Editing affordances for the active polygon.
      if (isRect(draft) || draft.length === 4) {
        const r = bbox(draft);
        if (r) {
          ctx.fillStyle = resolved;
          ctx.strokeStyle = "rgba(0,0,0,0.85)";
          ctx.lineWidth = 1;
          for (const hd of HANDLES) {
            const [hx, hy] = handlePos(hd, r);
            const px = hx * cssW;
            const py = hy * cssH;
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
        // Legacy non-rectangular polygon: draggable vertex dots.
        ctx.fillStyle = resolved;
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.lineWidth = 1;
        draft.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x * cssW, p.y * cssH, VERTEX_PX / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }
    }
  }, [hoverId]);

  const scheduleDraw = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      draw();
    });
  }, [draw]);

  // Redraw on any input change.
  useEffect(() => {
    scheduleDraw();
  }, [scheduleDraw, rois, selectedRoiId, draftPolygon, mode, imageReady, hoverId]);

  // ResizeObserver on the wrapper (NOT window.resize) keeps the overlay
  // pixel-aligned with the shrink-wrapped image at any container width.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => scheduleDraw());
    ro.observe(el);
    return () => ro.disconnect();
  }, [scheduleDraw]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  // ── Pointer interaction ────────────────────────────────────────────────
  function ptr(e: React.PointerEvent): Pt & { w: number; h: number } {
    const c = canvasRef.current!;
    const b = c.getBoundingClientRect();
    return {
      x: clamp01((e.clientX - b.left) / b.width),
      y: clamp01((e.clientY - b.top) / b.height),
      w: b.width,
      h: b.height,
    };
  }

  function hitHandle(p: Pt, w: number, h: number): Handle | null {
    const draft = stateRef.current.draftPolygon;
    if (!draft || !(isRect(draft) || draft.length === 4)) return null;
    const r = bbox(draft);
    if (!r) return null;
    const tolX = (HANDLE_PX + 6) / w;
    const tolY = (HANDLE_PX + 6) / h;
    for (const hd of HANDLES) {
      const [hx, hy] = handlePos(hd, r);
      if (Math.abs(p.x - hx) <= tolX && Math.abs(p.y - hy) <= tolY) return hd;
    }
    return null;
  }

  function hitVertex(p: Pt, w: number, h: number): number | null {
    const draft = stateRef.current.draftPolygon;
    if (!draft || isRect(draft) || draft.length === 4) return null;
    const tolX = (VERTEX_PX + 6) / w;
    const tolY = (VERTEX_PX + 6) / h;
    for (let i = 0; i < draft.length; i++) {
      if (
        Math.abs(p.x - draft[i].x) <= tolX &&
        Math.abs(p.y - draft[i].y) <= tolY
      )
        return i;
    }
    return null;
  }

  /** Topmost ROI under the point (last-drawn wins for overlaps). */
  function hitRoi(p: Pt): string | null {
    const all = stateRef.current.rois;
    for (let i = all.length - 1; i >= 0; i--) {
      if (pointInPoly(p.x, p.y, all[i].polygon)) return all[i].id;
    }
    return null;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!imageReady) return;
    canvasRef.current?.focus();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = ptr(e);
    const { draftPolygon: draft, mode: m } = stateRef.current;

    // Draw mode: anchor a brand-new rectangle.
    if (m === "draw") {
      dragRef.current = { kind: "new" };
      anchorRef.current = { x: p.x, y: p.y };
      cb.current.onDraftChange(rectToPoly({ x: p.x, y: p.y, w: 0, h: 0 }));
      return;
    }

    // Edit affordances on the active polygon take priority.
    const hd = hitHandle(p, p.w, p.h);
    if (hd) {
      dragRef.current = { kind: "resize", h: hd };
      return;
    }
    const vi = hitVertex(p, p.w, p.h);
    if (vi != null) {
      dragRef.current = { kind: "vertex", i: vi };
      return;
    }
    if (draft && pointInPoly(p.x, p.y, draft)) {
      const b = bbox(draft);
      dragRef.current = {
        kind: "move",
        dx: p.x - (b?.x ?? p.x),
        dy: p.y - (b?.y ?? p.y),
      };
      return;
    }

    // Otherwise: hit-test stored ROIs (select) or empty space (deselect).
    const id = hitRoi(p);
    dragRef.current = { kind: "none" };
    cb.current.onSelect(id);
  }

  function applyMove(p: Pt) {
    const d = dragRef.current;
    const draft = stateRef.current.draftPolygon;
    if (!draft) return;

    if (d.kind === "new") {
      const a = anchorRef.current ?? p;
      cb.current.onDraftChange(
        rectToPoly({
          x: Math.min(a.x, p.x),
          y: Math.min(a.y, p.y),
          w: Math.abs(p.x - a.x),
          h: Math.abs(p.y - a.y),
        }),
      );
      return;
    }

    if (d.kind === "vertex") {
      const next = draft.map((pt, i) =>
        i === d.i ? { x: clamp01(p.x), y: clamp01(p.y) } : pt,
      );
      cb.current.onDraftChange(next);
      return;
    }

    const r = bbox(draft);
    if (!r) return;

    if (d.kind === "move") {
      const nx = clamp01(Math.min(p.x - d.dx, 1 - r.w));
      const ny = clamp01(Math.min(p.y - d.dy, 1 - r.h));
      cb.current.onDraftChange(
        rectToPoly({ x: nx, y: ny, w: r.w, h: r.h }),
      );
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
      cb.current.onDraftChange(
        rectToPoly({
          x: clamp01(x),
          y: clamp01(y),
          w: Math.min(w, 1 - x),
          h: Math.min(h, 1 - y),
        }),
      );
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    const p = ptr(e);

    if (d.kind === "none") {
      // Hover highlight (only meaningful in select mode, off the draft).
      if (stateRef.current.mode === "select") {
        const draft = stateRef.current.draftPolygon;
        const overDraft = draft ? pointInPoly(p.x, p.y, draft) : false;
        const id = overDraft ? null : hitRoi(p);
        if (id !== hoverId) setHoverId(id);
      }
      return;
    }
    // rAF-coalesce the geometry update + redraw.
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      applyMove(p);
    });
  }

  function endDrag() {
    const d = dragRef.current;
    dragRef.current = { kind: "none" };
    anchorRef.current = null;
    if (d.kind === "new") {
      const draft = stateRef.current.draftPolygon;
      const r = draft ? bbox(draft) : null;
      if (!r || r.w < MIN || r.h < MIN) {
        // Click without a real drag — discard the empty rect, stay in draw.
        cb.current.onDraftChange(null);
      } else {
        cb.current.onAddComplete();
      }
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const draft = stateRef.current.draftPolygon;
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
    // Clamp the whole polygon so no vertex leaves the frame.
    const minX = Math.min(...draft.map((p) => p.x));
    const maxX = Math.max(...draft.map((p) => p.x));
    const minY = Math.min(...draft.map((p) => p.y));
    const maxY = Math.max(...draft.map((p) => p.y));
    dx = Math.max(-minX, Math.min(dx, 1 - maxX));
    dy = Math.max(-minY, Math.min(dy, 1 - maxY));
    if (dx === 0 && dy === 0) return;
    cb.current.onDraftChange(
      draft.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    );
  }

  const cursor =
    mode === "draw"
      ? "cursor-crosshair"
      : draftPolygon
        ? "cursor-move"
        : hoverId
          ? "cursor-pointer"
          : "cursor-default";

  return (
    <div>
      <div className="flex justify-center bg-black border border-border rounded-md overflow-hidden">
        <div
          ref={wrapRef}
          className="relative inline-block select-none leading-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            alt=""
            draggable={false}
            className={`block max-h-[68vh] max-w-full w-auto ${
              imageReady ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => {
              setImageReady(true);
              setImageError(null);
              scheduleDraw();
            }}
            onError={() => {
              setImageReady(false);
              setImageError("Waiting for camera frames…");
            }}
          />
          {!imageReady && (
            <div className="absolute inset-0 flex items-center justify-center min-h-[260px] min-w-[360px]">
              <div className="text-text-dim mono text-[11px] uppercase tracking-[0.08em]">
                {imageError ?? "loading snapshot…"}
              </div>
            </div>
          )}
          <canvas
            ref={canvasRef}
            tabIndex={0}
            role="application"
            aria-label="Region of interest editor"
            className={`absolute inset-0 w-full h-full outline-none touch-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] ${cursor}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerLeave={() => {
              if (dragRef.current.kind === "none" && hoverId) setHoverId(null);
            }}
            onKeyDown={onKeyDown}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button className="btn" type="button" onClick={refresh}>
          Refresh frame
        </button>
        <span className="mono text-[11px] text-text-dim">
          {mode === "draw"
            ? "Drag to draw — Esc to cancel"
            : draftPolygon
              ? "Drag the box or its handles to adjust · arrows nudge · Esc deselect"
              : "Click a zone to edit it"}
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
