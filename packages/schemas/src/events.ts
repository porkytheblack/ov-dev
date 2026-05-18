import { z } from "zod";

export const Bbox = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});
export type Bbox = z.infer<typeof Bbox>;

export const Detection = z.object({
  class: z.string(),
  confidence: z.number().min(0).max(1),
  bbox: Bbox,
  track_id: z.string().optional(),
});
export type Detection = z.infer<typeof Detection>;

export const FrameSampled = z.object({
  type: z.literal("frame.sampled"),
  camera_id: z.string().uuid(),
  ts: z.string().datetime({ offset: true }),
  frame_id: z.string(),
  storage_key: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
});
export type FrameSampled = z.infer<typeof FrameSampled>;

export const FrameDetections = z.object({
  type: z.literal("frame.detections"),
  camera_id: z.string().uuid(),
  ts: z.string().datetime({ offset: true }),
  frame_id: z.string(),
  detections: z.array(Detection),
});
export type FrameDetections = z.infer<typeof FrameDetections>;

export const SegmentReady = z.object({
  type: z.literal("segment.ready"),
  camera_id: z.string().uuid(),
  segment_id: z.string().uuid(),
  start_ts: z.string().datetime({ offset: true }),
  end_ts: z.string().datetime({ offset: true }),
  storage_key: z.string(),
  duration_ms: z.number(),
  size_bytes: z.number(),
});
export type SegmentReady = z.infer<typeof SegmentReady>;

export const IncidentOpened = z.object({
  type: z.literal("incident.opened"),
  incident_id: z.string().uuid(),
  camera_id: z.string().uuid(),
  roi_id: z.string().uuid(),
  classes: z.array(z.string()),
  opened_at: z.string().datetime({ offset: true }),
  track_id: z.string().optional(),
});
export type IncidentOpened = z.infer<typeof IncidentOpened>;

export const IncidentClosed = z.object({
  type: z.literal("incident.closed"),
  incident_id: z.string().uuid(),
  closed_at: z.string().datetime({ offset: true }),
  duration_ms: z.number(),
});
export type IncidentClosed = z.infer<typeof IncidentClosed>;

export const ClipReady = z.object({
  type: z.literal("clip.ready"),
  clip_id: z.string().uuid(),
  incident_id: z.string().uuid().optional(),
  camera_id: z.string().uuid(),
  kind: z.enum(["incident", "regular"]),
  storage_key: z.string(),
  poster_key: z.string().optional(),
  start_ts: z.string().datetime({ offset: true }),
  end_ts: z.string().datetime({ offset: true }),
});
export type ClipReady = z.infer<typeof ClipReady>;

export const SummaryReady = z.object({
  type: z.literal("summary.ready"),
  incident_id: z.string().uuid(),
  summary: z.string(),
});
export type SummaryReady = z.infer<typeof SummaryReady>;

export const CameraStatusChanged = z.object({
  type: z.literal("camera.status_changed"),
  camera_id: z.string().uuid(),
  status: z.enum(["connecting", "online", "offline"]),
  ts: z.string().datetime({ offset: true }),
});
export type CameraStatusChanged = z.infer<typeof CameraStatusChanged>;

export const BotOutboxMessage = z.object({
  type: z.literal("bot.outbox"),
  channel: z.enum(["whatsapp", "telegram"]),
  handle: z.string(),
  text: z.string(),
  attachments: z
    .array(
      z.object({
        kind: z.enum(["link", "image", "video"]),
        url: z.string(),
        caption: z.string().optional(),
      }),
    )
    .optional(),
  incident_id: z.string().uuid().optional(),
  // Carry `incident_id` for message↔incident tracking (so resolving the
  // incident can clean up every related message) WITHOUT rendering the
  // action keyboard — e.g. the follow-up summary.
  suppress_actions: z.boolean().optional(),
  // Arbitrary URL buttons rendered as an inline keyboard (e.g. the recap's
  // "open the calendar" deep links). Telegram-only; ignored on WhatsApp.
  buttons: z
    .array(z.object({ text: z.string(), url: z.string() }))
    .optional(),
  // Telegram-only: edit the existing tracked message for `incident_id` in
  // place (caption/text) instead of sending a new one — e.g. the summary
  // filling into the original clip alert. Ignored where unsupported
  // (WhatsApp has no edit API → it still gets a follow-up).
  edit: z.boolean().optional(),
});
export type BotOutboxMessage = z.infer<typeof BotOutboxMessage>;

export const STREAMS = {
  frames: (cameraId: string) => `frames.${cameraId}`,
  detections: (cameraId: string) => `detections.${cameraId}`,
  segments: "segments",
  incidents: "incidents",
  clips: "clips",
  summaries: "summaries",
  camera_status: "camera_status",
  bot_outbox: (channel: "whatsapp" | "telegram") => `bot_outbox.${channel}`,
} as const;

export const CONSUMER_GROUP = (service: string) => `cg.${service}`;
