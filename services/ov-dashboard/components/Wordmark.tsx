"use client";

import { useEffect, useState } from "react";

export function Wordmark() {
  const [connected, setConnected] = useState<"live" | "offline">("offline");
  const [pulse, setPulse] = useState(true);

  useEffect(() => {
    const i = setInterval(() => setPulse((p) => !p), 1000);
    fetch("/api/system/status")
      .then((r) => r.json())
      .then((j) => {
        const hasActive = j.counts?.cameras > 0;
        setConnected(hasActive ? "live" : "offline");
      })
      .catch(() => setConnected("offline"));
    return () => clearInterval(i);
  }, []);

  const live = connected === "live";

  return (
    <div className="flex items-center gap-2.5">
      <span className="mono uppercase tracking-[0.14em] font-semibold text-[15px] text-text">
        OVERWATCH
      </span>
      <span
        className="inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.08em] text-[10px] leading-none"
        style={{ color: live ? "var(--accent)" : "var(--danger)" }}
        title={live ? "System live" : "System offline"}
      >
        <span
          className="inline-block rounded-full"
          style={{
            width: 7,
            height: 7,
            backgroundColor: live ? "var(--accent)" : "var(--danger)",
            boxShadow: live ? "0 0 0 3px rgba(245, 173, 74, 0.22)" : "none",
            opacity: live ? (pulse ? 1 : 0.45) : 1,
            transition: "opacity 220ms ease-out",
          }}
        />
        {live ? "LIVE" : "OFFLINE"}
      </span>
    </div>
  );
}
