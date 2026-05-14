"use client";

import { useEffect, useRef, useState } from "react";

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

  useEffect(() => {
    if (imgRef.current) {
      imgRef.current.src = `/api/cameras/${cameraId}/snapshot?t=${Date.now()}`;
    }
  }, [cameraId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const w = canvas.width = img.clientWidth || 640;
    const h = canvas.height = img.clientHeight || 360;
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

  function handleClick(e: React.MouseEvent) {
    if (closed) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setPoly((p) => [...p, { x, y }]);
  }

  function handleDoubleClick() {
    if (poly.length >= 3) setClosed(true);
  }

  return (
    <div>
      <div className="relative border border-border bg-black select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} alt="snapshot" className="block w-full h-auto" />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
        />
      </div>
      <div className="flex items-center gap-2 mt-2">
        <button className="btn" onClick={() => { setPoly([]); setClosed(false); }}>RESET</button>
        <button
          className="btn"
          disabled={poly.length < 3}
          onClick={handleDoubleClick}
        >
          CLOSE POLYGON
        </button>
        <button className="btn-primary" disabled={!closed} onClick={() => onSave(poly)}>SAVE ROI</button>
        <span className="mono text-[11px] text-text-dim ml-auto">
          {poly.length} pts {closed ? "· closed" : "· click to add, double-click to close"}
        </span>
      </div>
    </div>
  );
}
