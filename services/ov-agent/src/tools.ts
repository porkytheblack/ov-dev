import { z } from "zod";
import postgres from "postgres";
import { humanWhen, publishEvent, type makeRedis } from "@overwatch/shared-ts";
import { STREAMS } from "@overwatch/schemas/events";
import { signDeepLink } from "./deep-link.js";

export type ToolDeps = {
  sql: ReturnType<typeof postgres>;
  /** Channel the request arrived on; gates channel-specific tools. */
  channel?: string;
  /** Messenger handle (e.g. Telegram chat id) for outbound media. */
  handle?: string;
  redis?: ReturnType<typeof makeRedis>;
  /** Public base URL Telegram can fetch clips from (Caddy → ov-api). */
  dashboardBaseUrl?: string;
  /** Internal ov-api base (docker network) the bot service fetches clips
   *  from to upload them to the messenger as files. */
  internalApiUrl?: string;
};

function resolveRange(start?: string, end?: string): { from: Date; to: Date } {
  const to = end ? new Date(end) : new Date();
  const from = start ? new Date(start) : new Date(to.getTime() - 24 * 3600_000);
  return { from, to };
}

/** IANA timezone the operator lives in (e.g. "Africa/Nairobi"). */
export const OV_TIMEZONE = process.env.OV_TIMEZONE || process.env.TZ || "UTC";

/** Current instant described in the operator's timezone. */
export function tzNow(tz: string = OV_TIMEZONE) {
  const now = new Date();
  return {
    timezone: tz,
    iso_utc: now.toISOString(),
    local: now.toLocaleString("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  };
}

/** tz offset (ms) relative to UTC, sampled now (DST edges approximate). */
function tzOffsetMs(tz: string): number {
  const d = new Date();
  const utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  const loc = new Date(d.toLocaleString("en-US", { timeZone: tz }));
  return loc.getTime() - utc.getTime();
}

/** UTC [from,to) for a calendar day given as YYYY-MM-DD in `tz` (default: today). */
function tzDayRangeUtc(date: string | undefined, tz: string = OV_TIMEZONE): { from: Date; to: Date; day: string } {
  const off = tzOffsetMs(tz);
  const day =
    date ??
    new Date(Date.now() + off).toISOString().slice(0, 10); // today's date in tz
  const startUtcMs = Date.parse(`${day}T00:00:00.000Z`) - off;
  return { from: new Date(startUtcMs), to: new Date(startUtcMs + 24 * 3600_000), day };
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
    status: z
      .enum(["open", "acknowledged", "suppressed", "closed", "all"])
      .default("all"),
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
  description: "Get full details for a specific incident: camera, zone, detected classes, status, and summary.",
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

export const get_current_time = (_deps: ToolDeps) => ({
  name: "get_current_time",
  description:
    "Get the current date and time in the operator's configured timezone. " +
    "Use this to resolve relative time references like \"now\", \"today\", " +
    "\"this morning\", or \"the last hour\".",
  inputSchema: z.object({}),
  async do() {
    return { status: "success" as const, data: tzNow() };
  },
});

export const set_incident_status = (deps: ToolDeps) => ({
  name: "set_incident_status",
  description:
    "Change an incident's status. Valid values: open, acknowledged, " +
    "suppressed, closed. Use 'acknowledged' when the operator has seen it, " +
    "'suppressed' for a false alarm, 'closed' when resolved.",
  inputSchema: z.object({
    incident_id: z.string().uuid(),
    status: z.enum(["open", "acknowledged", "suppressed", "closed"]),
  }),
  async do(input: any) {
    const rows = await deps.sql<any[]>`
      UPDATE incidents
         SET status = ${input.status},
             acknowledged_at = CASE WHEN ${input.status} = 'acknowledged'
                                    THEN now() ELSE acknowledged_at END,
             closed_at = CASE WHEN ${input.status} = 'closed' AND closed_at IS NULL
                              THEN now() ELSE closed_at END
       WHERE id = ${input.incident_id}::uuid
       RETURNING id, status
    `;
    if (rows.length === 0) {
      return { status: "error" as const, data: null, message: "incident not found" };
    }
    return { status: "success" as const, data: rows[0] };
  },
});

export const summarize_day = (deps: ToolDeps) => ({
  name: "summarize_day",
  description:
    "Compile what happened on a given day from the incident record — no " +
    "video re-analysis. Returns each incident (time, camera, zone, detected " +
    "classes, status, and any existing summary) so you can narrate the " +
    "day's activity. Date is YYYY-MM-DD in the operator's timezone; omit " +
    "for today.",
  inputSchema: z.object({ date: z.string().optional() }),
  async do(input: any) {
    const { from, to, day } = tzDayRangeUtc(input.date);
    const incidents = await deps.sql<any[]>`
      SELECT i.id, c.name AS camera, r.name AS zone, i.classes, i.status,
             i.opened_at, i.closed_at, i.summary
        FROM incidents i
        JOIN cameras c ON c.id = i.camera_id
        JOIN rois r ON r.id = i.roi_id
       WHERE i.opened_at >= ${from} AND i.opened_at < ${to}
       ORDER BY i.opened_at DESC
    `;
    return {
      status: "success" as const,
      data: {
        day,
        timezone: OV_TIMEZONE,
        incident_count: incidents.length,
        incidents: incidents.map((r: any) => ({
          id: r.id,
          camera: r.camera,
          zone: r.zone,
          classes: r.classes,
          status: r.status,
          opened_at: r.opened_at,
          closed_at: r.closed_at,
          summary: r.summary ?? null,
        })),
      },
    };
  },
});

// ── Messenger tools (registered for telegram + whatsapp channels) ────────

const CLIP_RESOLVER = (sql: ReturnType<typeof postgres>) => sql`
  LEFT JOIN LATERAL (
    SELECT x.storage_key
      FROM clips x
     WHERE x.camera_id = i.camera_id
       AND (
         x.incident_id = i.id
         OR (x.start_ts <= COALESCE(i.closed_at, i.opened_at) + interval '30 seconds'
             AND x.end_ts >= i.opened_at - interval '30 seconds')
       )
     ORDER BY (x.incident_id = i.id) DESC, (x.kind = 'incident') DESC,
              abs(extract(epoch FROM (x.start_ts - i.opened_at))) ASC
     LIMIT 1
  ) clip ON true
`;

export const send_incident_clips = (deps: ToolDeps) => ({
  name: "send_incident_clips",
  description:
    "Send the actual video clip(s) for one or more incidents to the user " +
    "on Telegram (e.g. when they say \"show me\"). Pass explicit " +
    "incident_ids, or a time range / camera to pick recent ones. Sends up " +
    "to 10 videos. Use this instead of describing the clip when the user " +
    "wants to see it.",
  inputSchema: z.object({
    incident_ids: z.array(z.string().uuid()).optional(),
    time_range: z
      .object({ start: z.string().optional(), end: z.string().optional() })
      .optional(),
    camera_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(10).default(3),
  }),
  async do(input: any) {
    if (!deps.redis || !deps.handle) {
      return { status: "error" as const, data: null, message: "messenger channel unavailable" };
    }
    // Internal ov-api URL: the bot service fetches the clip over the docker
    // network and uploads the file to Telegram (Telegram can't reach an
    // internal/localhost URL itself).
    const base = (deps.internalApiUrl ?? "http://ov-api:3001").replace(/\/+$/, "");
    const ids: string[] | undefined = input.incident_ids;
    let rows: any[];
    if (ids && ids.length > 0) {
      rows = await deps.sql<any[]>`
        SELECT i.id, c.name AS camera, i.opened_at, clip.storage_key
          FROM incidents i
          JOIN cameras c ON c.id = i.camera_id
          ${CLIP_RESOLVER(deps.sql)}
         WHERE i.id = ANY(${ids}::uuid[])
         ORDER BY i.opened_at DESC
         LIMIT ${input.limit}
      `;
    } else {
      const { from, to } = resolveRange(input.time_range?.start, input.time_range?.end);
      rows = await deps.sql<any[]>`
        SELECT i.id, c.name AS camera, i.opened_at, clip.storage_key
          FROM incidents i
          JOIN cameras c ON c.id = i.camera_id
          ${CLIP_RESOLVER(deps.sql)}
         WHERE i.opened_at BETWEEN ${from} AND ${to}
           ${input.camera_id ? deps.sql`AND i.camera_id = ${input.camera_id}::uuid` : deps.sql``}
         ORDER BY i.opened_at DESC
         LIMIT ${input.limit}
      `;
    }
    // Prefer the clip-builder clip; otherwise fall back to on-demand
    // footage built from raw recording segments (works even if the clip
    // pipeline is behind — ov-api builds & caches it on fetch).
    const attachments = rows.map((r) => ({
      kind: "video" as const,
      url: r.storage_key
        ? `${base}/api/clips/by-key/${encodeURIComponent(r.storage_key)}`
        : `${base}/api/incidents/${r.id}/footage`,
      caption: `${r.camera} · ${humanWhen(r.opened_at, OV_TIMEZONE)}`,
    }));
    if (attachments.length === 0) {
      return {
        status: "success" as const,
        data: { sent: 0, note: "No incidents matched the request." },
      };
    }
    // Surface the working playback page as an inline button (never as a raw
    // URL in the message) for the primary incident.
    const primaryId: string | undefined = rows[0]?.id;
    const outAttachments: Array<Record<string, unknown>> = [...attachments];
    if (primaryId) {
      outAttachments.push({
        kind: "link",
        url: signDeepLink(primaryId),
        caption: "View playback",
      });
    }
    const ch = deps.channel === "whatsapp" ? "whatsapp" : "telegram";
    await publishEvent(deps.redis, STREAMS.bot_outbox(ch), {
      type: "bot.outbox",
      channel: ch,
      handle: deps.handle,
      text: attachments.length === 1 ? "Here's the clip:" : `Here are ${attachments.length} clips:`,
      attachments: outAttachments,
      incident_id: primaryId,
    } as Record<string, unknown>);
    return {
      status: "success" as const,
      data: { sent: attachments.length, note: "Clip(s) are being delivered to the chat." },
    };
  },
});

export const send_action_buttons = (deps: ToolDeps) => ({
  name: "send_action_buttons",
  description:
    "Show the user tappable buttons to act on an incident " +
    "(Acknowledge / Suppress / Close, plus a playback link). Use when the " +
    "user may want to take action on a specific incident.",
  inputSchema: z.object({
    incident_id: z.string().uuid(),
    text: z.string().optional(),
  }),
  async do(input: any) {
    if (!deps.redis || !deps.handle) {
      return { status: "error" as const, data: null, message: "messenger channel unavailable" };
    }
    const ch = deps.channel === "whatsapp" ? "whatsapp" : "telegram";
    await publishEvent(deps.redis, STREAMS.bot_outbox(ch), {
      type: "bot.outbox",
      channel: ch,
      handle: deps.handle,
      text: input.text ?? "Choose an action for this incident:",
      attachments: [
        { kind: "link", url: signDeepLink(input.incident_id), caption: "View playback" },
      ],
      incident_id: input.incident_id,
    } as Record<string, unknown>);
    return { status: "success" as const, data: { ok: true } };
  },
});

export function buildToolset(deps: ToolDeps) {
  const messengerTools =
    (deps.channel === "telegram" || deps.channel === "whatsapp") && deps.redis
      ? [send_incident_clips(deps), send_action_buttons(deps)]
      : [];
  return [
    ...messengerTools,
    get_current_time(deps),
    search_incidents(deps),
    get_incident_details(deps),
    get_compound_status(deps),
    get_camera_context(deps),
    summarize_period(deps),
    summarize_day(deps),
    set_incident_status(deps),
    acknowledge_incident(deps),
  ];
}
