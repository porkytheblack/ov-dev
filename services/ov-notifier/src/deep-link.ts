import { createHmac } from "node:crypto";

/**
 * HMAC-signed deep links to incident playback. Same logic verified server-side
 * by ov-api at /incidents/:id/playback?token=...
 */
export function signDeepLink(args: {
  incidentId: string;
  secret: string;
  ttlHours: number;
}): { url: string; token: string; expiresAt: Date } {
  const expiresAt = new Date(Date.now() + args.ttlHours * 3600_000);
  const payload = `${args.incidentId}.${expiresAt.getTime()}`;
  const sig = createHmac("sha256", args.secret).update(payload).digest("hex");
  const token = Buffer.from(`${payload}.${sig}`).toString("base64url");
  const base = process.env.DASHBOARD_BASE_URL ?? "http://localhost:9090";
  return {
    url: `${base.replace(/\/+$/, "")}/incidents/${args.incidentId}/playback?token=${token}`,
    token,
    expiresAt,
  };
}

export function verifyDeepLink(args: {
  incidentId: string;
  token: string;
  secret: string;
}): { ok: boolean; reason?: string } {
  try {
    const decoded = Buffer.from(args.token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return { ok: false, reason: "malformed" };
    const [iid, expiresStr, sig] = parts as [string, string, string];
    if (iid !== args.incidentId) return { ok: false, reason: "mismatch" };
    const expected = createHmac("sha256", args.secret)
      .update(`${iid}.${expiresStr}`)
      .digest("hex");
    if (sig !== expected) return { ok: false, reason: "bad-signature" };
    const expires = Number(expiresStr);
    if (!Number.isFinite(expires) || expires < Date.now())
      return { ok: false, reason: "expired" };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}
