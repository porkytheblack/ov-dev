"use client";

import { useState, ReactNode } from "react";
import { PhoneFrame } from "./mocks/PhoneFrame";
import { WhatsAppChat, WaBubble, WaIncidentCard } from "./mocks/WhatsAppChat";
import { TelegramChat, TgBubble, TgFireCard } from "./mocks/TelegramChat";
import { TypingDots } from "./mocks/Typing";
import { Reveal } from "./Reveal";

type Tab = {
  id: string;
  tag: string;
  channel: "WhatsApp" | "Telegram";
  title: string;
  body: string;
  points: string[];
  phone: ReactNode;
};

const tabs: Tab[] = [
  {
    id: "intrusion",
    tag: "Intrusion",
    channel: "WhatsApp",
    title: "Person at the gate, 2AM",
    body: "Someone enters a watched zone after hours and stays. Overwatch opens an incident and sends the clip before they reach the door.",
    points: [
      "Night-only zone, triggered on linger",
      "Clip with bounding boxes drawn in",
      "Poster frame and a plain-language summary",
    ],
    phone: (
      <PhoneFrame>
        <WhatsAppChat subtitle="online · security bot">
          <WaBubble side="in" time="02:15" noPad>
            <WaIncidentCard />
          </WaBubble>
          <WaBubble side="out" time="02:15" ticks>
            On it — checking the camera now.
          </WaBubble>
          <WaBubble side="in" time="02:16">
            Acknowledged. Still in frame — I&apos;ll flag if it escalates.
          </WaBubble>
        </WhatsAppChat>
      </PhoneFrame>
    ),
  },
  {
    id: "fire",
    tag: "Fire & smoke",
    channel: "Telegram",
    title: "Smoke detected. Acknowledge now.",
    body: "Fire and smoke are flagged the instant they appear, with one-tap actions so you can respond without typing a word.",
    points: [
      "Urgent priority, sent immediately",
      "One-tap acknowledge, inline",
      "Clip and poster of the source",
    ],
    phone: (
      <PhoneFrame>
        <TelegramChat subtitle="bot · alerts">
          <TgBubble side="in" time="23:48" noPad>
            <TgFireCard />
          </TgBubble>
          <TgBubble side="out" time="23:49">
            Calling it in now.
          </TgBubble>
        </TelegramChat>
      </PhoneFrame>
    ),
  },
  {
    id: "ask",
    tag: "Ask it",
    channel: "WhatsApp",
    title: "“What happened last hour?”",
    body: "Reply in plain language and get a factual answer pulled from real incident data — never invented.",
    points: [
      "Natural-language questions",
      "Answers from real incidents only",
      "“Show me the gate clip” → it sends it",
    ],
    phone: (
      <PhoneFrame>
        <WhatsAppChat subtitle="online · security bot">
          <WaBubble side="out" time="08:02" ticks>
            what happened in the last hour?
          </WaBubble>
          <TypingDots tint="wa" />
          <WaBubble side="in" time="08:02">
            <p>3 incidents in the last hour:</p>
            <p className="mono mt-1.5 text-[11px] leading-snug text-[#3b4a54]">
              07:14 Gate · person · ack&apos;d
              <br />
              07:31 Fence · person · supp
              <br />
              07:55 Drive · car+person
            </p>
            <p className="mt-1.5">Only 07:14 is worth a look. Want the clip?</p>
          </WaBubble>
          <WaBubble side="out" time="08:03" ticks>
            yes, send the gate one
          </WaBubble>
        </WhatsAppChat>
      </PhoneFrame>
    ),
  },
  {
    id: "briefing",
    tag: "Briefing",
    channel: "Telegram",
    title: "Your overnight rollup",
    body: "A scheduled briefing summarizes everything that happened while you slept — quiet nights stay quiet.",
    points: [
      "Scheduled rollups, your cadence",
      "Summary with incident counts",
      "Tap through to any clip",
    ],
    phone: (
      <PhoneFrame>
        <TelegramChat subtitle="bot · summaries">
          <TgBubble side="in" time="06:00">
            <p className="font-semibold text-[#b15c00]">
              [OVERWATCH] Overnight summary
            </p>
            <p className="mono mt-1 text-[11px] text-[#8a9aa5]">
              22:00→06:00 · 4 cams
            </p>
            <p className="mono mt-2 text-[11px] leading-snug text-[#3b4a54]">
              Front Gate · 2 · ack&apos;d
              <br />
              West Fence · 1 · suppr.
              <br />
              Driveway · 1 · closed
              <br />
              Rear Yard · 0
            </p>
            <p className="mt-2 text-[#1a1a1a]">
              Quietest night this week. Nothing open — the 02:14 gate visitor
              is the only clip worth a glance.
            </p>
          </TgBubble>
          <TgBubble side="out" time="07:18">
            all clear, thanks
          </TgBubble>
        </TelegramChat>
      </PhoneFrame>
    ),
  },
];

export function Showcase() {
  const [active, setActive] = useState(0);
  const t = tabs[active];

  return (
    <section id="showcase" className="container-ov py-24 lg:py-28">
      <Reveal>
        <div className="max-w-2xl">
          <span className="eyebrow">In the field</span>
          <h2 className="section-title mt-4">This is what arrives.</h2>
          <p className="lead mt-5">
            No app to open. The incident comes to you, with the evidence
            attached.
          </p>
        </div>
      </Reveal>

      <div className="mt-10 flex flex-wrap gap-2">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            onClick={() => setActive(i)}
            className={`mono inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[12px] uppercase tracking-[0.08em] transition-colors duration-150 ${
              i === active
                ? "border-transparent text-[color:var(--on-accent)] font-semibold"
                : "border-border-strong bg-surface text-text-muted hover:bg-surface-elev hover:text-text"
            }`}
            style={
              i === active
                ? { background: "var(--accent-fill)" }
                : undefined
            }
          >
            {tab.tag}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-16">
        <div key={t.id} className="animate-fade-up lg:order-1">
          <span
            className={`pill ${
              t.channel === "WhatsApp"
                ? "border-[#1da851] text-[#1da851]"
                : "border-[#2b8fd6] text-[#2b8fd6]"
            }`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                t.channel === "WhatsApp" ? "bg-[#1da851]" : "bg-[#2b8fd6]"
              }`}
            />
            {t.channel}
          </span>
          <h3 className="mt-4 text-[clamp(1.5rem,3vw,2.1rem)] font-medium leading-tight tracking-[-0.02em]">
            {t.title}
          </h3>
          <p className="lead mt-4 max-w-[34rem]">{t.body}</p>
          <ul className="mt-7 space-y-3.5">
            {t.points.map((p) => (
              <li key={p} className="flex gap-3 text-[15px] text-text">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="mt-0.5 shrink-0 text-accent"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeOpacity="0.35"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M8 12.5l2.5 2.5L16 9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div
          key={`${t.id}-phone`}
          className="animate-fade-up lg:order-2"
          style={{ animationDelay: "60ms" }}
        >
          {t.phone}
        </div>
      </div>
    </section>
  );
}
