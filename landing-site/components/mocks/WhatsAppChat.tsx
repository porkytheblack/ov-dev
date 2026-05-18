import { ReactNode } from "react";
import { StatusBar } from "./PhoneFrame";
import { CameraFeed } from "./CameraFeed";

function Avatar() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 5c4 0 7.4 2.5 9 7-1.6 4.5-5 7-9 7s-7.4-2.5-9-7c1.6-4.5 5-7 9-7Z"
          stroke="#0a0c10"
          strokeWidth="1.8"
        />
        <circle cx="12" cy="12" r="3.2" fill="#0a0c10" />
      </svg>
    </div>
  );
}

function Ticks() {
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none" className="inline">
      <path
        d="M1 6l3 3 6-7M6 9l1 0.8 6-7"
        stroke="#53bdeb"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WaBubble({
  side = "in",
  time,
  ticks,
  children,
  noPad,
}: {
  side?: "in" | "out";
  time: string;
  ticks?: boolean;
  children: ReactNode;
  noPad?: boolean;
}) {
  const out = side === "out";
  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[80%] rounded-lg text-[13.5px] leading-snug text-[#e9edef] ${
          out ? "rounded-tr-none bg-whatsapp-out" : "rounded-tl-none bg-whatsapp-bubble"
        } ${noPad ? "p-1" : "px-2.5 py-1.5"}`}
      >
        {children}
        <div className="mt-0.5 flex items-center justify-end gap-1 px-1 pb-0.5">
          <span className="mono text-[10px] text-[#ffffff8a]">{time}</span>
          {out && ticks && <Ticks />}
        </div>
      </div>
    </div>
  );
}

export function WaIncidentCard() {
  return (
    <div className="w-[230px]">
      <CameraFeed
        scene="gate"
        camera="CAM-01 · FRONT GATE"
        time="02:14:07"
        tag="INCIDENT"
        className="!rounded-md"
      />
      <div className="px-1 pt-2 text-[13px] leading-snug">
        <p className="font-semibold text-accent">[OVERWATCH] Incident · Front Gate</p>
        <p className="mt-1 text-[#e9edef]">
          <span className="font-medium">person</span> detected in{" "}
          <span className="font-medium">Driveway ROI</span>
        </p>
        <p className="mono mt-1 text-[11px] text-[#8696a0]">
          Started 02:14 · lingered 64s
        </p>
        <p className="mt-1.5 text-[#cfd5da]">
          One person entered the driveway zone and approached the gate. No
          vehicle present.
        </p>
      </div>
      <a className="mt-2 flex items-center gap-2 rounded-md bg-[#111b21] px-2.5 py-2 no-underline">
        <span className="flex h-7 w-7 items-center justify-center rounded bg-accent text-[#0a0c10]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <span className="leading-tight">
          <span className="block text-[12px] font-medium text-[#e9edef]">
            View live playback
          </span>
          <span className="mono block text-[10px] text-[#53bdeb]">
            overwatch.local/i/8f3a…
          </span>
        </span>
      </a>
    </div>
  );
}

export function WhatsAppChat({
  subtitle = "online",
  children,
}: {
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col bg-whatsapp-bg">
      <div className="bg-[#202c33]">
        <StatusBar tint="light" />
        <div className="flex items-center gap-3 px-3 py-2">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            className="text-[#e9edef]"
          >
            <path
              d="M15 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <Avatar />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium text-[#e9edef]">
              Overwatch
            </p>
            <p className="truncate text-[12px] text-[#8696a0]">{subtitle}</p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" className="fill-[#aebac1]">
            <path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24 11 11 0 0 0 3.5.56 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.2.2 2.4.56 3.5a1 1 0 0 1-.24 1l-2.2 2.3Z" />
          </svg>
          <svg width="6" height="20" viewBox="0 0 6 20" className="fill-[#aebac1]">
            <circle cx="3" cy="3" r="2.4" />
            <circle cx="3" cy="10" r="2.4" />
            <circle cx="3" cy="17" r="2.4" />
          </svg>
        </div>
      </div>

      <div
        className="flex flex-1 flex-col gap-2 overflow-hidden px-3 py-3"
        style={{
          backgroundColor: "#0b141a",
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.022) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        <div className="mx-auto mb-1 rounded-md bg-[#1d282f] px-2.5 py-1">
          <span className="mono text-[10px] tracking-[0.08em] text-[#8696a0]">
            TODAY
          </span>
        </div>
        {children}
      </div>

      <div className="flex items-center gap-2 bg-[#0b141a] px-3 py-2.5">
        <div className="flex h-9 flex-1 items-center rounded-full bg-[#202c33] px-3.5 text-[13px] text-[#8696a0]">
          Message
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-whatsapp">
          <svg width="16" height="16" viewBox="0 0 24 24" className="fill-white">
            <path d="M3 20l18-8L3 4v6l12 2-12 2z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
