import { ReactNode } from "react";
import { StatusBar } from "./PhoneFrame";
import { CameraFeed } from "./CameraFeed";

function Avatar() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 5c4 0 7.4 2.5 9 7-1.6 4.5-5 7-9 7s-7.4-2.5-9-7c1.6-4.5 5-7 9-7Z"
          stroke="#ffffff"
          strokeWidth="1.8"
        />
        <circle cx="12" cy="12" r="3.2" fill="#ffffff" />
      </svg>
    </div>
  );
}

function Ticks() {
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none" className="inline">
      <path
        d="M1 6l3 3 6-7M6 9l1 0.8 6-7"
        stroke="#34b7f1"
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
        className={`relative rounded-lg text-[13.5px] leading-snug text-[#111b21] shadow-sm ${
          out ? "rounded-tr-none bg-[#d9fdd3]" : "rounded-tl-none bg-white"
        } ${noPad ? "w-[248px] max-w-[96%] p-1.5" : "max-w-[82%] px-2.5 py-1.5"}`}
      >
        {children}
        <div className="mt-0.5 flex items-center justify-end gap-1 pr-0.5">
          <span className="mono text-[10px] text-[#667781]">{time}</span>
          {out && ticks && <Ticks />}
        </div>
      </div>
    </div>
  );
}

export function WaIncidentCard() {
  return (
    <div className="w-full">
      <CameraFeed
        scene="gate"
        camera="CAM-01 · FRONT GATE"
        time="02:14:07"
        tag="INCIDENT"
        className="!rounded-md"
      />
      <div className="px-1 pt-1.5 text-[12.5px] leading-snug">
        <p className="font-semibold text-[#b15c00]">
          [OVERWATCH] Incident · Front Gate
        </p>
        <p className="mt-1 text-[#111b21]">
          <span className="font-medium">person</span> detected in{" "}
          <span className="font-medium">Driveway zone</span>
        </p>
        <p className="mono mt-1 text-[11px] text-[#667781]">
          Started 02:14 · lingered 64s
        </p>
        <p className="mt-1 text-[#3b4a54]">
          One person entered the driveway and approached the gate. No vehicle.
        </p>
      </div>
      <div className="mt-1.5 flex items-center gap-2 rounded-md bg-[#f0f2f5] px-2.5 py-1.5">
        <span className="flex h-7 w-7 items-center justify-center rounded bg-[#c9740a] text-white">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <span className="leading-tight">
          <span className="block text-[12px] font-medium text-[#111b21]">
            View playback
          </span>
          <span className="mono block text-[10px] text-[#027eb5]">
            overwatch.app/i/8f3a…
          </span>
        </span>
      </div>
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
    <div className="flex h-full flex-col bg-[#efeae2]">
      <div className="bg-[#008069]">
        <StatusBar tint="light" />
        <div className="flex items-center gap-3 px-3 py-2">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            className="text-white"
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
            <p className="truncate text-[15px] font-medium text-white">
              Overwatch
            </p>
            <p className="truncate text-[12px] text-white/75">{subtitle}</p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" className="fill-white/90">
            <path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24 11 11 0 0 0 3.5.56 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.2.2 2.4.56 3.5a1 1 0 0 1-.24 1l-2.2 2.3Z" />
          </svg>
          <svg width="6" height="20" viewBox="0 0 6 20" className="fill-white/90">
            <circle cx="3" cy="3" r="2.4" />
            <circle cx="3" cy="10" r="2.4" />
            <circle cx="3" cy="17" r="2.4" />
          </svg>
        </div>
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden px-3 py-3"
        style={{
          backgroundColor: "#efeae2",
          backgroundImage:
            "radial-gradient(rgba(0,0,0,0.025) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      >
        <div className="mx-auto rounded-md bg-white/70 px-2.5 py-0.5 shadow-sm">
          <span className="mono text-[10px] tracking-[0.08em] text-[#54656f]">
            TODAY
          </span>
        </div>
        {children}
      </div>

      <div className="flex items-center gap-2 bg-[#f0f2f5] px-3 py-2.5">
        <div className="flex h-9 flex-1 items-center rounded-full bg-white px-3.5 text-[13px] text-[#8696a0]">
          Message
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#008069]">
          <svg width="16" height="16" viewBox="0 0 24 24" className="fill-white">
            <path d="M3 20l18-8L3 4v6l12 2-12 2z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
