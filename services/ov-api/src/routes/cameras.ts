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

  // Delete an explicit list of object keys in batches of 1000 (MinIO's
  // removeObjects limit). We deliberately do NOT enumerate via
  // minio.listObjectsV2: its XML response is parsed by fast-xml-parser, whose
  // entity-expansion guard throws from inside the stream's _flush once a bucket
  // page exceeds ~1000 nodes. That throw escapes any try/catch around the
  // `for await`, crashes the ov-api process mid-request, and the browser sees a
  // Caddy 502 even though the Postgres DELETE already committed (camera gone,
  // "delete failed"). All keys we need are already recorded in Postgres
  // (segments/clips) or Redis (frames), so we enumerate from there instead.
  async function removeKeys(bucket: string, keys: string[]): Promise<number> {
    let removed = 0;
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);
      await new Promise<void>((resolve) => {
        minio
          .removeObjects(bucket, batch)
          .then(() => resolve())
          .catch(() => resolve());
      });
      removed += batch.length;
    }
    return removed;
  }

  // Best-effort ffprobe of an RTSP URL via the ingestor (the only container
  // with ffprobe). Returns native stream geometry/fps so a freshly added
  // camera transcodes with a correctly aligned GOP. Never throws — a camera
  // that's briefly unreachable at add-time must still be created.
  async function probeRtsp(
    rtspUrl: string,
  ): Promise<{ fps?: number; width?: number; height?: number }> {
    const ingestor = process.env.INGESTOR_URL ?? "http://ov-ingestor:8000";
    try {
      const resp = await fetch(`${ingestor}/probe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rtsp_url: rtspUrl, timeout_seconds: 10 }),
      });
      const data = (await resp.json().catch(() => null)) as {
        ok?: boolean;
        info?: { fps?: number | null; width?: number | null; height?: number | null };
      } | null;
      if (!data?.ok || !data.info) return {};
      const { fps, width, height } = data.info;
      return {
        fps: typeof fps === "number" && fps > 0 ? fps : undefined,
        width: typeof width === "number" && width > 0 ? width : undefined,
        height: typeof height === "number" && height > 0 ? height : undefined,
      };
    } catch {
      return {};
    }
  }

  const cameraInput = z.object({
    name: z.string().min(1),
    rtsp_url: z.string().min(1),
    sample_fps: z.number().int().min(1).max(60).optional(),
    frame_context: z.record(z.any()).optional(),
    vlm_enabled: z.boolean().optional(),
    description: z.string().max(2000).optional(),
  });
  const cameraPatch = cameraInput.partial();

  app.get("/", async (c) => {
    const rows = await sql<any[]>`
      SELECT id, name, rtsp_url, enabled, sample_fps, stream_fps, status,
             last_frame_at, frame_context, vlm_enabled, frame_width,
             frame_height, description, created_at
        FROM cameras ORDER BY name
    `;
    return c.json({ cameras: rows });
  });

  app.post("/", zValidator("json", cameraInput), async (c) => {
    const body = c.req.valid("json");
    const id = uuid();
    await sql`
      INSERT INTO cameras (id, name, rtsp_url, sample_fps, frame_context, vlm_enabled, description)
      VALUES (
        ${id}, ${body.name}, ${body.rtsp_url},
        ${body.sample_fps ?? 5},
        ${JSON.stringify(body.frame_context ?? {})}::jsonb,
        ${body.vlm_enabled ?? false},
        ${body.description ?? ''}
      )
    `;
    // Auto-probe the stream so the transcoder GOP and the dashboard aspect
    // ratio match reality. Best-effort: the row already exists, so a probe
    // failure (camera offline at add-time) just leaves the fields null and a
    // later /:id/test or restart can backfill.
    const probed = await probeRtsp(body.rtsp_url);
    if (probed.fps || probed.width || probed.height) {
      await sql`
        UPDATE cameras
           SET stream_fps   = COALESCE(${probed.fps ?? null}, stream_fps),
               frame_width  = COALESCE(${probed.width ?? null}, frame_width),
               frame_height = COALESCE(${probed.height ?? null}, frame_height),
               updated_at   = now()
         WHERE id = ${id}::uuid
      `;
    }
    return c.json({ id, probed });
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
    const desc = b.description !== undefined ? b.description : null;
    // A new RTSP URL can change resolution/fps — re-probe so the transcoder
    // and aspect ratio stay correct.
    const reprobe = rtsp ? await probeRtsp(rtsp) : {};
    const rows = await sql<any[]>`
      UPDATE cameras
         SET name          = COALESCE(${name}, name),
             rtsp_url      = COALESCE(${rtsp}, rtsp_url),
             sample_fps    = COALESCE(${fps}, sample_fps),
             vlm_enabled   = COALESCE(${vlm}, vlm_enabled),
             frame_context = COALESCE(${fc}::jsonb, frame_context),
             stream_fps    = COALESCE(${reprobe.fps ?? null}, stream_fps),
             frame_width   = COALESCE(${reprobe.width ?? null}, frame_width),
             frame_height  = COALESCE(${reprobe.height ?? null}, frame_height),
             description   = COALESCE(${desc}, description),
             updated_at    = now()
       WHERE id = ${id}::uuid
       RETURNING id, name, rtsp_url, enabled, sample_fps, stream_fps, status,
                 last_frame_at, frame_context, vlm_enabled, frame_width,
                 frame_height, description, created_at, updated_at
    `;
    if (rows.length === 0) return c.json({ error: "not found" }, 404);
    return c.json({ ok: true, camera: rows[0] });
  });

  app.delete("/:id", async (c) => {
    const id = c.req.param("id");

    // Enumerate every storage key BEFORE the CASCADE delete, entirely from
    // Postgres + Redis (never minio.listObjectsV2 — see removeKeys). segments
    // and clips record their own keys; live frames not yet consumed by the
    // detector are still referenced in the `frames.<id>` Redis stream.
    const [segRows, clipRows] = await Promise.all([
      sql<Array<{ storage_key: string }>>`
        SELECT storage_key FROM segments WHERE camera_id = ${id}::uuid
      `,
      sql<Array<{ storage_key: string; poster_key: string | null }>>`
        SELECT storage_key, poster_key FROM clips WHERE camera_id = ${id}::uuid
      `,
    ]);

    let frameKeys: string[] = [];
    try {
      const entries = (await redis.xrange(
        `frames.${id}`,
        "-",
        "+",
      )) as Array<[string, string[]]>;
      frameKeys = entries
        .map(([, fields]) => {
          for (let i = 0; i + 1 < fields.length; i += 2) {
            if (fields[i] === "storage_key") return fields[i + 1];
          }
          return undefined;
        })
        .filter((k): k is string => !!k);
    } catch {
      /* stream may not exist — nothing to purge */
    }

    const result = await sql<Array<{ id: string }>>`
      DELETE FROM cameras WHERE id = ${id}::uuid RETURNING id
    `;
    if (result.length === 0) return c.json({ error: "not found" }, 404);

    const segmentsRemoved = await removeKeys(
      BUCKETS.segments,
      segRows.map((r) => r.storage_key).filter(Boolean),
    );
    const framesRemoved = await removeKeys(BUCKETS.frames, frameKeys);
    const clipObjectsRemoved = await removeKeys(
      BUCKETS.clips,
      clipRows.flatMap((r) => [r.storage_key, r.poster_key]).filter((k): k is string => !!k),
    );

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
    // The ingestor publishes every sampled frame to the per-camera Redis stream
    // `frames.{id}` with its MinIO storage_key, then the detector deletes the
    // object after consuming it. Reading the freshest stream entry gives the
    // newest live frame in O(1) — listing the bucket was both slow and crashed
    // the API once MinIO's listObjectsV2 XML response exceeded fast-xml-parser's
    // entity-expansion limit.
    try {
      const entries = (await redis.xrevrange(
        `frames.${id}`,
        "+",
        "-",
        "COUNT",
        1,
      )) as Array<[string, string[]]>;
      const fields = entries[0]?.[1];
      let storageKey: string | undefined;
      if (fields) {
        for (let i = 0; i + 1 < fields.length; i += 2) {
          if (fields[i] === "storage_key") {
            storageKey = fields[i + 1];
            break;
          }
        }
      }
      if (storageKey) {
        try {
          const obj = await minio.getObject(BUCKETS.frames, storageKey);
          c.header("content-type", "image/jpeg");
          c.header("cache-control", "no-store");
          return c.body(obj as any);
        } catch {
          // Race with the detector cleanup — fall through to the poster fallback.
        }
      }
      const rows = await sql<Array<{ poster_key: string | null }>>`
        SELECT poster_key FROM clips
         WHERE camera_id = ${id}::uuid AND poster_key IS NOT NULL
         ORDER BY end_ts DESC LIMIT 1
      `;
      if (rows[0]?.poster_key) {
        const obj = await minio.getObject(BUCKETS.clips, rows[0].poster_key);
        c.header("content-type", "image/jpeg");
        c.header("cache-control", "no-store");
        return c.body(obj as any);
      }
      return c.json({ error: "no snapshot available" }, 404);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 500);
    }
  });

  return app;
}
