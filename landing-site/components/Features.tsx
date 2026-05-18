import type { JSX } from "react";
import { Reveal } from "./Reveal";

type Icon = (p: { className?: string }) => JSX.Element;

const I = {
  scan: ({ className }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <rect x="8.5" y="8.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  ),
  zone: ({ className }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5 7l7-3 7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 12l2.2 2.2L15 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  pulse: ({ className }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M3 12h4l2.5-6 4 13 2.5-7H21" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  clip: ({ className }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10 9.5l5 2.5-5 2.5v-5Z" fill="currentColor" />
    </svg>
  ),
  chat: ({ className }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 4V6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 9h8M8 12h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  send: ({ className }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 11.5 19 4l-5 16-3.5-6.5L4 11.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  ),
  shield: ({ className }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 12l2.2 2.2L15.5 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  clock: ({ className }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
} satisfies Record<string, Icon>;

const features = [
  {
    icon: I.scan,
    t: "Real-time AI vision",
    d: "Detects and tracks 80+ object classes across frames as it happens.",
  },
  {
    icon: I.zone,
    t: "Zones & schedules",
    d: "Draw regions of interest and set time windows like night-only.",
  },
  {
    icon: I.pulse,
    t: "Smart incident logic",
    d: "A linger threshold filters noise, so there's no false-alarm spam.",
  },
  {
    icon: I.clip,
    t: "Overlay clips & posters",
    d: "Every incident ships with bounding boxes and a poster frame.",
  },
  {
    icon: I.chat,
    t: "Conversational agent",
    d: "Ask questions in plain language, get answers from real data.",
  },
  {
    icon: I.send,
    t: "WhatsApp & Telegram",
    d: "Delivered where you already are, with inline acknowledge.",
  },
  {
    icon: I.shield,
    t: "Private by default",
    d: "Your footage stays private. Never sold, never mined.",
  },
  {
    icon: I.clock,
    t: "Smart retention",
    d: "Incidents kept long, routine footage pruned automatically.",
  },
];

export function Features() {
  return (
    <section id="features" className="border-y border-border bg-surface-elev/60">
      <div className="container-ov py-24 lg:py-28">
        <Reveal>
          <div className="max-w-2xl">
            <span className="eyebrow">Capabilities</span>
            <h2 className="section-title mt-4">Built to watch, not record.</h2>
            <p className="lead mt-5">
              Everything operating in real time, across every connected camera.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <Reveal key={f.t} delay={(i % 4) * 60}>
              <div className="group h-full bg-bg p-7 transition-colors duration-150 hover:bg-surface-elev">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-elev text-accent transition-colors duration-150 group-hover:border-[color:var(--accent-line)]">
                  <f.icon className="h-[22px] w-[22px]" />
                </div>
                <h3 className="mt-5 text-[1.05rem] font-medium">{f.t}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-text-muted">
                  {f.d}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
