import { Hono } from "hono";
import postgres from "postgres";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUCKETS, makeMinio } from "@overwatch/shared-ts";
import { verifyDeepLink } from "../deep-link.js";

const filterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  camera_id: z.string().uuid().optional(),
  status: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// On-demand "footage" window. The detection sits FOOTAGE_PRE_S into the built
// clip; the player seeks FOOTAGE_PRE_S − FOOTAGE_LEAD_S in so the subject is
// caught entering, with no minutes of empty frames to scrub through.
const FOOTAGE_PRE_S = 8;
const FOOTAGE_POST_S = 22;
const FOOTAGE_MAX_S = 75;
export const FOOTAGE_LEAD_S = 4;

const minio = makeMinio();
// De-dupe concurrent builds of the same incident's footage.
const inflight = new Map<string, Promise<string | null>>();

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-500)}`)),
    );
  });
}

/** First video stream codec_name of a file ("" if unknown). */
function probeCodec(path: string): Promise<string> {
  return new Promise((resolve) => {
    const p = spawn("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=codec_name",
      "-of",
      "default=nw=1:nk=1",
      path,
    ]);
    let out = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.on("error", () => resolve(""));
    p.on("close", () => resolve(out.trim()));
  });
}

/**
 * Build (and cache, in the clips bucket) a short, seekable MP4 of the actual
 * recording around an incident, concatenated from the fine-grained `segments`
 * that produced its detections — so the user always sees the subject and
 * never scrubs through empty frames. Returns the clips-bucket key, or null
 * when no recording covers the moment.
 */
async function ensureIncidentFootage(
  sql: ReturnType<typeof postgres>,
  id: string,
): Promise<string | null> {
  const cacheKey = `ondemand/${id}.mp4`;
  try {
    await minio.statObject(BUCKETS.clips, cacheKey);
    return cacheKey; // already built
  } catch {
    /* not cached — build it */
  }
  if (inflight.has(id)) return inflight.get(id)!;

  const build = (async (): Promise<string | null> => {
    const inc = await sql<
      { camera_id: string; opened_at: Date; closed_at: Date | null }[]
    >`SELECT camera_id, opened_at, closed_at FROM incidents WHERE id = ${id}::uuid`;
    if (!inc[0]) return null;
    const opened = new Date(inc[0].opened_at).getTime();
    const ended = inc[0].closed_at
      ? new Date(inc[0].closed_at).getTime()
      : opened;
    const winStart = new Date(opened - FOOTAGE_PRE_S * 1000);
    const winEnd = new Date(
      Math.min(ended + FOOTAGE_POST_S * 1000, opened + FOOTAGE_MAX_S * 1000),
    );
    const segs = await sql<{ storage_key: string }[]>`
      SELECT storage_key FROM segments
       WHERE camera_id = ${inc[0].camera_id}::uuid
         AND start_ts <= ${winEnd} AND end_ts >= ${winStart}
       ORDER BY start_ts
       LIMIT 24
    `;
    if (!segs.length) return null;

    const work = await mkdtemp(join(tmpdir(), `footage-${id.slice(0, 8)}-`));
    try {
      const locals: string[] = [];
      let i = 0;
      for (const s of segs) {
        const lp = join(work, `${String(i++).padStart(3, "0")}.ts`);
        try {
          await minio.fGetObject(BUCKETS.segments, s.storage_key, lp);
          locals.push(lp);
        } catch {
          /* skip a missing segment */
        }
      }
      if (!locals.length) return null;
      const listPath = join(work, "list.txt");
      await writeFile(
        listPath,
        locals.map((p) => `file '${p}'`).join("\n"),
        "utf8",
      );
      const outPath = join(work, "out.mp4");
      // Only stamp the HEVC-in-MP4 tag when the source is actually HEVC.
      // Forcing -tag:v hvc1 on an H.264 stream makes ffmpeg fail to write the
      // header → empty output → silent 404 (the builder only ever worked
      // because the IP camera happened to be HEVC).
      const codec = locals[0] ? await probeCodec(locals[0]) : "";
      const tagArgs = codec === "hevc" ? ["-tag:v", "hvc1"] : [];
      await runFfmpeg([
        "-y",
        "-loglevel",
        "error",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listPath,
        "-c",
        "copy",
        "-fflags",
        "+genpts",
        "-avoid_negative_ts",
        "make_zero",
        "-movflags",
        "+faststart",
        ...tagArgs,
        outPath,
      ]);
      await minio.fPutObject(BUCKETS.clips, cacheKey, outPath, {
        "Content-Type": "video/mp4",
      });
      return cacheKey;
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  })();

  inflight.set(id, build);
  try {
    return await build;
  } catch (e) {
    console.error(`[footage] build failed for ${id}:`, (e as Error).message);
    return null;
  } finally {
    inflight.delete(id);
  }
}

export function makeIncidentRoutes(sql: ReturnType<typeof postgres>) {
  const app = new Hono();

  // Resolve a poster/clip for an incident: prefer the incident's own clip,
  // else the recording segment that contains the moment, else the nearest
  // overlapping one. Used for thumbnails + metadata; actual playback now
  // comes from the segment-accurate /footage route below.
  const clipResolver = sql`
    LEFT JOIN LATERAL (
      SELECT x.storage_key, x.poster_key, x.kind, x.start_ts
        FROM clips x
       WHERE x.camera_id = i.camera_id
         AND (
           x.incident_id = i.id
           OR (
             x.start_ts <= COALESCE(i.closed_at, i.opened_at) + interval '30 seconds'
             AND x.end_ts >= i.opened_at - interval '30 seconds'
           )
         )
       ORDER BY (x.incident_id = i.id) DESC,
                (x.kind = 'incident') DESC,
                (x.start_ts <= i.opened_at AND x.end_ts >= i.opened_at) DESC,
                abs(extract(epoch FROM (x.start_ts - i.opened_at))) ASC
       LIMIT 1
    ) clip ON true
  `;

  app.get("/", zValidator("query", filterSchema), async (c) => {
    const f = c.req.valid("query");
    const from = f.from ? new Date(f.from) : new Date(Date.now() - 7 * 24 * 3600_000);
    const to = f.to ? new Date(f.to) : new Date();
    const rows = await sql<any[]>`
      SELECT i.id, i.camera_id, c.name AS camera_name, i.roi_id, r.name AS roi_name,
             i.classes, i.opened_at, i.closed_at, i.status, i.summary, i.clip_url,
             i.clip_status, i.summary_status, i.notified_at, i.acknowledged_at,
             clip.storage_key AS clip_storage_key,
             clip.poster_key  AS clip_poster_key,
             clip.kind        AS clip_kind,
             clip.start_ts    AS clip_start_ts
        FROM incidents i
        JOIN cameras c ON c.id = i.camera_id
        JOIN rois r ON r.id = i.roi_id
        ${clipResolver}
       WHERE i.opened_at BETWEEN ${from} AND ${to}
         ${f.camera_id ? sql`AND i.camera_id = ${f.camera_id}::uuid` : sql``}
         ${f.status ? sql`AND i.status = ${f.status}` : sql``}
       ORDER BY i.opened_at DESC
       LIMIT ${f.limit}
    `;
    return c.json({ incidents: rows });
  });

  app.get("/:id", async (c) => {
    const id = c.req.param("id");
    const rows = await sql<any[]>`
      SELECT i.*, c.name AS camera_name, r.name AS roi_name,
             clip.storage_key AS clip_storage_key,
             clip.poster_key  AS clip_poster_key,
             clip.kind        AS clip_kind,
             clip.start_ts    AS clip_start_ts
        FROM incidents i
        JOIN cameras c ON c.id = i.camera_id
        JOIN rois r ON r.id = i.roi_id
        ${clipResolver}
       WHERE i.id = ${id}::uuid
    `;
    if (!rows[0]) return c.json({ error: "not found" }, 404);
    const clipRows = await sql<any[]>`
      SELECT id, kind, start_ts, end_ts, storage_key, poster_key
        FROM clips WHERE incident_id = ${id}::uuid ORDER BY start_ts
    `;
    return c.json({ ...rows[0], clips: clipRows });
  });

  // Segment-accurate, browser-seekable footage of the incident. Builds once,
  // caches in the clips bucket, then redirects to the public Range-capable
  // by-key stream. The detection is FOOTAGE_PRE_S into the clip.
  app.get("/:id/footage", async (c) => {
    const id = c.req.param("id");
    const key = await ensureIncidentFootage(sql, id);
    if (!key) return c.json({ error: "no recording covers this incident" }, 404);
    return c.redirect(`/api/clips/by-key/${encodeURIComponent(key)}`, 302);
  });

  app.post("/:id/acknowledge", async (c) => {
    const id = c.req.param("id");
    await sql`
      UPDATE incidents SET status = 'acknowledged', acknowledged_at = now()
       WHERE id = ${id}::uuid
    `;
    return c.json({ ok: true });
  });

  app.get("/:id/playback", async (c) => {
    const id = c.req.param("id");
    const token = c.req.query("token");
    if (!token) return c.json({ error: "token required" }, 401);
    const secret = process.env.DEEP_LINK_TOKEN_SECRET ?? "change-me";
    const v = verifyDeepLink({ incidentId: id, token, secret });
    if (!v.ok) return c.json({ error: v.reason }, 401);
    const rows = await sql<any[]>`
      SELECT i.id, i.camera_id, c.name AS camera_name, i.classes, i.opened_at,
             i.closed_at, i.summary, i.status,
             clip.poster_key AS clip_poster_key
        FROM incidents i
        JOIN cameras c ON c.id = i.camera_id
        ${clipResolver}
       WHERE i.id = ${id}::uuid
    `;
    if (!rows[0]) return c.json({ error: "not found" }, 404);
    const r0 = rows[0];
    const key = await ensureIncidentFootage(sql, id);
    return c.json({
      incident: r0,
      stream_url: key
        ? `/api/clips/by-key/${encodeURIComponent(key)}`
        : null,
      poster_url: r0.clip_poster_key
        ? `/api/clips/by-key/${encodeURIComponent(r0.clip_poster_key)}`
        : null,
      start_offset_seconds: Math.max(0, FOOTAGE_PRE_S - FOOTAGE_LEAD_S),
    });
  });

  return app;
}
