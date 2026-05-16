# Overwatch — Test & Autofix Handover

You are taking over an in-progress implementation of the **Overwatch**
multi-camera AI surveillance system (`build-spec.md`). The end-to-end stack is
built; your job is to **exercise it, find what's broken, and fix it without
waiting for a human**.

---

## Mission

1. Bring the stack up.
2. Walk the demo flow end-to-end (camera → ROI → incident → notification → agent).
3. When something breaks, diagnose from logs, fix the code, rebuild **only the
   service(s) that changed**, re-test. Don't ping the user between each round.
4. Commit + push on every fix. The branch is already attached to PR #1.

You are authorised to make code, infra, and config changes anywhere in the
repo. You may NOT delete data volumes, force-push, push to `main`, or touch
secrets.

---

## Repository ground truth

- **Branch:** `claude/complete-build-spec-eClEN` (already checked out)
- **PR:** https://github.com/porkytheblack/ov-dev/pull/1 — push to the branch updates it
- **Spec:** `build-spec.md` (especially §13 Definition of Done, §7 core flows)
- **Top-level README:** `README.md`
- **Architecture overview & per-service notes:** `services/*/README.md`
- **Skills:** the spec says use `/glove` for agent work and `/station` for orchestration. Both are loaded into this environment.

Repo layout:
```
packages/schemas/         # Zod events + Drizzle tables + Pydantic codegen
packages/shared-ts/       # Redis/Postgres/MinIO clients (TS)
packages/shared-py/       # Same primitives (Python)
services/
  ov-ingestor/            # Py · RTSP → segments + frames
  ov-detector/            # Py · YOLO11L + BoT-SORT
  ov-incident-engine/     # TS · ROI matcher, lifecycle, suppression
  ov-clip-builder/        # Py · overlay clips + posters
  ov-vlm/                 # Py · optional summaries via local VLM
  ov-notifier/            # TS · fan-in clip-ready, signed deep links
  ov-whatsapp/            # TS · WhatsApp Cloud API
  ov-telegram/            # TS · Telegram bot
  ov-agent/               # TS · Anthropic tool-use loop (Glove-style)
  ov-api/                 # TS · Hono + Lucia-style auth + WS /events
  ov-stream-gateway/      # TS · mediamtx wrapper
  ov-dashboard/           # Next.js 14
infra/{postgres,redis,caddy}/   # init.sql, redis.conf, Caddyfile
```

Single source of truth: `packages/schemas/src/events.ts`. The Python
mirror is generated via `make codegen` — re-run after edits.

---

## Bring it up (every cold start)

```bash
# First time on this machine: copy env
[ -f .env ] || cp .env.example .env
# Edit .env: at minimum set ANTHROPIC_API_KEY for the agent.
# WhatsApp + Telegram tokens optional for messenger tests.

make up                 # builds + starts everything
make logs               # tail logs in a second pane

# If editing existing data and you've added a column:
make migrate            # idempotent re-pipes init.sql
```

Caddy publishes on **http://localhost:9090** (NOT 80 — that bit me earlier).

Force a clean rebuild of one service when its code changed:
```bash
docker compose build --no-cache <service>
docker compose up -d --force-recreate <service>
```

---

## Demo flow (this is the test you must run)

1. Open http://localhost:9090.
2. First-boot wizard → create admin user. Browser should land on `/`.
   - If you keep getting bounced to the wizard, see "Auth loop" below.
3. `/cameras/new` → real RTSP URL → ADD. Default 25 fps (HikVision/PAL).
4. On `/cameras/[id]/setup`, click **PROBE RTSP**. Expect
   `REACHABLE · <codec> · <res> · <fps>`. If `FAILED`, the body of the message
   is the ffprobe stderr — read it.
5. Draw an ROI polygon (click vertices, double-click to close). Pick
   `classes_of_interest = [person]`, write a per-ROI description. SAVE ROI.
6. `/settings` → add a WhatsApp or Telegram subscriber (or both).
7. Trigger detection (walk in front of the camera or push a synthetic stream).
   Within `linger_threshold_seconds` (default 60), an incident must appear in
   `/incidents` with overlay clip and a notification must reach the messenger.
8. Reply to the bot with "what happened in the last hour" — the agent must
   answer factually using the search_incidents tool.

If any of those steps fails, treat it as a bug — diagnose, fix, push.

For a no-real-camera test, use the dev synthetic RTSP source:
```bash
make dev-rtsp           # spawns a mediamtx container on the docker network
# Use rtsp://mediamtx:8554/<path> when adding the camera (publish a stream to it first).
```

---

## Health endpoints (use these before reading logs)

| Service | URL |
|---|---|
| ov-api | http://localhost:3001/health (dev overlay exposes it) |
| ov-ingestor | `docker compose exec ov-ingestor curl -s localhost:8000/health` |
| ov-detector | `… ov-detector curl -s localhost:8000/health` |
| ov-clip-builder | `… ov-clip-builder curl -s localhost:8000/health` |
| ov-vlm | `… ov-vlm curl -s localhost:8000/health` |
| ov-incident-engine | `… ov-incident-engine curl -s localhost:8001/health` |
| ov-notifier | `… ov-notifier curl -s localhost:8002/health` |
| ov-agent | `… ov-agent curl -s localhost:3000/health` |
| Aggregate | `/settings` page in the dashboard pulls them all |

`ov-ingestor /health` returns per-camera `rtsp_url`, `sample_fps`, `name` — use
it to confirm the ingestor sees your DB changes.

---

## Things that have already bitten us (debugging playbook)

### "Wizard loop" / "sign-in doesn't work"
Root cause was almost always one of:
- **Cookie not landing on the right origin.** All browser-side fetches must
  be relative (`/api/...`) and go through Caddy. SSR uses `INTERNAL_API_URL`
  (defaults `http://ov-api:3001`) — never `NEXT_PUBLIC_API_URL`.
- **Auth status check broken.** Dashboard root uses `/api/auth/status` to
  decide wizard-vs-login. If you change auth, keep that endpoint working.

### "RTSP probe / save returns empty body"
- **Container not rebuilt.** Docker layer caching can hide source changes.
  Use `--no-cache --force-recreate` (see "Bring it up").
- **Browser cached JS bundle.** Cmd/Ctrl+Shift+R.
- **Endpoint missing.** If ov-api hits ov-ingestor `/probe` and gets 404, the
  ingestor image is stale — rebuild it.

### "PATCH says 200 but the row didn't change"
The `cameras` and `rois` PATCH endpoints USED to build the UPDATE by reducing
`sql\`…\`` fragments — that didn't compose correctly in this postgres.js
version. They now use static `COALESCE(${value}, column)`. Keep that pattern
for any new dynamic-update endpoint you write. Always return the updated row
(`RETURNING *`) so the client can hydrate without a follow-up GET.

### "Ingestor doesn't notice RTSP/FPS change"
The reconcile loop in `services/ov-ingestor/overwatch_ingestor/main.py` runs
every 15s and detects `rtsp_url` / `sample_fps` drift, then restarts the
worker. If you change other camera fields and the ingestor should react,
extend `_worker_outdated`.

### "Cascade delete fails"
`incidents.camera_id` and `incidents.roi_id` need `ON DELETE CASCADE`. They
do today via the migration block at the bottom of `infra/postgres/init.sql`.
If you add new tables that reference `cameras` or `rois`, choose the cascade
behaviour deliberately.

### "VLM offline"
ov-vlm is no longer profile-gated. If `/settings` shows it offline, check
`docker compose logs ov-vlm` — the most common cause is the container
crashing because `VLM_ENDPOINT` is unreachable AND the container errored
during start. The service should idle gracefully without a VLM endpoint;
fix any path that crashes instead.

### "Detector image build timed out on torch/CUDA"
The detector Dockerfile pre-installs **CPU-only** torch from
`https://download.pytorch.org/whl/cpu` so ultralytics doesn't drag in 2GB of
CUDA wheels. For a GPU build:
```bash
docker compose build \
  --build-arg TORCH_INDEX=https://download.pytorch.org/whl/cu121 ov-detector
# Set DEVICE=cuda:0 in .env
```

### "Auth-protected route returns 401 for a logged-in user"
- The `/api/auth/me` middleware reads cookie `ov_session` OR header
  `Authorization: Bearer <session-id>`.
- Lucia-style sessions live in the `sessions` table; check the user's row.

---

## Verification commands

```bash
# TS workspace typecheck (must be clean):
pnpm -r typecheck

# Unit tests:
pnpm -r --filter "@overwatch/*" test

# Python syntax sanity (no pytest in CI yet — at minimum parse files):
python3 -c "import ast, sys; \
  [ast.parse(open(f).read()) for f in sys.argv[1:]]; print('OK')" \
  services/ov-*/overwatch_*/main.py packages/shared-py/overwatch_shared/*.py

# Compose validity:
cp .env.example .env && docker compose config -q && rm .env

# Dashboard build (catches Tailwind / Next issues):
cd services/ov-dashboard && pnpm build
```

Before committing any change, run at least:
```bash
pnpm -r typecheck
cd services/ov-dashboard && pnpm build
```

---

## Workflow expectations

- **Tight loops.** Read logs, hypothesize, fix, rebuild only the changed
  service, retest. Don't `make up` from scratch every cycle.
- **Commit per fix.** Conventional-style messages, e.g. `fix(api): …` /
  `feat(dashboard): …`. End each message with a session URL line if you have
  one; otherwise omit.
- **Push immediately.** The branch tracks `origin/claude/complete-build-spec-eClEN`
  and PR #1 will update.
- **Never force-push, never push to main, never delete volumes (`make reset`)
  unless explicitly authorised by the user.**
- **Don't touch `.env`** — it's gitignored and machine-local. Edit
  `.env.example` only when you're adding new vars all users will need.
- **Comments policy:** match the existing codebase. Short, only when the WHY
  is non-obvious. No "added this line because X" archaeology comments.

---

## Where to look first when X breaks

| Symptom | First file to read |
|---|---|
| Wizard loop / login fails | `services/ov-dashboard/app/login/page.tsx`, `app/page.tsx`, `services/ov-api/src/routes/auth.ts`, `src/middleware.ts` |
| Camera shows OFFLINE forever | `docker compose logs ov-ingestor`, then `services/ov-ingestor/overwatch_ingestor/camera_worker.py` |
| Frames not detected | `docker compose logs ov-detector`, then `services/ov-detector/overwatch_detector/model.py` (check YOLO weights at /models) |
| Incidents never open | `services/ov-incident-engine/src/engine.ts`, particularly `handleDetections` and the linger threshold logic |
| Incident opens but no clip | `services/ov-clip-builder/overwatch_clip_builder/main.py`, check `_fetch_segments` returns rows |
| Clip ready but no WhatsApp | `services/ov-notifier/src/main.ts` (waiting map / dispatch fan-in), `services/ov-whatsapp/src/main.ts` (token + phone-id env) |
| Agent gives wrong answer | `services/ov-agent/src/tools.ts` — likely a query bug |
| Dashboard JS old after rebuild | hard-refresh browser; otherwise force-recreate the container |

---

## Useful one-liners

```bash
# Tail one service:
docker compose logs -f ov-incident-engine

# Inspect a Redis stream's recent entries:
docker compose exec redis redis-cli XRANGE incidents - + COUNT 20

# Check current camera rows:
docker compose exec postgres psql -U overwatch -d overwatch \
  -c "select id, name, status, last_frame_at from cameras"

# List the latest segments for a camera:
docker compose exec postgres psql -U overwatch -d overwatch \
  -c "select start_ts, size_bytes from segments where camera_id = '<UUID>' order by start_ts desc limit 5"

# Trigger PROBE from the CLI:
docker compose exec ov-api curl -s -X POST -H 'content-type: application/json' \
  -d '{"rtsp_url":"rtsp://host/stream"}' \
  http://ov-ingestor:8000/probe
```

---

## Done is done when

- Definition of Done in `build-spec.md` §13 passes manually
- `pnpm -r typecheck` is clean
- `cd services/ov-dashboard && pnpm build` is clean
- `make e2e` (if you bring it up) passes
- The PR's diff against `main` only contains your intentional changes
