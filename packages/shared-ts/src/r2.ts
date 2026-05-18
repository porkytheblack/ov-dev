/**
 * Cloudflare R2 client (S3-compatible, reuses the `minio` SDK already in
 * shared-ts so no new dependency).
 *
 * R2 is the *transient* store for the video-analysis pipeline: a clip is
 * uploaded so the vision model can fetch it over a public URL, then deleted
 * once the summary is written. The Station broadcast owns that lifecycle;
 * `r2ListOlderThan` backs a recurring sweep that mops up anything a crash
 * left behind.
 */
import { Client } from "minio";

export const R2_BUCKET = process.env.R2_BUCKET ?? "overwatch-vision";

/** R2 object key prefix for incident clips uploaded for analysis. */
export const R2_INCIDENT_PREFIX = "incident-clips/";

function r2Endpoint(): string | undefined {
  const explicit = process.env.R2_ENDPOINT;
  if (explicit && explicit.trim() !== "") {
    return explicit.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  }
  const acct = process.env.R2_ACCOUNT_ID;
  if (acct && acct.trim() !== "") return `${acct.trim()}.r2.cloudflarestorage.com`;
  return undefined;
}

/** True when R2 credentials + bucket are fully configured. */
export function r2Configured(): boolean {
  return (
    !!r2Endpoint() &&
    !!process.env.R2_ACCESS_KEY_ID &&
    !!process.env.R2_SECRET_ACCESS_KEY &&
    !!R2_BUCKET
  );
}

export function makeR2(): Client {
  const endPoint = r2Endpoint();
  if (!endPoint) throw new Error("R2 not configured (set R2_ACCOUNT_ID or R2_ENDPOINT)");
  return new Client({
    endPoint,
    port: 443,
    useSSL: true,
    region: process.env.R2_REGION ?? "auto",
    accessKey: process.env.R2_ACCESS_KEY_ID ?? "",
    secretKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  });
}

export async function r2EnsureBucket(client: Client): Promise<void> {
  const exists = await client.bucketExists(R2_BUCKET).catch(() => false);
  if (!exists) {
    await client.makeBucket(R2_BUCKET, process.env.R2_REGION ?? "auto");
  }
}

export async function r2PutFile(
  client: Client,
  key: string,
  localPath: string,
  contentType: string,
): Promise<void> {
  await client.fPutObject(R2_BUCKET, key, localPath, { "Content-Type": contentType });
}

export async function r2Remove(client: Client, key: string): Promise<void> {
  try {
    await client.removeObject(R2_BUCKET, key);
  } catch (e) {
    // Already gone is fine — cleanup is best-effort and idempotent.
    const code = (e as { code?: string }).code ?? "";
    if (code !== "NoSuchKey" && code !== "NotFound") throw e;
  }
}

/**
 * Public URL the vision model uses to fetch the object. The operator points
 * `R2_PUBLIC_BASE_URL` at the bucket's r2.dev domain or a custom domain.
 */
export function r2PublicUrl(key: string): string {
  const base = (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
  if (!base) throw new Error("R2_PUBLIC_BASE_URL not configured");
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** Keys under `prefix` whose last-modified is older than `ageMs`. */
export async function r2ListOlderThan(
  client: Client,
  prefix: string,
  ageMs: number,
): Promise<string[]> {
  const cutoff = Date.now() - ageMs;
  const stale: string[] = [];
  await new Promise<void>((resolve, reject) => {
    const stream = client.listObjectsV2(R2_BUCKET, prefix, true);
    stream.on("data", (obj) => {
      const mod = obj.lastModified ? new Date(obj.lastModified).getTime() : 0;
      if (obj.name && mod && mod < cutoff) stale.push(obj.name);
    });
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });
  return stale;
}
