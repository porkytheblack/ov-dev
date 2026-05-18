import { createHmac } from "node:crypto";

/**
 * HMAC-signed deep link to incident playback — identical scheme to
 * ov-notifier's signer and verified server-side by ov-api at
 * /incidents/:id/playback?token=... . Lets the agent surface the same
 * working playback link as an inline button (never inlined in text).
 */
export function signDeepLink(incidentId: string): string {
  const secret = process.env.DEEP_LINK_TOKEN_SECRET ?? "change-me";
  const ttlHours = Number(process.env.DEEP_LINK_TTL_HOURS ?? 24) || 24;
  const expiresAt = Date.now() + ttlHours * 3600_000;
  const payload = `${incidentId}.${expiresAt}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  const token = Buffer.from(`${payload}.${sig}`).toString("base64url");
  const base = (process.env.DASHBOARD_BASE_URL ?? "http://localhost:9090").replace(/\/+$/, "");
  return `${base}/incidents/${incidentId}/playback?token=${token}`;
}
