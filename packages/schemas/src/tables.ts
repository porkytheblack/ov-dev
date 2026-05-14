import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  bigint,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("operator"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const cameras = pgTable("cameras", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  rtspUrl: text("rtsp_url").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  frameWidth: integer("frame_width"),
  frameHeight: integer("frame_height"),
  frameContext: jsonb("frame_context").notNull().default(sql`'{}'::jsonb`),
  vlmEnabled: boolean("vlm_enabled").notNull().default(false),
  sampleFps: integer("sample_fps").notNull().default(5),
  status: text("status").notNull().default("connecting"),
  lastFrameAt: timestamp("last_frame_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rois = pgTable("rois", {
  id: uuid("id").primaryKey(),
  cameraId: uuid("camera_id")
    .notNull()
    .references(() => cameras.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  polygon: jsonb("polygon").notNull(),
  classesOfInterest: text("classes_of_interest").array().notNull(),
  matchMode: text("match_mode").notNull().default("centroid"),
  detectionWindow: jsonb("detection_window").notNull().default(sql`'{"type":"always"}'::jsonb`),
  lingerThresholdSeconds: integer("linger_threshold_seconds").notNull().default(60),
  notifyEnabled: boolean("notify_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const detections = pgTable(
  "detections",
  {
    id: uuid("id").notNull(),
    cameraId: uuid("camera_id").notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    frameId: text("frame_id").notNull(),
    class: text("class").notNull(),
    confidence: real("confidence").notNull(),
    bbox: jsonb("bbox").notNull(),
    trackId: text("track_id"),
  },
  (t) => ({
    cameraTsIdx: index("idx_detections_camera_ts").on(t.cameraId, t.ts),
    trackIdx: index("idx_detections_track").on(t.trackId),
  }),
);

export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey(),
    cameraId: uuid("camera_id")
      .notNull()
      .references(() => cameras.id),
    roiId: uuid("roi_id")
      .notNull()
      .references(() => rois.id),
    trackId: text("track_id"),
    classes: text("classes").array().notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    status: text("status").notNull().default("open"),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    clipUrl: text("clip_url"),
    clipStatus: text("clip_status").notNull().default("pending"),
    summary: text("summary"),
    summaryStatus: text("summary_status").notNull().default("none"),
    acknowledgedBy: uuid("acknowledged_by").references(() => users.id),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  },
  (t) => ({
    openedIdx: index("idx_incidents_opened").on(t.openedAt),
    cameraStatusIdx: index("idx_incidents_camera_status").on(t.cameraId, t.status),
  }),
);

export const segments = pgTable(
  "segments",
  {
    id: uuid("id").primaryKey(),
    cameraId: uuid("camera_id")
      .notNull()
      .references(() => cameras.id, { onDelete: "cascade" }),
    startTs: timestamp("start_ts", { withTimezone: true }).notNull(),
    endTs: timestamp("end_ts", { withTimezone: true }).notNull(),
    storageKey: text("storage_key").notNull(),
    durationMs: integer("duration_ms").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    retentionUntil: timestamp("retention_until", { withTimezone: true }).notNull(),
  },
  (t) => ({
    cameraTsIdx: index("idx_segments_camera_ts").on(t.cameraId, t.startTs),
  }),
);

export const clips = pgTable(
  "clips",
  {
    id: uuid("id").primaryKey(),
    cameraId: uuid("camera_id")
      .notNull()
      .references(() => cameras.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    incidentId: uuid("incident_id").references(() => incidents.id),
    startTs: timestamp("start_ts", { withTimezone: true }).notNull(),
    endTs: timestamp("end_ts", { withTimezone: true }).notNull(),
    storageKey: text("storage_key").notNull(),
    posterKey: text("poster_key"),
    retentionUntil: timestamp("retention_until", { withTimezone: true }).notNull(),
  },
  (t) => ({
    cameraTsIdx: index("idx_clips_camera_ts").on(t.cameraId, t.startTs),
  }),
);

export const subscribers = pgTable(
  "subscribers",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    handle: text("handle").notNull(),
    cameraIds: uuid("camera_ids").array().notNull().default(sql`'{}'::uuid[]`),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqChanHandle: uniqueIndex("uniq_channel_handle").on(t.channel, t.handle),
  }),
);

export const botConfigs = pgTable("bot_configs", {
  channel: text("channel").primaryKey(),
  config: jsonb("config").notNull(),
  enabled: boolean("enabled").notNull().default(false),
});

export const agentConversations = pgTable(
  "agent_conversations",
  {
    id: uuid("id").primaryKey(),
    channel: text("channel").notNull(),
    handle: text("handle").notNull(),
    messages: jsonb("messages").notNull().default(sql`'[]'::jsonb`),
    lastActive: timestamp("last_active", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqChanHandle: uniqueIndex("uniq_agent_chan_handle").on(t.channel, t.handle),
  }),
);

export const retentionPolicies = pgTable("retention_policies", {
  id: uuid("id").primaryKey(),
  kind: text("kind").notNull(),
  retentionDays: integer("retention_days").notNull(),
});

export type User = typeof users.$inferSelect;
export type Camera = typeof cameras.$inferSelect;
export type Roi = typeof rois.$inferSelect;
export type Incident = typeof incidents.$inferSelect;
export type Segment = typeof segments.$inferSelect;
export type Clip = typeof clips.$inferSelect;
export type Subscriber = typeof subscribers.$inferSelect;
export type AgentConversation = typeof agentConversations.$inferSelect;
