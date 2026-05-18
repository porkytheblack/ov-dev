import { createHmac } from "node:crypto";

/**
 * HMAC-signed "open the calendar" deep link, verified by ov-api at
 * `GET /api/portal?token=…` (same secret/scheme family as the playback
 * links). The portal route validates the token, mints a dashboard session,
 * and 302s to the calendar day view for that camera — so a recap recipient
 * taps once on mobile and lands in the full calendar, no login.
 *
 * Payload: `cal|<YYYY-MM-DD>|<cameraId|'*'>|<expiresAtMs>` then `|<hexSig>`,
 * base64url-encoded. `|` is safe — none of the components contain it.
 */
export function signCalendarLink(date: string, cameraId?: string): string {
  const secret = process.env.DEEP_LINK_TOKEN_SECRET ?? "change-me";
  const ttlHours = Number(process.env.DEEP_LINK_TTL_HOURS ?? 24) || 24;
  const expiresAt = Date.now() + ttlHours * 3600_000;
  const payload = `cal|${date}|${cameraId ?? "*"}|${expiresAt}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  const token = Buffer.from(`${payload}|${sig}`).toString("base64url");
  const base = (process.env.DASHBOARD_BASE_URL ?? "http://localhost:9090").replace(
    /\/+$/,
    "",
  );
  return `${base}/api/portal?token=${token}`;
}
