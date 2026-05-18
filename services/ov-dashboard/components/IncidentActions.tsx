"use client";

import { useState } from "react";

const ACTIONS: { status: string; label: string; primary?: boolean }[] = [
  { status: "acknowledged", label: "Acknowledge", primary: true },
  { status: "suppressed", label: "Suppress" },
  { status: "closed", label: "Close" },
  { status: "open", label: "Re-open" },
];

/**
 * Incident-response controls. Posts to /api/incidents/:id/status. Shows
 * every status transition except the current one. Reused by the incident
 * detail page and the ClipModal so response is available everywhere an
 * incident is shown.
 */
export function IncidentActions({
  incidentId,
  status,
  onChanged,
  size = "md",
}: {
  incidentId: string;
  status?: string;
  onChanged?: (status: string) => void;
  size?: "sm" | "md";
}) {
  const [current, setCurrent] = useState(status ?? "open");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function apply(next: string) {
    setBusy(next);
    setError(null);
    try {
      const r = await fetch(`/api/incidents/${incidentId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(body.error ?? `Failed (${r.status})`);
        return;
      }
      setCurrent(next);
      onChanged?.(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const cls = size === "sm" ? "text-[12px] px-2 py-1" : "";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        {ACTIONS.filter((a) => a.status !== current).map((a) => (
          <button
            key={a.status}
            onClick={() => apply(a.status)}
            disabled={busy !== null}
            className={`${a.primary ? "btn-primary" : "btn"} ${cls} disabled:opacity-50`}
          >
            {busy === a.status ? "…" : a.label}
          </button>
        ))}
      </div>
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  );
}
