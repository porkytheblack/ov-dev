/**
 * Spawns a mediamtx subprocess with a generated config and proxies WebRTC + HLS
 * for each enabled camera. The HTTP wrapper authenticates the upgrade against
 * an Overwatch session by hitting ov-api's /api/auth/me, and rewrites paths
 * under /stream/{camera_id} → mediamtx's WebRTC endpoint.
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

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, service: "ov-stream-gateway" }));

app.get("/stream/:cameraId/whep", async (c) => {
  if (!(await authCheck(c.req.raw))) return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("cameraId");
  return Response.redirect(`http://localhost:8889/${camPath(id)}/whep`, 307);
});

app.get("/stream/:cameraId/hls/playlist.m3u8", async (c) => {
  if (!(await authCheck(c.req.raw))) return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("cameraId");
  return Response.redirect(`http://localhost:8888/${camPath(id)}/index.m3u8`, 307);
});

const proc = await startMediamtx();
const port = Number(process.env.STREAM_GATEWAY_PORT ?? 8889);
serve({ fetch: app.fetch, port: port + 100 }, () =>
  log.info({ port: port + 100 }, "ov-stream-gateway HTTP ready"),
);

const onSignal = async () => {
  proc.kill("SIGTERM");
  await sql.end({ timeout: 5 });
  process.exit(0);
};
process.on("SIGINT", onSignal);
process.on("SIGTERM", onSignal);
