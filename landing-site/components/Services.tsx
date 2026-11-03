import { ReactNode } from "react";
import { CameraFeed } from "./mocks/CameraFeed";
import { PhoneFrame } from "./mocks/PhoneFrame";
import { WhatsAppChat, WaBubble } from "./mocks/WhatsAppChat";
import { TelegramChat, TgBubble, TgFireCard } from "./mocks/TelegramChat";
import { Reveal } from "./Reveal";

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="mt-[5px] shrink-0 text-accent">
      <path d="M4 12.5l5 5L20 6.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function RuleRow({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2.5 last:border-b-0">
      <span className="index !text-[10px]">{k}</span>
      <span className="mono text-[12px] text-text">{v}</span>
    </div>
  );
}

function ZoneEditor() {
  return (
    <div className="ticks border border-border-strong bg-surface" aria-hidden="true">
      <div className="flex h-9 items-center justify-between border-b border-border px-4">
        <span className="index">CAM-01 · Front Gate · Zone editor</span>
        <span className="mono text-[11px] text-success">● ONLINE</span>
      </div>
      <div className="grid md:grid-cols-[1.35fr_1fr]">
        <div className="flex flex-col border-b border-border md:border-b-0 md:border-r">
          <CameraFeed
            scene="gate"
            camera="CAM-01 · FRONT GATE"
            time="02:14:07"
            tag="LIVE"
            zone="ROI · DRIVEWAY"
            className="!rounded-none !border-0"
          />
          <div className="flex-1 border-t border-border">
            <p className="index !text-[10px] px-4 pt-3">Zones on this camera</p>
            <ul className="mono px-4 pb-3 pt-2 text-[11.5px]">
              {[
                ["DRIVEWAY", "armed · 19:00–06:00", "text-accent"],
                ["GATE-APPROACH", "armed · always", "text-accent"],
                ["STREET", "ignored", "text-text-dim"],
              ].map(([z, st, c]) => (
                <li key={z} className="flex items-center justify-between py-1">
                  <span className="flex items-center gap-2 text-text">
                    <span className={`h-2 w-2 border ${c === "text-accent" ? "border-accent" : "border-border-strong"}`} />
                    {z}
                  </span>
                  <span className={c}>{st}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex flex-col">
          <div className="border-b border-border px-4 py-3">
            <p className="index !text-[10px]">Rule</p>
            <p className="mt-1 text-[14px] text-text">After-hours presence at gate</p>
          </div>
          <RuleRow k="Detect" v="person, vehicle" />
          <RuleRow k="Linger" v="≥ 60s" />
          <RuleRow k="Schedule" v="19:00 – 06:00" />
          <RuleRow k="Min. conf" v="0.60" />
          <RuleRow k="Cooldown" v="5 min" />
          <RuleRow
            k="Notify"
            v={
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 bg-whatsapp" /> WA ×3
                <span className="ml-1 h-1.5 w-1.5 bg-telegram" /> TG ×1
              </span>
            }
          />
        </div>
      </div>
    </div>
  );
}

type Pillar = {
  n: string;
  tag: string;
  title: string;
  body: string;
  items: string[];
  visual: ReactNode;
};

const pillars: Pillar[] = [
  {
    n: "01",
    tag: "Custom control software",
    title: "A command console built for your site.",
    body: "We install Overwatch on a dedicated server on your premises and configure it around how your property actually works: which zones matter, at what hours, and who needs to know. Every camera, every incident and every clip lives in one console your team can run from any browser on the network.",
    items: [
      "Multi-camera live view with real-time detection overlays",
      "Hand-drawn zones with per-zone rules, schedules and linger thresholds",
      "Incident lifecycle: open, acknowledge, resolve, suppress",
      "Overlay clips and poster frames for every incident",
      "Operator accounts, retention policies, camera-health watchdog",
    ],
    visual: <ZoneEditor />,
  },
  {
    n: "02",
    tag: "WhatsApp integration",
    title: "Your security desk, inside WhatsApp.",
    body: "We provision and verify a WhatsApp Business number for your property and connect it to your system. Alerts arrive with the clip, a plain-language summary and a secure playback link. You can also ask questions in plain language and get answers from the footage.",
    items: [
      "Business number set up, verified and connected to your server",
      "Incident alerts with clip, poster frame and playback link",
      "Ask questions in plain language: “anyone at the gate since 10?”",
      "Several recipients per zone: owner, manager, guard post",
      "Short-lived signed links: playback never sits on a public URL",
    ],
    visual: (
      <div className="flex justify-center">
        <PhoneFrame className="origin-top scale-[0.92]">
          <WhatsAppChat subtitle="online · security">
            <WaBubble side="out" time="22:41" ticks>
              Anyone come through the gate since 6pm?
            </WaBubble>
            <WaBubble side="in" time="22:41">
              <span className="block">3 arrivals since 18:00:</span>
              <span className="mono mt-1 block text-[11.5px] leading-relaxed text-[#3b4a54]">
                18:12 · car · driveway
                <br />
                19:47 · person · gate
                <br />
                21:05 · car · visitor bays
              </span>
              <span className="mt-1 block">The 19:47 visitor stayed 4 min. Want the clip?</span>
            </WaBubble>
            <WaBubble side="out" time="22:42" ticks>
              Yes please
            </WaBubble>
            <WaBubble side="in" time="22:42" noPad>
              <CameraFeed
                scene="gate"
                camera="CAM-01 · FRONT GATE"
                time="19:47:22"
                tag="REC"
                className="!rounded-md"
              />
            </WaBubble>
          </WhatsAppChat>
        </PhoneFrame>
      </div>
    ),
  },
  {
    n: "03",
    tag: "Telegram integration",
    title: "Team alerting, one tap from action.",
    body: "For guard teams and multi-person rotas, we set up a private Telegram bot and an escalation group. Urgent incidents arrive with inline buttons, so whoever is on shift can acknowledge in one tap and everyone sees who's handling it.",
    items: [
      "Private bot and security group, access-controlled",
      "Inline actions: view playback, acknowledge",
      "Scheduled briefings: overnight summaries and daily reports",
      "Live view and camera status on request",
      "Runs alongside WhatsApp, with different recipients per channel",
    ],
    visual: (
      <div className="flex justify-center">
        <PhoneFrame className="origin-top scale-[0.92]">
          <TelegramChat subtitle="Security · 4 members">
            <TgBubble side="in" time="23:48" noPad>
              <TgFireCard />
            </TgBubble>
            <TgBubble side="in" time="23:48">
              <span className="text-[12px] text-[#2b8fd6]">guard.post-2</span>
              <span className="block">✓ Acknowledged · responding</span>
            </TgBubble>
          </TelegramChat>
        </PhoneFrame>
      </div>
    ),
  },
];

export function Services() {
  return (
    <section id="services" className="relative border-t border-border">
      <div className="container-ov py-24 lg:py-32">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-end">
          <Reveal>
            <span className="eyebrow">What we deliver</span>
            <h2 className="section-title mt-4 max-w-[18ch]">
              Three systems. One installation. Fully commissioned.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="lead max-w-[34rem] lg:justify-self-end">
              We don&apos;t ship you a box and a login. Our engineers install,
              provision and tune every layer: the cameras, the control
              software and the messengers. You sign off on a system that
              already works.
            </p>
          </Reveal>
        </div>

        <div className="mt-20 space-y-28 lg:space-y-36">
          {pillars.map((p, i) => (
            <div
              key={p.n}
              className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20"
            >
              <Reveal className={i % 2 === 1 ? "lg:order-2" : ""}>
                <div className="flex items-center gap-4">
                  <span className="mono text-[13px] text-accent">{p.n}</span>
                  <span className="h-px w-10 bg-border-strong" />
                  <span className="index">{p.tag}</span>
                </div>
                <h3 className="mt-5 text-[clamp(1.6rem,3.2vw,2.3rem)] font-medium leading-[1.1] tracking-[-0.02em]">
                  {p.title}
                </h3>
                <p className="mt-5 max-w-[34rem] text-[15.5px] leading-relaxed text-text-muted">
                  {p.body}
                </p>
                <ul className="mt-8 space-y-3 border-t border-border pt-6">
                  {p.items.map((it) => (
                    <li key={it} className="flex gap-3 text-[14.5px] text-text">
                      <Check />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
              <Reveal delay={100} className={`${i % 2 === 1 ? "lg:order-1" : ""} ${i > 0 ? "-mb-12" : ""}`}>
                {p.visual}
              </Reveal>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
