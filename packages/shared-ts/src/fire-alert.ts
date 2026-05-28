/**
 * Shared fire-alert rate limiting + dispatch.
 *
 * A fire alert for a given camera may go out at most once per cooldown
 * window — and that limit is enforced in Postgres, not memory, so a service
 * restart can't re-trigger an alert inside the window (the deliberate
 * trade-off the operator chose: no duplicate spam, even across restarts).
 *
 * Both alerting paths funnel through here so the limit and the message
 * format have a single source of truth:
 *   - ov-incident-engine: high-confidence fire (>= OV_FIRE_HIGH_CONF) — direct
 *   - ov-station `raise-fire-alert`: fire confirmed (or fail-open) by the
 *     vision adjudicator for the uncertain band
 */
import type postgres from "postgres";
import type { Redis } from "ioredis";
import { STREAMS } from "@overwatch/schemas/events";
import { publishEvent } from "./redis.js";

type Sql = ReturnType<typeof postgres>;

let ensured: Promise<void> | null = null;

/** Idempotent — init.sql creates this for fresh installs; this covers an
 * already-running DB and guarantees the fail-open path can always claim. */
function ensureTable(sql: Sql): Promise<void> {
  if (!ensured) {
    ensured = sql`
      CREATE TABLE IF NOT EXISTS fire_alert_log (
        camera_id     UUID PRIMARY KEY,
        last_alert_at TIMESTAMPTZ NOT NULL
      )
    `.then(
      () => undefined,
      (e) => {
        // Don't cache a failure — let the next call retry.
        ensured = null;
        throw e;
      },
    );
  }
  return ensured;
}

/**
 * Atomically claim the right to send a fire alert for `cameraId`. Returns
 * true exactly once per `cooldownSec` window per camera; concurrent callers
 * (engine + station) race on the same row so only one wins.
 */
export async function claimFireAlert(
  sql: Sql,
  cameraId: string,
  cooldownSec: number,
): Promise<boolean> {
  await ensureTable(sql);
  const rows = await sql<Array<{ camera_id: string }>>`
    INSERT INTO fire_alert_log (camera_id, last_alert_at)
    VALUES (${cameraId}::uuid, now())
    ON CONFLICT (camera_id) DO UPDATE
      SET last_alert_at = now()
      WHERE fire_alert_log.last_alert_at < now() - make_interval(secs => ${cooldownSec})
    RETURNING camera_id
  `;
  return rows.length > 0;
}

export type FireAlertResult = {
  /** false when rate-limited (no send happened). */
  sent: boolean;
  subscribers: number;
};

/**
 * Rate-limited fire-alert dispatch: claims the per-camera window, and only
 * if it wins resolves the camera's subscribers and publishes the urgent
 * fire message to each channel's bot_outbox. The message format is kept
 * identical to the engine's original direct alert so behaviour is unchanged
 * for the high-confidence path.
 */
export async function dispatchFireAlert(
  sql: Sql,
  redis: Redis,
  args: { cameraId: string; classes: string[]; cooldownSec: number },
): Promise<FireAlertResult> {
  const claimed = await claimFireAlert(sql, args.cameraId, args.cooldownSec);
  if (!claimed) return { sent: false, subscribers: 0 };

  const cam = await sql<Array<{ name: string }>>`
    SELECT name FROM cameras WHERE id = ${args.cameraId}::uuid LIMIT 1
  `;
  const cameraName = cam[0]?.name ?? "a camera";
  const subs = await sql<Array<{ channel: string; handle: string }>>`
    SELECT channel, handle FROM subscribers
     WHERE enabled = true
       AND channel IN ('whatsapp', 'telegram')
       AND (cardinality(camera_ids) = 0 OR ${args.cameraId}::uuid = ANY(camera_ids))
  `;
  const what = args.classes.join(" & ");
  const text =
    `🔥 FIRE ALERT — ${cameraName}\n` +
    `${what.charAt(0).toUpperCase()}${what.slice(1)} detected on camera. ` +
    `Open the live view and respond immediately.`;
  // One-tap deep link to this camera's live view. Telegram renders it as an
  // inline keyboard button; WhatsApp has no buttons so it degrades to a
  // "• label: url" line — either way the operator gets a clickable link
  // instead of being told to "go check the dashboard".
  const base = (process.env.DASHBOARD_BASE_URL ?? "http://localhost:9090").replace(
    /\/+$/,
    "",
  );
  const liveUrl = `${base}/cameras/${args.cameraId}`;
  const buttons = [{ text: "🎥 Open live view", url: liveUrl }];
  for (const s of subs) {
    if (s.channel !== "telegram" && s.channel !== "whatsapp") continue;
    await publishEvent(
      redis,
      STREAMS.bot_outbox(s.channel as "telegram" | "whatsapp"),
      { type: "bot.outbox", channel: s.channel, handle: s.handle, text, buttons },
    );
  }
  return { sent: true, subscribers: subs.length };
}
