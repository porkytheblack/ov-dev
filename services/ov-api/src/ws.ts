/**
 * WS /events stream. Fans out per-camera detection events + incident lifecycle
 * + camera-status events from Redis Streams. The dashboard subscribes here for
 * the live-view bbox overlay and the activity timeline.
 */
import type { IncomingMessage } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { makeLogger, makeRedis } from "@overwatch/shared-ts";
import {
  CameraStatusChanged,
  FrameDetections,
  IncidentClosed,
  IncidentOpened,
  STREAMS,
} from "@overwatch/schemas/events";
import postgres from "postgres";
import { AuthService } from "./auth.js";

const log = makeLogger("ov-api-ws");
const cameraConsumers = new Map<string, AbortController>();
const clients = new Set<WebSocket>();

function send(ws: WebSocket, type: string, data: unknown) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify({ type, data }));
}

async function consumeStream(
  redis: ReturnType<typeof makeRedis>,
  stream: string,
  group: string,
  signal: AbortSignal,
  onEvent: (event: Record<string, unknown>) => void,
) {
  await redis.xgroup("CREATE", stream, group, "$", "MKSTREAM").catch((e) => {
    if (!String(e?.message ?? "").includes("BUSYGROUP")) throw e;
  });
  const consumer = `api-${process.env.HOSTNAME ?? "local"}`;
  while (!signal.aborted) {
    try {
      const res = (await redis.xreadgroup(
        "GROUP",
        group,
        consumer,
        "COUNT",
        "32",
        "BLOCK",
        "5000",
        "STREAMS",
        stream,
        ">",
      )) as Array<[string, Array<[string, string[]]>]> | null;
      if (!res) continue;
      for (const [, messages] of res) {
        for (const [id, fields] of messages) {
          const obj: Record<string, unknown> = {};
          for (let i = 0; i < fields.length; i += 2) {
            const k = fields[i]!;
            const v = fields[i + 1]!;
            obj[k] = v.startsWith("{") || v.startsWith("[") ? safeParse(v) : v;
          }
          onEvent(obj);
          await redis.xack(stream, group, id);
        }
      }
    } catch (e) {
      if (signal.aborted) return;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

async function spawnCameraConsumer(redis: ReturnType<typeof makeRedis>, cameraId: string) {
  if (cameraConsumers.has(cameraId)) return;
  const ac = new AbortController();
  cameraConsumers.set(cameraId, ac);
  void consumeStream(redis, STREAMS.detections(cameraId), `cg.ov-api-detections-${cameraId.slice(0, 8)}`, ac.signal, (event) => {
    for (const ws of clients) send(ws, "frame.detections", { ...event, camera_id: cameraId });
  });
}

export function startWs(args: {
  server: import("node:http").Server;
  sql: ReturnType<typeof postgres>;
}) {
  const wss = new WebSocketServer({ noServer: true });
  const redis = makeRedis();
  const auth = new AuthService(args.sql);

  // Reconcile camera consumers periodically.
  setInterval(async () => {
    const rows = await args.sql<{ id: string }[]>`SELECT id FROM cameras WHERE enabled = true`;
    for (const r of rows) await spawnCameraConsumer(redis, r.id);
  }, 30_000).unref();

  // Global streams: incidents + camera_status.
  const incidentAC = new AbortController();
  const statusAC = new AbortController();
  void consumeStream(redis, STREAMS.incidents, "cg.ov-api-incidents", incidentAC.signal, (event) => {
    const type = (event as any).type;
    if (type === "incident.opened" || type === "incident.closed") {
      for (const ws of clients) send(ws, type, event);
    }
  });
  void consumeStream(redis, STREAMS.camera_status, "cg.ov-api-camstatus", statusAC.signal, (event) => {
    for (const ws of clients) send(ws, "camera.status_changed", event);
  });

  args.server.on("upgrade", async (req: IncomingMessage, socket, head) => {
    if (!req.url?.startsWith("/events")) {
      socket.destroy();
      return;
    }
    const cookieHeader = req.headers.cookie ?? "";
    const sessionMatch = /(?:^|;\s*)ov_session=([^;]+)/.exec(cookieHeader);
    const sessionId =
      sessionMatch?.[1] ?? (req.headers.authorization ?? "").replace(/^bearer\s+/i, "");
    const user = sessionId ? await auth.getUserBySession(sessionId) : null;
    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      clients.add(ws);
      log.info({ user: user.username }, "ws connected");
      send(ws, "hello", { user });
      ws.on("close", () => {
        clients.delete(ws);
      });
    });
  });

  return {
    close: async () => {
      incidentAC.abort();
      statusAC.abort();
      for (const ac of cameraConsumers.values()) ac.abort();
      wss.close();
      await redis.quit();
    },
  };
}
