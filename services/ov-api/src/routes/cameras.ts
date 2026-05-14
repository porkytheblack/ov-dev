import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { v4 as uuid } from "uuid";
import postgres from "postgres";
import { BUCKETS, makeMinio } from "@overwatch/shared-ts";

export function makeCameraRoutes(sql: ReturnType<typeof postgres>) {
  const app = new Hono();
  const minio = makeMinio();

  const cameraInput = z.object({
    name: z.string().min(1),
    rtsp_url: z.string().min(1),
    sample_fps: z.number().int().min(1).max(60).optional(),
    frame_context: z.record(z.any()).optional(),
    vlm_enabled: z.boolean().optional(),
  });
  const cameraPatch = cameraInput.partial();

  app.get("/", async (c) => {
    const rows = await sql<any[]>`
      SELECT id, name, rtsp_url, enabled, sample_fps, status, last_frame_at,
             frame_context, vlm_enabled, frame_width, frame_height, created_at
        FROM cameras ORDER BY name
    `;
    return c.json({ cameras: rows });
  });

  app.post("/", zValidator("json", cameraInput), async (c) => {
    const body = c.req.valid("json");
    const id = uuid();
    await sql`
      INSERT INTO cameras (id, name, rtsp_url, sample_fps, frame_context, vlm_enabled)
      VALUES (
        ${id}, ${body.name}, ${body.rtsp_url},
        ${body.sample_fps ?? 5},
        ${JSON.stringify(body.frame_context ?? {})}::jsonb,
        ${body.vlm_enabled ?? false}
      )
    `;
    return c.json({ id });
  });

  app.get("/:id", async (c) => {
    const id = c.req.param("id");
    const rows = await sql<any[]>`SELECT * FROM cameras WHERE id = ${id}::uuid`;
    if (!rows[0]) return c.json({ error: "not found" }, 404);
    return c.json(rows[0]);
  });

  app.patch("/:id", zValidator("json", cameraPatch), async (c) => {
    const id = c.req.param("id");
    const b = c.req.valid("json");
    const updates: any[] = [];
    if (b.name !== undefined) updates.push(sql`name = ${b.name}`);
    if (b.rtsp_url !== undefined) updates.push(sql`rtsp_url = ${b.rtsp_url}`);
    if (b.sample_fps !== undefined) updates.push(sql`sample_fps = ${b.sample_fps}`);
    if (b.vlm_enabled !== undefined) updates.push(sql`vlm_enabled = ${b.vlm_enabled}`);
    if (b.frame_context !== undefined) updates.push(sql`frame_context = ${JSON.stringify(b.frame_context)}::jsonb`);
    if (updates.length === 0) return c.json({ ok: true });
    await sql`
      UPDATE cameras SET ${updates.reduce((acc, u, i) => i === 0 ? u : sql`${acc}, ${u}`)},
                         updated_at = now()
       WHERE id = ${id}::uuid
    `;
    return c.json({ ok: true });
  });

  app.delete("/:id", async (c) => {
    const id = c.req.param("id");
    await sql`DELETE FROM cameras WHERE id = ${id}::uuid`;
    return c.json({ ok: true });
  });

  app.post("/:id/test", async (c) => {
    const id = c.req.param("id");
    // Trigger a single-frame status check by updating updated_at.
    await sql`UPDATE cameras SET updated_at = now() WHERE id = ${id}::uuid`;
    return c.json({ ok: true });
  });

  app.get("/:id/snapshot", async (c) => {
    const id = c.req.param("id");
    // The ingestor uploads every frame to MinIO and deletes it after the detector consumes
    // it; instead of racing that, ask MinIO for the most recent object under the frames/{id}/ prefix.
    try {
      const stream = minio.listObjectsV2(BUCKETS.frames, `frames/${id}/`, true);
      let latest: { name: string; lastModified: Date } | null = null;
      for await (const obj of stream) {
        if (!obj.name) continue;
        if (!latest || (obj.lastModified && obj.lastModified > latest.lastModified)) {
          latest = { name: obj.name, lastModified: obj.lastModified ?? new Date(0) };
        }
      }
      if (!latest) {
        // No live snapshot — fall back to the latest clip poster.
        const rows = await sql<any[]>`
          SELECT poster_key FROM clips
           WHERE camera_id = ${id}::uuid AND poster_key IS NOT NULL
           ORDER BY end_ts DESC LIMIT 1
        `;
        if (rows[0]?.poster_key) {
          const obj = await minio.getObject(BUCKETS.clips, rows[0].poster_key);
          c.header("content-type", "image/jpeg");
          return c.body(obj as any);
        }
        return c.json({ error: "no snapshot available" }, 404);
      }
      const obj = await minio.getObject(BUCKETS.frames, latest.name);
      c.header("content-type", "image/jpeg");
      return c.body(obj as any);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 500);
    }
  });

  return app;
}
