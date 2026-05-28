import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import {
  ClipReady,
  CONSUMER_GROUP,
  IncidentOpened,
  STREAMS,
  SummaryReady,
} from "@overwatch/schemas/events";
import {
  createGroupConsumer,
  humanWhen,
  makeLogger,
  makeRedis,
  publishEvent,
} from "@overwatch/shared-ts";
import postgres from "postgres";
import { signDeepLink } from "./deep-link.js";

const log = makeLogger("ov-notifier");
const CLIP_WAIT_MS = (Number(process.env.CLIP_WAIT_TIMEOUT_SECONDS ?? 120) || 120) * 1000;
// The per-incident summary follow-up only makes sense as enrichment of a
// just-sent alert. A late re-analysis (e.g. the morning/evening recap
// force-analysing hours-old clips) must NOT spew one ping per old incident
// into the chat — the recap already covers them.
const SUMMARY_FOLLOWUP_MAX_AGE_MS =
  (Number(process.env.SUMMARY_FOLLOWUP_MAX_AGE_MIN ?? 120) || 120) * 60_000;

type PendingNotification = {
  incidentId: string;
  cameraId: string;
  roiId: string;
  classes: string[];
  openedAt: string;
  expiresAt: number;
  clipUrl?: string;
  posterUrl?: string;
};

const waiting = new Map<string, PendingNotification>();

function makeAttachmentUrls(args: { clipKey: string; posterKey?: string }) {
  const base = (process.env.DASHBOARD_BASE_URL ?? "http://localhost:9090").replace(/\/+$/, "");
  return {
    clipUrl: `${base}/api/clips/by-key/${encodeURIComponent(args.clipKey)}`,
    posterUrl: args.posterKey
      ? `${base}/api/clips/by-key/${encodeURIComponent(args.posterKey)}`
      : undefined,
  };
}

async function resolveSubscribers(
  sql: ReturnType<typeof postgres>,
  cameraId: string,
): Promise<Array<{ channel: "whatsapp" | "telegram"; handle: string }>> {
  const rows = await sql<Array<{ channel: string; handle: string; cameraIds: string[] }>>`
    SELECT channel, handle, camera_ids AS "cameraIds"
      FROM subscribers
     WHERE enabled = true
       AND (cardinality(camera_ids) = 0 OR ${cameraId}::uuid = ANY(camera_ids))
  `;
  return rows
    .filter((r) => r.channel === "whatsapp" || r.channel === "telegram")
    .map((r) => ({ channel: r.channel as "whatsapp" | "telegram", handle: r.handle }));
}

async function fetchIncidentMeta(
  sql: ReturnType<typeof postgres>,
  incidentId: string,
): Promise<{ cameraName: string; roiName: string; summary: string | null } | null> {
  const rows = await sql<Array<{ cameraName: string; roiName: string; summary: string | null }>>`
    SELECT c.name AS "cameraName", r.name AS "roiName", i.summary AS summary
      FROM incidents i
      JOIN cameras c ON c.id = i.camera_id
      JOIN rois r ON r.id = i.roi_id
     WHERE i.id = ${incidentId}::uuid
  `;
  return rows[0] ?? null;
}

function formatBody(args: {
  cameraName: string;
  roiName: string;
  classes: string[];
  openedAt: string;
  summary: string | null;
}) {
  const subjects =
    args.classes
      .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
      .join(", ") || "Motion";
  const summary = args.summary ?? "Generating summary…";
  // No "[OVERWATCH]" prefix — the operator already knows the system. Time is
  // a plain human phrase. The playback link rides as a structured `link`
  // attachment (inline button), never inlined in the text.
  return (
    `🚨 ${args.cameraName} — ${args.roiName}\n` +
    `${subjects} spotted ${humanWhen(args.openedAt)}\n\n` +
    `${summary}`
  );
}

/** Idempotent — the agent owns this table too; ensure it exists either way. */
async function ensureInboxTable(sql: ReturnType<typeof postgres>) {
  await sql`
    CREATE TABLE IF NOT EXISTS agent_inbox (
      id TEXT PRIMARY KEY, channel TEXT NOT NULL, handle TEXT NOT NULL,
      tag TEXT NOT NULL, request TEXT NOT NULL, response TEXT,
      status TEXT NOT NULL DEFAULT 'pending', blocking BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), resolved_at TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_agent_inbox_scope ON agent_inbox (channel, handle, status)`;
  // Idempotency marker for the follow-up summary (incidents.notified_at
  // already exists for the primary alert). Lets a reprocessed/reclaimed
  // summary event after a notifier restart be skipped instead of resent.
  await sql`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS summary_notified_at TIMESTAMPTZ`;
  // Idempotency marker for the late-clip follow-up — set by deliverLateClip
  // when a clip arrives after the primary text alert has already gone out.
  await sql`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS clip_notified_at TIMESTAMPTZ`;
}

/**
 * Post a notification to a subscriber's agent inbox as a *resolved* item so
 * Glove surfaces it the next time that user messages the bot (then marks it
 * consumed). This is how the agent "knows" about alerts sent while away.
 */
async function postInbox(
  sql: ReturnType<typeof postgres>,
  channel: string,
  handle: string,
  tag: string,
  request: string,
  response: string,
) {
  await sql`
    INSERT INTO agent_inbox
      (id, channel, handle, tag, request, response, status, blocking, created_at, resolved_at)
    VALUES (${randomUUID()}, ${channel}, ${handle}, ${tag}, ${request},
            ${response}, 'resolved', false, now(), now())
    ON CONFLICT (id) DO NOTHING
  `;
}

async function dispatch(
  redis: ReturnType<typeof makeRedis>,
  sql: ReturnType<typeof postgres>,
  pending: PendingNotification,
) {
  const meta = await fetchIncidentMeta(sql, pending.incidentId);
  if (!meta) return;
  // Idempotency: atomically claim the exclusive right to notify this
  // incident. Only the caller that flips notified_at from NULL proceeds —
  // any duplicate (clip + clip-wait timeout both firing, or a stream
  // message reprocessed by the XAUTOCLAIM reclaim after a notifier restart)
  // finds it already set and bails, so alerts are never resent.
  const claimed = await sql<Array<{ id: string }>>`
    UPDATE incidents SET notified_at = now()
     WHERE id = ${pending.incidentId}::uuid AND notified_at IS NULL
    RETURNING id
  `;
  if (claimed.length === 0) {
    log.info({ incidentId: pending.incidentId }, "already notified — skipping resend");
    return;
  }
  const secret = process.env.DEEP_LINK_TOKEN_SECRET ?? "change-me";
  const ttlHours = Number(process.env.DEEP_LINK_TTL_HOURS ?? 24) || 24;
  const link = signDeepLink({
    incidentId: pending.incidentId,
    secret,
    ttlHours,
  });
  const subscribers = await resolveSubscribers(sql, pending.cameraId);
  if (subscribers.length === 0) {
    log.info({ incidentId: pending.incidentId }, "no subscribers");
    return;
  }
  const body = formatBody({
    cameraName: meta.cameraName,
    roiName: meta.roiName,
    classes: pending.classes,
    openedAt: pending.openedAt,
    summary: meta.summary,
  });
  for (const sub of subscribers) {
    const stream = STREAMS.bot_outbox(sub.channel);
    const attachments: Array<{ kind: string; url: string; caption?: string }> = [
      { kind: "link", url: link.url, caption: "View playback" },
    ];
    if (pending.clipUrl) {
      attachments.unshift({ kind: "video", url: pending.clipUrl, caption: meta.cameraName });
    }
    const payload = {
      type: "bot.outbox",
      channel: sub.channel,
      handle: sub.handle,
      text: body,
      attachments,
      incident_id: pending.incidentId,
    };
    await publishEvent(redis, stream, payload as Record<string, unknown>);
    await postInbox(
      sql,
      sub.channel,
      sub.handle,
      "alert",
      `Alert: ${pending.classes.join(", ")} in ${meta.roiName} on ${meta.cameraName}`,
      body,
    ).catch((e) => log.warn({ err: e }, "inbox post failed"));
  }
  log.info({ incidentId: pending.incidentId, count: subscribers.length }, "dispatched");
}

/**
 * Send just the clip (and a "view playback" link) as a *follow-up* message
 * to every subscriber of an incident that was already alerted text-only.
 *
 * Why this exists:
 *   - The primary `dispatch()` claims `notified_at` so we never send the
 *     alert TWICE; that's correct for the text alert.
 *   - But the clip can arrive after the CLIP_WAIT timer fired (auto-
 *     suppressed incidents skip the engine's incident.closed event entirely
 *     and only get clipped by the clip-builder backfill loop, often minutes
 *     later). Before this function existed, that late clip was silently
 *     dropped — the operator got a text ping and no video.
 *
 * Idempotency: uses a `clip_notified_at` column on `incidents` so a
 * reprocessed clip.ready event after a notifier restart isn't resent.
 */
async function deliverLateClip(
  redis: ReturnType<typeof makeRedis>,
  sql: ReturnType<typeof postgres>,
  incidentId: string,
  urls: { clipUrl: string; posterUrl?: string },
) {
  // Only follow up if the incident was actually alerted in the first
  // place. If `notified_at` is still NULL, the alert is still pending /
  // suppressed by the engine — no clip-only follow-up makes sense.
  const claimed = await sql<Array<{ id: string }>>`
    UPDATE incidents
       SET clip_notified_at = now()
     WHERE id = ${incidentId}::uuid
       AND notified_at IS NOT NULL
       AND clip_notified_at IS NULL
    RETURNING id
  `;
  if (claimed.length === 0) {
    log.info({ incidentId }, "late clip — not eligible (not yet alerted, or already followed up)");
    return;
  }
  const rows = await sql<Array<{ cameraId: string; cameraName: string }>>`
    SELECT camera_id AS "cameraId", c.name AS "cameraName"
      FROM incidents i JOIN cameras c ON c.id = i.camera_id
     WHERE i.id = ${incidentId}::uuid
  `;
  const m = rows[0];
  if (!m) return;
  const secret = process.env.DEEP_LINK_TOKEN_SECRET ?? "change-me";
  const ttlHours = Number(process.env.DEEP_LINK_TTL_HOURS ?? 24) || 24;
  const link = signDeepLink({ incidentId, secret, ttlHours });
  const subscribers = await resolveSubscribers(sql, m.cameraId);
  for (const sub of subscribers) {
    await publishEvent(
      redis,
      STREAMS.bot_outbox(sub.channel),
      {
        type: "bot.outbox",
        channel: sub.channel,
        handle: sub.handle,
        // Short follow-up — the original alert already carries context.
        text: `🎬 Footage ready for ${m.cameraName}.`,
        attachments: [
          { kind: "video", url: urls.clipUrl, caption: m.cameraName },
          { kind: "link", url: link.url, caption: "View playback" },
        ],
        incident_id: incidentId,
      } as Record<string, unknown>,
    );
  }
  log.info({ incidentId, count: subscribers.length }, "late clip dispatched as follow-up");
}

async function main() {
  const redis = makeRedis();
  const sql = postgres(
    process.env.DATABASE_URL ?? "postgres://overwatch:overwatch@postgres:5432/overwatch",
    { max: 4 },
  );

  await ensureInboxTable(sql);

  const incidentConsumer = createGroupConsumer({
    redis,
    stream: STREAMS.incidents,
    group: CONSUMER_GROUP("ov-notifier-incidents"),
    consumer: `notifier-${process.env.HOSTNAME ?? "local"}`,
    schema: IncidentOpened,
    onParseError: () => {
      /* IncidentClosed will fail validation here — ignore via filter below */
    },
  });

  void incidentConsumer.consume(async (event) => {
    if (event.type !== "incident.opened") return;
    waiting.set(event.incident_id, {
      incidentId: event.incident_id,
      cameraId: event.camera_id,
      roiId: event.roi_id,
      classes: event.classes,
      openedAt: event.opened_at,
      expiresAt: Date.now() + CLIP_WAIT_MS,
    });
    // Clip-wait timeout: dispatch without inline playback if no clip arrives.
    setTimeout(async () => {
      const pending = waiting.get(event.incident_id);
      if (!pending || pending.clipUrl) return;
      await dispatch(redis, sql, pending);
      waiting.delete(event.incident_id);
    }, CLIP_WAIT_MS).unref();
  });

  const clipConsumer = createGroupConsumer({
    redis,
    stream: STREAMS.clips,
    group: CONSUMER_GROUP("ov-notifier-clips"),
    consumer: `notifier-${process.env.HOSTNAME ?? "local"}`,
    schema: ClipReady,
  });
  void clipConsumer.consume(async (event) => {
    if (event.kind !== "incident" || !event.incident_id) return;
    const urls = makeAttachmentUrls({ clipKey: event.storage_key, posterKey: event.poster_key });
    const pending = waiting.get(event.incident_id);
    if (pending) {
      // Common path: clip arrived before the wait timer fired. Dispatch
      // the full alert (text + video + link) atomically.
      pending.clipUrl = urls.clipUrl;
      pending.posterUrl = urls.posterUrl;
      await dispatch(redis, sql, pending);
      waiting.delete(event.incident_id);
      return;
    }
    // Late-arriving clip: the wait timer already fired and the text alert
    // went out without inline footage. Don't drop the clip — send it as a
    // standalone follow-up message so the operator gets the video they
    // were promised. This is the new clip-builder backfill loop's main
    // delivery path: incidents that the engine auto-suppressed (no
    // incident.closed event) get their clip built minutes later, and
    // until now there was no path from that clip back to the chat.
    await deliverLateClip(redis, sql, event.incident_id, urls);
  });

  // Auto-summary delivery: when the vision pipeline finishes summarising a
  // clip, send the summary to that incident's subscribers as a follow-up
  // alert and post it to their agent inbox.
  const summaryConsumer = createGroupConsumer({
    redis,
    stream: STREAMS.summaries,
    group: CONSUMER_GROUP("ov-notifier-summaries"),
    consumer: `notifier-${process.env.HOSTNAME ?? "local"}`,
    schema: SummaryReady,
  });
  void summaryConsumer.consume(async (event) => {
    if (event.type !== "summary.ready" || !event.summary?.trim()) return;
    const rows = await sql<
      Array<{
        camera_id: string;
        camera_name: string;
        roi_name: string;
        opened_at: string;
        classes: string[];
      }>
    >`
      SELECT i.camera_id, c.name AS camera_name, r.name AS roi_name,
             i.opened_at, i.classes
        FROM incidents i
        JOIN cameras c ON c.id = i.camera_id
        JOIN rois r ON r.id = i.roi_id
       WHERE i.id = ${event.incident_id}::uuid
    `;
    const m = rows[0];
    if (!m) return;
    // Recency guard: skip the chat follow-up for stale incidents (recap /
    // late re-analysis). No claim needed — a reprocess stays stale too.
    if (Date.now() - new Date(m.opened_at).getTime() > SUMMARY_FOLLOWUP_MAX_AGE_MS) {
      log.info(
        { incidentId: event.incident_id },
        "stale incident — summary follow-up suppressed (covered by recap)",
      );
      return;
    }
    // Idempotency (same rationale as dispatch): claim the summary send once
    // so a reclaimed/reprocessed summary event after a restart isn't resent.
    const claimedSummary = await sql<Array<{ id: string }>>`
      UPDATE incidents SET summary_notified_at = now()
       WHERE id = ${event.incident_id}::uuid AND summary_notified_at IS NULL
      RETURNING id
    `;
    if (claimedSummary.length === 0) {
      log.info({ incidentId: event.incident_id }, "summary already sent — skipping resend");
      return;
    }
    const subscribers = await resolveSubscribers(sql, m.camera_id);
    const secret = process.env.DEEP_LINK_TOKEN_SECRET ?? "change-me";
    const ttlHours = Number(process.env.DEEP_LINK_TTL_HOURS ?? 24) || 24;
    const link = signDeepLink({ incidentId: event.incident_id, secret, ttlHours });
    // Telegram can edit the original alert in place — send the FULL
    // recomposed body (now with the real summary) + edit flag, keeping the
    // playback link so the keyboard is rebuilt. WhatsApp has no edit API →
    // it still gets the compact follow-up.
    const tgText = formatBody({
      cameraName: m.camera_name,
      roiName: m.roi_name,
      classes: m.classes ?? [],
      openedAt: m.opened_at,
      summary: event.summary,
    });
    const waText = `📝 ${m.camera_name} — ${m.roi_name}\n${event.summary}`;
    for (const sub of subscribers) {
      const payload =
        sub.channel === "telegram"
          ? {
              type: "bot.outbox",
              channel: sub.channel,
              handle: sub.handle,
              text: tgText,
              incident_id: event.incident_id,
              edit: true,
              attachments: [
                { kind: "link", url: link.url, caption: "View playback" },
              ],
            }
          : {
              type: "bot.outbox",
              channel: sub.channel,
              handle: sub.handle,
              text: waText,
              incident_id: event.incident_id,
              suppress_actions: true,
            };
      await publishEvent(
        redis,
        STREAMS.bot_outbox(sub.channel),
        payload as Record<string, unknown>,
      );
      await postInbox(
        sql,
        sub.channel,
        sub.handle,
        "incident-summary",
        `Auto-summary for the ${m.roi_name} incident on ${m.camera_name}`,
        event.summary,
      ).catch((e) => log.warn({ err: e }, "inbox summary post failed"));
    }
    log.info({ incidentId: event.incident_id, count: subscribers.length }, "summary dispatched");
  });

  const server = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "ov-notifier", waiting: waiting.size }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(8002, () => log.info({ port: 8002 }, "notifier ready"));

  const onSignal = async () => {
    log.info("shutting down");
    server.close();
    await redis.quit();
    await sql.end({ timeout: 5 });
    process.exit(0);
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
}

main().catch((e) => {
  log.error({ err: e }, "fatal");
  process.exit(1);
});
