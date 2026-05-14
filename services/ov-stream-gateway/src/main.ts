/**
 * Spawns a mediamtx subprocess (config generated from Postgres) and proxies
 * LL-HLS + WHEP for each enabled camera. Two responsibilities:
 *
 *  1. Auth-gate every read with an Overwatch session by calling
 *     ov-api's /api/auth/me.
 *  2. Reverse-proxy the request body+headers to mediamtx so URLs always stay
 *     on the dashboard origin (Caddy → ov-stream-gateway → mediamtx). The
 *     previous redirect to localhost:8888 broke when the redirect landed in
 *     the browser, which can't reach localhost on this host.
 *
 * URL shape:
 *   /stream/<camera_id>/hls/*  → mediamtx :8888 /cam_<slug>/*
 *   /stream/<camera_id>/whep   → mediamtx :8889 /cam_<slug>/whep
 *
 * mediamtx's HLS playlists use relative URLs (index.m3u8 → video1_stream.m3u8
 * → segments) so as long as the proxy preserves the URL prefix the player
 * never sees the gateway boundary.
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import postgres from "postgres";
import { makeLogger } from "@overwatch/shared-ts";
import { renderMediamtxYml } from "./mediamtx.yml.js";

const log = makeLogger("ov-stream-gateway");
const sql = postgres(
  process.env.DATABASE_URL ?? "postgres://overwatch:overwatch@postgres:5432/overwatch",
  { max: 2 },
);
const API_URL = process.env.API_INTERNAL_URL ?? "http://ov-api:3001";
const MEDIAMTX_HLS = "http://127.0.0.1:8888";
const MEDIAMTX_WEBRTC = "http://127.0.0.1:8889";

async function authCheck(req: Request): Promise<boolean> {
  const cookie = req.headers.get("cookie") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  try {
    const r = await fetch(`${API_URL}/api/auth/me`, {
      headers: { cookie, authorization: auth },
    });
    if (!r.ok) return false;
    const data = (await r.json()) as { user?: unknown };
    return !!data.user;
  } catch {
    return false;
  }
}

async function startMediamtx() {
  try {
    const yml = await renderMediamtxYml(sql);
    writeFileSync("/tmp/mediamtx.yml", yml, "utf8");
    log.info("mediamtx config written");
  } catch (e) {
    log.warn({ err: e }, "could not render mediamtx config");
  }
  const proc = spawn("mediamtx", ["/tmp/mediamtx.yml"], {
    stdio: ["ignore", "inherit", "inherit"],
  });
  proc.on("exit", (code) => log.warn({ code }, "mediamtx exited"));
  return proc;
}

function camPath(cameraId: string): string {
  return `cam_${cameraId.replaceAll("-", "_")}`;
}

async function proxy(target: string, req: Request, publicPrefix: string): Promise<Response> {
  const incoming = new URL(req.url);
  const url = new URL(target);
  url.search = incoming.search;
  const headers = new Headers(req.headers);
  // host:authority must match the upstream, otherwise mediamtx 4xxs.
  headers.set("host", url.host);
  headers.delete("connection");
  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }
  const upstream = await fetch(url.toString(), init);
  const out = new Headers(upstream.headers);
  // Strip headers that Hono/Node will re-emit and that confuse the player when
  // copied verbatim (Transfer-Encoding chunked from upstream can clash with
  // Content-Length).
  out.delete("transfer-encoding");
  out.delete("connection");
  // Rewrite mediamtx's path-absolute redirects (it sends back
  // `/cam_<slug>/index.m3u8?cookieCheck=1` to set a session cookie). Without
  // rewriting, the browser follows /cam_<slug>/... which has no Caddy route
  // and falls back to the dashboard's 404. Map back to the proxy prefix.
  const upstreamPathPrefix = new URL(target).pathname.replace(/[^/]+$/, "");
  const location = upstream.headers.get("location");
  if (location && location.startsWith(upstreamPathPrefix)) {
    const tail = location.slice(upstreamPathPrefix.length);
    out.set("location", publicPrefix + (publicPrefix.endsWith("/") ? "" : "/") + tail);
  }
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, service: "ov-stream-gateway" }));

// Browsers (and hls.js) request OPTIONS preflight on segment fetches when the
// page itself sets non-simple headers. mediamtx's CORS support covers GET but
// we have to answer OPTIONS ourselves before the auth check or it 401s.
app.options("/stream/*", (c) => {
  c.header("access-control-allow-origin", "*");
  c.header("access-control-allow-methods", "GET, POST, OPTIONS, PATCH, DELETE");
  c.header("access-control-allow-headers", "*");
  return c.body(null, 204);
});

// WHEP: POST is the SDP offer, returns SDP answer.
app.all("/stream/:cameraId/whep", async (c) => {
  if (!(await authCheck(c.req.raw))) return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("cameraId");
  return proxy(`${MEDIAMTX_WEBRTC}/${camPath(id)}/whep`, c.req.raw, `/stream/${id}`);
});

// HLS index + every segment/part referenced by it.
app.get("/stream/:cameraId/hls/*", async (c) => {
  if (!(await authCheck(c.req.raw))) return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("cameraId");
  const path = c.req.path.replace(`/stream/${id}/hls`, "") || "/";
  // The dashboard fetches /stream/<id>/hls/index.m3u8 — map to mediamtx's
  // /cam_<slug>/index.m3u8. The master playlist references variant playlists
  // and segments by relative names that resolve back through this same route.
  return proxy(`${MEDIAMTX_HLS}/${camPath(id)}${path}`, c.req.raw, `/stream/${id}/hls`);
});

const proc = await startMediamtx();
const port = Number(process.env.STREAM_GATEWAY_PORT ?? 8989);
serve({ fetch: app.fetch, port }, () => log.info({ port }, "ov-stream-gateway HTTP ready"));

const onSignal = async () => {
  proc.kill("SIGTERM");
  await sql.end({ timeout: 5 });
  process.exit(0);
};
process.on("SIGINT", onSignal);
process.on("SIGTERM", onSignal);
