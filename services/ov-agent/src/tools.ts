import { z } from "zod";
import postgres from "postgres";

export type ToolDeps = {
  sql: ReturnType<typeof postgres>;
};

function resolveRange(start?: string, end?: string): { from: Date; to: Date } {
  const to = end ? new Date(end) : new Date();
  const from = start ? new Date(start) : new Date(to.getTime() - 24 * 3600_000);
  return { from, to };
}

export const search_incidents = (deps: ToolDeps) => ({
  name: "search_incidents",
  description:
    "Search past incidents by time range, camera, classes, or status. " +
    "Time references default to the last 24 hours.",
  inputSchema: z.object({
    time_range: z
      .object({ start: z.string().optional(), end: z.string().optional() })
      .optional(),
    camera_id: z.string().uuid().optional(),
    classes: z.array(z.string()).optional(),
    status: z.enum(["open", "closed", "all"]).default("all"),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  async do(input: any) {
    const { from, to } = resolveRange(input.time_range?.start, input.time_range?.end);
    const rows = await deps.sql<any[]>`
      SELECT i.id, i.camera_id, c.name AS camera_name, i.classes, i.opened_at, i.closed_at,
             i.status, i.summary
        FROM incidents i
        JOIN cameras c ON c.id = i.camera_id
       WHERE i.opened_at BETWEEN ${from} AND ${to}
         ${input.camera_id ? deps.sql`AND i.camera_id = ${input.camera_id}::uuid` : deps.sql``}
         ${input.status !== "all" ? deps.sql`AND i.status = ${input.status}` : deps.sql``}
         ${input.classes && input.classes.length > 0
           ? deps.sql`AND i.classes && ${input.classes as unknown as string[]}::text[]`
           : deps.sql``}
       ORDER BY i.opened_at DESC
       LIMIT ${input.limit}
    `;
    return {
      status: "success" as const,
      data: {
        from: from.toISOString(),
        to: to.toISOString(),
        count: rows.length,
        incidents: rows.map((r: any) => ({
          id: r.id,
          camera: r.camera_name,
          classes: r.classes,
          opened_at: r.opened_at,
          closed_at: r.closed_at,
          status: r.status,
          summary: r.summary,
        })),
      },
    };
  },
});

export const get_incident_details = (deps: ToolDeps) => ({
  name: "get_incident_details",
  description: "Get full details for a specific incident including summary and detections.",
  inputSchema: z.object({ incident_id: z.string().uuid() }),
  async do(input: any) {
    const rows = await deps.sql<any[]>`
      SELECT i.*, c.name AS camera_name, r.name AS roi_name
        FROM incidents i
        JOIN cameras c ON c.id = i.camera_id
        JOIN rois r ON r.id = i.roi_id
       WHERE i.id = ${input.incident_id}::uuid
    `;
    if (rows.length === 0) {
      return { status: "error" as const, data: null, message: "incident not found" };
    }
    const inc = rows[0];
    const det = await deps.sql<any[]>`
      SELECT class, count(*)::int AS count
        FROM detections
       WHERE camera_id = ${inc.camera_id}
         AND ts BETWEEN ${inc.opened_at} AND ${inc.closed_at ?? inc.opened_at}
       GROUP BY class
       ORDER BY count DESC
    `;
    return {
      status: "success" as const,
      data: {
        id: inc.id,
        camera: inc.camera_name,
        roi: inc.roi_name,
        classes: inc.classes,
        opened_at: inc.opened_at,
        closed_at: inc.closed_at,
        status: inc.status,
        summary: inc.summary,
        clip_url: inc.clip_url,
        acknowledged_at: inc.acknowledged_at,
        detection_counts: det,
      },
    };
  },
});

export const get_compound_status = (deps: ToolDeps) => ({
  name: "get_compound_status",
  description:
    "Get current snapshot of the compound: open incidents, cameras online/offline, last activity.",
  inputSchema: z.object({}),
  async do() {
    const cameras = await deps.sql<any[]>`
      SELECT id, name, status, last_frame_at FROM cameras ORDER BY name
    `;
    const open = await deps.sql<any[]>`
      SELECT id, camera_id, classes, opened_at
        FROM incidents
       WHERE status = 'open'
       ORDER BY opened_at DESC
       LIMIT 20
    `;
    return {
      status: "success" as const,
      data: {
        cameras: cameras.map((c: any) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          last_frame_at: c.last_frame_at,
        })),
        open_incidents: open,
      },
    };
  },
});

export const get_camera_context = (deps: ToolDeps) => ({
  name: "get_camera_context",
  description: "Get the user-defined scene description for a camera.",
  inputSchema: z.object({ camera_id: z.string().uuid() }),
  async do(input: any) {
    const rows = await deps.sql<any[]>`
      SELECT id, name, frame_context FROM cameras WHERE id = ${input.camera_id}::uuid
    `;
    if (rows.length === 0) return { status: "error" as const, data: null, message: "camera not found" };
    return { status: "success" as const, data: rows[0] };
  },
});

export const summarize_period = (deps: ToolDeps) => ({
  name: "summarize_period",
  description:
    "Summarize activity across one or all cameras over a time period. " +
    "Returns counts grouped by camera and class.",
  inputSchema: z.object({
    start: z.string().optional(),
    end: z.string().optional(),
    camera_id: z.string().uuid().optional(),
  }),
  async do(input: any) {
    const { from, to } = resolveRange(input.start, input.end);
    const counts = await deps.sql<any[]>`
      SELECT c.name AS camera, unnest(i.classes) AS class, count(*)::int AS count
        FROM incidents i
        JOIN cameras c ON c.id = i.camera_id
       WHERE i.opened_at BETWEEN ${from} AND ${to}
         ${input.camera_id ? deps.sql`AND i.camera_id = ${input.camera_id}::uuid` : deps.sql``}
       GROUP BY c.name, class
       ORDER BY count DESC
    `;
    const total = await deps.sql<any[]>`
      SELECT count(*)::int AS total
        FROM incidents
       WHERE opened_at BETWEEN ${from} AND ${to}
         ${input.camera_id ? deps.sql`AND camera_id = ${input.camera_id}::uuid` : deps.sql``}
    `;
    return {
      status: "success" as const,
      data: {
        from: from.toISOString(),
        to: to.toISOString(),
        total_incidents: total[0]?.total ?? 0,
        by_camera_class: counts,
      },
    };
  },
});

export const acknowledge_incident = (deps: ToolDeps) => ({
  name: "acknowledge_incident",
  description: "Mark an incident as acknowledged.",
  inputSchema: z.object({ incident_id: z.string().uuid() }),
  async do(input: any) {
    await deps.sql`
      UPDATE incidents SET status = 'acknowledged', acknowledged_at = now()
       WHERE id = ${input.incident_id}::uuid
    `;
    return { status: "success" as const, data: { incident_id: input.incident_id, acknowledged: true } };
  },
});

export function buildToolset(deps: ToolDeps) {
  return [
    search_incidents(deps),
    get_incident_details(deps),
    get_compound_status(deps),
    get_camera_context(deps),
    summarize_period(deps),
    acknowledge_incident(deps),
  ];
}
