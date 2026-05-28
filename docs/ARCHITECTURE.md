# Overwatch — End-to-End Architecture

How the system goes from an RTSP feed on the wall to a Telegram/WhatsApp
alert in the operator's pocket. Names match the actual services and Redis
streams in this repo.

---

## 1. Infrastructure spine

| Component   | Role                                                                 |
|-------------|----------------------------------------------------------------------|
| Postgres    | Source of truth: cameras, ROIs, incidents, clips, segments, users, subscribers, `bot_outbox` tracking, fire-alert rate-limit log, summary dispatch log. |
| Redis       | The event bus. Every service-to-service message is a Redis Stream (`xadd` / consumer-group `xreadgroup`). |
| MinIO       | Object storage. Three buckets: `overwatch-segments` (raw 10s .ts), `overwatch-frames` (sampled JPEGs, ephemeral), `overwatch-clips` (incident clips + posters + on-demand `ondemand/<id>.h264.mp4` footage). |
| Caddy       | Public ingress, behind Cloudflare. Routes `/api/*` → ov-api, `/webhook/whatsapp*` → ov-whatsapp, `/stream/*` + `/events` → ov-stream-gateway, falls through to ov-dashboard. |
| Cloudflare R2 | Transient public hosting for clip frames the MiMo vision model needs to fetch over the internet. Reclaimed by `r2-sweep`. |

---

## 2. Ingestion — RTSP to Redis

`ov-ingestor` runs one asyncio task per enabled camera (polls DB live, so
adding a camera in the dashboard doesn't require a restart). Each camera
worker spawns **two** parallel pipelines off the camera's RTSP URL:

**Pipeline A — recording (continuous):**
- `ffmpeg` writes 10-second `.ts` segments to disk.
- Each segment is uploaded to MinIO `overwatch-segments/<cam>/YYYY/MM/DD/...`.
- A row goes into the `segments` table, and a `segment.ready` event is
  published to Redis stream `segments`.
- Source codec is **HEVC** (stream-copied from Hikvision); transcoded
  to H.264 only when a browser, iOS, or Telegram has to play it.

**Pipeline B — sampling (for inference):**
- OpenCV captures frames at native rate; uploads are throttled to
  `sample_fps` (~1–2 fps).
- Each JPEG goes to MinIO `overwatch-frames/<cam>/<frame_id>.jpg`.
- A `frame.sampled` event is published to per-camera stream
  `frames.<cameraId>` (`STREAMS.frames(id)`).
- The frames stream is hard-capped (`FRAMES_STREAM_MAXLEN: "6"`,
  ~1s of buffer) so the CPU detector always works on near-live frames.

---

## 3. Detection — frames to detections

`ov-detector` consumes `frames.<cameraId>` with a per-camera consumer task
(spawned dynamically as new cameras appear) and runs **two** YOLO models:

1. **COCO model** (`yolo11n.pt`, IMGSZ=480) — general object detection
   with ByteTrack for stable `track_id`s (used by the engine to
   dedupe an incident across frames).
2. **Fire/smoke model** (HF `SalahALHaismawi/yolov26-fire-detection`) —
   throttled to ≤1 inference / camera / `FIRE_INTERVAL_SECONDS` (5s) so
   CPU stays bounded. Results merge into the same output stream.

Outputs:
- `frame.detections` event → per-camera stream `detections.<cameraId>`.
- Class-deny list (`DETECT_DENY_CLASSES`: boat, sheep, cow, …) drops the
  CPU model's worst hallucinations **before** they reach the engine.
- For a frame that carried a fire/smoke detection, the frame is **kept**
  in MinIO (not deleted by the cleaner) and `frame_key` is threaded into
  the event so the adjudicator can show it to MiMo.

Frame JPEGs not retained for fire are deleted seconds after consumption.

---

## 4. Engine — detections to incidents (and fire alerts)

`ov-incident-engine` consumes `detections.<cid>` per camera. Two
independent decision paths run on every batch:

### 4a. Incident path (zones + tracking)

- Drop detections by class-aware confidence floor
  (`OV_CONFIDENCE_PERSON` 0.65 vs `OV_CONFIDENCE_DEFAULT` 0.8).
- Drop any detection whose centroid sits inside an **exclude ROI**
  (`rois.kind='exclude'`) — silently blinds that area.
- For each `include` ROI active in its `detection_window`, match
  detections by centroid/bbox against the polygon.
- Open / refresh an incident row keyed by `(camera, roi, track_id)`;
  publish `incident.opened` to stream `incidents`.
- After a configurable linger (no further matches), publish
  `incident.closed`.

The incident row carries `camera_id`, `roi_id` (NOT NULL), `classes`,
`opened_at`, etc.

### 4b. Fire path (no ROI, urgent)

Fire is deliberately decoupled from the incident table (incidents.roi_id
is NOT NULL; fire has no ROI). The engine buffers fire/smoke hits per
camera and only acts when **≥`OV_FIRE_MIN_HITS` (3) hits within
`OV_FIRE_WINDOW_SEC` (40s)** — kills single-frame flicker false
positives. Once that triggers, it splits by confidence:

| Tier                                                        | Action |
|-------------------------------------------------------------|--------|
| `confidence ≥ OV_FIRE_HIGH_CONF`                            | **Direct alert** via shared `dispatchFireAlert` → `bot_outbox.<channel>`. |
| `OV_CONFIDENCE_FIRE ≤ confidence < OV_FIRE_HIGH_CONF`       | Publish `fire.review` → ov-station picks it up and adjudicates with MiMo (see §6). |

Cooldown (`OV_FIRE_ALERT_COOLDOWN_SEC`, default 300s) is enforced in
Postgres (`fire_alert_log`) so a restart cannot re-spam alerts inside
the window. Same `dispatchFireAlert` is used by the engine AND by
`raise-fire-alert` — single source of truth for message format and rate
limiting.

---

## 5. Clip building — incident closed to ready clip

`ov-clip-builder` (Python) consumes the `incidents` stream:

- On `incident.opened`: stash the incident in memory.
- On `incident.closed`: window = `[opened_at − FOOTAGE_PRE_S,
  closed_at + FOOTAGE_POST_S]`. Pull every overlapping row from
  `segments`, download from MinIO, ffmpeg-concat **and transcode to
  H.264 + yuv420p + +faststart** (so every browser, iOS Safari, and
  Telegram can play it), draw bbox overlays, write a poster frame.
- Upload clip + poster to MinIO `overwatch-clips/...`. Insert `clips`
  row with `retention_until` (90d for incident clips, 3d for regular).
- Mark the incident row `clip_status='ready'`, `clip_url=s3://...`.
- Publish `clip.ready` to stream `clips`.

`clip.ready` carries `incident_id`, `camera_id`, `kind`, `storage_key`,
`poster_key`, time range.

---

## 6. Station — orchestration and analysis

`ov-station-api` (the `station` CLI in dashboard mode) runs both the
HTTP API and the signal/broadcast runners; `ov-station` is a thin
container that consumes Redis streams and **remotely triggers**
broadcasts over the v1 API. Two pipelines matter for the alert flow:

### 6a. `analyze-incident-clip` broadcast

Triggered when an incident clip is ready (or manually from the
dashboard's "Analyze video" button, with `force:true`):

```
fetch-clip-context ─┐
                    ├─ analyze-clip (MiMo vision via R2 URL)
upload-clip-to-r2 ──┘            │
                                 ├─ write-summary  (UPDATE incidents.summary,
                                 │                  publishes summaries event)
                                 └─ cleanup-r2     (delete the R2 object)
```

Notes:
- `analyze-clip` uses `analyzeWithMimoVision` — a **forced
  `report_scene` function call** (activity / objects[] / noteworthy)
  because MiMo's free-form prompts get refused as "high risk".
- `REFUSAL_RE` → `MimoRefusalError` so a refusal is NEVER stored as
  `incidents.summary`. The signal retries.
- `write-summary` publishes `summary.ready` to stream `summaries`.

### 6b. `adjudicate-fire` broadcast

Triggered when ov-station consumes `fire.review` from the engine:

```
fire-verdict (MiMo second opinion on the retained frame)
  ├─ raise-fire-alert     (only if decision === "fire")
  └─ cleanup-fire-frame   (always, after fire-verdict)
```

- "false_alarm" and "unavailable" both **suppress** the alert
  (operator chose no-spam while MiMo is down). High-confidence fire
  is unaffected — that path bypasses station entirely.
- `raise-fire-alert` calls the same `dispatchFireAlert` as the engine.

### 6c. Recurring signals

- `window-summaries` (every 15m) — 🌙 overnight (22:00→06:00) and
  ☀️ daytime (06:00→18:00) recaps. Self-gates on `OV_TIMEZONE`,
  atomic per-window claim via `summary_dispatch_log`. For each window
  incident missing a summary, force-triggers `analyze-incident-clip`,
  polls ≤240s, then **condenses** all per-incident summaries into one
  short gist via `summarizeWithMimo`. Publishes a `bot.outbox` message
  per subscriber with a per-camera "review in detail" calendar deep
  link button.
- `storage-prune` (every 30m) — reclaims expired clips, raw segments
  past `SEGMENT_RETENTION_HOURS` that no incident window touches,
  legacy on-demand footage.
- `r2-sweep` (every 10m) — reclaims orphaned R2 objects from failed
  `analyze-incident-clip` runs.
- `camera-health-watchdog` — per-camera RTSP wedge detector; auto-
  recovers via ingestor restart and pages the operator on persistent
  failure.

`station-signal` recurring jobs **have no startup catch-up** — every
restart delays each schedule by up to one full interval. A missed
window IS still re-sent (the dispatch-log gate), but only on the next
post-boot tick. This is expected, not a bug.

---

## 7. Notifier — events to bot outbox

`ov-notifier` is the fan-out hub. It runs three consumer groups in
parallel:

| Consumes              | Action                                                                                       |
|-----------------------|----------------------------------------------------------------------------------------------|
| `incidents` stream    | On `incident.opened`: resolve subscribers for the camera, publish a `bot.outbox` text alert per channel with an inline keyboard (Ack/Suppress/Close + View playback). Posts a `resolved` `alert` item to the agent inbox so the agent "knows" what was sent. |
| `clips` stream        | On `clip.ready` for an incident: looks up the incident's notification, attaches the clip URL → bot_outbox message gets a video attachment + deep-link playback button. |
| `summaries` stream    | On `summary.ready`: **edit-in-place** for Telegram (publishes a `bot.outbox` with `edit:true`, full recomposed body + link attachment — the original alert's caption gets filled in). For WhatsApp (no edit API), sends a compact `📝` follow-up. Recency-gated by `SUMMARY_FOLLOWUP_MAX_AGE_MIN` (default 120) so the recap force-reanalyzing old incidents doesn't re-ping the chat. |

Subscriber model:
- `subscribers` row: `channel ('telegram'|'whatsapp')`, `handle` (chat
  id / wa_id), `enabled`, `camera_ids` (empty = all cameras).
- Playback deep links are signed (`DEEP_LINK_TOKEN_SECRET`) and
  delivered as a structured `{kind:"link", url, caption}` attachment —
  never inlined in message text.

---

## 8. Bot outbox — Telegram / WhatsApp delivery

There are two parallel outbox streams: `bot_outbox.telegram` and
`bot_outbox.whatsapp`. One consumer per stream.

### ov-telegram

- Single serial consumer of `bot_outbox.telegram`.
- For a clip attachment: fetches the MP4 from internal ov-api → **ffmpeg-transcodes to H.264 + yuv420p + +faststart** (ov-clip-builder
  output is `mpeg4` which Telegram can't play) → multipart upload
  via `sendVideo`. All fetches have bounded `AbortSignal.timeout`s
  (`TG_API_TIMEOUT_MS`, `TG_UPLOAD_TIMEOUT_MS`, `TG_CLIP_FETCH_TIMEOUT_MS`,
  `TG_AGENT_TIMEOUT_MS`) and retries (`TG_SEND_RETRIES`) so a hung
  upload can't wedge the entire outbox.
- Renders inline action keyboard from the message + handles
  `st:<id>:<status>` callback queries (auth-gated against
  `subscribers`) to update incident status.
- Supports `edit:true` for in-place caption edits (the auto-summary
  fills the original alert).
- Long-poll `getUpdates` for inbound chat → relays to ov-agent.

### ov-whatsapp

- Single serial consumer of `bot_outbox.whatsapp`.
- Reply buttons are sent as interactive `button_reply`s with id
  `st:<id>:<status>`; no edit-in-place (Meta has no edit API), so
  the summary arrives as a compact follow-up.
- Webhook at `/webhook/whatsapp` (Caddy-routed, NO prefix strip),
  verified with `WHATSAPP_WEBHOOK_VERIFY_TOKEN`. Subscriber gate:
  `channel='whatsapp'`, `handle=<wa_id digits, no +>`.
- Free-form outbound is only allowed inside WhatsApp's 24h window;
  proactive alerts outside need Meta-approved templates.

### ov-agent

The agent runtime (Glove + Postgres `StoreAdapter`) is the OTHER side
of inbound chat. Telegram/WhatsApp services POST to its `/chat`
endpoint; the agent uses MiMo, holds conversation state keyed by
`(channel, handle)`, and has tools to search incidents, set status,
fetch clips, send action buttons, summarize a day, etc. Outbound from
the agent also goes through `bot_outbox.<channel>` so delivery is
unified.

---

## 9. Two complete delivery walkthroughs

### Walkthrough A — Intrusion clip alert

```
RTSP frame
  → ov-ingestor: JPEG to MinIO, frame.sampled → frames.<cam>
  → ov-detector: YOLO COCO, frame.detections → detections.<cam>
  → ov-incident-engine: confidence + exclude + include-ROI match
       → incident.opened → stream incidents
  → ov-notifier (incidents consumer): subscribers fan-out
       → bot_outbox.telegram + bot_outbox.whatsapp (text alert, no clip yet)
  → ov-telegram / ov-whatsapp: send text + Ack/Suppress/Close keyboard
       (agent inbox gets a resolved "alert" item)

Meanwhile (parallel timeline):
  ov-ingestor continues to write 10s segments → MinIO + stream segments
  ov-incident-engine eventually emits incident.closed → stream incidents
  → ov-clip-builder: pull window segments, concat+transcode H.264,
       overlays + poster, write clips row, clip.ready → stream clips
  → ov-notifier (clips consumer): attaches the clip + playback deep link
       → bot_outbox.<channel>
  → ov-telegram: ffmpeg-transcode to H.264, sendVideo with playback button
  → ov-whatsapp: upload media id, send video

Auto-VLM (parallel, gated on engine NOT having suppressed the incident):
  ov-station consumes clip.ready → triggers analyze-incident-clip broadcast
    fetch-clip-context + upload-clip-to-r2 → analyze-clip (MiMo)
    → write-summary (UPDATE incidents.summary, summary.ready → stream summaries)
    → cleanup-r2
  → ov-notifier (summaries consumer): recency-check; if fresh, publish
       bot.outbox with edit:true and full body (telegram) OR compact follow-up
       (whatsapp)
  → ov-telegram: editMessageCaption on the original clip alert (preserving
       Ack/Suppress/Close + playback button)
  → ov-whatsapp: send a 📝 follow-up
```

Operator taps "Acknowledge" → callback → status update in DB →
`bot_outbox` messages tracked via `bot_incident_messages` are
cleaned up where the platform allows it.

### Walkthrough B — Fire alert

```
RTSP frame
  → ov-ingestor: JPEG to MinIO (frame retained for fire path)
  → ov-detector: fire/smoke model fires, frame.detections (with frame_key)
       → detections.<cam>
  → ov-incident-engine: buffer fire hits per camera.
       Once ≥3 hits in 40s:
         IF confidence ≥ OV_FIRE_HIGH_CONF
           → dispatchFireAlert: claim fire_alert_log row (cooldown),
              publish bot.outbox 🔥 with "Open live view" deep-link button
              to every subscriber's channel.
         ELSE (uncertain band)
           → publish fire.review → stream fire_review

  Uncertain band continues:
  → ov-station consumes fire_review → trigger adjudicate-fire broadcast
       fire-verdict (MiMo looks at frame_key in MinIO; refusal/timeout →
         "unavailable" → SUPPRESS, no alert)
       → if decision==="fire": raise-fire-alert calls dispatchFireAlert
          (same path as engine direct alert; same DB cooldown)
       → cleanup-fire-frame deletes the retained MinIO object (always)

  → ov-telegram / ov-whatsapp: 🔥 message with "🎥 Open live view" inline
       button to /cameras/<id> live page.
```

Single-frame flicker can't alert (≥3 hits / 40s gate). MiMo being
down can't spam (uncertain band suppresses). A restart can't re-alert
(Postgres-backed cooldown). High-confidence fire never waits on MiMo.

---

## 10. Recap delivery (window-summaries)

```
ov-station-api (every 15m tick) → window-summaries signal:
  Check OV_TIMEZONE wall clock; if it's past 06:00 (overnight) or 18:00
  (daytime), atomically claim summary_dispatch_log[<kind>:<date>].
  For each window incident missing a summary: force-trigger
    analyze-incident-clip via v1 API (Bearer STATION_API_KEY), poll ≤240s.
  Aggregate per-incident summaries (refusal-filtered).
  summarizeWithMimo condenses to a short highlights gist.
  For each subscriber, publish bot.outbox with:
    text  = the gist
    buttons = per-camera "📅 review in detail" → signCalendarLink →
              https://<dash>/api/portal?token=… → ov-api mints ov_session
              cookie → 302 /calendar/<date>?camera=<id>
  → ov-telegram / ov-whatsapp: deliver as a normal outbox message.
```

---

## 11. Stream + table cheat sheet

**Redis streams (`packages/schemas/src/events.ts → STREAMS`):**

```
frames.<cameraId>         frame.sampled         ingestor → detector
detections.<cameraId>     frame.detections      detector → engine, ov-api live overlay
segments                  segment.ready         ingestor → clip-builder
incidents                 incident.opened/closed engine → clip-builder, notifier
clips                     clip.ready            clip-builder → notifier, station
summaries                 summary.ready         station write-summary → notifier
fire_review               fire.review           engine → station (uncertain band only)
camera_status             camera.status_changed ingestor → ov-api (UI status pills)
bot_outbox.telegram       bot.outbox            anyone → ov-telegram
bot_outbox.whatsapp       bot.outbox            anyone → ov-whatsapp
```

**Key Postgres tables:**

```
cameras, rois (kind: include|exclude), incidents, clips, segments,
subscribers (channel,handle,enabled,camera_ids), users + ov_sessions,
bot_incident_messages (msg↔incident tracking for cleanup),
fire_alert_log (per-camera cooldown), summary_dispatch_log (recap claim),
agent_inbox (Glove resolved items the agent sees on resume).
```

**Buckets:**

```
overwatch-segments  raw 10s .ts HEVC (bulk; retention via storage-prune)
overwatch-frames    sampled JPEGs (ephemeral; detector deletes after use,
                    fire frames retained until cleanup-fire-frame)
overwatch-clips     incident MP4 + poster + ondemand/<id>.h264.mp4 footage
                    (retention via clips.retention_until)
```
