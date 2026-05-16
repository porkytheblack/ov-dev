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

  // Resolve a watchable clip for an incident: prefer the incident's own clip,
  // otherwise fall back to the continuous recording segment that covers the
  // incident's time window for that camera (nearest by start). The clip
  // pipeline may not have produced a dedicated incident clip — but a regular
  // segment almost always covers the moment, so the user can still watch it.
  const clipResolver = sql`
    LEFT JOIN LATERAL (
      SELECT x.storage_key, x.poster_key, x.kind, x.start_ts
        FROM clips x
       WHERE x.camera_id = i.camera_id
         AND (
           x.incident_id = i.id
           OR (
             x.start_ts <= COALESCE(i.closed_at, i.opened_at) + interval '30 seconds'
             AND x.end_ts >= i.opened_at - interval '30 seconds'
           )
         )
       ORDER BY (x.incident_id = i.id) DESC,
                (x.kind = 'incident') DESC,
                abs(extract(epoch FROM (x.start_ts - i.opened_at))) ASC
       LIMIT 1
    ) clip ON true
  `;

  app.get("/", zValidator("query", filterSchema), async (c) => {
    const f = c.req.valid("query");
    const from = f.from ? new Date(f.from) : new Date(Date.now() - 7 * 24 * 3600_000);
    const to = f.to ? new Date(f.to) : new Date();
    const rows = await sql<any[]>`
      SELECT i.id, i.camera_id, c.name AS camera_name, i.roi_id, r.name AS roi_name,
             i.classes, i.opened_at, i.closed_at, i.status, i.summary, i.clip_url,
             i.clip_status, i.summary_status, i.notified_at, i.acknowledged_at,
             clip.storage_key AS clip_storage_key,
             clip.poster_key  AS clip_poster_key,
             clip.kind        AS clip_kind
        FROM incidents i
        JOIN cameras c ON c.id = i.camera_id
        JOIN rois r ON r.id = i.roi_id
        ${clipResolver}
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
      SELECT i.*, c.name AS camera_name, r.name AS roi_name,
             clip.storage_key AS clip_storage_key,
             clip.poster_key  AS clip_poster_key,
             clip.kind        AS clip_kind
        FROM incidents i
        JOIN cameras c ON c.id = i.camera_id
        JOIN rois r ON r.id = i.roi_id
        ${clipResolver}
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
             i.closed_at, i.summary, i.status,
             clip.storage_key AS clip_storage_key,
             clip.poster_key  AS clip_poster_key
        FROM incidents i
        JOIN cameras c ON c.id = i.camera_id
        ${clipResolver}
       WHERE i.id = ${id}::uuid
    `;
    if (!rows[0]) return c.json({ error: "not found" }, 404);
    const r0 = rows[0];
    return c.json({
      incident: r0,
      clip: r0.clip_storage_key
        ? { storage_key: r0.clip_storage_key, poster_key: r0.clip_poster_key }
        : null,
      stream_url: r0.clip_storage_key
        ? `/api/clips/by-key/${encodeURIComponent(r0.clip_storage_key)}`
        : null,
      poster_url: r0.clip_poster_key
        ? `/api/clips/by-key/${encodeURIComponent(r0.clip_poster_key)}`
        : null,
    });
  });

  return app;
}
