import { Hono } from "hono";
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

export function makeClipRoutes(sql: ReturnType<typeof postgres>) {
  const minio = makeMinio();
  const app = new Hono();

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
    try {
      const obj = await minio.getObject(BUCKETS.clips, rows[0].storage_key);
      c.header("content-type", "video/mp4");
      return c.body(obj as any);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 500);
    }
  });

  // Public (signed-link)-friendly raw stream by key. The storage key contains
  // slashes (clips/<kind>/<cam>/<Y>/<M>/<D>/<uuid>.mp4), so it MUST be captured
  // as a wildcard — a single ":param" segment can never match a real key.
  app.get("/by-key/:key{.+}", async (c) => {
    const key = c.req.param("key");
    const isPoster = key.endsWith(".jpg");
    try {
      const obj = await minio.getObject(BUCKETS.clips, key);
      c.header("content-type", isPoster ? "image/jpeg" : "video/mp4");
      c.header("cache-control", "private, max-age=3600");
      return c.body(obj as any);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 404);
    }
  });

  return app;
}
