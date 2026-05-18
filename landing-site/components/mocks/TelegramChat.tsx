import { ReactNode } from "react";
import { StatusBar } from "./PhoneFrame";
import { CameraFeed } from "./CameraFeed";

function Avatar() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-[#3aa8f0] to-[#2b8fd6]">
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

export function TgBubble({
  side = "in",
  time,
  children,
  noPad,
}: {
  side?: "in" | "out";
  time: string;
  children: ReactNode;
  noPad?: boolean;
}) {
  const out = side === "out";
  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[84%] text-[13.5px] leading-snug text-[#1a1a1a] shadow-sm ${
          out
            ? "rounded-2xl rounded-br-md bg-[#eeffde]"
            : "rounded-2xl rounded-bl-md bg-white"
        } ${noPad ? "p-1.5" : "px-3 py-2"}`}
      >
        {children}
        <div className="mt-0.5 flex items-center justify-end gap-1">
          <span className="mono text-[10px] text-[#8a9aa5]">{time}</span>
          {out && (
            <svg width="15" height="10" viewBox="0 0 16 11" fill="none">
              <path
                d="M1 6l3 3 6-7M6 9l1 0.8 6-7"
                stroke="#4fae4e"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

export function TgInlineKeyboard() {
  return (
    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
      <button className="flex items-center justify-center gap-1.5 rounded-lg bg-black/[0.05] py-1.5 text-[12px] font-medium text-[#2b8fd6]">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
        View playback
      </button>
      <button className="flex items-center justify-center gap-1.5 rounded-lg bg-black/[0.05] py-1.5 text-[12px] font-medium text-[#2b8fd6]">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 13l4 4 10-11"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Acknowledge
      </button>
    </div>
  );
}

export function TgFireCard() {
  return (
    <div className="w-[230px]">
      <CameraFeed
        scene="fire"
        camera="CAM-04 · REAR YARD"
        time="23:48:31"
        tag="INCIDENT"
        className="!rounded-lg"
      />
      <div className="px-0.5 pt-1.5 text-[12.5px] leading-snug">
        <p className="font-semibold text-[#c4302b]">
          [OVERWATCH] Incident · Rear Yard
        </p>
        <p className="mt-1">
          <span className="font-medium">fire, smoke</span> detected in{" "}
          <span className="font-medium">Yard zone</span>
        </p>
        <p className="mono mt-1 text-[11px] text-[#8a9aa5]">
          Started 23:48 · escalated in 6s
        </p>
        <p className="mt-1 text-[#3b4a54]">
          Active flames near the rear shed, smoke rising. No people in frame.
        </p>
      </div>
      <TgInlineKeyboard />
    </div>
  );
}

export function TelegramChat({
  subtitle = "bot",
  children,
}: {
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col bg-[#e4ebf2]">
      <div className="border-b border-[#e4e4e4] bg-white">
        <StatusBar tint="dark" />
        <div className="flex items-center gap-3 px-3 py-2">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            className="text-[#2b8fd6]"
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
            <p className="truncate text-[15px] font-medium text-[#1a1a1a]">
              Overwatch
            </p>
            <p className="truncate text-[12px] text-[#2b8fd6]">{subtitle}</p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" className="fill-[#8a9aa5]">
            <path d="M12 4a4 4 0 0 1 4 4v3l2 3v1H6v-1l2-3V8a4 4 0 0 1 4-4Zm0 17a2.5 2.5 0 0 1-2.45-2h4.9A2.5 2.5 0 0 1 12 21Z" />
          </svg>
          <svg width="6" height="20" viewBox="0 0 6 20" className="fill-[#8a9aa5]">
            <circle cx="3" cy="3" r="2.4" />
            <circle cx="3" cy="10" r="2.4" />
            <circle cx="3" cy="17" r="2.4" />
          </svg>
        </div>
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden px-3 py-3"
        style={{
          background:
            "linear-gradient(180deg, #dfe7ef 0%, #d4dfeb 100%)",
        }}
      >
        <div className="mx-auto rounded-full bg-black/[0.07] px-3 py-0.5">
          <span className="mono text-[10px] tracking-[0.08em] text-[#5b6b78]">
            TODAY
          </span>
        </div>
        {children}
      </div>

      <div className="flex items-center gap-2 border-t border-[#e4e4e4] bg-white px-3 py-2.5">
        <div className="flex h-9 flex-1 items-center rounded-full bg-[#f1f3f5] px-3.5 text-[13px] text-[#8a9aa5]">
          Message
        </div>
        <svg width="22" height="22" viewBox="0 0 24 24" className="fill-[#2b8fd6]">
          <path d="M3 20l18-8L3 4v6l12 2-12 2z" />
        </svg>
      </div>
    </div>
  );
}
