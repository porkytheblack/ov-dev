import { createServer } from "node:http";
import {
  ClipReady,
  CONSUMER_GROUP,
  IncidentOpened,
  STREAMS,
} from "@overwatch/schemas/events";
import {
  createGroupConsumer,
  makeLogger,
  makeRedis,
  publishEvent,
} from "@overwatch/shared-ts";
import postgres from "postgres";
import { signDeepLink } from "./deep-link.js";

const log = makeLogger("ov-notifier");
const CLIP_WAIT_MS = (Number(process.env.CLIP_WAIT_TIMEOUT_SECONDS ?? 120) || 120) * 1000;

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
  const base = (process.env.DASHBOARD_BASE_URL ?? "http://localhost").replace(/\/+$/, "");
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
  deepLink: string;
}) {
  const opened = new Date(args.openedAt);
  const rel = (() => {
    const seconds = Math.max(1, Math.round((Date.now() - opened.getTime()) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
    return `${Math.round(seconds / 3600)}h ago`;
  })();
  const summary = args.summary ?? "Generating summary…";
  return (
    `[OVERWATCH] Incident · ${args.cameraName}\n` +
    `${args.classes.join(", ")} detected in ${args.roiName}\n` +
    `Started ${rel}\n` +
    `${summary}\n\n` +
    `Playback → ${args.deepLink}`
  );
}

async function dispatch(
  redis: ReturnType<typeof makeRedis>,
  sql: ReturnType<typeof postgres>,
  pending: PendingNotification,
) {
  const meta = await fetchIncidentMeta(sql, pending.incidentId);
  if (!meta) return;
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
    await sql`UPDATE incidents SET notified_at = now() WHERE id = ${pending.incidentId}::uuid`;
    return;
  }
  const body = formatBody({
    cameraName: meta.cameraName,
    roiName: meta.roiName,
    classes: pending.classes,
    openedAt: pending.openedAt,
    summary: meta.summary,
    deepLink: link.url,
  });
  for (const sub of subscribers) {
    const stream = STREAMS.bot_outbox(sub.channel);
    const payload = {
      type: "bot.outbox",
      channel: sub.channel,
      handle: sub.handle,
      text: body,
      attachments: pending.clipUrl
        ? [{ kind: "video", url: pending.clipUrl, caption: meta.cameraName }]
        : undefined,
      incident_id: pending.incidentId,
    };
    await publishEvent(redis, stream, payload as Record<string, unknown>);
  }
  await sql`UPDATE incidents SET notified_at = now() WHERE id = ${pending.incidentId}::uuid`;
  log.info({ incidentId: pending.incidentId, count: subscribers.length }, "dispatched");
}

async function main() {
  const redis = makeRedis();
  const sql = postgres(
    process.env.DATABASE_URL ?? "postgres://overwatch:overwatch@postgres:5432/overwatch",
    { max: 4 },
  );

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
    const pending = waiting.get(event.incident_id);
    if (!pending) return;
    const urls = makeAttachmentUrls({ clipKey: event.storage_key, posterKey: event.poster_key });
    pending.clipUrl = urls.clipUrl;
    pending.posterUrl = urls.posterUrl;
    await dispatch(redis, sql, pending);
    waiting.delete(event.incident_id);
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
