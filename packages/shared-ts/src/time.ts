/**
 * Human-friendly "when did this happen" phrasing for messenger output.
 * Recent events read as a relative phrase ("just now", "5 minutes ago");
 * older events fall back to a local clock time with a day qualifier
 * ("today at 7:44 PM", "yesterday at 7:44 PM", "May 16 at 7:44 PM"), all
 * rendered in the operator's timezone.
 */
export function humanWhen(
  input: string | number | Date,
  tz: string = process.env.OV_TIMEZONE || process.env.TZ || "UTC",
): string {
  const t = input instanceof Date ? input : new Date(input);
  const ms = t.getTime();
  if (Number.isNaN(ms)) return "unknown time";
  const diff = Date.now() - ms;

  if (diff < 45_000) return "just now"; // also covers minor future clock skew
  if (diff < 90_000) return "a minute ago";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} minutes ago`;
  if (diff < 7_200_000) return "about an hour ago";

  const time = t.toLocaleTimeString("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  // Stable YYYY-MM-DD day key in the target tz for today/yesterday checks.
  const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: tz });
  const that = dayKey(t);
  if (that === dayKey(new Date())) return `today at ${time}`;
  if (that === dayKey(new Date(Date.now() - 86_400_000)))
    return `yesterday at ${time}`;

  const yearOf = (d: Date) =>
    d.toLocaleDateString("en-US", { timeZone: tz, year: "numeric" });
  const date = t.toLocaleDateString("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    ...(yearOf(t) === yearOf(new Date()) ? {} : { year: "numeric" }),
  });
  return `${date} at ${time}`;
}
