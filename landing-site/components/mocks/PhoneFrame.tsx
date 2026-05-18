import { ReactNode } from "react";

export function PhoneFrame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative mx-auto w-[300px] shrink-0 ${className}`}
      aria-hidden="true"
    >
      <div className="relative rounded-[44px] border border-border-strong bg-[#0c0d10] p-[9px] shadow-[0_24px_60px_-18px_rgba(20,20,20,0.35)]">
        <div className="absolute left-1/2 top-[17px] z-20 h-[24px] w-[88px] -translate-x-1/2 rounded-full bg-[#0c0d10]" />
        <div className="relative h-[640px] overflow-hidden rounded-[36px] bg-white">
          {children}
        </div>
      </div>
      <div className="absolute -right-[2px] top-[132px] h-[56px] w-[2px] rounded-r bg-border-strong" />
      <div className="absolute -left-[2px] top-[110px] h-[32px] w-[2px] rounded-l bg-border-strong" />
      <div className="absolute -left-[2px] top-[156px] h-[32px] w-[2px] rounded-l bg-border-strong" />
    </div>
  );
}

export function StatusBar({
  tint = "dark",
}: {
  tint?: "light" | "dark";
}) {
  const color = tint === "light" ? "text-white" : "text-[#0a0c10]";
  return (
    <div
      className={`flex h-[34px] items-center justify-between px-6 pt-[13px] text-[12px] font-semibold ${color}`}
    >
      <span className="mono tracking-tight">9:41</span>
      <div className="flex items-center gap-1.5">
        <svg width="17" height="11" viewBox="0 0 17 11" fill="none">
          <rect x="0" y="6" width="3" height="5" rx="1" fill="currentColor" />
          <rect x="4.5" y="4" width="3" height="7" rx="1" fill="currentColor" />
          <rect x="9" y="2" width="3" height="9" rx="1" fill="currentColor" />
          <rect x="13.5" y="0" width="3" height="11" rx="1" fill="currentColor" />
        </svg>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
          <path
            d="M8 2.5C10.4 2.5 12.6 3.4 14.2 5l-1.1 1.1A7.7 7.7 0 0 0 8 4.1 7.7 7.7 0 0 0 2.9 6.1L1.8 5A9.2 9.2 0 0 1 8 2.5Z"
            fill="currentColor"
          />
          <circle cx="8" cy="9" r="1.6" fill="currentColor" />
        </svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
          <rect
            x="0.5"
            y="0.5"
            width="21"
            height="11"
            rx="3"
            stroke="currentColor"
            opacity="0.5"
          />
          <rect x="2.5" y="2.5" width="15" height="7" rx="1.5" fill="currentColor" />
          <rect x="23" y="4" width="2" height="4" rx="1" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}
