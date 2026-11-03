"use client";

import { ReactNode, useEffect, useState } from "react";
import { CameraFeed, type Scene } from "./mocks/CameraFeed";
import { PhoneFrame } from "./mocks/PhoneFrame";
import { WhatsAppChat, WaBubble, WaIncidentCard } from "./mocks/WhatsAppChat";
import { TelegramChat, TgBubble, TgFireCard, TgInlineKeyboard } from "./mocks/TelegramChat";
import { TypingDots } from "./mocks/Typing";
import { Reveal } from "./Reveal";

type Step = { t: string; label: string };

type Scenario = {
  id: string;
  tab: string;
  channel: "WhatsApp" | "Telegram";
  title: string;
  body: string;
  feed: {
    scene: Scene;
    camera: string;
    time: string;
    tag: "LIVE" | "INCIDENT" | "REC";
    zone: string;
    boxes?: { x: number; y: number; w: number; h: number; label: string; danger?: boolean }[];
  };
  steps: Step[];
  phone: ReactNode;
};

const scenarios: Scenario[] = [
  {
    id: "perimeter",
    tab: "Perimeter breach",
    channel: "WhatsApp",
    title: "Someone crosses the fence line at night.",
    body: "The perimeter zone is armed only after dark. A person entering it opens an incident immediately, with no linger needed, and the owner and guard post are alerted with the clip.",
    feed: {
      scene: "perimeter",
      camera: "CAM-03 · EAST FENCE",
      time: "01:12:40",
      tag: "INCIDENT",
      zone: "ROI · PERIMETER",
    },
    steps: [
      { t: "01:12:38", label: "person detected · conf 0.90 · track #77" },
      { t: "01:12:39", label: "entered PERIMETER zone · armed 19:00–06:00" },
      { t: "01:12:39", label: "rule: instant trigger → INC-1187 OPEN" },
      { t: "01:12:44", label: "clip + poster rendered with overlays" },
      { t: "01:12:45", label: "WhatsApp → owner, guard post" },
    ],
    phone: (
      <WhatsAppChat subtitle="online · security">
        <WaBubble side="in" time="01:12" noPad>
          <div className="w-full">
            <CameraFeed
              scene="perimeter"
              camera="CAM-03 · EAST FENCE"
              time="01:12:40"
              tag="INCIDENT"
              zone="ROI · PERIMETER"
              className="!rounded-md"
            />
            <div className="px-1 pt-1.5 text-[12.5px] leading-snug">
              <p className="font-semibold text-[#b15c00]">[OVERWATCH] Incident · East Fence</p>
              <p className="mt-1 text-[#111b21]">
                <span className="font-medium">person</span> detected in{" "}
                <span className="font-medium">Perimeter</span>
              </p>
              <p className="mono mt-1 text-[11px] text-[#667781]">Started 01:12 · instant trigger</p>
            </div>
          </div>
        </WaBubble>
        <WaBubble side="out" time="01:13" ticks>
          Where are they headed?
        </WaBubble>
        <WaBubble side="in" time="01:13">
          Moving north along the fence toward the rear yard. CAM-04 has them
          in view now. I&apos;ll keep you posted.
        </WaBubble>
      </WhatsAppChat>
    ),
  },
  {
    id: "loiter",
    tab: "Loitering",
    channel: "WhatsApp",
    title: "Someone waits at the gate too long.",
    body: "Passers-by are ignored. Someone who stays in the driveway zone for more than 60 seconds after hours is not. The linger threshold filters out the noise, so the alerts you get are worth reading.",
    feed: {
      scene: "gate",
      camera: "CAM-01 · FRONT GATE",
      time: "02:14:07",
      tag: "INCIDENT",
      zone: "ROI · DRIVEWAY",
    },
    steps: [
      { t: "02:13:03", label: "person detected · track #118" },
      { t: "02:13:03", label: "entered DRIVEWAY zone · timer started" },
      { t: "02:14:07", label: "linger 64s ≥ 60s → INC-2041 OPEN" },
      { t: "02:14:11", label: "summary: “one person, no vehicle”" },
      { t: "02:14:12", label: "WhatsApp → 3 recipients" },
    ],
    phone: (
      <WhatsAppChat subtitle="online · security">
        <WaBubble side="in" time="02:14" noPad>
          <WaIncidentCard />
        </WaBubble>
        <WaBubble side="out" time="02:15" ticks>
          Ack. Guard is on the way.
        </WaBubble>
      </WhatsAppChat>
    ),
  },
  {
    id: "fire",
    tab: "Fire & smoke",
    channel: "Telegram",
    title: "Smoke in the rear yard at 23:48.",
    body: "Fire and smoke are detected on any camera, at any hour, and skip the queue. The whole security group is alerted at once, and the first person to tap Acknowledge takes ownership.",
    feed: {
      scene: "fire",
      camera: "CAM-04 · REAR YARD",
      time: "23:48:31",
      tag: "INCIDENT",
      zone: "ROI · YARD",
    },
    steps: [
      { t: "23:48:25", label: "fire 0.91 · smoke 0.86 detected" },
      { t: "23:48:25", label: "class priority: critical · any hour" },
      { t: "23:48:31", label: "INC-1902 OPEN · escalated in 6s" },
      { t: "23:48:33", label: "Telegram → Security group (4)" },
      { t: "23:48:51", label: "ACK'D by guard.post-2" },
    ],
    phone: (
      <TelegramChat subtitle="Security · 4 members">
        <TgBubble side="in" time="23:48" noPad>
          <TgFireCard />
        </TgBubble>
        <TgBubble side="in" time="23:48">
          <span className="text-[12px] text-[#2b8fd6]">guard.post-2</span>
          <span className="block">✓ Acknowledged · responding</span>
        </TgBubble>
      </TelegramChat>
    ),
  },
  {
    id: "vehicle",
    tab: "After-hours vehicle",
    channel: "Telegram",
    title: "A truck at the loading bay at 03:10.",
    body: "Vehicles at the bay doors are routine by day and suspicious at night. Business-hours schedules mean the same zone can stay quiet at 14:00 and escalate at 03:00.",
    feed: {
      scene: "bay",
      camera: "CAM-05 · LOADING BAY",
      time: "03:10:52",
      tag: "INCIDENT",
      zone: "ROI · BAY-DOORS",
    },
    steps: [
      { t: "03:10:41", label: "truck detected · conf 0.93" },
      { t: "03:10:41", label: "entered BAY-DOORS · outside 06:00–20:00" },
      { t: "03:10:52", label: "stationary 11s → INC-0388 OPEN" },
      { t: "03:10:56", label: "clip rendered · 00:22" },
      { t: "03:10:57", label: "Telegram → Warehouse leads" },
    ],
    phone: (
      <TelegramChat subtitle="Warehouse leads · 3 members">
        <TgBubble side="in" time="03:10" noPad>
          <div className="w-full">
            <CameraFeed
              scene="bay"
              camera="CAM-05 · LOADING BAY"
              time="03:10:52"
              tag="INCIDENT"
              zone="ROI · BAY-DOORS"
              className="!rounded-lg"
            />
            <div className="px-0.5 pt-1.5 text-[12.5px] leading-snug">
              <p className="font-semibold text-[#b15c00]">[OVERWATCH] Incident · Loading Bay</p>
              <p className="mt-1">
                <span className="font-medium">truck</span> detected in{" "}
                <span className="font-medium">Bay doors</span>
              </p>
              <p className="mono mt-1 text-[11px] text-[#8a9aa5]">Started 03:10 · outside business hours</p>
            </div>
            <TgInlineKeyboard />
          </div>
        </TgBubble>
      </TelegramChat>
    ),
  },
  {
    id: "ask",
    tab: "Ask it anything",
    channel: "WhatsApp",
    title: "Ask questions about your own footage.",
    body: "The built-in agent can search incidents, check camera status, pull clips and summarise any period. Message it like you'd message a guard, and it answers from what the cameras saw.",
    feed: {
      scene: "driveway",
      camera: "CAM-02 · DRIVEWAY",
      time: "16:32:10",
      tag: "LIVE",
      zone: "ROI · DRIVEWAY",
    },
    steps: [
      { t: "16:32:04", label: "message: “did the delivery come?”" },
      { t: "16:32:05", label: "tool: search_incidents · last 6h" },
      { t: "16:32:05", label: "tool: query_activity · DRIVEWAY" },
      { t: "16:32:07", label: "tool: send_incident_clips · 1 clip" },
      { t: "16:32:08", label: "reply sent · WhatsApp" },
    ],
    phone: (
      <WhatsAppChat subtitle="online · security">
        <WaBubble side="out" time="16:32" ticks>
          Did the delivery come today?
        </WaBubble>
        <WaBubble side="in" time="16:32">
          Yes. A van stopped in the driveway at 14:06. One person carried a
          parcel to the door and left at 14:09. Here&apos;s the clip.
        </WaBubble>
        <WaBubble side="in" time="16:32" noPad>
          <CameraFeed
            scene="driveway"
            camera="CAM-02 · DRIVEWAY"
            time="14:06:31"
            tag="REC"
            zone="ROI · DRIVEWAY"
            className="!rounded-md"
          />
        </WaBubble>
        <WaBubble side="out" time="16:33" ticks>
          Are all cameras online?
        </WaBubble>
        <TypingDots />
      </WhatsAppChat>
    ),
  },
  {
    id: "brief",
    tab: "Morning briefing",
    channel: "Telegram",
    title: "Last night, summarised by 06:30.",
    body: "Briefings are scheduled for whenever suits you. Each one covers incidents, activity per zone and camera health, so you don't have to scroll through the night's alerts.",
    feed: {
      scene: "gate",
      camera: "CAM-01 · FRONT GATE",
      time: "06:30:00",
      tag: "REC",
      zone: "ROI · DRIVEWAY",
      boxes: [],
    },
    steps: [
      { t: "06:30:00", label: "schedule fired · overnight briefing" },
      { t: "06:30:01", label: "tool: summarize_period 19:00–06:30" },
      { t: "06:30:02", label: "tool: get_system_status" },
      { t: "06:30:04", label: "briefing composed · 4 incidents" },
      { t: "06:30:04", label: "Telegram → Owner" },
    ],
    phone: (
      <TelegramChat subtitle="bot">
        <TgBubble side="in" time="06:30">
          <span className="block font-semibold">Overnight briefing · 19:00–06:30</span>
          <span className="mono mt-1.5 block text-[11.5px] leading-[1.6] text-[#3b4a54]">
            Incidents ······· 4<br />
            Open ············ 0<br />
            Acknowledged ···· 3<br />
            Suppressed ······ 1 (dog)<br />
            Cameras ········· 8/8 online
          </span>
          <span className="mt-1.5 block">
            Quiet night. The only notable event was a visitor at the gate at
            02:14, who stayed 64s and left on foot. CAM-05 dropped its stream
            once at 02:15 and recovered on its own.
          </span>
        </TgBubble>
        <TgBubble side="out" time="06:41">
          Thanks. Send me the 02:14 clip
        </TgBubble>
      </TelegramChat>
    ),
  },
];

function Pipeline({ steps, runKey }: { steps: Step[]; runKey: string }) {
  const [lit, setLit] = useState(0);
  useEffect(() => {
    setLit(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setLit(i);
      if (i >= steps.length) clearInterval(id);
    }, 520);
    return () => clearInterval(id);
  }, [runKey, steps.length]);

  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const on = i < lit;
        const last = i === steps.length - 1;
        return (
          <li key={`${runKey}-${i}`} className="relative flex gap-4 pb-4 last:pb-0">
            {!last && (
              <span
                className={`absolute left-[5px] top-[14px] h-[calc(100%-6px)] w-px transition-colors duration-300 ${
                  i + 1 < lit ? "bg-accent/60" : "bg-border-strong"
                }`}
              />
            )}
            <span
              className={`relative z-10 mt-[5px] h-[11px] w-[11px] shrink-0 border transition-colors duration-300 ${
                on
                  ? last
                    ? "border-accent bg-accent"
                    : "border-accent bg-bg"
                  : "border-border-strong bg-bg"
              }`}
            />
            <div
              className={`flex min-w-0 flex-col gap-0.5 transition-opacity duration-300 sm:flex-row sm:gap-4 ${
                on ? "opacity-100" : "opacity-30"
              }`}
            >
              <span className="mono shrink-0 text-[12px] text-text-dim">{s.t}</span>
              <span className="mono text-[12.5px] text-text">{s.label}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function Scenarios() {
  const [active, setActive] = useState(scenarios[0].id);
  const s = scenarios.find((x) => x.id === active)!;

  return (
    <section id="scenarios" className="relative border-t border-border bg-surface">
      <div className="container-ov py-24 lg:py-32">
        <div className="max-w-3xl">
          <Reveal>
            <span className="eyebrow">What&apos;s possible</span>
          </Reveal>
          <Reveal delay={60}>
            <h2 className="section-title mt-4">
              Rules that understand context. Alerts that arrive with proof.
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="lead mt-5 max-w-2xl">
              Every scenario below is a rule we can configure during
              commissioning. Pick one to see what happens between the camera
              and your phone.
            </p>
          </Reveal>
        </div>

        <Reveal delay={160}>
          <div
            role="tablist"
            aria-label="Monitoring scenarios"
            className="mt-12 flex gap-px overflow-x-auto border border-border bg-border [scrollbar-width:none]"
          >
            {scenarios.map((x, i) => {
              const on = x.id === active;
              return (
                <button
                  key={x.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActive(x.id)}
                  className={`group relative flex min-w-[170px] flex-1 flex-col items-start gap-1 px-4 py-3.5 text-left transition-colors duration-150 ${
                    on ? "bg-bg" : "bg-surface hover:bg-surface-elev"
                  }`}
                >
                  <span
                    className={`absolute inset-x-0 top-0 h-[2px] transition-colors ${on ? "bg-accent" : "bg-transparent"}`}
                  />
                  <span className="mono text-[11px] text-text-dim">
                    {String(i + 1).padStart(2, "0")} · {x.channel}
                  </span>
                  <span className={`text-[14px] ${on ? "text-text" : "text-text-muted group-hover:text-text"}`}>
                    {x.tab}
                  </span>
                </button>
              );
            })}
          </div>
        </Reveal>

        <div
          role="tabpanel"
          className="grid gap-px border-x border-b border-border bg-border lg:grid-cols-[1.25fr_0.75fr]"
        >
          <div className="flex flex-col bg-bg p-6 sm:p-8">
            <h3 className="text-[clamp(1.3rem,2.4vw,1.7rem)] font-medium leading-tight tracking-[-0.015em]">
              {s.title}
            </h3>
            <p className="mt-3 max-w-[36rem] text-[15px] leading-relaxed text-text-muted">
              {s.body}
            </p>

            <div className="mt-7">
              <CameraFeed
                key={s.id}
                scene={s.feed.scene}
                camera={s.feed.camera}
                time={s.feed.time}
                tag={s.feed.tag}
                zone={s.feed.zone}
                boxes={s.feed.boxes}
                className="!rounded-none animate-fade-up"
              />
            </div>

            <div className="mt-7 border-t border-border pt-6">
              <p className="index mb-4">Under the hood</p>
              <Pipeline steps={s.steps} runKey={s.id} />
            </div>
          </div>

          <div className="relative flex items-start justify-center overflow-hidden bg-bg px-4 pt-8 lg:pt-10">
            <div className="h-[560px] sm:h-[600px]">
              <div key={s.id} className="animate-fade-up">
                <PhoneFrame className="origin-top scale-[0.86] sm:scale-[0.92]">{s.phone}</PhoneFrame>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
