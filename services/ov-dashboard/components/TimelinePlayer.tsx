"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Marker = { t: number; classes: string[]; incident?: boolean };

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

/**
 * Custom, accessible, touch-friendly video player. The scrubber shows tick
 * markers at every moment a detection was found in the clip (fetched from
 * /api/incidents/:id/markers) plus a highlighted marker for the incident
 * itself — so you can see and jump straight to "when things happened".
 */
export function TimelinePlayer({
  src,
  poster,
  incidentId,
  seekTo = 0,
  onError,
}: {
  src: string;
  poster?: string;
  incidentId: string;
  seekTo?: number;
  onError?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  // Start muted: mobile browsers block autoplay WITH sound, so an unmuted
  // autoplay just shows a frozen poster. Surveillance clips have no useful
  // audio anyway; the mute button unmutes.
  const [muted, setMuted] = useState(true);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [incidentT, setIncidentT] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/incidents/${incidentId}/markers`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j) return;
        setIncidentT(typeof j.incident_t === "number" ? j.incident_t : null);
        setMarkers(Array.isArray(j.markers) ? j.markers : []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [incidentId]);

  const seek = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    v.currentTime = Math.max(0, Math.min(t, v.duration - 0.05));
  }, []);

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  // Pointer scrub (mouse + touch). Capture on the track element itself —
  // it's stable and the markers are pointer-events-none, so the drag stays
  // bound through re-renders on touch.
  const scrubTo = useCallback((clientX: number) => {
    const el = trackRef.current;
    const v = videoRef.current;
    if (!el || !v || !Number.isFinite(v.duration)) return;
    const r = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    v.currentTime = frac * v.duration;
  }, []);
  const onTrackPointerDown = (e: React.PointerEvent) => {
    const el = trackRef.current;
    el?.setPointerCapture?.(e.pointerId);
    scrubTo(e.clientX);
    const move = (ev: PointerEvent) => scrubTo(ev.clientX);
    const end = () => {
      el?.removeEventListener("pointermove", move);
      el?.removeEventListener("pointerup", end);
      el?.removeEventListener("pointercancel", end);
    };
    el?.addEventListener("pointermove", move);
    el?.addEventListener("pointerup", end);
    el?.addEventListener("pointercancel", end);
  };

  // Marker navigation — far more usable on a phone than tapping a 3px tick.
  const markerTimes = useMemo(
    () => [...new Set(markers.map((m) => m.t))].sort((a, b) => a - b),
    [markers],
  );
  const jumpMarker = useCallback(
    (dir: 1 | -1) => {
      if (markerTimes.length === 0) return;
      const next =
        dir === 1
          ? markerTimes.find((t) => t > cur + 0.25)
          : [...markerTimes].reverse().find((t) => t < cur - 0.25);
      if (next != null) seek(next);
    },
    [markerTimes, cur, seek],
  );

  const pct = dur > 0 ? (cur / dur) * 100 : 0;

  return (
    <div className="bg-black select-none">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        key={src}
        src={src}
        poster={poster}
        autoPlay
        muted
        playsInline
        onClick={toggle}
        onError={onError}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setDur(v.duration);
          if (seekTo > 0 && seekTo < v.duration - 0.5) {
            try {
              v.currentTime = seekTo;
            } catch {
              /* ignore */
            }
          }
        }}
        className="w-full max-h-[42vh] sm:max-h-[60vh] block bg-black cursor-pointer"
      />

      {/* Controls */}
      <div className="px-3 sm:px-4 py-3 bg-bg border-t border-border flex flex-col gap-2">
        {/* Scrubber + markers */}
        <div
          ref={trackRef}
          onPointerDown={onTrackPointerDown}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(dur)}
          aria-valuenow={Math.round(cur)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") seek(cur + 5);
            else if (e.key === "ArrowLeft") seek(cur - 5);
            else if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              toggle();
            }
          }}
          className="relative h-6 flex items-center cursor-pointer touch-none group"
        >
          {/* track */}
          <div className="absolute inset-x-0 h-1.5 rounded-full bg-border-strong" />
          {/* progress */}
          <div
            className="absolute left-0 h-1.5 rounded-full bg-accent"
            style={{ width: `${pct}%` }}
          />
          {/* detection markers — visual only (pointer-events-none) so they
              never block scrubbing on touch; jump between them via the
              prev/next detection buttons below. */}
          {dur > 0 &&
            markers.map((m, i) => {
              const left = Math.max(0, Math.min(100, (m.t / dur) * 100));
              return (
                <span
                  key={i}
                  title={`${m.classes.join(", ")} @ ${fmt(m.t)}`}
                  className="absolute -top-0.5 h-3 w-0.5 rounded-sm bg-danger/80 -translate-x-1/2 pointer-events-none"
                  style={{ left: `${left}%` }}
                />
              );
            })}
          {/* incident moment */}
          {dur > 0 && incidentT != null && (
            <span
              title={`Incident @ ${fmt(incidentT)}`}
              className="absolute h-5 w-[3px] rounded-sm bg-accent-strong -translate-x-1/2 pointer-events-none"
              style={{ left: `${Math.min(100, (incidentT / dur) * 100)}%` }}
            />
          )}
          {/* thumb */}
          <span
            className="absolute h-4 w-4 rounded-full bg-accent border-2 border-bg shadow -translate-x-1/2 pointer-events-none"
            style={{ left: `${pct}%` }}
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
            className="inline-flex items-center justify-center h-11 w-11 rounded-full bg-accent text-[color:var(--on-accent)] hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
          >
            {playing ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <div className="mono text-[13px] text-text-muted tabular-nums">
            {fmt(cur)} <span className="text-text-dim">/ {fmt(dur)}</span>
          </div>
          <button
            type="button"
            onClick={() => jumpMarker(-1)}
            disabled={markerTimes.length === 0}
            aria-label="Previous detection"
            title="Previous detection"
            className="inline-flex items-center justify-center h-10 w-10 rounded-md text-text-muted hover:text-text hover:bg-surface-elev disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M7 6h2v12H7zM20 6v12l-9-6z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => jumpMarker(1)}
            disabled={markerTimes.length === 0}
            aria-label="Next detection"
            title="Next detection"
            className="inline-flex items-center justify-center h-10 w-10 rounded-md text-text-muted hover:text-text hover:bg-surface-elev disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M15 6h2v12h-2zM4 6l9 6-9 6z" />
            </svg>
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => {
              const v = videoRef.current;
              if (v) v.muted = !v.muted;
            }}
            aria-label={muted ? "Unmute" : "Mute"}
            className="inline-flex items-center justify-center h-10 w-10 rounded-md text-text-muted hover:text-text hover:bg-surface-elev focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
          >
            {muted ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M4 9v6h4l5 5V4L8 9H4zm13.5 3l2.5 2.5-1 1L16.5 13 14 15.5l-1-1L15.5 12 13 9.5l1-1L16.5 11 19 8.5l1 1z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M4 9v6h4l5 5V4L8 9H4zm12 3a4 4 0 00-2-3.46v6.92A4 4 0 0016 12z" />
              </svg>
            )}
          </button>
        </div>

        <p className="text-[12px] text-text-dim leading-snug">
          <span className="inline-block align-middle h-2 w-0.5 rounded-sm bg-accent-strong mr-1" />
          incident ·
          <span className="inline-block align-middle h-2 w-0.5 rounded-sm bg-danger/80 mx-1" />
          detections — use the ◀▶ buttons to jump between them.
        </p>
      </div>
    </div>
  );
}
