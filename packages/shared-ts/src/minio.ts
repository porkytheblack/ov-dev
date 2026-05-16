import { Client } from "minio";

export function makeMinio(): Client {
  const endpoint = process.env.MINIO_ENDPOINT ?? "minio:9000";
  const [host, portStr] = endpoint.replace(/^https?:\/\//, "").split(":");
  return new Client({
    endPoint: host ?? "minio",
    port: portStr ? Number(portStr) : 9000,
    useSSL: (process.env.MINIO_USE_SSL ?? "false") === "true",
    accessKey: process.env.MINIO_ACCESS_KEY ?? "overwatch",
    secretKey: process.env.MINIO_SECRET_KEY ?? "overwatch-secret",
  });
}

export const BUCKETS = {
  segments: process.env.MINIO_BUCKET_SEGMENTS ?? "overwatch-segments",
  frames: process.env.MINIO_BUCKET_FRAMES ?? "overwatch-frames",
  clips: process.env.MINIO_BUCKET_CLIPS ?? "overwatch-clips",
} as const;

export async function ensureBuckets(client: Client) {
  for (const bucket of Object.values(BUCKETS)) {
    const exists = await client.bucketExists(bucket).catch(() => false);
    if (!exists) {
      await client.makeBucket(bucket);
    }
  }
}
