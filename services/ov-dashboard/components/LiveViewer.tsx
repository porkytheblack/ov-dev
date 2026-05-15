"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

/**
 * Live view: LL-HLS via the stream-gateway (mediamtx transcodes HEVC→H.264 on
 * demand). hls.js drives Chrome/Firefox via MSE; Safari uses the native HLS
 * pipeline. Bbox overlays still come from the WebSocket /events stream and
 * paint a transparent canvas over the <video>.
 */
// How long a detection stays drawn after the last frame that contained it.
// CPU inference is sparse and bursty (a person yields a box on some frames,
// nothing on others); without a hold the overlay strobes and looks empty.
const DETECTION_HOLD_MS = 2000;

export function LiveViewer({ cameraId }: { cameraId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState(true);
  const [latest, setLatest] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isFs, setIsFs] = useState(false);
  // Bumped on video metadata/resize so the draw effect re-runs with correct
  // dimensions even when no new detection has arrived.
  const [redrawTick, setRedrawTick] = useState(0);
  // Wall-clock of the last non-empty detection for this camera.
  const lastSeenRef = useRef(0);

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
          const dets = Array.isArray(msg.data.detections) ? msg.data.detections : [];
          if (dets.length > 0) {
            lastSeenRef.current = Date.now();
            setLatest(dets);
          }
          // Empty frame: keep the last boxes; the hold timer below clears
          // them once detections have actually stopped for DETECTION_HOLD_MS.
        }
      } catch {
        /* ignore */
      }
    };
    return () => {
      try { ws?.close(); } catch { /* ignore */ }
    };
  }, [cameraId]);

  // Expire stale boxes once nothing has been detected for the hold window.
  useEffect(() => {
    const i = setInterval(() => {
      if (
        lastSeenRef.current > 0 &&
        Date.now() - lastSeenRef.current > DETECTION_HOLD_MS
      ) {
        setLatest((prev) => (prev.length ? [] : prev));
      }
    }, 250);
    return () => clearInterval(i);
  }, []);

  // Fullscreen the whole player (video + bbox canvas together).
  useEffect(() => {
    const onFs = () => setIsFs(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      wrapRef.current?.requestFullscreen().catch(() => {});
    }
  };

  // Keep the overlay aligned: redraw when the video reports its real size or
  // the element resizes (detections may arrive before the video is ready).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const bump = () => setRedrawTick((t) => t + 1);
    video.addEventListener("loadedmetadata", bump);
    video.addEventListener("resize", bump);
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(bump) : null;
    ro?.observe(video);
    return () => {
      video.removeEventListener("loadedmetadata", bump);
      video.removeEventListener("resize", bump);
      ro?.disconnect();
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
  }, [latest, boxes, redrawTick]);

  return (
    // Fill the frame at a true 16:9 (object-cover scales the near-square
    // security-cam source up to cover the box — no pillarbox, no distortion,
    // just edge crop). video + canvas share intrinsic dimensions and the same
    // object-cover, so the overlay crops identically and bboxes stay aligned.
    // In fullscreen the wrapper fills the screen instead of the 16:9 box.
    <div
      ref={wrapRef}
      className={`relative bg-black w-full ${isFs ? "h-screen" : "aspect-video"}`}
    >
      <video
        ref={videoRef}
        muted
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />

      <div className="absolute top-2 left-3 mono uppercase tracking-[0.08em] text-[11px] text-white/90 drop-shadow">
        ● LIVE
      </div>
      <div className="absolute top-2 right-2 flex gap-2">
        <button onClick={() => setBoxes((b) => !b)} className="btn">
          BOXES {boxes ? "ON" : "OFF"}
        </button>
        <button onClick={toggleFullscreen} className="btn" title="Toggle fullscreen">
          {isFs ? "EXIT FULLSCREEN" : "FULLSCREEN"}
        </button>
      </div>

      {error && (
        <div className="absolute inset-x-0 bottom-0 px-3 py-2 mono text-[11px] bg-black/70 text-danger">
          stream error: {error}
        </div>
      )}
    </div>
  );
}
