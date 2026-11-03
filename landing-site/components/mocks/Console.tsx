"use client";

import { useEffect, useState } from "react";
import { CameraFeed } from "./CameraFeed";

type LogLine = { t: string; src: string; msg: string; level?: "accent" | "ok" | "dim" };

const script: LogLine[] = [
  { t: "02:13:58", src: "detector", msg: "CAM-01 person conf=0.94 track=#118", level: "dim" },
  { t: "02:14:02", src: "engine", msg: "track #118 entered ROI “Gate approach”", level: "dim" },
  { t: "02:14:07", src: "engine", msg: "linger 60s exceeded → INC-2041 OPEN", level: "accent" },
  { t: "02:14:11", src: "clips", msg: "INC-2041 clip 00:24 + poster rendered", level: "dim" },
  { t: "02:14:12", src: "notifier", msg: "→ WhatsApp ×3 · Telegram group ×1", level: "accent" },
  { t: "02:14:40", src: "telegram", msg: "INC-2041 ACK'D by guard.post-2", level: "ok" },
  { t: "02:15:03", src: "watchdog", msg: "CAM-05 stream stalled → reconnected 1.8s", level: "dim" },
  { t: "02:16:20", src: "agent", msg: "“who’s at the gate?” → answered with clip", level: "dim" },
  { t: "02:18:44", src: "engine", msg: "INC-2041 RESOLVED · track left scene", level: "ok" },
];

function LiveLog() {
  const [n, setN] = useState(4);
  useEffect(() => {
    const id = setInterval(() => setN((v) => (v >= script.length ? 4 : v + 1)), 2200);
    return () => clearInterval(id);
  }, []);
  const lines = script.slice(Math.max(0, n - 4), n);
  return (
    <div className="mono space-y-1 text-[11px] leading-[1.55]">
      {lines.map((l, i) => (
        <div key={`${l.t}-${n}-${i}`} className="flex gap-3 animate-fade-up">
          <span className="text-text-dim">{l.t}</span>
          <span className="w-[68px] shrink-0 text-text-dim">{l.src}</span>
          <span
            className={
              l.level === "accent"
                ? "text-accent"
                : l.level === "ok"
                  ? "text-success"
                  : "text-text-muted"
            }
          >
            {l.msg}
          </span>
        </div>
      ))}
    </div>
  );
}

const incidents = [
  { id: "INC-2041", cam: "Front Gate", cls: "person · linger 64s", st: "OPEN", t: "02:14" },
  { id: "INC-2040", cam: "Loading Bay", cls: "vehicle · after-hours", st: "ACK'D", t: "01:52" },
  { id: "INC-2039", cam: "East Fence", cls: "person · perimeter", st: "RESOLVED", t: "00:31" },
  { id: "INC-2038", cam: "Rear Yard", cls: "dog · suppressed", st: "SUPPRESSED", t: "23:07" },
];

function Status({ st }: { st: string }) {
  const cls =
    st === "OPEN"
      ? "bg-accent text-[color:var(--on-accent)] border-accent"
      : st === "RESOLVED"
        ? "border-success/60 text-success"
        : "border-border-strong text-text-muted";
  return (
    <span className={`mono border px-1.5 py-[1px] text-[9.5px] tracking-[0.06em] ${cls}`}>
      {st}
    </span>
  );
}

export function Console() {
  return (
    <div className="ticks border border-border-strong bg-surface" aria-hidden="true">
      {/* title bar */}
      <div className="flex h-10 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <span className="mono text-[11px] font-medium uppercase tracking-[0.14em] text-text">
            Overwatch
          </span>
          <span className="inline-block h-[6px] w-[6px] bg-accent animate-pulse-mark" />
          <span className="mono hidden text-[11px] text-text-dim sm:inline">
            / Hillcrest Residence · Console
          </span>
        </div>
        <div className="mono flex items-center gap-4 text-[11px] text-text-muted">
          <span className="hidden md:inline">
            <span className="text-success">●</span> 8/8 cameras
          </span>
          <span className="hidden md:inline">
            <span className="text-accent">1</span> open
          </span>
          <span className="text-text-dim">02:14:12</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px]">
        {/* feeds: one primary + two secondary, heights line up at 16:9 */}
        <div className="grid grid-cols-3 gap-px bg-border p-px">
          <div className="col-span-3 sm:col-span-2 sm:row-span-2">
            <CameraFeed
              scene="gate"
              camera="CAM-01 · FRONT GATE"
              time="02:14:12"
              tag="INCIDENT"
              zone="ROI · GATE APPROACH"
              className="!rounded-none !border-0"
            />
          </div>
          <div className="col-span-3 hidden sm:col-span-1 sm:block">
            <CameraFeed
              scene="perimeter"
              camera="CAM-03 · FENCE"
              time="02:14:12"
              tag="LIVE"
              zone="ROI · PERIMETER"
              className="!rounded-none !border-0"
            />
          </div>
          <div className="col-span-3 hidden sm:col-span-1 sm:block">
            <CameraFeed
              scene="bay"
              camera="CAM-05 · BAY"
              time="02:14:12"
              tag="REC"
              zone="ROI · BAY"
              className="!rounded-none !border-0"
            />
          </div>
        </div>

        {/* incident rail */}
        <div className="relative hidden border-l border-border lg:block">
          <div className="absolute inset-0 flex flex-col overflow-hidden">
          <div className="flex h-9 items-center justify-between border-b border-border px-4">
            <span className="index">Incidents · 24h</span>
            <span className="mono text-[11px] text-text-dim">4</span>
          </div>
          <ul className="flex-1">
            {incidents.map((i, k) => (
              <li
                key={i.id}
                className={`border-b border-border px-4 py-3 ${k === 0 ? "bg-[color:var(--accent-soft)]" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <Status st={i.st} />
                  <span className="mono text-[11px] text-text">{i.id}</span>
                </div>
                <p className="mt-1 text-[12.5px] text-text">{i.cam}</p>
                <p className="mono mt-0.5 text-[10.5px] text-text-dim">
                  {i.t} · {i.cls}
                </p>
              </li>
            ))}
          </ul>
          </div>
        </div>
      </div>

      {/* event log */}
      <div className="flex items-start gap-4 border-t border-border px-4 py-3">
        <span className="index hidden shrink-0 pt-[2px] sm:inline">Event log</span>
        <div className="min-h-[72px] min-w-0 flex-1 overflow-hidden">
          <LiveLog />
        </div>
      </div>
    </div>
  );
}
