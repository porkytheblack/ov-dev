import { createHmac } from "node:crypto";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import postgres from "postgres";
import { makeLogger } from "@overwatch/shared-ts";
import { AuthService } from "./auth.js";
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
  await sql`ALTER TABLE cameras ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''`;
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
  // Strip `/api/incidents` (not just `/api`): the standalone publicIncidents
  // app's routes are root-relative (`/:id/playback`), so forwarding
  // `/incidents/:id/playback` never matched → 404 ("Access denied").
  return publicIncidents.fetch(
    new Request(`http://internal${new URL(c.req.url).pathname.replace(/^\/api\/incidents/, "")}${new URL(c.req.url).search}`, {
      method: c.req.method,
      headers: c.req.raw.headers,
    }),
  );
});

// On-demand, segment-built incident footage. Public (like clip-by-key) so
// the bot service can fetch a clip even when ov-clip-builder hasn't
// produced one — guarantees "send me a clip" works for any incident with
// recording, independent of the clip pipeline.
app.get("/api/incidents/:id/footage", async (c) => {
  return publicIncidents.fetch(
    new Request(`http://internal${new URL(c.req.url).pathname.replace(/^\/api\/incidents/, "")}${new URL(c.req.url).search}`, {
      method: c.req.method,
      headers: c.req.raw.headers,
    }),
  );
});

// Public clip-by-key for signed deep-link previews.
const publicClips = makeClipRoutes(sql);
app.get("/api/clips/by-key/:rest{.+}", async (c) => {
  // Forward the raw (still-encoded) sub-path so the inner wildcard route and
  // its param-decoding stay consistent end to end.
  const url = new URL(c.req.url);
  const sub = url.pathname.replace(/^\/api\/clips/, "");
  return publicClips.fetch(
    new Request(`http://internal${sub}${url.search}`, {
      method: c.req.method,
      headers: c.req.raw.headers, // forward Range/If-Range for <video> seeking
    }),
  );
});

// Public "calendar portal" for the recap deep links. Verifies the
// HMAC-signed token (mirrors signCalendarLink in ov-station), mints a
// dashboard session for the operator, and 302s into the calendar day view
// — so a recap recipient taps once on mobile and is straight in, no login.
function verifyCalendarLink(
  token: string,
): { ok: true; date: string; cameraId?: string; exp: number } | { ok: false } {
  try {
    const parts = Buffer.from(token, "base64url").toString("utf8").split("|");
    if (parts.length !== 5 || parts[0] !== "cal") return { ok: false };
    const [, date, cam, expStr, sig] = parts as [string, string, string, string, string];
    const secret = process.env.DEEP_LINK_TOKEN_SECRET ?? "change-me";
    const expected = createHmac("sha256", secret)
      .update(`cal|${date}|${cam}|${expStr}`)
      .digest("hex");
    if (sig.length !== expected.length || sig !== expected) return { ok: false };
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp < Date.now()) return { ok: false };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false };
    return { ok: true, date, cameraId: cam && cam !== "*" ? cam : undefined, exp };
  } catch {
    return { ok: false };
  }
}

const portalAuth = new AuthService(sql);
app.get("/api/portal", async (c) => {
  const v = verifyCalendarLink(c.req.query("token") ?? "");
  if (!v.ok) return c.redirect("/login", 302);
  const u = await sql<Array<{ id: string }>>`
    SELECT id FROM users ORDER BY created_at ASC LIMIT 1
  `;
  if (!u[0]) return c.redirect("/login", 302);
  const sess = await portalAuth.createSession(u[0].id);
  setCookie(c, "ov_session", sess.id, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    // Cookie dies with the link (≈token TTL), not the 30-day DB session —
    // limits the blast radius of a leaked recap link.
    expires: new Date(Math.min(v.exp, sess.expiresAt.getTime())),
  });
  const q = v.cameraId ? `?camera=${encodeURIComponent(v.cameraId)}` : "";
  return c.redirect(`/calendar/${v.date}${q}`, 302);
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
