"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

/**
 * Live view. Primary transport is WebRTC/WHEP (sub-second glass-to-glass) so
 * the picture is genuinely live and the bbox overlay lines up with what's on
 * screen. If WHEP can't establish (e.g. the ICE port isn't reachable) it
 * falls back to LL-HLS so there's still a picture.
 *
 * Overlay: detections (WS /events, ~1s pipeline) are buffered by capture
 * timestamp.
 *  - WebRTC: video is ~live, so we draw the freshest detection; it trails the
 *    subject by roughly the detection compute time (~1s) — the inherent floor
 *    without delaying the video.
 *  - HLS: video is several seconds behind, so we draw the detection whose
 *    timestamp matches the displayed frame (derived from the playing
 *    fragment's EXT-X-PROGRAM-DATE-TIME), self-correcting to the real lag.
 */

// HLS-only: detection ts vs mediamtx PDT skew (see git history). WebRTC needs
// no such constant — both paths are near-real-time.
const SYNC_OFFSET_MS = 0;
const WEBRTC_SYNC_OFFSET_MS = 0;
const MATCH_TOLERANCE_MS = 2500;
const FALLBACK_VIDEO_DELAY_MS = 6000;
const BUFFER_MS = 30000;
const WHEP_CONNECT_TIMEOUT_MS = 9000;

type Sample = { t: number; dets: any[] };
// `snapshot` is the last-resort polling fallback used when neither WebRTC
// nor HLS can start (Telegram in-app webview gates both on iOS, and
// random constructor throws used to bubble up as a Next.js crash overlay).
// `error` is a terminal state for unexpected throws inside the setup path.
type Mode = "connecting" | "webrtc" | "hls" | "snapshot" | "error";

const SNAPSHOT_POLL_MS = 2500;

export function LiveViewer({ cameraId }: { cameraId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const whepResRef = useRef<string | null>(null);
  const fragRef = useRef<{ pdt: number; start: number } | null>(null);
  const bufRef = useRef<Sample[]>([]);
  const boxesRef = useRef(true);
  const modeRef = useRef<Mode>("connecting");
  const [boxes, setBoxes] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFs, setIsFs] = useState(false);
  const [mode, setMode] = useState<Mode>("connecting");
  const [stat, setStat] = useState<string>("");
  const statAtRef = useRef(0);

  useEffect(() => {
    boxesRef.current = boxes;
  }, [boxes]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    let hls: Hls | null = null;
    setError(null);
    setMode("connecting");

    const teardownPc = () => {
      const res = whepResRef.current;
      if (res) {
        fetch(res, { method: "DELETE" }).catch(() => {});
        whepResRef.current = null;
      }
      try {
        pcRef.current?.close();
      } catch {
        /* ignore */
      }
      pcRef.current = null;
      if (video.srcObject) video.srcObject = null;
    };

    const waitIce = (pc: RTCPeerConnection, ms: number) =>
      new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") return resolve();
        const done = () => {
          clearTimeout(timer);
          pc.removeEventListener("icegatheringstatechange", check);
          resolve();
        };
        const check = () => {
          if (pc.iceGatheringState === "complete") done();
        };
        const timer = setTimeout(done, ms);
        pc.addEventListener("icegatheringstatechange", check);
      });

    const waitConnected = (pc: RTCPeerConnection, ms: number) =>
      new Promise<boolean>((resolve) => {
        const finish = (v: boolean) => {
          clearTimeout(timer);
          pc.removeEventListener("iceconnectionstatechange", on);
          pc.removeEventListener("connectionstatechange", on);
          resolve(v);
        };
        const on = () => {
          const s = pc.iceConnectionState;
          const c = pc.connectionState;
          if (s === "connected" || s === "completed" || c === "connected")
            finish(true);
          else if (
            s === "failed" ||
            c === "failed" ||
            s === "closed" ||
            c === "closed"
          )
            finish(false);
        };
        const timer = setTimeout(() => finish(false), ms);
        pc.addEventListener("iceconnectionstatechange", on);
        pc.addEventListener("connectionstatechange", on);
        on();
      });

    const connectWhep = async (): Promise<boolean> => {
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.ontrack = (e) => {
        if (videoRef.current && e.streams[0]) {
          videoRef.current.srcObject = e.streams[0];
          videoRef.current.play().catch(() => {});
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitIce(pc, 2500);
      if (cancelled) return false;
      const res = await fetch(`/stream/${cameraId}/whep`, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription?.sdp ?? offer.sdp ?? "",
        credentials: "include",
      });
      if (!res.ok) return false;
      const loc = res.headers.get("location");
      if (loc) whepResRef.current = loc;
      const answer = await res.text();
      if (!answer || cancelled) return false;
      await pc.setRemoteDescription({ type: "answer", sdp: answer });
      return waitConnected(pc, WHEP_CONNECT_TIMEOUT_MS);
    };

    const startHls = () => {
      const src = `/stream/${cameraId}/hls/index.m3u8`;
      const useNative = video.canPlayType("application/vnd.apple.mpegurl");
      if (useNative) {
        video.src = src;
        video.play().catch(() => {});
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
        const onFrag = (_e: unknown, data: any) => {
          const f = data?.frag;
          const pdt = f?.programDateTime;
          if (f && typeof pdt === "number" && Number.isFinite(pdt)) {
            fragRef.current = { pdt, start: f.start ?? 0 };
          }
        };
        hls.on(Hls.Events.FRAG_CHANGED, onFrag);
        hls.on(Hls.Events.FRAG_BUFFERED, onFrag);
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) {
            setError(`${data.type}: ${data.details}`);
            hls?.destroy();
          }
        });
        video.play().catch(() => {});
      } else {
        setError("Live video not supported in this browser");
        return;
      }
      if (!cancelled) setMode("hls");
    };

    // Wraps the whole live-init pipeline. Any uncaught throw in here used
    // to crash React (Next.js error overlay was what the Telegram in-app
    // webview was hitting because RTCPeerConnection/MSE are gated there).
    // Falls through to snapshot polling so the operator at least sees a
    // recent frame in restricted webviews.
    (async () => {
      const hasWebRTC =
        typeof window !== "undefined" && typeof RTCPeerConnection !== "undefined";
      let ok = false;
      if (hasWebRTC) {
        try {
          ok = await connectWhep();
        } catch {
          ok = false;
        }
      }
      if (cancelled) return;
      if (ok) {
        setMode("webrtc");
        return;
      }
      teardownPc();
      try {
        startHls();
        return;
      } catch (e) {
        // hls.js / native HLS init can throw in restricted webviews. Fall
        // through to snapshot mode rather than crashing the page.
        setError(`hls init: ${(e as Error).message ?? "failed"}`);
      }
      if (!cancelled) setMode("snapshot");
    })().catch((e) => {
      // Defence in depth — the IIFE shouldn't throw past its own catches,
      // but a thrown synchronous error inside an awaited promise chain
      // would surface here. Always degrade to snapshot rather than crash.
      if (cancelled) return;
      setError(`live init: ${(e as Error)?.message ?? "failed"}`);
      setMode("snapshot");
    });

    return () => {
      cancelled = true;
      teardownPc();
      hls?.destroy();
      hlsRef.current = null;
      fragRef.current = null;
      try {
        video.removeAttribute("src");
        video.load();
      } catch {
        /* ignore */
      }
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

  useEffect(() => {
    let raf = 0;
    // The overlay tick reads from the video element + canvas. In snapshot
    // mode neither exists, so don't bother starting the loop — also
    // protects against canvas-getContext throwing in restricted webviews.
    if (mode === "snapshot" || mode === "error") return;

    const hlsWallMs = (video: HTMLVideoElement): { ms: number; src: string } => {
      const fr = fragRef.current;
      if (fr && Number.isFinite(video.currentTime)) {
        return { ms: fr.pdt + (video.currentTime - fr.start) * 1000, src: "frag" };
      }
      const hls = hlsRef.current;
      if (hls && hls.playingDate) {
        const ms = hls.playingDate.getTime();
        if (Number.isFinite(ms)) return { ms, src: "pdt" };
      }
      const gs = (video as any).getStartDate?.();
      if (gs instanceof Date && Number.isFinite(gs.getTime())) {
        return { ms: gs.getTime() + video.currentTime * 1000, src: "sd" };
      }
      return { ms: Date.now() - FALLBACK_VIDEO_DELAY_MS, src: "fb" };
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

      const now = Date.now();
      let target: number;
      let srcTag: string;
      if (modeRef.current === "webrtc") {
        target = now + WEBRTC_SYNC_OFFSET_MS;
        srcTag = "webrtc";
      } else {
        const d = hlsWallMs(video);
        target = d.ms + SYNC_OFFSET_MS;
        srcTag = d.src;
      }
      if (now - statAtRef.current > 1000) {
        statAtRef.current = now;
        const buf = bufRef.current;
        if (modeRef.current === "webrtc") {
          const age = buf.length ? (now - buf[buf.length - 1]!.t) / 1000 : 0;
          setStat(`webrtc · det ~${age.toFixed(1)}s`);
        } else {
          setStat(`hls v-lat ${((now - target) / 1000).toFixed(1)}s · ${srcTag}`);
        }
      }
      if (!boxesRef.current) return;
      const dets = pickNearest(target);
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
  }, [cameraId, mode]);

  // Snapshot-polling fallback used by restricted webviews (e.g. Telegram's
  // in-app browser on iOS, which blocks WebRTC + MSE). Bumps a cache-buster
  // every SNAPSHOT_POLL_MS so the <img> re-fetches the latest frame.
  const [snapshotTick, setSnapshotTick] = useState(0);
  useEffect(() => {
    if (mode !== "snapshot") return;
    const t = setInterval(() => setSnapshotTick((n) => n + 1), SNAPSHOT_POLL_MS);
    return () => clearInterval(t);
  }, [mode]);
  const snapshotSrc = `/api/cameras/${cameraId}/snapshot?t=${snapshotTick}`;

  return (
    <div
      ref={wrapRef}
      className={`relative bg-black w-full ${isFs ? "h-screen" : "aspect-video"}`}
    >
      {mode === "snapshot" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={snapshotTick}
          src={snapshotSrc}
          alt="camera snapshot"
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => {
            /* keep showing the previous frame; next poll will retry */
          }}
        />
      ) : (
        <>
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
        </>
      )}

      <div className="absolute top-2 left-3 flex items-center gap-2 bg-black/65 px-2 py-1 rounded">
        <span className="mono uppercase tracking-[0.08em] text-[11px] text-white flex items-center gap-1.5">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              mode === "connecting"
                ? "bg-text-dim"
                : mode === "snapshot"
                  ? "bg-warning"
                  : "bg-accent"
            }`}
          />
          {mode === "connecting"
            ? "CONNECTING"
            : mode === "snapshot"
              ? "SNAPSHOT"
              : "LIVE"}
        </span>
        {stat && (
          <span className="mono text-[11px] text-white/80 border-l border-white/25 pl-2">
            {stat}
          </span>
        )}
      </div>
      <div className="absolute top-2 right-2 flex gap-2">
        {mode !== "snapshot" && (
          <button onClick={() => setBoxes((b) => !b)} className="btn">
            BOXES {boxes ? "ON" : "OFF"}
          </button>
        )}
        <button onClick={toggleFullscreen} className="btn" title="Toggle fullscreen">
          {isFs ? "EXIT FULLSCREEN" : "FULLSCREEN"}
        </button>
      </div>

      {mode === "snapshot" && (
        <div className="absolute inset-x-0 bottom-0 px-3 py-2 mono text-[11px] bg-black/70 text-text-dim">
          Live stream unsupported in this browser — showing periodic
          snapshots. Open in your main browser for the full live view.
        </div>
      )}
      {mode !== "snapshot" && error && (
        <div className="absolute inset-x-0 bottom-0 px-3 py-2 mono text-[11px] bg-black/70 text-danger">
          stream error: {error}
        </div>
      )}
    </div>
  );
}
