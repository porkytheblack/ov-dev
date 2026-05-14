"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Live view: snapshot polled every 2s as a baseline, with bbox overlays drawn
 * on a <canvas> aligned to the image. WebRTC is left as a future hookup —
 * the snapshot path works without WebRTC infrastructure for first-light demos.
 */
export function LiveViewer({ cameraId }: { cameraId: string }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [boxes, setBoxes] = useState(true);
  const [latest, setLatest] = useState<any[]>([]);

  useEffect(() => {
    const url = `/api/cameras/${cameraId}/snapshot`;
    let cancelled = false;
    let timer: number | undefined;

    // Preload each frame off-screen and only swap into the visible <img> once
    // the bytes are decoded. Without this the polling interval flashes a blank
    // frame between fetches.
    const tick = () => {
      const next = new Image();
      const finish = () => {
        if (cancelled) return;
        if (imgRef.current && next.complete && next.naturalWidth > 0) {
          imgRef.current.src = next.src;
        }
        timer = window.setTimeout(tick, 250);
      };
      next.onload = finish;
      next.onerror = finish;
      next.src = `${url}?t=${Date.now()}`;
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [cameraId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const wsUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/events`;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      return;
    }
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "frame.detections" && msg.data?.camera_id === cameraId) {
          setLatest(msg.data.detections ?? []);
        }
      } catch {
        /* ignore */
      }
    };
    return () => {
      try { ws?.close(); } catch { /* ignore */ }
    };
  }, [cameraId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const w = img.naturalWidth || img.clientWidth;
    const h = img.naturalHeight || img.clientHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    if (!boxes) return;
    ctx.strokeStyle = "#F59E0B";
    ctx.lineWidth = 2;
    ctx.font = "11px JetBrains Mono";
    for (const d of latest) {
      const x = d.bbox.x * w;
      const y = d.bbox.y * h;
      const bw = d.bbox.w * w;
      const bh = d.bbox.h * h;
      ctx.strokeRect(x, y, bw, bh);
      ctx.fillStyle = "rgba(245,158,11,0.85)";
      ctx.fillRect(x, y - 14, ctx.measureText(`${d.class} ${(d.confidence * 100).toFixed(0)}%`).width + 6, 14);
      ctx.fillStyle = "#000";
      ctx.fillText(`${d.class} ${(d.confidence * 100).toFixed(0)}%`, x + 3, y - 3);
    }
  }, [latest, boxes]);

  return (
    <div>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="mono uppercase tracking-[0.08em] text-text-dim text-[11px]">LIVE</div>
        <button onClick={() => setBoxes((b) => !b)} className="btn">
          BOXES {boxes ? "ON" : "OFF"}
        </button>
      </div>
      <div className="relative bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} alt="live" className="block w-full h-auto" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      </div>
    </div>
  );
}
