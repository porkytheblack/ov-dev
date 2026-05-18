import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { v4 as uuid } from "uuid";
import postgres from "postgres";

const polygonSchema = z.array(
  z.union([
    z.tuple([z.number(), z.number()]),
    z.object({ x: z.number(), y: z.number() }),
  ]),
);

const detectionWindow = z.union([
  z.object({ type: z.literal("always") }),
  z.object({
    type: z.literal("time"),
    start: z.string(),
    end: z.string(),
    tz: z.string(),
    days: z.array(z.number().int().min(0).max(6)),
  }),
]);

const roiInput = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  polygon: polygonSchema,
  // Exclusion zones have no classes/window, so no longer hard-min(1);
  // the POST handler still requires ≥1 class for `include` zones.
  classes_of_interest: z.array(z.string()).default([]),
  match_mode: z.enum(["centroid", "iou"]).default("centroid"),
  detection_window: detectionWindow.optional(),
  linger_threshold_seconds: z.number().int().min(0).max(3600).default(60),
  notify_enabled: z.boolean().default(true),
  kind: z.enum(["include", "exclude"]).default("include"),
});

export function makeRoiRoutes(sql: ReturnType<typeof postgres>) {
  const cameraScoped = new Hono();
  const root = new Hono();

  // Idempotent: ensure the exclusion-zone column exists on already-migrated
  // databases (init.sql covers fresh ones). The engine's RoiCache also
  // ensures it, so whichever boots first wins and the other no-ops.
  void sql`ALTER TABLE rois ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'include'`.catch(
    () => {},
  );

  cameraScoped.get("/", async (c) => {
    const cameraId = c.req.param("id") as string;
    const rows = await sql<any[]>`
      SELECT id, camera_id, name, description, polygon, classes_of_interest,
             match_mode, detection_window, linger_threshold_seconds,
             notify_enabled, kind, created_at
        FROM rois WHERE camera_id = ${cameraId}::uuid ORDER BY created_at
    `;
    return c.json({ rois: rows });
  });

  cameraScoped.post("/", zValidator("json", roiInput), async (c) => {
    const cameraId = c.req.param("id") as string;
    const b = c.req.valid("json");
    if (b.kind !== "exclude" && b.classes_of_interest.length === 0) {
      return c.json({ error: "an include zone needs at least one class" }, 400);
    }
    const id = uuid();
    await sql`
      INSERT INTO rois
        (id, camera_id, name, description, polygon, classes_of_interest,
         match_mode, detection_window, linger_threshold_seconds, notify_enabled, kind)
      VALUES (
        ${id}, ${cameraId}::uuid, ${b.name}, ${b.description ?? ""},
        ${JSON.stringify(b.polygon)}::jsonb,
        ${b.classes_of_interest as unknown as string[]}::text[],
        ${b.match_mode},
        ${JSON.stringify(b.detection_window ?? { type: "always" })}::jsonb,
        ${b.linger_threshold_seconds},
        ${b.notify_enabled},
        ${b.kind}
      )
    `;
    return c.json({ id });
  });

  root.patch("/:id", zValidator("json", roiInput.partial()), async (c) => {
    const id = c.req.param("id");
    const b = c.req.valid("json");
    const name = b.name ?? null;
    const description = b.description ?? null;
    const polygon = b.polygon !== undefined ? JSON.stringify(b.polygon) : null;
    const classes = b.classes_of_interest ?? null;
    const matchMode = b.match_mode ?? null;
    const detWindow = b.detection_window !== undefined ? JSON.stringify(b.detection_window) : null;
    const linger = b.linger_threshold_seconds ?? null;
    const notify = b.notify_enabled ?? null;
    const kind = b.kind ?? null;
    const rows = await sql<any[]>`
      UPDATE rois
         SET name                     = COALESCE(${name}, name),
             description              = COALESCE(${description}, description),
             polygon                  = COALESCE(${polygon}::jsonb, polygon),
             classes_of_interest      = COALESCE(${classes as unknown as string[] | null}::text[], classes_of_interest),
             match_mode               = COALESCE(${matchMode}, match_mode),
             detection_window         = COALESCE(${detWindow}::jsonb, detection_window),
             linger_threshold_seconds = COALESCE(${linger}, linger_threshold_seconds),
             notify_enabled           = COALESCE(${notify}, notify_enabled),
             kind                     = COALESCE(${kind}, kind)
       WHERE id = ${id}::uuid
       RETURNING *
    `;
    if (rows.length === 0) return c.json({ error: "not found" }, 404);
    return c.json({ ok: true, roi: rows[0] });
  });

  root.delete("/:id", async (c) => {
    const id = c.req.param("id");
    await sql`DELETE FROM rois WHERE id = ${id}::uuid`;
    return c.json({ ok: true });
  });

  return { cameraScoped, root };
}
