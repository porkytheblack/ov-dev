function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * "YYYY-MM-DD HH:MM:SS" in the **viewer's local timezone** (browser tz).
 * Fixed 19-char width so `.slice(11,19)` still yields HH:MM:SS.
 */
export function formatTime(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** Local clock time, HH:MM:SS. */
export function formatClock(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Short timezone label for the viewer (e.g. "EAT", "GMT+3", "UTC"). */
export function tzLabel(): string {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

/** Local datetime followed by the viewer's timezone, e.g. "2026-05-16 14:03:11 EAT". */
export function formatTimeWithZone(value: string | Date): string {
  const z = tzLabel();
  return z ? `${formatTime(value)} ${z}` : formatTime(value);
}

export function formatRelative(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  const s = Math.max(1, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return rs === 0 ? `${m}m` : `${m}m ${rs}s`;
}
