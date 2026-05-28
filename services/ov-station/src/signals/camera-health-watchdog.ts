/**
 * Watches camera frame freshness; if too many cameras are stale, restarts
 * ov-ingestor and notifies the operator on Telegram.
 *
 * Catches the partial-RTSP-wedge pattern observed after a Docker DNS hiccup:
 * the ingestor process stays alive (its /health is fine), one camera keeps
 * flowing frames, but the other workers got stuck mid-reconnect and never
 * recover on their own. An in-process supervisor wouldn't catch the case
 * where the whole ingestor wedges, so the watchdog lives outside.
 *
 * Recovery action: POST to ov-ingestor /admin/restart → it calls os._exit(1)
 * → Docker's restart policy brings it back with fresh workers. A DB-backed
 * cooldown (`auto_recovery_log`) prevents flapping if the underlying cause
 * is persistent (e.g. RTSP server down).
 */
import { signal, z } from "station-signal";
import { publishEvent } from "@overwatch/shared-ts";
import { STREAMS } from "@overwatch/schemas/events";
import { sql, redis, log } from "../config.js";

const STALE_SECS =
  Number(process.env.CAMERA_STALE_SECS ?? 120) || 120;
const HEALTH_THRESHOLD =
  Number(process.env.CAMERA_HEALTH_THRESHOLD ?? 0.5) || 0.5;
const COOLDOWN_SEC =
  Number(process.env.CAMERA_HEALTH_COOLDOWN_SEC ?? 600) || 600;
const INGESTOR_ADMIN_URL = (
  process.env.INGESTOR_ADMIN_URL ?? "http://ov-ingestor:8000"
).replace(/\/+$/, "");

let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ensured) {
    ensured = sql`
      CREATE TABLE IF NOT EXISTS auto_recovery_log (
        action  TEXT PRIMARY KEY,
        last_at TIMESTAMPTZ NOT NULL
      )
    `.then(
      () => undefined,
      (e) => {
        ensured = null;
        throw e;
      },
    );
  }
  return ensured;
}

/** Atomic per-action claim — true exactly once per cooldown window. */
async function claimRecovery(action: string, cooldownSec: number): Promise<boolean> {
  await ensureTable();
  const rows = await sql<Array<{ action: string }>>`
    INSERT INTO auto_recovery_log (action, last_at)
    VALUES (${action}, now())
    ON CONFLICT (action) DO UPDATE
      SET last_at = now()
      WHERE auto_recovery_log.last_at < now() - make_interval(secs => ${cooldownSec})
    RETURNING action
  `;
  return rows.length > 0;
}

async function notifyOperator(text: string): Promise<void> {
  const subs = await sql<Array<{ channel: string; handle: string }>>`
    SELECT channel, handle FROM subscribers
     WHERE enabled = true
       AND channel IN ('whatsapp', 'telegram')
  `;
  for (const s of subs) {
    if (s.channel !== "telegram" && s.channel !== "whatsapp") continue;
    await publishEvent(
      redis,
      STREAMS.bot_outbox(s.channel as "telegram" | "whatsapp"),
      { type: "bot.outbox", channel: s.channel, handle: s.handle, text },
    );
  }
}

export const cameraHealthWatchdog = signal("camera-health-watchdog")
  .input(z.object({}))
  .output(
    z.object({
      stale: z.number(),
      total: z.number(),
      restarted: z.boolean(),
      reason: z.string(),
    }),
  )
  .every("2m")
  .withInput({})
  .timeout(30_000)
  .retries(0)
  .run(async () => {
    const cams = await sql<Array<{ name: string; secs_ago: number | null }>>`
      SELECT name,
             EXTRACT(EPOCH FROM (now() - last_frame_at))::int AS secs_ago
        FROM cameras
       WHERE enabled = true
    `;
    if (cams.length === 0) {
      return { stale: 0, total: 0, restarted: false, reason: "no enabled cameras" };
    }
    const stale = cams.filter(
      (c) => c.secs_ago == null || c.secs_ago > STALE_SECS,
    );
    const ratio = stale.length / cams.length;

    if (ratio < HEALTH_THRESHOLD) {
      return {
        stale: stale.length,
        total: cams.length,
        restarted: false,
        reason: `healthy (ratio ${ratio.toFixed(2)} < threshold ${HEALTH_THRESHOLD})`,
      };
    }

    const claimed = await claimRecovery("ingestor-restart", COOLDOWN_SEC);
    if (!claimed) {
      log.warn(
        {
          stale: stale.length,
          total: cams.length,
          ratio,
          cooldown_sec: COOLDOWN_SEC,
        },
        "cameras stale but auto-restart in cooldown",
      );
      return {
        stale: stale.length,
        total: cams.length,
        restarted: false,
        reason: "in cooldown",
      };
    }

    const list = stale.map((s) => `${s.name} (${s.secs_ago ?? "?"}s)`).join(", ");
    log.warn(
      { stale: stale.length, total: cams.length, ratio, cameras: list },
      "auto-restarting ov-ingestor — cameras stale",
    );
    try {
      const res = await fetch(`${INGESTOR_ADMIN_URL}/admin/restart`, {
        method: "POST",
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        throw new Error(`ingestor /admin/restart returned ${res.status}`);
      }
    } catch (e) {
      log.error({ err: e }, "ingestor restart request failed");
      return {
        stale: stale.length,
        total: cams.length,
        restarted: false,
        reason: `restart call failed: ${(e as Error).message}`,
      };
    }

    await notifyOperator(
      `🛠️ Auto-recovery: ov-ingestor restarted.\n` +
        `${stale.length}/${cams.length} cameras were stale — ${list}.\n` +
        `Cameras should be back online within ~30s.`,
    ).catch((e) => log.warn({ err: e }, "operator notify failed"));

    return {
      stale: stale.length,
      total: cams.length,
      restarted: true,
      reason: `restarted (${stale.length}/${cams.length} stale)`,
    };
  });
