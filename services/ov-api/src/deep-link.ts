import { createHmac } from "node:crypto";

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
    const expected = createHmac("sha256", args.secret).update(`${iid}.${expiresStr}`).digest("hex");
    if (sig !== expected) return { ok: false, reason: "bad-signature" };
    const expires = Number(expiresStr);
    if (!Number.isFinite(expires) || expires < Date.now()) return { ok: false, reason: "expired" };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}
