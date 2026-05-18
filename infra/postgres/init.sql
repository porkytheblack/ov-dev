-- Overwatch initial DB schema.
-- Idempotent: safe to run on every container start.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS cameras (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  rtsp_url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  frame_width INT,
  frame_height INT,
  frame_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  vlm_enabled BOOLEAN NOT NULL DEFAULT false,
  sample_fps INT NOT NULL DEFAULT 25,
  -- Native stream frame rate, auto-probed via ffprobe on add. Distinct from
  -- sample_fps (detection sampling rate). Drives the transcoder GOP so LL-HLS
  -- parts land on keyframes.
  stream_fps REAL,
  -- Human-readable description of what this camera covers; used as VLM context.
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'connecting',
  last_frame_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rois (
  id UUID PRIMARY KEY,
  camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  polygon JSONB NOT NULL,
  classes_of_interest TEXT[] NOT NULL,
  match_mode TEXT NOT NULL DEFAULT 'centroid',
  detection_window JSONB NOT NULL DEFAULT '{"type":"always"}'::jsonb,
  linger_threshold_seconds INT NOT NULL DEFAULT 3,
  notify_enabled BOOLEAN NOT NULL DEFAULT true,
  -- 'include' = a normal region of interest; 'exclude' = an ignore zone
  -- (any detection whose centroid falls inside is dropped before it can
  -- open an incident or raise a fire alert, e.g. a tree mis-IDed as a
  -- person in bad light).
  kind TEXT NOT NULL DEFAULT 'include',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS detections (
  id UUID NOT NULL,
  camera_id UUID NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  frame_id TEXT NOT NULL,
  class TEXT NOT NULL,
  confidence REAL NOT NULL,
  bbox JSONB NOT NULL,
  track_id TEXT,
  PRIMARY KEY (id, ts)
) PARTITION BY RANGE (ts);

CREATE INDEX IF NOT EXISTS idx_detections_camera_ts ON detections (camera_id, ts);
CREATE INDEX IF NOT EXISTS idx_detections_track ON detections (track_id) WHERE track_id IS NOT NULL;

-- Helper to keep daily partitions ahead of "now". Safe to call repeatedly.
CREATE OR REPLACE FUNCTION ensure_detection_partitions(days_ahead INT DEFAULT 7)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  d DATE;
  part_name TEXT;
BEGIN
  FOR i IN -1..days_ahead LOOP
    d := (CURRENT_DATE + i);
    part_name := 'detections_' || to_char(d, 'YYYYMMDD');
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF detections FOR VALUES FROM (%L) TO (%L)',
      part_name,
      d::TIMESTAMPTZ,
      (d + INTERVAL '1 day')::TIMESTAMPTZ
    );
  END LOOP;
END $$;

SELECT ensure_detection_partitions(7);

CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY,
  camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
  roi_id UUID NOT NULL REFERENCES rois(id) ON DELETE CASCADE,
  track_id TEXT,
  classes TEXT[] NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open',
  notified_at TIMESTAMPTZ,
  clip_url TEXT,
  clip_status TEXT NOT NULL DEFAULT 'pending',
  summary TEXT,
  summary_status TEXT NOT NULL DEFAULT 'none',
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_incidents_opened ON incidents (opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_camera_status ON incidents (camera_id, status);
CREATE INDEX IF NOT EXISTS idx_incidents_open ON incidents (status) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS segments (
  id UUID PRIMARY KEY,
  camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
  start_ts TIMESTAMPTZ NOT NULL,
  end_ts TIMESTAMPTZ NOT NULL,
  storage_key TEXT NOT NULL,
  duration_ms INT NOT NULL,
  size_bytes BIGINT NOT NULL,
  retention_until TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_segments_camera_ts ON segments (camera_id, start_ts);

CREATE TABLE IF NOT EXISTS clips (
  id UUID PRIMARY KEY,
  camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  incident_id UUID REFERENCES incidents(id),
  start_ts TIMESTAMPTZ NOT NULL,
  end_ts TIMESTAMPTZ NOT NULL,
  storage_key TEXT NOT NULL,
  poster_key TEXT,
  retention_until TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clips_camera_ts ON clips (camera_id, start_ts DESC);

CREATE TABLE IF NOT EXISTS subscribers (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  handle TEXT NOT NULL,
  camera_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel, handle)
);

CREATE TABLE IF NOT EXISTS bot_configs (
  channel TEXT PRIMARY KEY,
  config JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY,
  channel TEXT NOT NULL,
  handle TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_active TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel, handle)
);

CREATE TABLE IF NOT EXISTS retention_policies (
  id UUID PRIMARY KEY,
  kind TEXT NOT NULL,
  retention_days INT NOT NULL
);

-- Seed default retention policies on first boot.
INSERT INTO retention_policies (id, kind, retention_days) VALUES
  (gen_random_uuid(), 'segment', 7),
  (gen_random_uuid(), 'clip_regular', 3),
  (gen_random_uuid(), 'clip_incident', 90),
  (gen_random_uuid(), 'detection', 14)
ON CONFLICT DO NOTHING;

-- LISTEN/NOTIFY: roi changes (incident-engine picks these up live).
CREATE OR REPLACE FUNCTION notify_roi_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('roi_changed', COALESCE(NEW.camera_id, OLD.camera_id)::text);
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS roi_change_trigger ON rois;
CREATE TRIGGER roi_change_trigger
  AFTER INSERT OR UPDATE OR DELETE ON rois
  FOR EACH ROW EXECUTE FUNCTION notify_roi_change();

CREATE OR REPLACE FUNCTION notify_camera_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('camera_changed', COALESCE(NEW.id, OLD.id)::text);
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS camera_change_trigger ON cameras;
CREATE TRIGGER camera_change_trigger
  AFTER INSERT OR UPDATE OR DELETE ON cameras
  FOR EACH ROW EXECUTE FUNCTION notify_camera_change();

-- ============================================================================
-- Idempotent migrations. Postgres only runs this file on first init, but
-- `make migrate` re-pipes it so existing volumes pick up new columns.
-- ============================================================================
ALTER TABLE rois ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE cameras ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

-- Cascade incident deletes when a camera or ROI is removed. Postgres names
-- auto-generated FKs <table>_<col>_fkey; drop-then-add is idempotent.
ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_camera_id_fkey;
ALTER TABLE incidents ADD CONSTRAINT incidents_camera_id_fkey
  FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE CASCADE;
ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_roi_id_fkey;
ALTER TABLE incidents ADD CONSTRAINT incidents_roi_id_fkey
  FOREIGN KEY (roi_id) REFERENCES rois(id) ON DELETE CASCADE;

-- Glove conversation store: token / turn counters live alongside the
-- message history so the agent keeps stats across messenger turns.
ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS tokens_in BIGINT NOT NULL DEFAULT 0;
ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS tokens_out BIGINT NOT NULL DEFAULT 0;
ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS turns INT NOT NULL DEFAULT 0;

-- Glove inbox: notifications posted while the operator was away. The agent
-- auto-surfaces status='resolved' rows on the next message, then marks them
-- 'consumed'. Written by ov-notifier, read by ov-agent's store.
CREATE TABLE IF NOT EXISTS agent_inbox (
  id          TEXT PRIMARY KEY,
  channel     TEXT NOT NULL,
  handle      TEXT NOT NULL,
  tag         TEXT NOT NULL,
  request     TEXT NOT NULL,
  response    TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  blocking    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_agent_inbox_scope ON agent_inbox (channel, handle, status);

-- Fire-alert rate limiter: at most one fire alert per camera per cooldown
-- window, persisted so a service restart can't re-trigger inside the window.
-- Claimed atomically by the shared dispatchFireAlert (engine high-confidence
-- path AND the Station adjudicated path). shared-ts also ensures this at
-- runtime; kept here so fresh installs have it from the start.
CREATE TABLE IF NOT EXISTS fire_alert_log (
  camera_id     UUID PRIMARY KEY,
  last_alert_at TIMESTAMPTZ NOT NULL
);
