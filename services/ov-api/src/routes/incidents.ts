import { Hono } from "hono";
import postgres from "postgres";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { verifyDeepLink } from "../deep-link.js";

const filterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  camera_id: z.string().uuid().optional(),
  status: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export function makeIncidentRoutes(sql: ReturnType<typeof postgres>) {
  const app = new Hono();

  app.get("/", zValidator("query", filterSchema), async (c) => {
    const f = c.req.valid("query");
    const from = f.from ? new Date(f.from) : new Date(Date.now() - 7 * 24 * 3600_000);
    const to = f.to ? new Date(f.to) : new Date();
    const rows = await sql<any[]>`
      SELECT i.id, i.camera_id, c.name AS camera_name, i.roi_id, r.name AS roi_name,
             i.classes, i.opened_at, i.closed_at, i.status, i.summary, i.clip_url,
             i.clip_status, i.summary_status, i.notified_at, i.acknowledged_at
        FROM incidents i
        JOIN cameras c ON c.id = i.camera_id
        JOIN rois r ON r.id = i.roi_id
       WHERE i.opened_at BETWEEN ${from} AND ${to}
         ${f.camera_id ? sql`AND i.camera_id = ${f.camera_id}::uuid` : sql``}
         ${f.status ? sql`AND i.status = ${f.status}` : sql``}
       ORDER BY i.opened_at DESC
       LIMIT ${f.limit}
    `;
    return c.json({ incidents: rows });
  });

  app.get("/:id", async (c) => {
    const id = c.req.param("id");
    const rows = await sql<any[]>`
      SELECT i.*, c.name AS camera_name, r.name AS roi_name
        FROM incidents i
        JOIN cameras c ON c.id = i.camera_id
        JOIN rois r ON r.id = i.roi_id
       WHERE i.id = ${id}::uuid
    `;
    if (!rows[0]) return c.json({ error: "not found" }, 404);
    const clipRows = await sql<any[]>`
      SELECT id, kind, start_ts, end_ts, storage_key, poster_key
        FROM clips WHERE incident_id = ${id}::uuid ORDER BY start_ts
    `;
    return c.json({ ...rows[0], clips: clipRows });
  });

  app.post("/:id/acknowledge", async (c) => {
    const id = c.req.param("id");
    await sql`
      UPDATE incidents SET status = 'acknowledged', acknowledged_at = now()
       WHERE id = ${id}::uuid
    `;
    return c.json({ ok: true });
  });

  app.get("/:id/playback", async (c) => {
    const id = c.req.param("id");
    const token = c.req.query("token");
    if (!token) return c.json({ error: "token required" }, 401);
    const secret = process.env.DEEP_LINK_TOKEN_SECRET ?? "change-me";
    const v = verifyDeepLink({ incidentId: id, token, secret });
    if (!v.ok) return c.json({ error: v.reason }, 401);
    const rows = await sql<any[]>`
      SELECT i.id, i.camera_id, c.name AS camera_name, i.classes, i.opened_at,
             i.closed_at, i.summary, i.status
        FROM incidents i
        JOIN cameras c ON c.id = i.camera_id
       WHERE i.id = ${id}::uuid
    `;
    if (!rows[0]) return c.json({ error: "not found" }, 404);
    const clip = await sql<any[]>`
      SELECT id, storage_key, poster_key FROM clips
       WHERE incident_id = ${id}::uuid AND kind = 'incident'
       ORDER BY start_ts DESC LIMIT 1
    `;
    return c.json({
      incident: rows[0],
      clip: clip[0] ?? null,
      stream_url: clip[0]
        ? `/api/clips/by-key/${encodeURIComponent(clip[0].storage_key)}`
        : null,
      poster_url: clip[0]?.poster_key
        ? `/api/clips/by-key/${encodeURIComponent(clip[0].poster_key)}`
        : null,
    });
  });

  return app;
}
