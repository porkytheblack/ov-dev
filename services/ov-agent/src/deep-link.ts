import { createHmac } from "node:crypto";

/**
 * HMAC token over `<subject_uuid>.<expiresAt>` — used by both the
 * incident-playback and live-camera deep links. ov-api verifies the same
 * shape at `/incidents/:id/playback?token=…` and `/cameras/:id/live?token=…`.
 * The signed token IS the credential, so the messenger recipient can open
 * the link without any dashboard session cookie (Telegram's in-app
 * webview has none).
 */
function signSubjectToken(subjectId: string): { base: string; token: string } {
  const secret = process.env.DEEP_LINK_TOKEN_SECRET ?? "change-me";
  const ttlHours = Number(process.env.DEEP_LINK_TTL_HOURS ?? 24) || 24;
  const expiresAt = Date.now() + ttlHours * 3600_000;
  const payload = `${subjectId}.${expiresAt}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  const token = Buffer.from(`${payload}.${sig}`).toString("base64url");
  const base = (process.env.DASHBOARD_BASE_URL ?? "http://localhost:9090").replace(/\/+$/, "");
  return { base, token };
}

/**
 * Signed playback link for an incident. Verified server-side by ov-api at
 * /incidents/:id/playback?token=... . Lets the agent surface the
 * working playback link as an inline button (never inlined in text).
 */
export function signDeepLink(incidentId: string): string {
  const { base, token } = signSubjectToken(incidentId);
  return `${base}/incidents/${incidentId}/playback?token=${token}`;
}

/**
 * Signed live-view link for a camera. The dashboard /cameras/:id/live page
 * is public and uses the token as its credential — same scheme as
 * playback. Needed because Telegram's in-app webview has no dashboard
 * session and the legacy raw /cameras/:id URL crashed on the missing
 * session.
 */
export function signLiveLink(cameraId: string): string {
  const { base, token } = signSubjectToken(cameraId);
  return `${base}/cameras/${cameraId}/live?token=${token}`;
}
