import type { ReactNode } from "react";
import { Reveal } from "./Reveal";

const P = { stroke: "currentColor", strokeWidth: 1.5, fill: "none" } as const;

const caps: { k: string; title: string; body: string; icon: ReactNode }[] = [
  {
    k: "zones",
    title: "Zone-based rules",
    body: "Draw zones on each camera. Each zone has its own rule: what to detect, when, and for how long.",
    icon: <path d="M4 6l6-2 10 3-2 11-9 2-5-6z" {...P} strokeDasharray="3 2" />,
  },
  {
    k: "classes",
    title: "80 object classes",
    body: "People, vehicles, animals, bags and more. Alert on what matters, ignore the rest, and suppress the neighbour's cat.",
    icon: (
      <>
        <rect x="4" y="4" width="16" height="16" {...P} />
        <path d="M4 9h5V4" {...P} />
      </>
    ),
  },
  {
    k: "linger",
    title: "Linger thresholds",
    body: "Ignore people walking past. Escalate when someone stays at the gate, by the car or at the bay doors.",
    icon: (
      <>
        <circle cx="12" cy="13" r="7" {...P} />
        <path d="M12 9v4l3 2M10 3h4" {...P} />
      </>
    ),
  },
  {
    k: "fire",
    title: "Fire & smoke detection",
    body: "Critical classes bypass schedules and cooldowns. They alert everyone at any hour.",
    icon: <path d="M12 3c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3 0-5 1-8z" {...P} />,
  },
  {
    k: "sched",
    title: "Schedules & quiet hours",
    body: "Arm zones by time of day and day of week. Business hours stay quiet and nights stay watched.",
    icon: (
      <>
        <rect x="4" y="5" width="16" height="15" {...P} />
        <path d="M4 10h16M9 3v4M15 3v4" {...P} />
      </>
    ),
  },
  {
    k: "clips",
    title: "Evidence-grade clips",
    body: "Every incident gets a clip with detection overlays and a poster frame, kept on your storage for as long as you choose.",
    icon: (
      <>
        <rect x="3" y="6" width="13" height="12" {...P} />
        <path d="M16 10l5-3v10l-5-3" {...P} />
      </>
    ),
  },
  {
    k: "agent",
    title: "Conversational agent",
    body: "Ask questions in plain language over WhatsApp or Telegram. It searches incidents, pulls clips and reports camera status.",
    icon: <path d="M4 5h16v11H9l-5 4z M8 10h8" {...P} />,
  },
  {
    k: "brief",
    title: "Scheduled briefings",
    body: "Overnight summaries, daily reports and weekly rollups, delivered to whoever needs them.",
    icon: <path d="M6 3h9l4 4v14H6z M14 3v5h5 M9 13h7M9 17h5" {...P} />,
  },
  {
    k: "watchdog",
    title: "Self-healing streams",
    body: "A camera-health watchdog detects stalled streams and reconnects them automatically. You're told if a camera goes dark.",
    icon: <path d="M4 12a8 8 0 0 1 14-5l2-2v6h-6l2-2a5 5 0 1 0 1 6" {...P} />,
  },
  {
    k: "links",
    title: "Signed playback links",
    body: "Alert links are short-lived and cryptographically signed, so playback never sits on a public URL.",
    icon: (
      <>
        <rect x="5" y="11" width="14" height="10" {...P} />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" {...P} />
      </>
    ),
  },
  {
    k: "existing",
    title: "Works with your cameras",
    body: "Any RTSP-capable IP camera or NVR. We audit what you have, reuse what works and replace only what doesn't.",
    icon: (
      <>
        <path d="M3 8h13v9H3z M16 11l5-2v7l-5-2" {...P} />
        <circle cx="9.5" cy="12.5" r="2" {...P} />
      </>
    ),
  },
  {
    k: "vlm",
    title: "On-prem AI summaries",
    body: "Optional local vision-language model writes a one-line description of each incident without sending video to a cloud service.",
    icon: (
      <>
        <rect x="6" y="6" width="12" height="12" {...P} />
        <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" {...P} />
      </>
    ),
  },
];

export function Capabilities() {
  return (
    <section id="capabilities" className="relative border-t border-border">
      <div className="container-ov py-24 lg:py-32">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-end">
          <Reveal>
            <span className="eyebrow">Smart monitoring</span>
            <h2 className="section-title mt-4 max-w-[16ch]">
              More than motion detection.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="lead max-w-[34rem] lg:justify-self-end">
              Motion sensors alert on swaying trees. Overwatch knows what it is
              looking at, where it is, and whether it matters at this hour.
              Every capability below ships with every installation.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {caps.map((c, i) => (
            <Reveal
              key={c.k}
              delay={(i % 4) * 50}
              className="group bg-bg p-6 transition-colors duration-200 hover:bg-surface"
            >
              <div className="flex items-center justify-between">
                <svg width="24" height="24" viewBox="0 0 24 24" className="text-accent">
                  {c.icon}
                </svg>
                <span className="mono text-[11px] text-text-dim">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-6 text-[16px] font-medium text-text">{c.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-text-muted">{c.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
