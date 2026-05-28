/**
 * ov-station — Redis → Station bridge.
 *
 * Execution (signal + broadcast runners, recurring jobs, the v1 HTTP API,
 * the dashboard) lives in the `ov-station-api` container (station-kit,
 * runRunners:true). This process does the one thing station-kit can't: it
 * consumes the Redis `clips` stream and, for incident clips, remotely
 * triggers the `analyze-incident-clip` broadcast through the Station v1 API
 * — the same API-key-authenticated path the dashboard uses.
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import {
  createGroupConsumer,
  makeLogger,
  makeRedis,
  r2Configured,
  type Logger,
} from "@overwatch/shared-ts";
import { visionConfigured, visionProvider } from "@overwatch/ai";
import { ClipReady, CONSUMER_GROUP, FireReview, STREAMS } from "@overwatch/schemas/events";

const log: Logger = makeLogger("ov-station");

const STATION_ENDPOINT = (
  process.env.STATION_ENDPOINT ?? "http://ov-station-api:4400"
).replace(/\/+$/, "");
const STATION_API_KEY = process.env.STATION_API_KEY ?? "";

async function triggerBroadcast(
  broadcastName: string,
  input: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${STATION_ENDPOINT}/api/v1/trigger-broadcast`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${STATION_API_KEY}`,
    },
    body: JSON.stringify({ broadcastName, input }),
  });
  if (!res.ok) {
    throw new Error(`station ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

async function main() {
  const redis = makeRedis();
  const clipConsumer = createGroupConsumer({
    redis,
    stream: STREAMS.clips,
    group: CONSUMER_GROUP("ov-station-clips"),
    consumer: `station-${process.env.HOSTNAME ?? "local"}`,
    schema: ClipReady,
  });
  void clipConsumer.consume(async (event) => {
    if (event.type !== "clip.ready" || event.kind !== "incident" || !event.incident_id) {
      return;
    }
    if (!STATION_API_KEY) {
      log.warn({ incident_id: event.incident_id }, "STATION_API_KEY unset; skipping auto-analysis");
      return;
    }
    try {
      await triggerBroadcast("analyze-incident-clip", {
        incident_id: event.incident_id,
        camera_id: event.camera_id,
        storage_key: event.storage_key,
        poster_key: event.poster_key,
      });
      log.info({ incident_id: event.incident_id }, "vision broadcast triggered (auto)");
    } catch (e) {
      log.error({ err: e, incident_id: event.incident_id }, "auto-trigger failed");
    }
  });

  // Fire below the engine's high-confidence bar: adjudicate with the vision
  // model before alerting. station-kit's v1 API only exposes
  // trigger-broadcast (no trigger-signal), so adjudication is a broadcast.
  const fireConsumer = createGroupConsumer({
    redis,
    stream: STREAMS.fire_review,
    group: CONSUMER_GROUP("ov-station-fire"),
    consumer: `station-${process.env.HOSTNAME ?? "local"}`,
    schema: FireReview,
  });
  void fireConsumer.consume(async (event) => {
    if (event.type !== "fire.review") return;
    if (!STATION_API_KEY) {
      log.warn({ camera_id: event.camera_id }, "STATION_API_KEY unset; skipping fire adjudication");
      return;
    }
    try {
      await triggerBroadcast("adjudicate-fire", {
        camera_id: event.camera_id,
        classes: event.classes,
        frame_key: event.frame_key,
        confidence: event.confidence,
        high_confidence: event.high_confidence,
      });
      log.info({ camera_id: event.camera_id }, "fire adjudication broadcast triggered");
    } catch (e) {
      log.error({ err: e, camera_id: event.camera_id }, "fire adjudication trigger failed");
    }
  });

  const app = new Hono();
  app.get("/health", (c) =>
    c.json({
      ok: true,
      service: "ov-station",
      role: "redis-bridge",
      station_key_configured: STATION_API_KEY !== "",
      vision_provider: visionProvider(),
      vision_configured: visionConfigured(),
      r2_configured: r2Configured(),
    }),
  );
  const port = Number(process.env.STATION_HEALTH_PORT ?? 8005);
  serve({ fetch: app.fetch, port }, () => log.info({ port }, "ov-station bridge ready"));

  const shutdown = async () => {
    log.info("shutting down");
    try {
      await redis.quit();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  log.error({ err: e }, "fatal");
  process.exit(1);
});
