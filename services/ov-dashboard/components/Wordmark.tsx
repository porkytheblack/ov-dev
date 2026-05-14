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

  return (
    <div className="flex items-center gap-2">
      <span className="mono uppercase tracking-[0.08em] font-medium">OVERWATCH</span>
      <span
        className="inline-block"
        style={{
          width: 6,
          height: 6,
          backgroundColor: connected === "live" ? "var(--accent)" : "var(--danger)",
          opacity: connected === "live" ? (pulse ? 1 : 0.5) : 1,
          transition: "opacity 150ms ease-out",
        }}
      />
    </div>
  );
}
