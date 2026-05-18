/**
 * Recurring storage reclaimer. The DVR holds the real archive — here we
 * only need the *alert artifacts* (incident clips, their built footage,
 * posters). Everything else is disposable once those exist:
 *
 *  1. Expired clips — enforce the retention the clip-builder already stamps
 *     (`clips.retention_until`: 90d incident / 3d regular). Nothing was
 *     actually deleting these.
 *  2. Raw segments — the bulk of storage (tens of thousands of objects).
 *     Drop any past `SEGMENT_RETENTION_HOURS` that no existing incident's
 *     review window still overlaps, and ALL segments past a hard cap
 *     `SEGMENT_HARD_MAX_HOURS` (by then the incident clip + on-demand
 *     footage are materialised, so the raw segment is redundant).
 *  3. Orphaned / legacy on-demand footage — `ondemand/*` whose incident no
 *     longer exists, plus the pre-codec-fix HEVC builds (`<id>.mp4` that
 *     aren't the current `<id>.h264.mp4`), which are never served again.
 *
 * Conservative by construction: never touches a clip before its policy
 * retention, never touches segments a still-existing recent incident might
 * need, never touches `<id>.h264.mp4` of a live incident. Bounded per run;
 * the schedule drains a large backlog over successive runs.
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
    z.object({ clips: z.number(), segments: z.number(), footage: z.number() }),
  )
  .every("30m")
  .withInput({})
  .timeout(300_000)
  .retries(1)
  .run(async () => {
    let clipsRemoved = 0;
    let segsRemoved = 0;
    let footageRemoved = 0;

    // ── 1. Expired clips (enforce clips.retention_until) ────────────────
    try {
      const expired = await sql<
        Array<{ id: string; storage_key: string; poster_key: string | null }>
      >`
        SELECT id, storage_key, poster_key
          FROM clips
         WHERE retention_until IS NOT NULL AND retention_until < now()
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

    // ── 3. Orphaned / legacy on-demand footage ─────────────────────────
    try {
      const keys = await listKeys(BUCKETS.clips, "ondemand/");
      if (keys.length > 0) {
        const byId = new Map<string, { key: string; legacy: boolean }[]>();
        for (const key of keys) {
          const m = UUID_RE.exec(key);
          if (!m) continue;
          const id = m[1]!.toLowerCase();
          const legacy = !m[2]; // not the current `.h264.mp4` build
          (byId.get(id) ?? byId.set(id, []).get(id)!).push({ key, legacy });
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
          for (const it of items) {
            // Delete if the incident is gone, or it's a superseded legacy
            // (non-h264) build that's never served again.
            if (!alive.has(id) || it.legacy) {
              if (await rm(BUCKETS.clips, it.key)) footageRemoved++;
            }
          }
        }
      }
    } catch (e) {
      log.warn({ err: e }, "footage prune failed");
    }

    if (clipsRemoved || segsRemoved || footageRemoved) {
      log.info(
        { clips: clipsRemoved, segments: segsRemoved, footage: footageRemoved },
        "storage pruned",
      );
    }
    return {
      clips: clipsRemoved,
      segments: segsRemoved,
      footage: footageRemoved,
    };
  });
