"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

/**
 * Live view: LL-HLS via the stream-gateway (mediamtx transcodes HEVC→H.264 on
 * demand). hls.js drives Chrome/Firefox via MSE; Safari uses the native HLS
 * pipeline. Bbox overlays still come from the WebSocket /events stream and
 * paint a transparent canvas over the <video>.
 */
export function LiveViewer({ cameraId }: { cameraId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [boxes, setBoxes] = useState(true);
  const [latest, setLatest] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const src = `/stream/${cameraId}/hls/index.m3u8`;
    let hls: Hls | null = null;
    setError(null);

    const useNative = video.canPlayType("application/vnd.apple.mpegurl");
    if (useNative) {
      video.src = src;
      video.play().catch(() => {/* autoplay blocked; user gesture needed */});
    } else if (Hls.isSupported()) {
      hls = new Hls({
        lowLatencyMode: true,
        liveDurationInfinity: true,
        backBufferLength: 4,
        // mediamtx publishes LL-HLS parts ~100ms; keep playback close to live.
        liveSyncDurationCount: 1,
        liveMaxLatencyDurationCount: 5,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          setError(`${data.type}: ${data.details}`);
          hls?.destroy();
        }
      });
      video.play().catch(() => {/* autoplay blocked */});
    } else {
      setError("HLS not supported in this browser");
    }
    return () => {
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
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
    const video = videoRef.current;
    if (!canvas || !video) return;
    const w = video.videoWidth || video.clientWidth;
    const h = video.videoHeight || video.clientHeight;
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
        <video
          ref={videoRef}
          muted
          autoPlay
          playsInline
          className="block w-full h-auto"
        />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        {error && (
          <div className="absolute inset-x-0 bottom-0 px-3 py-2 mono text-[11px] bg-black/70 text-danger">
            stream error: {error}
          </div>
        )}
      </div>
    </div>
  );
}
