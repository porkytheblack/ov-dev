import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { v4 as uuid } from "uuid";
import postgres from "postgres";
import { BUCKETS, makeMinio, makeRedis } from "@overwatch/shared-ts";

export function makeCameraRoutes(sql: ReturnType<typeof postgres>) {
  const app = new Hono();
  const minio = makeMinio();
  const redis = makeRedis();

  // Best-effort recursive object delete by prefix. MinIO listObjectsV2 yields
  // streams; removeObjects accepts batches of up to 1000.
  async function purgePrefix(bucket: string, prefix: string): Promise<number> {
    let removed = 0;
    let batch: string[] = [];
    const flush = async () => {
      if (batch.length === 0) return;
      await new Promise<void>((resolve) => {
        minio
          .removeObjects(bucket, batch)
          .then(() => resolve())
          .catch(() => resolve());
      });
      removed += batch.length;
      batch = [];
    };
    const stream = minio.listObjectsV2(bucket, prefix, true);
    for await (const obj of stream) {
      if (!obj.name) continue;
      batch.push(obj.name);
      if (batch.length >= 1000) await flush();
    }
    await flush();
    return removed;
  }

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
    const name = b.name ?? null;
    const rtsp = b.rtsp_url ?? null;
    const fps = b.sample_fps ?? null;
    const vlm = b.vlm_enabled ?? null;
    const fc = b.frame_context !== undefined ? JSON.stringify(b.frame_context) : null;
    const rows = await sql<any[]>`
      UPDATE cameras
         SET name          = COALESCE(${name}, name),
             rtsp_url      = COALESCE(${rtsp}, rtsp_url),
             sample_fps    = COALESCE(${fps}, sample_fps),
             vlm_enabled   = COALESCE(${vlm}, vlm_enabled),
             frame_context = COALESCE(${fc}::jsonb, frame_context),
             updated_at    = now()
       WHERE id = ${id}::uuid
       RETURNING id, name, rtsp_url, enabled, sample_fps, status, last_frame_at,
                 frame_context, vlm_enabled, frame_width, frame_height, created_at,
                 updated_at
    `;
    if (rows.length === 0) return c.json({ error: "not found" }, 404);
    return c.json({ ok: true, camera: rows[0] });
  });

  app.delete("/:id", async (c) => {
    const id = c.req.param("id");

    // Collect clip keys before CASCADE: storage_keys / poster_keys aren't
    // under a per-camera prefix in the clips bucket, so we must enumerate
    // them from Postgres while the rows still exist.
    const clipRows = await sql<Array<{ storage_key: string; poster_key: string | null }>>`
      SELECT storage_key, poster_key
        FROM clips
       WHERE camera_id = ${id}::uuid
    `;

    const result = await sql<Array<{ id: string }>>`
      DELETE FROM cameras WHERE id = ${id}::uuid RETURNING id
    `;
    if (result.length === 0) return c.json({ error: "not found" }, 404);

    let segmentsRemoved = 0;
    let framesRemoved = 0;
    let clipObjectsRemoved = 0;
    try {
      segmentsRemoved = await purgePrefix(BUCKETS.segments, `segments/${id}/`);
    } catch {
      /* tolerate */
    }
    try {
      framesRemoved = await purgePrefix(BUCKETS.frames, `frames/${id}/`);
    } catch {
      /* tolerate */
    }
    // Delete individual clip artifacts (storage_key + poster_key) in bulk.
    if (clipRows.length > 0) {
      const keys = clipRows
        .flatMap((r) => [r.storage_key, r.poster_key])
        .filter((k): k is string => !!k);
      for (let i = 0; i < keys.length; i += 1000) {
        const batch = keys.slice(i, i + 1000);
        await new Promise<void>((resolve) => {
          minio
            .removeObjects(BUCKETS.clips, batch)
            .then(() => resolve())
            .catch(() => resolve());
        });
        clipObjectsRemoved += batch.length;
      }
    }

    // Wipe per-camera Redis streams so a new camera created later with the
    // same id (or just to free memory) doesn't inherit stale state.
    await Promise.allSettled([
      redis.del(`frames.${id}`),
      redis.del(`detections.${id}`),
    ]);

    return c.json({
      ok: true,
      removed: {
        segments: segmentsRemoved,
        frames: framesRemoved,
        clip_objects: clipObjectsRemoved,
      },
    });
  });

  // Probe the camera's RTSP URL via the ingestor (which has ffprobe). Optional
  // `rtsp_url` body lets the dashboard test an unsaved URL before writing it.
  // Every code path returns JSON so the dashboard never sees an empty body.
  app.post("/:id/test", async (c) => {
    try {
      const id = c.req.param("id");
      let body: { rtsp_url?: string } = {};
      try {
        body = (await c.req.json().catch(() => ({}))) as { rtsp_url?: string };
      } catch {
        body = {};
      }
      let rtspUrl = body.rtsp_url;
      if (!rtspUrl) {
        const rows = await sql<Array<{ rtspUrl: string }>>`
          SELECT rtsp_url AS "rtspUrl" FROM cameras WHERE id = ${id}::uuid
        `;
        if (!rows[0]) return c.json({ ok: false, error: "camera not found" }, 404);
        rtspUrl = rows[0].rtspUrl;
      }
      if (!rtspUrl || !rtspUrl.trim()) {
        return c.json({ ok: false, error: "rtsp_url is empty" }, 400);
      }
      const ingestor = process.env.INGESTOR_URL ?? "http://ov-ingestor:8000";
      let resp: Response;
      try {
        resp = await fetch(`${ingestor}/probe`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rtsp_url: rtspUrl, timeout_seconds: 10 }),
        });
      } catch (e) {
        return c.json(
          { ok: false, error: `ingestor unreachable: ${(e as Error).message}` },
          502,
        );
      }
      const text = await resp.text();
      let data: { ok?: boolean; error?: string; info?: unknown } | null = null;
      try {
        data = text ? (JSON.parse(text) as typeof data) : null;
      } catch {
        /* non-JSON */
      }
      if (!data || typeof data !== "object") {
        return c.json(
          {
            ok: false,
            error: `ingestor HTTP ${resp.status}${
              text ? `: ${text.slice(0, 240)}` : ""
            }`,
          },
          502,
        );
      }
      return c.json(data, resp.ok ? 200 : 502);
    } catch (e) {
      return c.json({ ok: false, error: (e as Error).message }, 500);
    }
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
