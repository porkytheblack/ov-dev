"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };
type Polygon = Point[];
type Rect = { x: number; y: number; w: number; h: number }; // normalized 0..1

const MIN = 0.03; // minimum rect size (normalized)
const HANDLE_PX = 9;

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type Handle = (typeof HANDLES)[number];
type Mode = { kind: "none" } | { kind: "new" } | { kind: "move"; dx: number; dy: number } | { kind: "resize"; h: Handle };

function rectFromPolygon(poly?: Polygon): Rect | null {
  if (!poly || poly.length < 3) return null;
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function polygonFromRect(r: Rect): Polygon {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Drag on the snapshot to draw a rectangular region of interest; drag the box
 * to move it or its handles to resize. The rectangle is reported live as a
 * 4-point polygon — no separate "apply" step. The image is shown at its
 * natural aspect (the canvas exactly overlays it) so coordinates map 1:1.
 */
export function RoiEditor({
  cameraId,
  initial,
  onChange,
}: {
  cameraId: string;
  initial?: Polygon;
  onChange: (poly: Polygon | null) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rect, setRect] = useState<Rect | null>(rectFromPolygon(initial));
  const [imageReady, setImageReady] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const modeRef = useRef<Mode>({ kind: "none" });
  // Anchor corner while drawing a brand-new rectangle.
  const anchorRef = useRef<{ x: number; y: number } | null>(null);

  // Report the rectangle (as a 4-point polygon) live on every change — no
  // separate apply step. Kept in a ref so a changing onChange identity from
  // the parent doesn't re-fire the effect.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    onChangeRef.current(rect ? polygonFromRect(rect) : null);
  }, [rect]);

  const refresh = useCallback(() => {
    if (!imgRef.current) return;
    setImageError(null);
    imgRef.current.src = `/api/cameras/${cameraId}/snapshot?t=${Date.now()}`;
  }, [cameraId]);

  useEffect(() => {
    refresh();
    const i = setInterval(() => {
      if (!imageReady) refresh();
    }, 3000);
    return () => clearInterval(i);
  }, [refresh, imageReady]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const w = (canvas.width = Math.max(1, Math.round(r.width)));
    const h = (canvas.height = Math.max(1, Math.round(r.height)));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    if (!rect) return;
    const px = rect.x * w;
    const py = rect.y * h;
    const pw = rect.w * w;
    const ph = rect.h * h;
    // Dim everything outside the ROI.
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, w, py);
    ctx.fillRect(0, py + ph, w, h - py - ph);
    ctx.fillRect(0, py, px, ph);
    ctx.fillRect(px + pw, py, w - px - pw, ph);
    // Box.
    ctx.strokeStyle = "#F59E0B";
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);
    // Handles.
    ctx.fillStyle = "#F59E0B";
    for (const hd of HANDLES) {
      const [hx, hy] = handlePos(hd, px, py, pw, ph);
      ctx.fillRect(hx - HANDLE_PX / 2, hy - HANDLE_PX / 2, HANDLE_PX, HANDLE_PX);
    }
  }, [rect]);

  useEffect(() => {
    draw();
  }, [draw, imageReady]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  function handlePos(hd: Handle, x: number, y: number, w: number, h: number): [number, number] {
    const cx = x + w / 2;
    const cy = y + h / 2;
    switch (hd) {
      case "nw": return [x, y];
      case "n": return [cx, y];
      case "ne": return [x + w, y];
      case "e": return [x + w, cy];
      case "se": return [x + w, y + h];
      case "s": return [cx, y + h];
      case "sw": return [x, y + h];
      case "w": return [x, cy];
    }
  }

  function ptr(e: React.PointerEvent): { x: number; y: number; w: number; h: number } {
    const c = canvasRef.current!;
    const b = c.getBoundingClientRect();
    return {
      x: clamp01((e.clientX - b.left) / b.width),
      y: clamp01((e.clientY - b.top) / b.height),
      w: b.width,
      h: b.height,
    };
  }

  function hitHandle(nx: number, ny: number, b: { w: number; h: number }): Handle | null {
    if (!rect) return null;
    const tolX = (HANDLE_PX + 4) / b.w;
    const tolY = (HANDLE_PX + 4) / b.h;
    for (const hd of HANDLES) {
      const [hx, hy] = handlePos(hd, rect.x, rect.y, rect.w, rect.h);
      if (Math.abs(nx - hx) <= tolX && Math.abs(ny - hy) <= tolY) return hd;
    }
    return null;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!imageReady) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = ptr(e);
    const hd = hitHandle(p.x, p.y, p);
    if (hd) {
      modeRef.current = { kind: "resize", h: hd };
      return;
    }
    if (rect && p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h) {
      modeRef.current = { kind: "move", dx: p.x - rect.x, dy: p.y - rect.y };
      return;
    }
    // Start a fresh rectangle anchored here.
    modeRef.current = { kind: "new" };
    anchorRef.current = { x: p.x, y: p.y };
    setRect({ x: p.x, y: p.y, w: 0, h: 0 });
  }

  function onPointerMove(e: React.PointerEvent) {
    const m = modeRef.current;
    if (m.kind === "none") return;
    const p = ptr(e);
    setRect((cur) => {
      if (m.kind === "new") {
        const a = anchorRef.current ?? { x: p.x, y: p.y };
        return {
          x: Math.min(a.x, p.x),
          y: Math.min(a.y, p.y),
          w: Math.abs(p.x - a.x),
          h: Math.abs(p.y - a.y),
        };
      }
      if (!cur) return cur;
      if (m.kind === "move") {
        return {
          x: clamp01(Math.min(p.x - m.dx, 1 - cur.w)),
          y: clamp01(Math.min(p.y - m.dy, 1 - cur.h)),
          w: cur.w,
          h: cur.h,
        };
      }
      // resize
      let { x, y, w, h } = cur;
      const right = x + w;
      const bottom = y + h;
      const hd = m.h;
      if (hd.includes("n")) { y = Math.min(p.y, bottom - MIN); h = bottom - y; }
      if (hd.includes("s")) { h = Math.max(MIN, p.y - y); }
      if (hd.includes("w")) { x = Math.min(p.x, right - MIN); w = right - x; }
      if (hd.includes("e")) { w = Math.max(MIN, p.x - x); }
      return {
        x: clamp01(x),
        y: clamp01(y),
        w: Math.min(w, 1 - x),
        h: Math.min(h, 1 - y),
      };
    });
  }

  function endDrag() {
    const m = modeRef.current;
    modeRef.current = { kind: "none" };
    anchorRef.current = null;
    // Discard an accidental tiny new rect (a click without a drag).
    if (m.kind === "new") {
      setRect((cur) => (cur && (cur.w < MIN || cur.h < MIN) ? null : cur));
    }
  }

  function clearRect() {
    setRect(null);
  }

  return (
    <div>
      <div className="flex justify-center bg-black border border-border overflow-hidden">
        <div className="relative inline-block select-none leading-none">
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
              draw();
            }}
            onError={() => {
              setImageReady(false);
              setImageError("Waiting for camera frames…");
            }}
          />
          {!imageReady && (
            <div className="absolute inset-0 flex items-center justify-center text-text-dim mono text-[11px] uppercase tracking-[0.08em] min-h-[240px]">
              {imageError ?? "loading snapshot…"}
            </div>
          )}
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 w-full h-full ${
              rect ? "cursor-move" : "cursor-crosshair"
            }`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button className="btn" type="button" disabled={!rect} onClick={clearRect}>
          Clear
        </button>
        <button className="btn" type="button" onClick={refresh}>
          Refresh frame
        </button>
        <span className="mono text-[11px] text-text-dim ml-auto">
          {rect ? "Drag the box or its handles to adjust" : "Drag on the image to draw the region"}
        </span>
      </div>
    </div>
  );
}
