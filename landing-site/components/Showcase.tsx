"use client";

import { useState, ReactNode } from "react";
import { PhoneFrame } from "./mocks/PhoneFrame";
import {
  WhatsAppChat,
  WaBubble,
  WaIncidentCard,
} from "./mocks/WhatsAppChat";
import {
  TelegramChat,
  TgBubble,
  TgFireCard,
  TgInlineKeyboard,
} from "./mocks/TelegramChat";
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
    title: "Someone in the driveway at 2am",
    body: "A person crosses into the driveway zone and lingers by the gate. After the linger threshold, Overwatch opens an incident and messages you — with the clip and boxes already drawn.",
    points: [
      "Object tracked across frames, not a one-off motion blip",
      "Notification only after it genuinely lingers — no false alarms",
      "Plain-language summary of what it saw",
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
            Acknowledged. Still in frame. I&apos;ll message you if it escalates
            or leaves.
          </WaBubble>
        </WhatsAppChat>
      </PhoneFrame>
    ),
  },
  {
    id: "fire",
    tag: "Fire & smoke",
    channel: "Telegram",
    title: "Fire breaks out behind the shed",
    body: "Flames and smoke are detected in the rear yard. This isn't a slow linger — it escalates in seconds. Overwatch fires immediately and gives you one-tap actions right in the chat.",
    points: [
      "Fire and smoke classes escalate without waiting",
      "Inline buttons: view playback or acknowledge in one tap",
      "Every subscriber on that camera is notified at once",
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
          <TgBubble side="in" time="23:49">
            Acknowledged by you at 23:49. Smoke still rising — I&apos;ll keep the
            clip running until it clears.
          </TgBubble>
        </TelegramChat>
      </PhoneFrame>
    ),
  },
  {
    id: "ask",
    tag: "Ask anything",
    channel: "WhatsApp",
    title: "Just ask what happened",
    body: "Overwatch is a conversational agent, not a one-way siren. Ask it in plain language and it queries your incident history and answers factually — never made up.",
    points: [
      "Understands “last hour”, “overnight”, “this week”",
      "Answers only from real incident data via its tools",
      "Pull up any clip without opening the dashboard",
    ],
    phone: (
      <PhoneFrame>
        <WhatsAppChat subtitle="online · security bot">
          <WaBubble side="out" time="08:02" ticks>
            what happened in the last hour?
          </WaBubble>
          <TypingDots tint="wa" />
          <WaBubble side="in" time="08:02">
            <p>In the last hour I logged 3 incidents:</p>
            <p className="mono mt-1.5 text-[12px] leading-relaxed text-[#cfd5da]">
              07:14 · Front Gate — 1 person, driveway (64s) · ack&apos;d
              <br />
              07:31 · West Fence — 1 person · suppressed (left in 7s)
              <br />
              07:55 · Driveway — 1 vehicle + 1 person · closed
            </p>
            <p className="mt-1.5">
              Only the 07:14 one is still worth a look. Want the clip?
            </p>
          </WaBubble>
          <WaBubble side="out" time="08:03" ticks>
            yes, show me the gate one
          </WaBubble>
          <WaBubble side="in" time="08:03">
            Front Gate · 07:14 — person lingered 64s near the gate, no vehicle.
            <br />
            <span className="mono text-[12px] text-[#53bdeb]">
              overwatch.local/i/8f3a…
            </span>
          </WaBubble>
        </WhatsAppChat>
      </PhoneFrame>
    ),
  },
  {
    id: "briefing",
    tag: "Daily briefing",
    channel: "Telegram",
    title: "A summary while you slept",
    body: "Wake up to a clear picture instead of a folder of footage. Overwatch rolls the night up into one message so you know in five seconds whether anything needs you.",
    points: [
      "Scheduled rollups across every camera",
      "Counts, statuses and the one thing worth your attention",
      "Drill into any incident straight from the summary",
    ],
    phone: (
      <PhoneFrame>
        <TelegramChat subtitle="bot · summaries">
          <TgBubble side="in" time="06:00">
            <p className="font-semibold text-accent">
              [OVERWATCH] Overnight summary
            </p>
            <p className="mono mt-1 text-[11px] text-[#7d8b99]">
              22:00 → 06:00 · 4 cameras online
            </p>
            <p className="mono mt-2 text-[12px] leading-relaxed text-[#cdd6df]">
              Front Gate ···· 2 incidents · both ack&apos;d
              <br />
              West Fence ··· 1 suppressed
              <br />
              Driveway ····· 1 closed
              <br />
              Rear Yard ···· 0
            </p>
            <p className="mt-2 text-[#cdd6df]">
              Quietest night this week. Nothing open. The 02:14 gate visitor is
              the only clip worth a glance.
            </p>
          </TgBubble>
          <TgBubble side="in" time="06:00">
            Want the full incident list or just the gate clip?
            <TgInlineKeyboard />
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
          <span className="eyebrow">In action</span>
          <h2 className="section-title mt-4">
            See what lands on your phone
          </h2>
          <p className="lead mt-5">
            Real incidents, real conversations — on the apps you already use.
            Tap through a few.
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
                ? "border-accent bg-accent text-[color:var(--on-accent)] font-semibold"
                : "border-border-strong bg-surface text-text-muted hover:bg-surface-elev hover:text-text"
            }`}
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
                ? "border-whatsapp text-whatsapp"
                : "border-telegram text-telegram"
            }`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                t.channel === "WhatsApp" ? "bg-whatsapp" : "bg-telegram"
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
                    strokeOpacity="0.4"
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
