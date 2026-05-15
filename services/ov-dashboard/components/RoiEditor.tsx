"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };
type Polygon = Point[];

export function RoiEditor({
  cameraId,
  initial,
  onSave,
}: {
  cameraId: string;
  initial?: Polygon;
  onSave: (poly: Polygon) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [poly, setPoly] = useState<Polygon>(initial ?? []);
  const [closed, setClosed] = useState((initial ?? []).length >= 3);
  const [imageReady, setImageReady] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!imgRef.current) return;
    setImageError(null);
    imgRef.current.src = `/api/cameras/${cameraId}/snapshot?t=${Date.now()}`;
  }, [cameraId]);

  useEffect(() => {
    refresh();
    // Until the image arrives, retry every 3s so the editor recovers
    // automatically once the ingestor produces the first frame.
    const i = setInterval(() => {
      if (!imageReady) refresh();
    }, 3000);
    return () => clearInterval(i);
  }, [refresh, imageReady]);

  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = (canvas.width = Math.max(1, Math.round(rect.width)));
    const h = (canvas.height = Math.max(1, Math.round(rect.height)));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    if (poly.length === 0) return;
    ctx.strokeStyle = "#F59E0B";
    ctx.fillStyle = "rgba(245,158,11,0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    poly.forEach((p, i) => {
      const x = p.x * w;
      const y = p.y * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    if (closed) ctx.closePath();
    ctx.stroke();
    if (closed) ctx.fill();
    for (const p of poly) {
      const x = p.x * w;
      const y = p.y * h;
      ctx.fillStyle = "#F59E0B";
      ctx.fillRect(x - 3, y - 3, 6, 6);
    }
  }, [poly, closed]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay, imageReady]);

  useEffect(() => {
    const onResize = () => drawOverlay();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [drawOverlay]);

  function handleClick(e: React.MouseEvent) {
    if (closed) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setPoly((p) => [...p, { x, y }]);
  }

  function handleDoubleClick() {
    if (poly.length >= 3) setClosed(true);
  }

  return (
    <div>
      <div
        className="relative border border-border bg-black select-none overflow-hidden"
        style={{ aspectRatio: "16 / 9" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          alt=""
          className={`absolute inset-0 w-full h-full object-contain ${
            imageReady ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => {
            setImageReady(true);
            setImageError(null);
          }}
          onError={() => {
            setImageReady(false);
            setImageError("Waiting for camera frames…");
          }}
        />
        {!imageReady && (
          <div className="absolute inset-0 flex items-center justify-center text-text-dim mono text-[11px] uppercase tracking-[0.08em]">
            {imageError ?? "loading snapshot…"}
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
        />
      </div>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button
          className="btn"
          type="button"
          disabled={poly.length === 0}
          onClick={() => { setPoly([]); setClosed(false); }}
        >
          Reset
        </button>
        <button
          className="btn"
          type="button"
          disabled={poly.length < 3 || closed}
          onClick={handleDoubleClick}
        >
          Close polygon
        </button>
        <button className="btn" type="button" onClick={refresh}>
          Refresh frame
        </button>
        <button
          className="btn-primary"
          type="button"
          disabled={!closed}
          onClick={() => onSave(poly)}
        >
          Use this shape
        </button>
        <span className="mono text-[11px] text-text-dim ml-auto">
          {poly.length} pt{poly.length === 1 ? "" : "s"}
          {closed ? " · closed" : " · click to add, double-click to close"}
        </span>
      </div>
    </div>
  );
}
