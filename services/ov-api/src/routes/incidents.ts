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
import { getBroadcastRun, stationConfigured, triggerBroadcast } from "../station.js";

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
  // 1. If the clip-builder already produced an incident clip for this
  //    incident, prefer it. Those clips are H.264 (matching the ondemand
  //    recipe) and live under the 90-day clip retention — they survive
  //    segment expiry, while the ondemand-from-segments fallback below
  //    cannot rebuild once SEGMENT_HARD_MAX_HOURS has passed.
  try {
    const existing = await sql<{ storage_key: string }[]>`
      SELECT storage_key
        FROM clips
       WHERE incident_id = ${id}::uuid
       ORDER BY (kind = 'incident') DESC, start_ts DESC
       LIMIT 1
    `;
    if (existing[0]) return existing[0].storage_key;
  } catch (e) {
    // Don't fail the request because the preference lookup failed — fall
    // through to the legacy build-from-segments path.
    console.warn(`[footage] clip lookup failed for ${id}:`, (e as Error).message);
  }

  // 2. `.h264` in the key: footage is now transcoded to H.264 (below). The
  //    version suffix bypasses any pre-existing HEVC `-c copy` build that iOS
  //    Safari can't decode (the old "black box / crossed-out play" on phones).
  const cacheKey = `ondemand/${id}.h264.mp4`;
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
      // Transcode to H.264 + yuv420p + faststart (audio dropped — these are
      // silent surveillance clips). The cameras are HEVC at odd
      // resolutions/fps which iOS Safari refuses to play progressively
      // (`-c copy` only ever worked on HEVC-capable desktops). H.264 main /
      // yuv420p / +faststart is universally decodable (iOS, Android, all
      // browsers). Even-dimension scale guards libx264's 4:2:0 requirement.
      // Built once per incident and cached, so the transcode is one-time.
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
        "-vf",
        "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-profile:v",
        "main",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "23",
        "-an",
        "-fflags",
        "+genpts",
        "-avoid_negative_ts",
        "make_zero",
        "-movflags",
        "+faststart",
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

  // Timeline markers for the custom player: every detection on this
  // incident's camera within the built footage window, expressed as an
  // offset (seconds) into the clip so the scrubber can show ticks of
  // "when things were found". The incident moment itself is at FOOTAGE_PRE_S.
  app.get("/:id/markers", async (c) => {
    const id = c.req.param("id");
    const inc = await sql<{ camera_id: string; opened_at: Date }[]>`
      SELECT camera_id, opened_at FROM incidents WHERE id = ${id}::uuid
    `;
    if (!inc[0]) return c.json({ error: "not found" }, 404);
    const rows = await sql<{ t: number; classes: string[] }[]>`
      SELECT floor((extract(epoch FROM (d.ts - ${inc[0].opened_at}::timestamptz))
                     + ${FOOTAGE_PRE_S}) * 2) / 2 AS t,
             array_agg(DISTINCT d.class) AS classes
        FROM detections d
       WHERE d.camera_id = ${inc[0].camera_id}::uuid
         AND d.ts BETWEEN ${inc[0].opened_at}::timestamptz - make_interval(secs => ${FOOTAGE_PRE_S})
                      AND ${inc[0].opened_at}::timestamptz + make_interval(secs => ${FOOTAGE_POST_S})
       GROUP BY 1
      HAVING floor((extract(epoch FROM (min(d.ts) - ${inc[0].opened_at}::timestamptz))
                     + ${FOOTAGE_PRE_S}) * 2) / 2 >= 0
       ORDER BY 1
       LIMIT 400
    `;
    return c.json({
      incident_t: FOOTAGE_PRE_S,
      window_s: FOOTAGE_PRE_S + FOOTAGE_POST_S,
      markers: rows.map((r) => ({ t: Number(r.t), classes: r.classes })),
    });
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

  // Trigger MiMo video analysis for this incident as a Station broadcast.
  // The job runs async on ov-station; the client polls GET /:id/analysis.
  app.post("/:id/analyze", async (c) => {
    const id = c.req.param("id");
    if (!stationConfigured()) {
      return c.json(
        { error: "station not configured", message: "STATION_API_KEY is not set — provision one (make station-key)." },
        503,
      );
    }
    const inc = await sql<{ camera_id: string }[]>`
      SELECT camera_id FROM incidents WHERE id = ${id}::uuid
    `;
    if (!inc[0]) return c.json({ error: "not found" }, 404);

    // Reuse the segment-accurate footage builder so analysis works for any
    // incident, even without a pre-built incident clip.
    const storageKey = await ensureIncidentFootage(sql, id);
    if (!storageKey) {
      return c.json({ error: "no recording covers this incident" }, 409);
    }
    const posterRow = await sql<{ poster_key: string | null }[]>`
      SELECT poster_key FROM clips
       WHERE incident_id = ${id}::uuid AND poster_key IS NOT NULL
       ORDER BY (kind = 'incident') DESC, start_ts DESC
       LIMIT 1
    `;
    const posterKey = posterRow[0]?.poster_key ?? undefined;

    try {
      const run = await triggerBroadcast("analyze-incident-clip", {
        incident_id: id,
        camera_id: inc[0].camera_id,
        storage_key: storageKey,
        poster_key: posterKey,
        force: true,
      });
      const analysis = {
        broadcast_run_id: run.id,
        triggered_at: new Date().toISOString(),
      };
      await sql`
        UPDATE incidents
           SET summary_status = 'pending',
               metadata = coalesce(metadata, '{}'::jsonb) || ${JSON.stringify({ analysis })}::jsonb
         WHERE id = ${id}::uuid
      `;
      return c.json({ ok: true, broadcast_run_id: run.id, status: run.status });
    } catch (e) {
      return c.json({ error: "trigger failed", message: (e as Error).message }, 502);
    }
  });

  // Lazy status/result of the analysis job. The summary lands on the
  // incident when the broadcast's write-summary node completes.
  app.get("/:id/analysis", async (c) => {
    const id = c.req.param("id");
    const rows = await sql<
      { summary: string | null; summary_status: string; metadata: Record<string, any> | null }[]
    >`
      SELECT summary, summary_status, metadata FROM incidents WHERE id = ${id}::uuid
    `;
    if (!rows[0]) return c.json({ error: "not found" }, 404);
    const runId: string | undefined = rows[0].metadata?.analysis?.broadcast_run_id;
    const run = runId ? await getBroadcastRun(runId) : null;
    const triggeredAt: string | undefined = rows[0].metadata?.analysis?.triggered_at;

    // Self-heal a stuck 'pending'. summary_status is only ever advanced to
    // 'ready' by the write-summary node on success — there is no failure
    // transition, and Station reconciles its own run row (timeout → failed)
    // but never this field. So a broadcast that failed, was skipped under
    // onFailure("continue"), or whose runner crashed leaves the incident
    // "Analyzing…" forever. Converge it to 'failed' once the run reached a
    // terminal state without a summary, or the trigger is older than any run
    // could still be active. (The reap-stale-analysis signal is the catch-all
    // for incidents nobody is polling.)
    let summaryStatus = rows[0].summary_status;
    if (summaryStatus === "pending" && !rows[0].summary) {
      const runTerminal = run?.status === "failed" || run?.status === "completed";
      const staleMs = (Number(process.env.ANALYSIS_STALE_MINUTES ?? 15) || 15) * 60_000;
      const stale = triggeredAt
        ? Date.now() - new Date(triggeredAt).getTime() > staleMs
        : true;
      if (runTerminal || stale) {
        await sql`
          UPDATE incidents SET summary_status = 'failed'
           WHERE id = ${id}::uuid AND summary_status = 'pending'
        `;
        summaryStatus = "failed";
      }
    }

    return c.json({
      summary_status: summaryStatus,
      summary: rows[0].summary,
      run: run ? { id: run.id, status: run.status } : null,
      triggered_at: triggeredAt ?? null,
    });
  });

  app.post("/:id/acknowledge", async (c) => {
    const id = c.req.param("id");
    await sql`
      UPDATE incidents SET status = 'acknowledged', acknowledged_at = now()
       WHERE id = ${id}::uuid
    `;
    return c.json({ ok: true });
  });

  // General incident-response status change (acknowledge / suppress /
  // close / re-open). Mirrors the agent's set_incident_status tool.
  const STATUSES = ["open", "acknowledged", "suppressed", "closed"] as const;
  app.post("/:id/status", async (c) => {
    const id = c.req.param("id");
    const body = (await c.req.json().catch(() => ({}))) as { status?: string };
    if (!body.status || !STATUSES.includes(body.status as any)) {
      return c.json(
        { error: `status must be one of ${STATUSES.join(", ")}` },
        400,
      );
    }
    const rows = await sql<Array<{ id: string; status: string }>>`
      UPDATE incidents
         SET status = ${body.status},
             acknowledged_at = CASE WHEN ${body.status} = 'acknowledged'
                                    THEN now() ELSE acknowledged_at END,
             closed_at = CASE WHEN ${body.status} = 'closed' AND closed_at IS NULL
                              THEN now() ELSE closed_at END
       WHERE id = ${id}::uuid
       RETURNING id, status
    `;
    if (rows.length === 0) return c.json({ error: "not found" }, 404);
    return c.json({ ok: true, incident: rows[0] });
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
