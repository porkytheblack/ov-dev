/**
 * Recurring storage reclaimer. The DVR holds the real archive — here we
 * only need the *alert artifacts* (incident clips, their built footage,
 * posters). Everything else is disposable once those exist:
 *
 *  1. Expired clips — enforce `clips.retention_until` for clips that are
 *     NOT tied to a still-existing incident (kind='regular' background
 *     recordings, orphaned ondemand stand-ins, etc.). A clip whose
 *     `incident_id` points at an incident still in the DB — any status,
 *     including `suppressed` — is preserved indefinitely: suppressed
 *     alerts are explicitly review material the operator wants to look
 *     back at, and storage for incident clips is tiny vs. raw segments.
 *  2. Raw segments — the bulk of storage (tens of thousands of objects).
 *     Drop any past `SEGMENT_RETENTION_HOURS` that no existing incident's
 *     review window still overlaps, and ALL segments past a hard cap
 *     `SEGMENT_HARD_MAX_HOURS` (by then the incident clip + on-demand
 *     footage are materialised, so the raw segment is redundant).
 *  3. Truly orphaned on-demand footage — `ondemand/*` whose incident no
 *     longer exists in the DB. We deliberately keep the pre-codec-fix
 *     legacy `<id>.mp4` builds too (even though the current player only
 *     serves `<id>.h264.mp4`): for some old incidents the legacy build is
 *     the only footage ever materialised, and once deleted the modal is
 *     dead-end. ondemand is tiny (~100MB) — the savings aren't worth the
 *     irreversible loss.
 *  4. Orphaned frames — the detector deletes each frame after processing,
 *     but orphans accumulate (consumer lag, restarts, fire-retention paths
 *     that didn't reach cleanup). Frames must turn over fast; we drop any
 *     object in `overwatch-frames` older than `FRAMES_RETENTION_MIN`.
 *
 * Conservative by construction: never touches a clip while its incident
 * still exists, never touches segments a still-existing recent incident
 * might need, never touches an ondemand build whose incident is alive.
 * Bounded per run; the schedule drains a large backlog over successive runs.
 */
import { signal, z } from "station-signal";
import { BUCKETS, makeMinio } from "@overwatch/shared-ts";
import { sql, log } from "../config.js";

const RET_HOURS = Number(process.env.SEGMENT_RETENTION_HOURS ?? 48) || 48;
const HARD_HOURS = Number(process.env.SEGMENT_HARD_MAX_HOURS ?? 168) || 168;
// Generous keep-margin around an incident so the on-demand footage builder
// can always still assemble it (footage window is ~30s; 5min is safe slack).
const KEEP_MARGIN_S = Number(process.env.SEGMENT_KEEP_MARGIN_SEC ?? 300) || 300;
const BATCH = Number(process.env.PRUNE_BATCH ?? 2000) || 2000;
// Frames are touched within seconds of being written (detector consumes from
// `frames.{camera}` Redis stream). Anything older than this is an orphan.
const FRAMES_RET_MIN = Number(process.env.FRAMES_RETENTION_MIN ?? 10) || 10;

const minio = makeMinio();

/** Best-effort object delete; a missing object is success (idempotent). */
async function rm(bucket: string, key: string): Promise<boolean> {
  try {
    await minio.removeObject(bucket, key);
    return true;
  } catch (e: any) {
    if (e?.code === "NoSuchKey" || e?.code === "NotFound") return true;
    log.warn({ bucket, key, err: e?.message }, "object delete failed");
    return false;
  }
}

function listKeys(bucket: string, prefix: string): Promise<string[]> {
  return new Promise((resolve) => {
    const out: string[] = [];
    const stream = minio.listObjectsV2(bucket, prefix, true);
    stream.on("data", (o: { name?: string }) => {
      if (o.name) out.push(o.name);
    });
    stream.on("error", () => resolve(out));
    stream.on("end", () => resolve(out));
  });
}

const UUID_RE =
  /^ondemand\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\.h264)?\.mp4$/i;

export const storagePrune = signal("storage-prune")
  .input(z.object({}))
  .output(
    z.object({
      clips: z.number(),
      segments: z.number(),
      footage: z.number(),
      frames: z.number(),
    }),
  )
  .every("30m")
  .withInput({})
  .timeout(300_000)
  .retries(1)
  .run(async () => {
    let clipsRemoved = 0;
    let segsRemoved = 0;
    let footageRemoved = 0;
    let framesRemoved = 0;

    // ── 1. Expired clips, but ONLY if their incident no longer exists ──
    // Suppressed (and any other still-on-disk) incidents are review
    // material — never auto-delete their footage, even past retention.
    try {
      const expired = await sql<
        Array<{ id: string; storage_key: string; poster_key: string | null }>
      >`
        SELECT c.id, c.storage_key, c.poster_key
          FROM clips c
         WHERE c.retention_until IS NOT NULL
           AND c.retention_until < now()
           AND (
             c.incident_id IS NULL
             OR NOT EXISTS (
               SELECT 1 FROM incidents i WHERE i.id = c.incident_id
             )
           )
         LIMIT ${BATCH}
      `;
      const goneIds: string[] = [];
      for (const c of expired) {
        const a = await rm(BUCKETS.clips, c.storage_key);
        const b = c.poster_key ? await rm(BUCKETS.clips, c.poster_key) : true;
        if (a && b) goneIds.push(c.id);
      }
      if (goneIds.length > 0) {
        await sql`DELETE FROM clips WHERE id = ANY(${goneIds}::uuid[])`;
        clipsRemoved = goneIds.length;
      }
    } catch (e) {
      log.warn({ err: e }, "clip prune failed");
    }

    // ── 2. Raw segments past retention that no incident still needs ─────
    try {
      const old = await sql<Array<{ id: string; storage_key: string }>>`
        SELECT s.id, s.storage_key
          FROM segments s
         WHERE s.end_ts < now() - (${RET_HOURS} || ' hours')::interval
           AND (
             s.end_ts < now() - (${HARD_HOURS} || ' hours')::interval
             OR NOT EXISTS (
               SELECT 1 FROM incidents i
                WHERE i.camera_id = s.camera_id
                  AND i.opened_at - (${KEEP_MARGIN_S} || ' seconds')::interval <= s.end_ts
                  AND COALESCE(i.closed_at, i.opened_at)
                      + (${KEEP_MARGIN_S} || ' seconds')::interval >= s.start_ts
             )
           )
         ORDER BY s.end_ts
         LIMIT ${BATCH}
      `;
      const goneIds: string[] = [];
      for (const s of old) {
        if (await rm(BUCKETS.segments, s.storage_key)) goneIds.push(s.id);
      }
      if (goneIds.length > 0) {
        await sql`DELETE FROM segments WHERE id = ANY(${goneIds}::uuid[])`;
        segsRemoved = goneIds.length;
      }
    } catch (e) {
      log.warn({ err: e }, "segment prune failed");
    }

    // ── 3. Truly orphaned on-demand footage ─────────────────────────────
    // Only delete `ondemand/*` whose incident no longer exists in the DB.
    // We intentionally keep the legacy `<id>.mp4` (non-h264) builds — they
    // may be the only materialised footage for an old incident and once
    // gone the review modal is dead-end. Bucket is small (~100MB) so the
    // savings aren't worth the irreversible loss.
    try {
      const keys = await listKeys(BUCKETS.clips, "ondemand/");
      if (keys.length > 0) {
        const byId = new Map<string, string[]>();
        for (const key of keys) {
          const m = UUID_RE.exec(key);
          if (!m) continue;
          const id = m[1]!.toLowerCase();
          (byId.get(id) ?? byId.set(id, []).get(id)!).push(key);
        }
        const ids = [...byId.keys()];
        const alive = new Set(
          (
            await sql<Array<{ id: string }>>`
              SELECT id::text FROM incidents WHERE id = ANY(${ids}::uuid[])
            `
          ).map((r) => r.id.toLowerCase()),
        );
        for (const [id, items] of byId) {
          if (alive.has(id)) continue; // incident still on file → keep all builds
          for (const key of items) {
            if (await rm(BUCKETS.clips, key)) footageRemoved++;
          }
        }
      }
    } catch (e) {
      log.warn({ err: e }, "footage prune failed");
    }

    // ── 4. Orphaned frames — anything older than FRAMES_RET_MIN ─────────
    try {
      const cutoff = Date.now() - FRAMES_RET_MIN * 60_000;
      const stale: string[] = [];
      await new Promise<void>((resolve) => {
        const stream = minio.listObjectsV2(BUCKETS.frames, "", true);
        const finish = () => {
          try {
            (stream as { destroy?: () => void }).destroy?.();
          } catch {
            /* ignore */
          }
          resolve();
        };
        stream.on("data", (o: { name?: string; lastModified?: Date }) => {
          const mod = o.lastModified ? o.lastModified.getTime() : 0;
          if (o.name && mod && mod < cutoff) stale.push(o.name);
          // Bound enumeration cost too — once we have a batch's worth of
          // stale keys, stop listing and delete; next tick picks up the rest.
          if (stale.length >= BATCH) finish();
        });
        stream.on("error", () => resolve());
        stream.on("end", () => resolve());
      });
      for (const key of stale) {
        if (await rm(BUCKETS.frames, key)) framesRemoved++;
      }
    } catch (e) {
      log.warn({ err: e }, "frames prune failed");
    }

    if (clipsRemoved || segsRemoved || footageRemoved || framesRemoved) {
      log.info(
        {
          clips: clipsRemoved,
          segments: segsRemoved,
          footage: footageRemoved,
          frames: framesRemoved,
        },
        "storage pruned",
      );
    }
    return {
      clips: clipsRemoved,
      segments: segsRemoved,
      footage: footageRemoved,
      frames: framesRemoved,
    };
  });
