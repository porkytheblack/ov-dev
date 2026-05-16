import { Hono } from "hono";
import type { Context } from "hono";
import postgres from "postgres";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { BUCKETS, makeMinio } from "@overwatch/shared-ts";

const filter = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  camera_id: z.string().uuid().optional(),
  kind: z.enum(["incident", "regular"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

/** Parse a single-range `Range` header. "invalid" → 416. null → full body. */
function parseRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | null | "invalid" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return "invalid";
  const g1 = m[1] ?? "";
  const g2 = m[2] ?? "";
  const hasStart = g1 !== "";
  const hasEnd = g2 !== "";
  if (!hasStart && !hasEnd) return "invalid";
  let start: number;
  let end: number;
  if (!hasStart) {
    // suffix range: last N bytes
    const n = parseInt(g2, 10);
    if (n <= 0) return "invalid";
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = parseInt(g1, 10);
    end = hasEnd ? Math.min(parseInt(g2, 10), size - 1) : size - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "invalid";
  if (start > end || start >= size || start < 0) return "invalid";
  return { start, end };
}

export function makeClipRoutes(sql: ReturnType<typeof postgres>) {
  const minio = makeMinio();
  const app = new Hono();

  // Stream a clips-bucket object with HTTP Range support. Range is REQUIRED
  // for <video> seeking — without 206/Accept-Ranges the browser cannot jump
  // to the detection offset and the user is stuck scrubbing from t=0.
  const serveObject = async (c: Context, key: string) => {
    const ctype = key.endsWith(".jpg") ? "image/jpeg" : "video/mp4";
    let size: number;
    try {
      const stat = await minio.statObject(BUCKETS.clips, key);
      size = stat.size;
    } catch (e) {
      return c.json({ error: (e as Error).message }, 404);
    }
    c.header("accept-ranges", "bytes");
    c.header("cache-control", "private, max-age=3600");
    c.header("content-type", ctype);
    const r = parseRange(c.req.header("range"), size);
    if (r === "invalid") {
      c.header("content-range", `bytes */${size}`);
      return c.body(null, 416);
    }
    try {
      if (r) {
        const len = r.end - r.start + 1;
        const stream = await minio.getPartialObject(
          BUCKETS.clips,
          key,
          r.start,
          len,
        );
        c.header("content-range", `bytes ${r.start}-${r.end}/${size}`);
        c.header("content-length", String(len));
        return c.body(stream as unknown as ReadableStream, 206);
      }
      const stream = await minio.getObject(BUCKETS.clips, key);
      c.header("content-length", String(size));
      return c.body(stream as unknown as ReadableStream);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 404);
    }
  };

  app.get("/", zValidator("query", filter), async (c) => {
    const f = c.req.valid("query");
    const from = f.from ? new Date(f.from) : new Date(Date.now() - 24 * 3600_000);
    const to = f.to ? new Date(f.to) : new Date();
    const rows = await sql<any[]>`
      SELECT c.*, cm.name AS camera_name
        FROM clips c
        JOIN cameras cm ON cm.id = c.camera_id
       WHERE c.start_ts BETWEEN ${from} AND ${to}
         ${f.camera_id ? sql`AND c.camera_id = ${f.camera_id}::uuid` : sql``}
         ${f.kind ? sql`AND c.kind = ${f.kind}` : sql``}
       ORDER BY c.start_ts DESC
       LIMIT ${f.limit}
    `;
    return c.json({ clips: rows });
  });

  app.get("/:id/stream", async (c) => {
    const id = c.req.param("id");
    const rows = await sql<any[]>`SELECT storage_key FROM clips WHERE id = ${id}::uuid`;
    if (!rows[0]) return c.json({ error: "not found" }, 404);
    return serveObject(c, rows[0].storage_key as string);
  });

  // Public (signed-link)-friendly raw stream by key. The storage key contains
  // slashes (clips/<kind>/<cam>/<Y>/<M>/<D>/<uuid>.mp4), so it MUST be captured
  // as a wildcard — a single ":param" segment can never match a real key.
  app.get("/by-key/:key{.+}", async (c) => {
    return serveObject(c, c.req.param("key"));
  });

  return app;
}
