import { createHmac } from "node:crypto";

/**
 * Verify an HMAC-signed deep-link token over `<subjectId>.<expiresAt>`.
 * Same scheme is used for incident playback (`/incidents/:id/playback`)
 * and live camera view (`/cameras/:id/live`); the signed token IS the
 * credential, so a messenger recipient can open the URL with no
 * dashboard session.
 */
export function verifySubjectDeepLink(args: {
  subjectId: string;
  token: string;
  secret: string;
}): { ok: boolean; reason?: string } {
  try {
    const decoded = Buffer.from(args.token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return { ok: false, reason: "malformed" };
    const [sid, expiresStr, sig] = parts as [string, string, string];
    if (sid !== args.subjectId) return { ok: false, reason: "mismatch" };
    const expected = createHmac("sha256", args.secret).update(`${sid}.${expiresStr}`).digest("hex");
    if (sig !== expected) return { ok: false, reason: "bad-signature" };
    const expires = Number(expiresStr);
    if (!Number.isFinite(expires) || expires < Date.now()) return { ok: false, reason: "expired" };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

/** Back-compat alias — existing call sites pass `incidentId` and we
 *  keep the public shape stable. */
export function verifyDeepLink(args: {
  incidentId: string;
  token: string;
  secret: string;
}): { ok: boolean; reason?: string } {
  return verifySubjectDeepLink({
    subjectId: args.incidentId,
    token: args.token,
    secret: args.secret,
  });
}
