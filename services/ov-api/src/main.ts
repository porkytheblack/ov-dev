import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import postgres from "postgres";
import { makeLogger } from "@overwatch/shared-ts";
import { requireAuth } from "./middleware.js";
import { makeAuthRoutes } from "./routes/auth.js";
import { makeBotConfigRoutes } from "./routes/bot-configs.js";
import { makeCameraRoutes } from "./routes/cameras.js";
import { makeClipRoutes } from "./routes/clips.js";
import { makeIncidentRoutes } from "./routes/incidents.js";
import { makeRoiRoutes } from "./routes/rois.js";
import { makeSubscriberRoutes } from "./routes/subscribers.js";
import { makeSystemRoutes } from "./routes/system.js";
import { startWs } from "./ws.js";
import { openapiSpec } from "./openapi.js";

const log = makeLogger("ov-api");
const sql = postgres(
  process.env.DATABASE_URL ?? "postgres://overwatch:overwatch@postgres:5432/overwatch",
  { max: 10 },
);

// infra/postgres/init.sql only runs on a fresh data volume. Additive,
// idempotent column adds are applied here so existing deployments pick them
// up on the next restart without a migration runner or manual psql.
async function ensureSchema(): Promise<void> {
  await sql`ALTER TABLE cameras ADD COLUMN IF NOT EXISTS stream_fps REAL`;
}
await ensureSchema().catch((err) =>
  log.error({ err }, "schema bootstrap failed"),
);

const app = new Hono();

app.use("*", cors({ origin: (origin) => origin ?? "*", credentials: true }));

app.get("/health", (c) => c.json({ ok: true, service: "ov-api" }));
app.get("/openapi.json", (c) => c.json(openapiSpec));

const { app: authApp } = makeAuthRoutes(sql);
app.route("/api/auth", authApp);

// Public playback endpoint (signed deep links).
const publicIncidents = makeIncidentRoutes(sql);
app.get("/api/incidents/:id/playback", async (c) => {
  return publicIncidents.fetch(
    new Request(`http://internal${new URL(c.req.url).pathname.replace(/^\/api/, "")}${new URL(c.req.url).search}`, {
      method: c.req.method,
      headers: c.req.raw.headers,
    }),
  );
});

// Public clip-by-key for signed deep-link previews.
const publicClips = makeClipRoutes(sql);
app.get("/api/clips/by-key/:encodedKey", async (c) => {
  return publicClips.fetch(
    new Request(`http://internal/by-key/${c.req.param("encodedKey")}`, {
      method: c.req.method,
    }),
  );
});

const authed = new Hono();
authed.use("*", requireAuth(sql));
authed.route("/cameras", makeCameraRoutes(sql));
const { cameraScoped: roiCameraScoped, root: roiRoot } = makeRoiRoutes(sql);
authed.route("/cameras/:id/rois", roiCameraScoped);
authed.route("/rois", roiRoot);
authed.route("/incidents", makeIncidentRoutes(sql));
authed.route("/clips", makeClipRoutes(sql));
authed.route("/subscribers", makeSubscriberRoutes(sql));
authed.route("/bot-configs", makeBotConfigRoutes(sql));
authed.route("/system", makeSystemRoutes(sql));

app.route("/api", authed);

const port = Number(process.env.API_PORT ?? 3001);
const httpServer = serve({ fetch: app.fetch, port }, () =>
  log.info({ port }, "ov-api ready"),
);

const ws = startWs({ server: httpServer as unknown as import("node:http").Server, sql });

const shutdown = async () => {
  log.info("shutting down");
  await ws.close();
  (httpServer as any).close?.();
  await sql.end({ timeout: 5 });
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
