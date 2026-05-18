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
        className={`relative max-w-[82%] text-[13.5px] leading-snug text-[#e9edef] ${
          out
            ? "rounded-2xl rounded-br-md bg-telegram-out"
            : "rounded-2xl rounded-bl-md bg-telegram-bubble"
        } ${noPad ? "p-1" : "px-3 py-2"}`}
      >
        {children}
        <div className="mt-0.5 flex items-center justify-end gap-1">
          <span className="mono text-[10px] text-[#ffffff7a]">{time}</span>
          {out && (
            <svg width="15" height="10" viewBox="0 0 16 11" fill="none">
              <path
                d="M1 6l3 3 6-7M6 9l1 0.8 6-7"
                stroke="#7ec8ff"
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
      <button className="flex items-center justify-center gap-1.5 rounded-lg bg-[#ffffff14] py-2 text-[12px] font-medium text-[#7ec8ff]">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
        View playback
      </button>
      <button className="flex items-center justify-center gap-1.5 rounded-lg bg-[#ffffff14] py-2 text-[12px] font-medium text-[#7ec8ff]">
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
    <div className="w-[236px]">
      <CameraFeed
        scene="fire"
        camera="CAM-04 · REAR YARD"
        time="23:48:31"
        tag="INCIDENT"
        className="!rounded-lg"
      />
      <div className="px-0.5 pt-2 text-[13px] leading-snug">
        <p className="font-semibold text-danger">[OVERWATCH] Incident · Rear Yard</p>
        <p className="mt-1">
          <span className="font-medium">fire, smoke</span> detected in{" "}
          <span className="font-medium">Yard ROI</span>
        </p>
        <p className="mono mt-1 text-[11px] text-[#7d8b99]">
          Started 23:48 · escalated in 6s
        </p>
        <p className="mt-1.5 text-[#cdd6df]">
          Active flames near the rear shed with rising smoke. No people detected
          in frame. Recommend immediate response.
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
    <div className="flex h-full flex-col bg-telegram-bg">
      <div className="bg-[#17212b]">
        <StatusBar tint="light" />
        <div className="flex items-center gap-3 px-3 py-2">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            className="text-telegram"
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
            <p className="truncate text-[12px] text-telegram">{subtitle}</p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" className="fill-[#6c7883]">
            <path d="M12 4a4 4 0 0 1 4 4v3l2 3v1H6v-1l2-3V8a4 4 0 0 1 4-4Zm0 17a2.5 2.5 0 0 1-2.45-2h4.9A2.5 2.5 0 0 1 12 21Z" />
          </svg>
          <svg width="6" height="20" viewBox="0 0 6 20" className="fill-[#6c7883]">
            <circle cx="3" cy="3" r="2.4" />
            <circle cx="3" cy="10" r="2.4" />
            <circle cx="3" cy="17" r="2.4" />
          </svg>
        </div>
      </div>

      <div
        className="flex flex-1 flex-col gap-2 overflow-hidden px-3 py-3"
        style={{
          background:
            "linear-gradient(180deg, #0e1621 0%, #14202c 100%)",
        }}
      >
        <div className="mx-auto mb-1 rounded-full bg-[#ffffff14] px-3 py-0.5">
          <span className="mono text-[10px] tracking-[0.08em] text-[#cdd6df]">
            TODAY
          </span>
        </div>
        {children}
      </div>

      <div className="flex items-center gap-2 bg-[#17212b] px-3 py-2.5">
        <div className="flex h-9 flex-1 items-center rounded-full bg-[#242f3d] px-3.5 text-[13px] text-[#6c7883]">
          Message
        </div>
        <svg width="22" height="22" viewBox="0 0 24 24" className="fill-telegram">
          <path d="M3 20l18-8L3 4v6l12 2-12 2z" />
        </svg>
      </div>
    </div>
  );
}
