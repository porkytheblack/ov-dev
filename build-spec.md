# Overwatch — Build Specification v1

> Multi-camera AI surveillance for self-hosted compounds. Real-time detection, ROI-driven incident lifecycle, WhatsApp and Telegram alerts, conversational agent over messenger.
**Status:** Ready for implementation handover
**Target:** A coding agent can implement this end-to-end against the acceptance criteria in §13.

---

If doing anything in relation to agents refer to the /glove skill, if doing anything in relation to station for orcherstration refer to /station skill

## Table of contents

0. Brand
1. Goals & non-goals
2. Architecture overview
3. Repo layout
4. Data model
5. Event contracts
6. Services (12)
7. Core flows
8. Dashboard
9. Authentication
10. Notification format
11. Agent tools
12. Deployment & configuration
13. Definition of done
14. Testing requirements
15. Out of scope

---

## 0. Brand

### Name
**Overwatch.** Wordmark only.

### Voice
Terse. Informational. No marketing language, no exclamation marks in UI strings, no celebratory copy. Status before sentiment.

- Yes: `3 active incidents · last update 14:22`
- No: `You have 3 incidents to review!`

Mono for all numeric data, IDs, timestamps, addresses, durations. Sans for prose.

### Palette

Single accent — **amber** (`#F59E0B`). Reads as "attention" without alarm. Works on dark surfaces. Never introduce a second accent anywhere in the UI.

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0A0A0A` | Page background |
| `--surface` | `#141414` | Cards, panels |
| `--surface-elev` | `#1F1F1F` | Hover, focused row |
| `--border` | `#262626` | Hairline dividers |
| `--border-strong` | `#404040` | Outlines, active states |
| `--text` | `#E5E5E5` | Primary text |
| `--text-muted` | `#A3A3A3` | Secondary text |
| `--text-dim` | `#525252` | Labels, metadata |
| `--accent` | `#F59E0B` | Live state, primary CTA, incident-open indicator |
| `--accent-strong` | `#FBBF24` | Accent hover |
| `--accent-dim` | `#7C2D12` | Text on accent fills |
| `--success` | `#10B981` | Resolved status only |
| `--danger` | `#EF4444` | Connection lost / critical only |

### Type
- **Inter** — sans, UI prose, headings. Weights 400, 500 only.
- **JetBrains Mono** — mono. Timestamps, IDs, durations, counts, code, addresses, table data. Weights 400, 500 only.

No italics in UI. No serifs. Self-host both fonts in `services/ov-dashboard/public/fonts/`.

### Geometry
- Border-radius: `0` everywhere (no exceptions, including form controls)
- Borders: `1px solid var(--border)`
- No drop shadows, no gradients, no glow effects
- Solid fills only

### Mark
Wordmark `OVERWATCH` in JetBrains Mono 500, uppercase, `letter-spacing: 0.08em`. In dashboard header, immediately followed by a 6×6px amber square that pulses between full opacity and 0.5 opacity at a 2-second interval when the system is receiving events from at least one camera, and goes solid `var(--danger)` if all cameras are disconnected.

### Component primitives
- **Button** — 32px height, 1px border, mono label, uppercase, letter-spacing 0.04em. Primary = amber fill on black text. Secondary = transparent fill with `var(--border-strong)`.
- **Input** — 32px height, `var(--surface)` fill, `var(--border)` border, mono on numeric/code inputs, sans on free text.
- **Table** — borderless rows separated by `var(--border)` hairlines, mono for data columns, sans for label columns. Header row uses `var(--text-dim)` uppercase 11px tracking 0.08em.
- **Status pill** — 1px outline, no fill (except for incident-open which uses amber fill). `OPEN` `RESOLVED` `ACK'D` `SUPPRESSED`.

---

## 1. Goals & non-goals

### Success criteria (the demo that ships)
A user clones the repo, runs `docker compose up`, signs in, adds a camera by RTSP URL, draws an ROI on a frame snapshot, picks classes of interest (e.g., `person`), writes a scene-context description, configures their WhatsApp number and a Telegram bot token. Within minutes of motion in that ROI:

1. They receive a WhatsApp message with a deep link to live incident playback.
2. They see the incident in the dashboard with bounding-box overlay clip.
3. They can reply on WhatsApp asking "what happened in the last hour" and get a coherent answer from the agent.
4. They can browse historical incidents in the calendar view.

If all four work end-to-end on a fresh deploy, the system ships.

### Non-goals (v1)
- Multi-tenant SaaS (single deployment per compound)
- Mobile native apps (responsive dashboard only)
- Face recognition (gait + class detection only; person-ID is later)
- Audio analysis
- Cloud vendor lock-in (all storage and compute self-hostable)

---

## 2. Architecture overview

Two planes connected by a single bus.

**Vision plane (Python):** `ov-ingestor`, `ov-detector`, `ov-clip-builder`, `ov-vlm`

**Application plane (TypeScript):** `ov-incident-engine`, `ov-notifier`, `ov-whatsapp`, `ov-telegram`, `ov-agent`, `ov-api`, `ov-stream-gateway`, `ov-dashboard`

**Infrastructure:** Postgres 16, Redis 7 (Streams), MinIO (S3-compatible object storage), Caddy (TLS + reverse proxy)

The Python ↔ TypeScript contract is the event schema on Redis Streams. The schema is single source of truth — bindings are generated for both sides, never hand-written.

Service boundary rules:
- Python services do nothing but vision work. They never write to Postgres directly except via events consumed on the TS side. (Exception: `ov-ingestor` writes raw segment metadata to a `segments` table — single-table exception so the segment-to-clip pipeline can be entirely Python.)
- TypeScript services never invoke Python directly. They communicate via Redis Streams or HTTP to `ov-api` only.
- The dashboard talks only to `ov-api` and `ov-stream-gateway`.

---

## 3. Repo layout

```
overwatch/
├── README.md
├── docker-compose.yml          # Production
├── docker-compose.dev.yml      # Development overrides
├── .env.example
├── Makefile                    # `make up`, `make down`, `make seed`, `make logs`
├── packages/
│   ├── schemas/                # SINGLE SOURCE OF TRUTH for events + tables
│   │   ├── src/
│   │   │   ├── events.ts       # Zod definitions
│   │   │   └── tables.ts       # Drizzle schemas
│   │   ├── pygen/              # Generated Pydantic models
│   │   └── build.ts            # Codegen script
│   ├── shared-ts/              # Effect helpers, Redis client wrapper, Drizzle client
│   └── shared-py/              # Redis client, Pydantic helpers, frame utils
├── services/
│   ├── ov-ingestor/            # Python · RTSP → segments + frames
│   ├── ov-detector/            # Python · frames → detections
│   ├── ov-clip-builder/        # Python · segments + detections → overlay clips
│   ├── ov-vlm/                 # Python · incident clips → summaries (optional)
│   ├── ov-incident-engine/     # TS · detection events → incidents (Station broadcast)
│   ├── ov-notifier/            # TS · incidents → bot dispatch
│   ├── ov-whatsapp/            # TS · WhatsApp Cloud API adapter
│   ├── ov-telegram/            # TS · Telegram Bot API adapter
│   ├── ov-agent/               # TS · Glove runtime, conversational interface
│   ├── ov-api/                 # TS · Hono HTTP/WS API for dashboard
│   ├── ov-stream-gateway/      # TS · live video relay to dashboard
│   └── ov-dashboard/           # Next.js 14 App Router
├── infra/
│   ├── caddy/Caddyfile
│   ├── postgres/init.sql       # Includes partition setup
│   └── redis/redis.conf
└── scripts/
    ├── seed.ts
    ├── reset-dev.sh
    ├── gen-schemas.sh
    └── e2e.sh                  # End-to-end smoke test
```

**Tooling:**
- **TypeScript:** pnpm workspaces + Turborepo, Effect, Zod, Drizzle ORM (Postgres), Glove (agent runtime), Station (orchestration), Hono (HTTP), Lucia (auth)
- **Python:** uv per service, FastAPI (where HTTP needed), OpenCV, Ultralytics (YOLO11L), Pydantic, redis-py
- **Frontend:** Next.js 14 App Router, Tailwind CSS (configured to the brand palette above), no UI framework — hand-build components from the design system

---

## 4. Data model

All tables use UUID v7 (time-ordered) primary keys unless stated. Timestamps as `timestamptz`. `created_at` on all rows where useful. The `detections` table is partitioned by day.

```sql
-- Users (operators)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sessions (Lucia v3)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Cameras
CREATE TABLE cameras (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  rtsp_url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  frame_width INT,
  frame_height INT,
  frame_context JSONB NOT NULL DEFAULT '{}',
  -- { description: string, named_objects: [{label, bbox}] }
  vlm_enabled BOOLEAN NOT NULL DEFAULT false,
  sample_fps INT NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'connecting',
  -- connecting | online | offline
  last_frame_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ROIs
CREATE TABLE rois (
  id UUID PRIMARY KEY,
  camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  polygon JSONB NOT NULL,
  -- [[x,y], [x,y], ...]  normalized 0-1
  classes_of_interest TEXT[] NOT NULL,
  match_mode TEXT NOT NULL DEFAULT 'centroid',
  -- centroid | iou
  detection_window JSONB NOT NULL DEFAULT '{"type":"always"}',
  -- {type:'always'} | {type:'time', start:'18:00', end:'06:00', tz:'Africa/Nairobi', days:[0..6]}
  linger_threshold_seconds INT NOT NULL DEFAULT 60,
  notify_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Detections (high volume, partitioned by day)
CREATE TABLE detections (
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

CREATE INDEX idx_detections_camera_ts ON detections (camera_id, ts);
CREATE INDEX idx_detections_track ON detections (track_id) WHERE track_id IS NOT NULL;

-- Incidents
CREATE TABLE incidents (
  id UUID PRIMARY KEY,
  camera_id UUID NOT NULL REFERENCES cameras(id),
  roi_id UUID NOT NULL REFERENCES rois(id),
  track_id TEXT,
  classes TEXT[] NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open',
  -- open | closed | suppressed | acknowledged
  notified_at TIMESTAMPTZ,
  clip_url TEXT,
  clip_status TEXT NOT NULL DEFAULT 'pending',
  -- pending | ready | failed
  summary TEXT,
  summary_status TEXT NOT NULL DEFAULT 'none',
  -- none | pending | ready | failed
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_incidents_opened ON incidents (opened_at DESC);
CREATE INDEX idx_incidents_camera_status ON incidents (camera_id, status);
CREATE INDEX idx_incidents_open ON incidents (status) WHERE status = 'open';

-- Video segments (raw, 10-second .ts files)
CREATE TABLE segments (
  id UUID PRIMARY KEY,
  camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
  start_ts TIMESTAMPTZ NOT NULL,
  end_ts TIMESTAMPTZ NOT NULL,
  storage_key TEXT NOT NULL,
  duration_ms INT NOT NULL,
  size_bytes BIGINT NOT NULL,
  retention_until TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_segments_camera_ts ON segments (camera_id, start_ts);

-- Clips (overlay-rendered for playback)
CREATE TABLE clips (
  id UUID PRIMARY KEY,
  camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  -- incident | regular
  incident_id UUID REFERENCES incidents(id),
  start_ts TIMESTAMPTZ NOT NULL,
  end_ts TIMESTAMPTZ NOT NULL,
  storage_key TEXT NOT NULL,
  poster_key TEXT,
  retention_until TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_clips_camera_ts ON clips (camera_id, start_ts DESC);

-- Subscribers (notification targets)
CREATE TABLE subscribers (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  -- whatsapp | telegram
  handle TEXT NOT NULL,
  camera_ids UUID[] NOT NULL DEFAULT '{}',
  -- empty = all cameras
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel, handle)
);

-- Bot configurations
CREATE TABLE bot_configs (
  channel TEXT PRIMARY KEY,
  config JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false
);

-- Agent conversation memory
CREATE TABLE agent_conversations (
  id UUID PRIMARY KEY,
  channel TEXT NOT NULL,
  handle TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  last_active TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel, handle)
);

-- Retention policies
CREATE TABLE retention_policies (
  id UUID PRIMARY KEY,
  kind TEXT NOT NULL,
  -- segment | clip_incident | clip_regular | detection
  retention_days INT NOT NULL
);
```

**Default retention policies (seeded on first boot):**
- `segment`: 7 days
- `clip_regular`: 3 days
- `clip_incident`: 90 days
- `detection`: 14 days (partition drop)

---

## 5. Event contracts

Single source of truth in `packages/schemas/src/events.ts`. A build script generates Pydantic models in `packages/schemas/pygen/`.

```typescript
import { z } from 'zod';

export const Bbox = z.object({
  x: z.number(), y: z.number(),
  w: z.number(), h: z.number(),
});
export type Bbox = z.infer<typeof Bbox>;

export const Detection = z.object({
  class: z.string(),
  confidence: z.number().min(0).max(1),
  bbox: Bbox,
  track_id: z.string().optional(),
});

// Stream: frames.{camera_id}
export const FrameSampled = z.object({
  type: z.literal('frame.sampled'),
  camera_id: z.string().uuid(),
  ts: z.string().datetime(),
  frame_id: z.string(),
  storage_key: z.string(), // MinIO key, deleted after detection
});

// Stream: detections.{camera_id}
export const FrameDetections = z.object({
  type: z.literal('frame.detections'),
  camera_id: z.string().uuid(),
  ts: z.string().datetime(),
  frame_id: z.string(),
  detections: z.array(Detection),
});

// Stream: segments
export const SegmentReady = z.object({
  type: z.literal('segment.ready'),
  camera_id: z.string().uuid(),
  segment_id: z.string().uuid(),
  start_ts: z.string().datetime(),
  end_ts: z.string().datetime(),
  storage_key: z.string(),
});

// Stream: incidents
export const IncidentOpened = z.object({
  type: z.literal('incident.opened'),
  incident_id: z.string().uuid(),
  camera_id: z.string().uuid(),
  roi_id: z.string().uuid(),
  classes: z.array(z.string()),
  opened_at: z.string().datetime(),
  track_id: z.string().optional(),
});

export const IncidentClosed = z.object({
  type: z.literal('incident.closed'),
  incident_id: z.string().uuid(),
  closed_at: z.string().datetime(),
  duration_ms: z.number(),
});

// Stream: clips
export const ClipReady = z.object({
  type: z.literal('clip.ready'),
  clip_id: z.string().uuid(),
  incident_id: z.string().uuid().optional(),
  kind: z.enum(['incident', 'regular']),
  storage_key: z.string(),
  poster_key: z.string().optional(),
});

// Stream: summaries
export const SummaryReady = z.object({
  type: z.literal('summary.ready'),
  incident_id: z.string().uuid(),
  summary: z.string(),
});

// Stream: camera_status
export const CameraStatusChanged = z.object({
  type: z.literal('camera.status_changed'),
  camera_id: z.string().uuid(),
  status: z.enum(['connecting', 'online', 'offline']),
  ts: z.string().datetime(),
});
```

**Redis Streams (XADD/XREADGROUP):**
- `frames.{camera_id}`
- `detections.{camera_id}`
- `segments`
- `incidents`
- `clips`
- `summaries`
- `camera_status`

Each consumer uses a consumer group named `cg.{service-name}` for at-least-once delivery semantics. Failed messages re-queued with exponential backoff via PEL.

---

## 6. Services

For each service: **responsibility · consumes · produces · HTTP · env · DoD**.

### 6.1 ov-ingestor (Python)

**Responsibility:** Connect to RTSP per camera. Continuously write 10-second H.264 `.ts` segments to MinIO. Sample frames at configured fps and emit to detection queue.

**Consumes:** Nothing (root producer)

**Produces:**
- `frames.{camera_id}` → `FrameSampled`
- `segments` → `SegmentReady`
- `camera_status` → `CameraStatusChanged`

**HTTP:** `GET /health` only (no business endpoints)

**Env:**
```
DATABASE_URL=postgres://...
REDIS_URL=redis://...
MINIO_ENDPOINT=...
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_BUCKET_SEGMENTS=overwatch-segments
MINIO_BUCKET_FRAMES=overwatch-frames
LOG_LEVEL=info
```

**Implementation notes:**
- Use ffmpeg subprocess (not opencv) for RTSP → HLS-style segmenting. OpenCV is for frame extraction only.
- Watch RTSP connection; on disconnect emit `camera.status_changed` to `offline` and retry with backoff.
- Frame sample rate is `camera.sample_fps` from Postgres. Default 5 fps. Read from DB once per minute (avoid hot loop).
- Frames stored in MinIO with key `frames/{camera_id}/{frame_id}.jpg` and a 5-minute lifecycle policy (auto-delete after detector consumes).
- One process can ingest multiple cameras; spawn one asyncio task per camera.
- Segments named `segments/{camera_id}/{YYYY/MM/DD/HH}/{start_ts}.ts` for natural prefix-based browsing.

**Definition of done:**
- [ ] Connects to RTSP and writes 10s `.ts` segments to MinIO with metadata in `segments` table
- [ ] Reconnects on stream failure, emits `camera.status_changed` events
- [ ] Samples frames at configured fps and emits to `frames.{camera_id}`
- [ ] One process handles 4 cameras concurrently without dropping frames on a 4-core machine
- [ ] Health endpoint reports per-camera connection status
- [ ] Integration test with a synthetic RTSP server (use mediamtx in test container)

---

### 6.2 ov-detector (Python)

**Responsibility:** Consume sampled frames, run YOLO11L inference, run BoT-SORT tracker, emit detection events.

**Consumes:** `frames.{camera_id}` → `FrameSampled`

**Produces:** `detections.{camera_id}` → `FrameDetections`

**HTTP:** `GET /health`, `GET /classes` (returns model's class list for UI)

**Env:**
```
REDIS_URL=...
MINIO_ENDPOINT=...
MODEL_PATH=/models/yolo11l.pt
DEVICE=cuda:0  # or cpu, mps
BATCH_SIZE=8
TRACKER_CONFIG=botsort.yaml
```

**Implementation notes:**
- Maintain a frame buffer per camera, batch up to BATCH_SIZE for GPU efficiency
- Track IDs persist across batches via BoT-SORT; track_id is critical for incident-engine's linger check
- After processing a frame, delete the MinIO frame object (or rely on lifecycle policy)
- If GPU unavailable, fall back to CPU and warn loudly in logs

**Definition of done:**
- [ ] Detects all 80 COCO classes; class list discoverable via HTTP
- [ ] Produces detections within 200ms p99 latency from frame arrival on GPU
- [ ] Track IDs persist across frames for the same camera
- [ ] Recovers gracefully from model load failure with clear error
- [ ] Benchmark test: 100 frames processed in under 10s on the target hardware

---

### 6.3 ov-incident-engine (TypeScript)

**Responsibility:** The brain. Apply ROI rules to detection events, manage incident lifecycle, write incidents to DB, emit incident lifecycle events.

**Consumes:**
- `detections.{camera_id}` → `FrameDetections` (for all enabled cameras)

**Produces:**
- `incidents` → `IncidentOpened`, `IncidentClosed`

**HTTP:** `GET /health`

**Env:**
```
DATABASE_URL=...
REDIS_URL=...
LOG_LEVEL=info
SWEEP_INTERVAL_SECONDS=10
```

**State (in-memory, rebuilt from DB on boot):**
```typescript
type OpenIncidentKey = `${cameraId}:${roiId}:${trackId}`
type OpenIncident = {
  incident_id: string
  opened_at: Date
  last_seen_at: Date
  classes: Set<string>
  notify_pending: boolean  // notification debounce
}
const openIncidents = new Map<OpenIncidentKey, OpenIncident>()
```

**Per-event logic (pseudocode):**
```
on FrameDetections(camera_id, ts, detections):
  rois = roisForCamera(camera_id)
  for roi in rois:
    if not isWithinDetectionWindow(roi, ts): continue
    for det in detections:
      if det.class not in roi.classes_of_interest: continue
      if not matchesRoi(det.bbox, roi.polygon, roi.match_mode): continue

      key = `${camera_id}:${roi.id}:${det.track_id ?? 'untracked'}`
      existing = openIncidents.get(key)

      if existing:
        existing.last_seen_at = ts
        existing.classes.add(det.class)
        # check if we've crossed linger threshold for notification
        if existing.notify_pending and
           (ts - existing.opened_at).seconds >= roi.linger_threshold_seconds:
          emitIncidentOpened(existing)
          existing.notify_pending = false
      else:
        incident = createIncident(camera_id, roi.id, det.track_id, [det.class], ts)
        openIncidents.set(key, { ...incident, notify_pending: true })

# Sweep every SWEEP_INTERVAL_SECONDS:
sweep():
  now = Date.now()
  for [key, incident] of openIncidents:
    grace_period = 5_000  # 5s grace after last detection
    if now - incident.last_seen_at > grace_period:
      if incident.notify_pending:
        # never reached linger threshold; suppress
        markIncidentSuppressed(incident.incident_id)
      else:
        closeIncident(incident.incident_id, now)
        emitIncidentClosed(incident.incident_id)
      openIncidents.delete(key)
```

**The 60-second rule (per discussion):**
Incident is created in-memory on first match. Notification only fires after `linger_threshold_seconds` of continuous presence. If the object leaves before the threshold, the incident is marked `suppressed` (still in DB for audit) and no notification is sent. After threshold, notifications fire and the incident persists until the object leaves frame for more than 5 seconds.

**Implementation notes:**
- Use Effect's `Stream` for consuming Redis groups
- Use Effect's `Schedule` for the periodic sweep
- Bulk-load all ROIs into memory on boot, subscribe to a Postgres LISTEN/NOTIFY channel for live updates from the API when ROIs change
- Use Station broadcast for the `incident.opened` fan-out (see §6.6 and §7.1)

**Definition of done:**
- [ ] Correctly opens incidents on first detection match
- [ ] Suppresses incidents whose objects leave before linger threshold
- [ ] Closes incidents after grace period when object leaves
- [ ] Persists all state changes to Postgres
- [ ] Reloads open incidents from DB on restart without losing state
- [ ] Unit tests for all ROI matching modes (centroid, IoU)
- [ ] Unit tests for the lifecycle state machine including suppression
- [ ] Integration test: synthetic detection event stream produces expected incident records

---

### 6.4 ov-clip-builder (Python)

**Responsibility:** Consume incident-opened events, fetch raw segments overlapping the incident window, composite bounding boxes onto frames, output overlay-rendered clip, register clip metadata.

**Consumes:**
- `incidents` → `IncidentOpened`
- `incidents` → `IncidentClosed` (to finalize clip duration)

**Produces:** `clips` → `ClipReady`

**HTTP:** `GET /health`

**Env:**
```
REDIS_URL=...
DATABASE_URL=...  # read-only, just for segment lookup
MINIO_ENDPOINT=...
MINIO_BUCKET_SEGMENTS=...
MINIO_BUCKET_CLIPS=overwatch-clips
PADDING_SECONDS_BEFORE=5
PADDING_SECONDS_AFTER=10
```

**Implementation notes:**
- On `incident.opened`: start building clip from `opened_at - 5s` to `opened_at + 30s` (initial window). On `incident.closed`: extend clip to `closed_at + 10s`.
- Pull all segments overlapping the window from MinIO, concat with ffmpeg, overlay detection bboxes per frame.
- Detection bboxes for the overlay are fetched from Postgres (read-only path) by `(camera_id, ts range)`.
- Generate a poster JPEG from the middle frame, also uploaded to MinIO.
- Output H.264 MP4 with `+faststart` for streaming.

**Additional path (regular clips):**
- For non-incident detection retention: on a 5-minute cron, scan all detection events with class-of-interest activity in any ROI and build "regular" clips with shorter duration (configurable, default 30s clips covering active periods). These are visible in the dashboard calendar.

**Definition of done:**
- [ ] Builds overlay clip for an incident within 30s of `incident.closed`
- [ ] Output clip plays in standard HTML5 video player
- [ ] Bounding boxes accurately overlaid on each frame
- [ ] Poster image generated
- [ ] `clips` table row created with correct retention_until
- [ ] Regular-detection clip path runs on schedule and creates browsable clips

---

### 6.5 ov-vlm (Python, optional)

**Responsibility:** On incident-ready clips (where `vlm_enabled = true` for the camera), generate a natural-language summary using a local VLM (LM Studio or similar).

**Consumes:** `clips` → `ClipReady` (filter on `kind = 'incident'`)

**Produces:** `summaries` → `SummaryReady`

**HTTP:** `GET /health`

**Env:**
```
REDIS_URL=...
DATABASE_URL=...
MINIO_ENDPOINT=...
VLM_ENDPOINT=http://lmstudio:1234/v1
VLM_MODEL=...
SAMPLE_FRAMES_PER_CLIP=8
```

**Implementation notes:**
- Sample 8 frames evenly from the clip, send to VLM with prompt that includes `camera.frame_context.description`
- Prompt template:
  ```
  You are summarizing a security incident clip. Context about this camera's scene: {frame_context.description}. Detected classes: {classes}. Incident duration: {duration_seconds}s.

  Describe what is happening in 1-2 sentences. Be specific and factual. Do not speculate.
  ```
- Write summary back to `incidents.summary` and emit `SummaryReady`

**Definition of done:**
- [ ] Connects to LM Studio endpoint and processes one incident clip end-to-end
- [ ] Summary written to `incidents.summary` column
- [ ] `summary_status` transitions: pending → ready (or failed)
- [ ] Skips incidents for cameras with `vlm_enabled = false`

---

### 6.6 ov-notifier (TypeScript)

**Responsibility:** Consume incident-opened events. Resolve subscribers per camera. Wait for clip-ready (with timeout). Dispatch alerts to bot adapters.

**Consumes:**
- `incidents` → `IncidentOpened`
- `clips` → `ClipReady`

**Produces:** None (calls bot adapters via HTTP or Redis stream `bot_outbox`)

**HTTP:** `GET /health`

**Env:**
```
DATABASE_URL=...
REDIS_URL=...
CLIP_WAIT_TIMEOUT_SECONDS=120
DASHBOARD_BASE_URL=https://overwatch.example.com
DEEP_LINK_TOKEN_SECRET=...
DEEP_LINK_TTL_HOURS=24
```

**Implementation notes:**
- Uses Station broadcast for the parallel work: persist + clip + notify + summarize. Notify step has a fan-in dependency on `clip.ready` (with timeout — if clip isn't ready in 120s, send notification with dashboard link only, no inline playback).
- Generate a signed deep link to `/incidents/{id}/playback?token={signed}` with HMAC-SHA256 + 24h TTL.
- Dispatch by emitting to `bot_outbox.{channel}` Redis stream. Bot adapters consume this.

**Definition of done:**
- [ ] Sends a notification within 30s of `incident.opened` event for each subscribed user
- [ ] Notification includes a working deep link
- [ ] Handles clip-wait timeout gracefully
- [ ] No duplicate notifications for the same incident
- [ ] Respects per-subscriber camera filters

---

### 6.7 ov-whatsapp (TypeScript)

**Responsibility:** WhatsApp Cloud API adapter. Outbound notifications + inbound user messages routed to the agent.

**Consumes:** `bot_outbox.whatsapp` (from notifier and agent)

**Produces:** Calls into `ov-agent` HTTP for inbound user messages

**HTTP:**
- `POST /webhook` (WhatsApp webhook)
- `GET /webhook` (verification)
- `GET /health`

**Env:**
```
DATABASE_URL=...
REDIS_URL=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_WEBHOOK_VERIFY_TOKEN=...
AGENT_URL=http://ov-agent:3000
```

**Implementation notes:**
- Outbound: consume `bot_outbox.whatsapp` and post messages to WhatsApp Cloud API
- Inbound: webhook receives user messages, forward to `ov-agent` with `{channel: 'whatsapp', handle, message, message_id}`, render agent reply back to WhatsApp
- Reply rendering: text directly; if agent attaches a clip URL, send as link with preview

**Definition of done:**
- [ ] Verifies webhook on first request
- [ ] Sends incident notifications to subscribed numbers
- [ ] Receives user messages and forwards to agent
- [ ] Renders agent responses correctly including link previews

---

### 6.8 ov-telegram (TypeScript)

Mirror of `ov-whatsapp` for Telegram. Uses long-polling via `getUpdates` (simpler than webhooks for self-hosted).

**Env:**
```
TELEGRAM_BOT_TOKEN=...
AGENT_URL=http://ov-agent:3000
```

**Definition of done:**
- [ ] Receives bot token via config, starts polling
- [ ] Sends incident notifications to subscribed users
- [ ] Forwards user messages to agent
- [ ] Renders agent responses with inline keyboard for `/acknowledge` action on incidents

---

### 6.9 ov-agent (TypeScript, Glove)

**Responsibility:** Single Glove runtime exposing conversational tools over HTTP. Both bot services proxy into it.

**Consumes:** Nothing (request-response only)

**Produces:** `bot_outbox.{channel}` for proactive messages (rare; e.g., scheduled summaries)

**HTTP:**
- `POST /chat` — input: `{channel, handle, message}` → output: `{response, attachments?}`
- `GET /health`

**Env:**
```
DATABASE_URL=...
REDIS_URL=...
ANTHROPIC_API_KEY=...  # or OpenAI / local
MODEL=claude-sonnet-4-5
```

**Glove tools (defined in agent's tool registry):**

```typescript
const tools = {
  search_incidents: {
    description: "Search past incidents by time range, camera, or class",
    params: z.object({
      time_range: z.object({ start: z.string(), end: z.string() }),
      camera_id: z.string().uuid().optional(),
      classes: z.array(z.string()).optional(),
      status: z.enum(['open', 'closed', 'all']).default('all'),
      limit: z.number().default(20),
    }),
    handler: async (p) => { /* postgres query */ },
  },
  get_incident_details: {
    description: "Get full details for a specific incident",
    params: z.object({ incident_id: z.string().uuid() }),
    handler: async (p) => { /* incident + summary + clip_url + detections */ },
  },
  get_compound_status: {
    description: "Get current status: open incidents, cameras online/offline, last activity",
    params: z.object({}),
    handler: async () => { /* db aggregations */ },
  },
  get_camera_context: {
    description: "Get user-defined scene description for a camera",
    params: z.object({ camera_id: z.string().uuid() }),
    handler: async (p) => { /* cameras.frame_context */ },
  },
  summarize_period: {
    description: "Summarize activity across one or all cameras over a time period",
    params: z.object({
      start: z.string(),
      end: z.string(),
      camera_id: z.string().uuid().optional(),
    }),
    handler: async (p) => { /* aggregate incidents + counts + return structured */ },
  },
  acknowledge_incident: {
    description: "Mark an incident as acknowledged by the current user",
    params: z.object({ incident_id: z.string().uuid() }),
    handler: async (p) => { /* update incident.acknowledged_* */ },
  },
}
```

**System prompt template:**
```
You are the Overwatch agent for a surveillance system. You answer questions about cameras, incidents, and compound status concisely and factually. Use tools to look up data — never make up incident details. Time references like "last hour" or "today" should be resolved against the current time: {now_iso}. The user is reaching you via {channel}.
```

**Conversation memory:**
Last 20 messages persisted in `agent_conversations` table, keyed by (channel, handle). Older messages dropped.

**Definition of done:**
- [ ] Glove runtime initialized with all tools above
- [ ] Each tool returns valid data given seeded DB
- [ ] Conversation memory persists across messages
- [ ] Handles time references ("last hour", "yesterday", "this week") correctly relative to current time
- [ ] Responses fit in messenger character limits (truncate or paginate)
- [ ] Unit test: tool handlers against test DB
- [ ] Integration test: full message → agent → tool → response cycle

---

### 6.10 ov-api (TypeScript, Hono)

**Responsibility:** HTTP/WS API for the dashboard.

**Consumes:** Nothing on the bus (DB-direct)

**Produces:** Nothing on the bus directly; uses Postgres LISTEN/NOTIFY to broadcast updates to WS subscribers, and writes ROI/camera changes that the incident engine picks up

**HTTP routes:**

```
POST   /auth/login                  body: {username, password} → {session_id}
POST   /auth/logout
GET    /auth/me

GET    /cameras
POST   /cameras                     body: {name, rtsp_url, sample_fps?}
GET    /cameras/:id
PATCH  /cameras/:id
DELETE /cameras/:id
POST   /cameras/:id/test            triggers a single-frame capture for ROI drawing
GET    /cameras/:id/snapshot        returns latest sampled frame

GET    /cameras/:id/rois
POST   /cameras/:id/rois            body: roi schema
PATCH  /rois/:id
DELETE /rois/:id

GET    /incidents                   query: ?from, ?to, ?camera_id, ?status, ?cursor
GET    /incidents/:id
POST   /incidents/:id/acknowledge
GET    /incidents/:id/playback      query: ?token (signed deep-link)

GET    /clips                       query: ?from, ?to, ?camera_id, ?kind, ?cursor
GET    /clips/:id/stream            proxies MinIO with auth

GET    /subscribers
POST   /subscribers
DELETE /subscribers/:id

GET    /bot-configs/:channel
PUT    /bot-configs/:channel

GET    /system/status               aggregate health of all services

WS     /events                      live event stream: { detections, incidents, camera_status }
```

**Auth middleware:** session cookie or `Authorization: Bearer {session_id}`. Lucia v3.

**Definition of done:**
- [ ] All routes implemented with Zod-validated I/O
- [ ] WS streams live events from Redis
- [ ] Auth-protected; unauthenticated requests 401
- [ ] OpenAPI spec auto-generated at `/openapi.json`
- [ ] Integration tests for each route

---

### 6.11 ov-stream-gateway (TypeScript)

**Responsibility:** Live video gateway. Re-broadcasts the ingestor's RTSP stream to the browser via WebRTC (preferred) or LL-HLS (fallback).

**Consumes:** Reads RTSP URL directly from cameras table

**HTTP/WS:**
- `WS /stream/:camera_id` — WebRTC signaling
- `GET /stream/:camera_id/hls/playlist.m3u8` — HLS fallback

**Env:**
```
DATABASE_URL=...
STUN_SERVERS=stun:stun.l.google.com:19302
```

**Implementation notes:**
- Use `mediamtx` as the underlying engine — it handles RTSP → WebRTC + HLS natively. Wrap it with our auth layer.
- The gateway authenticates the WS upgrade against an Overwatch session before allowing the relay.
- Bounding boxes are NOT drawn server-side. The dashboard subscribes to `WS /events` from `ov-api` for the relevant `camera_id` and overlays boxes client-side on a `<canvas>` aligned to the video element.

**Definition of done:**
- [ ] Browser connects via WebRTC and plays live video with < 2s latency
- [ ] Requires valid session to connect
- [ ] HLS fallback works
- [ ] Disconnects cleanly when client leaves

---

### 6.12 ov-dashboard (Next.js 14)

See §8 for full dashboard spec.

---

## 7. Core flows

### 7.1 Incident lifecycle (Station broadcast)

```
detector publishes FrameDetections
  ↓
incident-engine consumes, applies rules
  ↓
[match found, linger threshold reached]
  ↓
incident-engine emits IncidentOpened
  ↓
Station broadcast fans out:
  ├─ persist_incident       → DB write
  ├─ build_clip              → ov-clip-builder (consumes incidents stream)
  ├─ generate_summary        → ov-vlm (if camera.vlm_enabled)
  └─ notify_subscribers      → ov-notifier
       └─ waits for clip.ready (timeout 120s)
       └─ generates signed link
       └─ pushes to bot_outbox.{channel}
       └─ ov-whatsapp / ov-telegram consume and send
```

### 7.2 Live streaming with overlays

```
Dashboard opens camera view
  → connects to /stream/{camera_id} (WebRTC, via ov-stream-gateway)
  → subscribes to /events?camera_id={id} (WS from ov-api)
Dashboard renders:
  → <video> element plays WebRTC stream
  → <canvas> element overlays bboxes from detection events, aligned to video timestamps
```

### 7.3 Agent over messenger

```
User sends "what happened in the last hour" to WhatsApp
  → ov-whatsapp receives webhook
  → POST ov-agent /chat { channel: 'whatsapp', handle, message }
  → Glove runtime decides → calls search_incidents tool
  → tool queries DB → returns rows
  → Glove generates response → returns { response: "..." }
  → ov-whatsapp posts back to WhatsApp Cloud API
```

### 7.4 Camera onboarding

```
User clicks "Add camera" in dashboard
  → enters RTSP URL, name, sample_fps
  → POST /cameras → returns camera object
ov-ingestor picks up new row, connects to RTSP
  → emits camera.status_changed → online
Dashboard polls /cameras/{id}/snapshot until first frame arrives
  → user draws ROI polygon(s) on canvas overlay
  → user selects classes_of_interest from class list (fetched from ov-detector /classes)
  → user writes frame_context description
  → POST /cameras/{id}/rois
Camera is live.
```

---

## 8. Dashboard (Next.js 14)

### 8.1 Pages

```
/login                              Username/password
/                                   Overview: all cameras grid, status, recent incidents
/cameras/[id]                       Live view + recent activity timeline
/cameras/[id]/setup                 ROI drawing, classes, context, retention
/cameras/new                        RTSP URL form
/incidents                          List with filters + calendar toggle
/incidents/[id]                     Detail: clip player, detections, summary, ack button
/incidents/[id]/playback            Public-token deep-link target (for messenger deep-links)
/calendar                           Calendar view of incidents + regular detections
/settings                           Bot configs, subscribers, retention, system status
/settings/account                   Password change
```

### 8.2 Key components

- **CameraGrid** — N×M grid of live tiles, each showing the latest frame poster (refresh every 5s if not WebRTC-connected) or live WebRTC if user has clicked into it. Status pill in corner: `LIVE` (amber), `OFFLINE` (danger), `CONNECTING` (muted).
- **LiveViewer** — `<video>` + `<canvas>` overlay. Toggle button: `BOXES ON | OFF`. Class filter chips.
- **ROIEditor** — frame snapshot as background. Click to add polygon vertices. Drag to reposition. Double-click to close polygon. List of ROIs with class chips and detection-window pickers.
- **IncidentTimeline** — vertical list grouped by day. Each row: time, camera, classes, status pill, thumbnail (from clip poster).
- **IncidentDetail** — `<video>` player with overlay clip. Summary text (if VLM enabled). Detections grouped by track_id. Acknowledge button.
- **Calendar** — month view; each day cell shows incident count and a sparkline of detection density. Click a day → drill into that day's timeline.

### 8.3 UX rules
- No loading spinners. Use skeleton rows that match the final shape, in `var(--surface-elev)`.
- Numbers and timestamps in JetBrains Mono.
- All action buttons uppercase mono.
- No animation longer than 150ms. Easing: `ease-out` only.

### 8.4 Definition of done
- [ ] All pages routable; auth gates everything except `/login` and `/incidents/[id]/playback?token=`
- [ ] Live view works for 4 cameras simultaneously on a modern browser
- [ ] ROI editor produces valid polygons that match server-side
- [ ] Calendar view loads a month of data under 500ms with 1000 incidents
- [ ] Lighthouse perf score > 90 on overview page
- [ ] Responsive down to 768px (no mobile-specific layout)

---

## 9. Authentication

- Lucia v3 with session cookies for browser, bearer token for API clients.
- Single role: `operator` (everyone can do everything). Admin role reserved for future.
- Passwords hashed with Argon2id.
- First-boot wizard prompts to create initial admin user (no signup endpoint after).
- No password recovery in v1 (operator can reset via CLI: `pnpm run reset-password <username>`).

---

## 10. Notification format

**WhatsApp:**
```
[OVERWATCH] Incident · {camera.name}
{classes joined by ', '} detected in {roi.name}
Started {opened_at relative}
{summary if available, else 'Generating summary…'}

Playback → {deep_link}
```

**Telegram:**
Same content as WhatsApp, but with inline keyboard:
```
[ View playback ]  [ Acknowledge ]
```

---

## 11. Agent tools

See §6.9 for the complete tool definition. Tools must:
- Accept Zod-validated input
- Return structured results suitable for the LLM to render in prose
- Time-bound queries (default 24h if no range specified)
- Cap returned rows (default 20)

---

## 12. Deployment & configuration

### 12.1 Docker compose

```yaml
# docker-compose.yml (production)
services:
  postgres:
    image: postgres:16-alpine
    volumes: [pg-data:/var/lib/postgresql/data]
    environment: { POSTGRES_DB: overwatch, POSTGRES_USER: overwatch, POSTGRES_PASSWORD: ${POSTGRES_PASSWORD} }
    healthcheck: { test: pg_isready, interval: 10s }

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes: [redis-data:/data]

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    volumes: [minio-data:/data]
    environment: { MINIO_ROOT_USER: ${MINIO_USER}, MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD} }

  ov-ingestor: { build: services/ov-ingestor, env_file: .env, depends_on: [postgres, redis, minio] }
  ov-detector: { build: services/ov-detector, env_file: .env, depends_on: [redis, minio], deploy: { resources: { reservations: { devices: [{ driver: nvidia, count: 1, capabilities: [gpu] }] }}}}
  ov-clip-builder: { build: services/ov-clip-builder, env_file: .env, depends_on: [redis, minio] }
  ov-vlm: { build: services/ov-vlm, env_file: .env, depends_on: [redis], profiles: [vlm] }
  ov-incident-engine: { build: services/ov-incident-engine, env_file: .env, depends_on: [postgres, redis] }
  ov-notifier: { build: services/ov-notifier, env_file: .env, depends_on: [postgres, redis] }
  ov-whatsapp: { build: services/ov-whatsapp, env_file: .env, depends_on: [redis, ov-agent] }
  ov-telegram: { build: services/ov-telegram, env_file: .env, depends_on: [redis, ov-agent] }
  ov-agent: { build: services/ov-agent, env_file: .env, depends_on: [postgres, redis] }
  ov-api: { build: services/ov-api, env_file: .env, depends_on: [postgres, redis] }
  ov-stream-gateway: { build: services/ov-stream-gateway, env_file: .env, depends_on: [postgres] }
  ov-dashboard: { build: services/ov-dashboard, env_file: .env, depends_on: [ov-api] }

  caddy:
    image: caddy:2-alpine
    ports: ["80:80", "443:443"]
    volumes: [./infra/caddy/Caddyfile:/etc/caddy/Caddyfile, caddy-data:/data]

volumes: { pg-data: , redis-data: , minio-data: , caddy-data: }
```

VLM service runs under a `vlm` profile so deployments without GPU/local LLM can `docker compose up` without it.

### 12.2 .env.example

Ship `.env.example` covering every variable referenced above. README points to it.

### 12.3 Makefile targets

```
make up          # docker compose up -d
make down        # docker compose down
make logs        # docker compose logs -f
make seed        # seed test data
make reset       # nuke volumes, recreate
make e2e         # run e2e smoke test
make migrate     # run drizzle migrations
make codegen     # regenerate schemas
```

---

## 13. Definition of done (overall)

The system is done when **all of the following hold**:

### Functional
- [ ] Fresh clone + `docker compose up` brings the system up cleanly
- [ ] First-boot wizard creates admin user; login works
- [ ] Adding a camera by RTSP URL connects within 30s and begins emitting frames
- [ ] Drawing an ROI persists and takes effect immediately for new detections
- [ ] An incident in an ROI produces:
  - [ ] A WhatsApp message within 30s of crossing the linger threshold
  - [ ] A dashboard incident record with overlay clip
  - [ ] (If VLM enabled) A summary attached within 2 minutes
- [ ] Replying to the WhatsApp message with "what happened in the last hour" returns a coherent answer
- [ ] Acknowledging an incident from Telegram updates the dashboard
- [ ] Live view plays in browser with overlay boxes
- [ ] Calendar view shows historical incidents
- [ ] Retention policies prune old data on schedule

### Non-functional
- [ ] All services have `/health` endpoints returning structured status
- [ ] All services emit structured JSON logs
- [ ] Log levels respect `LOG_LEVEL` env
- [ ] No service has hard-coded secrets
- [ ] All HTTP endpoints are auth-protected (except `/auth/login`, `/health`, `/webhook`, and signed deep-links)
- [ ] OpenAPI spec available at `/openapi.json` from `ov-api`
- [ ] Postgres migrations are reversible
- [ ] Container images build under 1GB each (excluding the detector with model weights)

### Documentation
- [ ] `README.md` covers: prereqs, quickstart, env vars, troubleshooting
- [ ] Each service has its own `README.md` with one paragraph explaining what it does
- [ ] An architecture diagram in `README.md`
- [ ] First-boot wizard described

---

## 14. Testing requirements

### Per service
- **Unit tests** for all pure functions and state machines (target 80% line coverage on non-IO code)
- **Integration tests** for service ↔ DB and service ↔ Redis interactions
- Tests run via `pnpm test` (TS) or `uv run pytest` (Python)

### End-to-end
A single `make e2e` script that:
1. Spins up the full stack with `docker compose -f docker-compose.dev.yml up -d`
2. Seeds test data (admin user, test camera pointing at a built-in mediamtx synthetic RTSP source)
3. Runs a Playwright suite that:
   - Logs in
   - Adds a camera
   - Draws an ROI
   - Injects a synthetic person into the test RTSP source (via a separate test camera generator)
   - Verifies an incident appears in the dashboard
   - Verifies a notification is dispatched to a test WhatsApp webhook receiver
   - Sends a test message to the agent and verifies a sensible response
4. Tears down

This script must pass green in CI.

### Load test (target, not blocking v1)
- 8 cameras × 5 fps × 24 hours: system stays stable, no memory leaks, incident latency p99 < 30s

---

## 15. Out of scope (v1)

- Face recognition / person ID
- Multi-tenancy
- Mobile native apps
- Audio analysis
- Cross-camera tracking (object handoff between cameras)
- Push notifications via APNs/FCM
- Webhook integrations (Slack, Discord, etc.) — only WhatsApp + Telegram
- SAML/SSO
- Role-based access beyond single `operator` role
- Encrypted-at-rest storage (rely on infra-level encryption)

Future work should be filed as GitHub issues with `v2` label.

---

## Appendix A — How to start

Recommended implementation order:

1. **Foundation**: monorepo, schemas package, shared-ts, shared-py, Postgres migrations, Redis, MinIO, Docker compose dev profile working.
2. **Vision plane**: ov-ingestor → ov-detector. Verify detections land in Redis with a CLI consumer.
3. **Incident engine**: consume detections, write incidents, emit lifecycle events.
4. **Clip builder**: produce overlay clips for incidents.
5. **API + dashboard skeleton**: auth, camera CRUD, ROI editor, incident list.
6. **Notifier + bots**: WhatsApp first, then Telegram.
7. **Agent**: Glove integration, tools, conversation memory.
8. **Live streaming**: stream gateway with mediamtx, dashboard live view.
9. **VLM**: optional, can be deferred.
10. **Hardening**: tests, e2e, retention jobs, observability.

Each step should land green CI before moving to the next.