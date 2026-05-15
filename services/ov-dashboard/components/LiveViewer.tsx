"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

/**
 * Live view: LL-HLS via the stream-gateway (mediamtx transcodes HEVC→H.264 on
 * demand). hls.js drives Chrome/Firefox via MSE; Safari uses the native HLS
 * pipeline. Bbox overlays come from the WebSocket /events stream.
 *
 * Time sync: the detection pipeline (~1-2s) is much faster than LL-HLS
 * glass-to-glass (several seconds), so naively drawing the newest detection
 * paints boxes over where the subject *will be* in the laggy video. Instead we
 * buffer detections by their capture timestamp and, every animation frame,
 * draw the detection whose timestamp matches the wall-clock time of the video
 * frame currently on screen — derived from the HLS EXT-X-PROGRAM-DATE-TIME
 * (hls.js `playingDate` / native `getStartDate()`). Both the ingestor (which
 * stamps `ts`) and mediamtx (which stamps PDT) run on the same host clock, so
 * the overlay tracks the displayed frame regardless of either path's latency.
 */

// Detection ts (ingestor grab time) is stamped earlier than mediamtx's HLS
// PDT for the same visual moment (transcode + LL-HLS packaging adds latency
// the raw frame grab doesn't), so matching ts≈playingDate selects a detection
// from a slightly *later* moment and the boxes lead the video. Shifting the
// lookup target back in time selects the older, correct detection.
// More negative => boxes drawn for an earlier moment (pull them back / make
// them trail). Less negative / positive => boxes move ahead. Tune to taste.
const SYNC_OFFSET_MS = -1000;
// A buffered detection is "this frame's" only if within this of the target.
const MATCH_TOLERANCE_MS = 1500;
// Only used when the stream exposes no PDT (approx. HLS glass-to-glass).
const FALLBACK_VIDEO_DELAY_MS = 4000;
// How much detection history to retain for matching.
const BUFFER_MS = 20000;

type Sample = { t: number; dets: any[] };

export function LiveViewer({ cameraId }: { cameraId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  // Detections buffered by capture time (includes empty frames so "nothing
  // here at time T" is represented too).
  const bufRef = useRef<Sample[]>([]);
  const boxesRef = useRef(true);
  const [boxes, setBoxes] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    boxesRef.current = boxes;
  }, [boxes]);

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
        liveSyncDurationCount: 1,
        liveMaxLatencyDurationCount: 5,
      });
      hlsRef.current = hls;
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
      hlsRef.current = null;
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
          const parsed = Date.parse(msg.data.ts);
          const t = Number.isFinite(parsed) ? parsed : Date.now();
          const buf = bufRef.current;
          buf.push({ t, dets });
          // Keep sorted (events almost always arrive in order; guard anyway).
          if (buf.length > 1 && buf[buf.length - 1]!.t < buf[buf.length - 2]!.t) {
            buf.sort((a, b) => a.t - b.t);
          }
          const cutoff = Date.now() - BUFFER_MS;
          while (buf.length && buf[0]!.t < cutoff) buf.shift();
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

  // Render loop: every animation frame, work out the wall-clock time of the
  // video frame currently displayed and draw the detection that matches it.
  useEffect(() => {
    let raf = 0;

    const displayedWallMs = (video: HTMLVideoElement): number => {
      const hls = hlsRef.current;
      if (hls && hls.playingDate) {
        const ms = hls.playingDate.getTime();
        if (Number.isFinite(ms)) return ms;
      }
      const getStart = (video as any).getStartDate?.();
      if (getStart instanceof Date) {
        const startMs = getStart.getTime();
        if (Number.isFinite(startMs)) return startMs + video.currentTime * 1000;
      }
      return Date.now() - FALLBACK_VIDEO_DELAY_MS;
    };

    const pickNearest = (target: number): any[] | null => {
      const buf = bufRef.current;
      if (!buf.length) return null;
      let best: Sample | null = null;
      let bestDiff = Infinity;
      for (const s of buf) {
        const d = Math.abs(s.t - target);
        if (d < bestDiff) {
          bestDiff = d;
          best = s;
        }
      }
      if (!best || bestDiff > MATCH_TOLERANCE_MS) return null;
      return best.dets;
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      const w = video.videoWidth || video.clientWidth;
      const h = video.videoHeight || video.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      if (!boxesRef.current) return;
      const dets = pickNearest(displayedWallMs(video) + SYNC_OFFSET_MS);
      if (!dets || !dets.length) return;
      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 2;
      ctx.font = "11px JetBrains Mono";
      for (const d of dets) {
        const x = d.bbox.x * w;
        const y = d.bbox.y * h;
        const bw = d.bbox.w * w;
        const bh = d.bbox.h * h;
        ctx.strokeRect(x, y, bw, bh);
        const label = `${d.class} ${(d.confidence * 100).toFixed(0)}%`;
        ctx.fillStyle = "rgba(245,158,11,0.85)";
        ctx.fillRect(x, y - 14, ctx.measureText(label).width + 6, 14);
        ctx.fillStyle = "#000";
        ctx.fillText(label, x + 3, y - 3);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cameraId]);

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
