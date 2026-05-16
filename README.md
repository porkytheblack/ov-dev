# Overwatch

Multi-camera AI surveillance for self-hosted compounds. Real-time detection,
ROI-driven incident lifecycle, WhatsApp and Telegram alerts, conversational
agent over messenger.

## Quickstart

```bash
git clone <this repo>
cd overwatch
cp .env.example .env
# Edit .env: set WhatsApp + Telegram tokens, ANTHROPIC_API_KEY, secrets, etc.
make up
```

Open `http://localhost:9090`. First boot redirects to a wizard that creates
the initial operator account.

## Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│  ov-dashboard (Next.js 14, port 3000)                               │
│  └── ov-api  (Hono+Lucia, port 3001)                                │
│      └── ov-stream-gateway (mediamtx WebRTC/HLS, port 8889/8554)    │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          │  Postgres 16 · Redis Streams · MinIO (S3)
                          ▼
┌──────── Vision plane (Python) ─────┐  ┌────── App plane (TS) ──────┐
│  ov-ingestor  → frames + segments  │  │  ov-incident-engine        │
│  ov-detector  → YOLO + BoT-SORT    │  │  ov-notifier               │
│  ov-clip-builder → overlay clips   │  │  ov-whatsapp / ov-telegram │
│  ov-vlm (optional, profile=vlm)    │  │  ov-agent (Glove)          │
└────────────────────────────────────┘  └────────────────────────────┘
```

All cross-plane communication is via Redis Streams using the event schemas
defined in `packages/schemas/src/events.ts`. The Pydantic mirrors are
auto-generated into `packages/schemas/pygen/events.py` — run `make codegen`
after editing the TypeScript source of truth.

## Make targets

| Target | Description |
|---|---|
| `make up` | `docker compose up -d --build` |
| `make down` | stop containers |
| `make logs` | tail logs |
| `make seed` | seed retention policies + (with `SEED_TEST_CAMERA=1`) a synthetic camera |
| `make reset` | stop + drop volumes |
| `make e2e` | bring up the dev stack with a synthetic RTSP source and run the smoke test |
| `make codegen` | regenerate Python event models |
| `make dev-rtsp` | start the dev overlay with the `mediamtx` synthetic source |

## Configuration

See `.env.example` for every variable. Required for the demo:

- `ANTHROPIC_API_KEY` — for the agent
- `WHATSAPP_PHONE_NUMBER_ID` + `WHATSAPP_ACCESS_TOKEN` — for outbound WhatsApp
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` — set the same value in your Cloud API webhook config
- `TELEGRAM_BOT_TOKEN` — for the Telegram bot
- `DEEP_LINK_TOKEN_SECRET` — 32-byte random for the signed playback links

Inbound WhatsApp webhooks are served at `http://<your-host>/webhook/whatsapp`
(routed via Caddy → `ov-whatsapp:3010`).

## Testing the demo flow

1. `make up` and open `http://localhost:9090`. Create the admin user via the
   first-boot wizard.
2. Add a camera (`/cameras/new`). Use a real RTSP URL or, for a
   throw-away test, run `make dev-rtsp` and use `rtsp://mediamtx:8554/test`.
3. Wait for `STATUS=ONLINE` in the camera grid (≤ 30s).
4. Click into the camera and configure an ROI (`/cameras/[id]/setup`). Pick
   `person` (or whatever class is relevant) and a 60s linger threshold.
5. Add a WhatsApp / Telegram subscriber in `/settings` (the channel handles
   here are the user's phone number / chat id).
6. Walk in front of the camera. After the linger threshold you should:
   - See an incident appear in `/incidents`.
   - Receive a WhatsApp / Telegram alert with a signed playback link.
   - Be able to ask the agent "what happened in the last hour" over the
     same channel.

## Project layout

- `packages/schemas` — Zod event schemas + Drizzle table schemas. Single
  source of truth; the build script emits Pydantic mirrors.
- `packages/shared-ts` — Redis stream helpers, Postgres client, MinIO client,
  logger.
- `packages/shared-py` — same primitives for the Python plane.
- `services/ov-*` — one folder per service. Each has its own `README.md`.
- `infra/` — Postgres init, Redis config, Caddyfile.
- `scripts/` — `seed.ts`, `reset-password.ts`, `e2e.sh`, `gen-schemas.sh`.

## GPU vs CPU detector

The `ov-detector` image installs **CPU-only PyTorch** by default to keep
the image small (avoids 2GB+ of CUDA wheels). For a GPU build, override
the torch index at build time:

```bash
docker compose build \
  --build-arg TORCH_INDEX=https://download.pytorch.org/whl/cu121 \
  ov-detector
```

Set `DEVICE=cuda:0` in `.env` to actually run on the GPU.

## Troubleshooting

- **Detector skips frames / no incidents fire.** Check
  `docker compose logs ov-detector`. The YOLO weights download on first use
  to `/models`; subsequent runs are cached in the `models` named volume.
- **`docker compose up` fails on Postgres init.** Run `make reset` to drop
  volumes — partial init from a crashed first boot can leave inconsistent
  state.
- **WhatsApp webhook 403.** Make sure
  `WHATSAPP_WEBHOOK_VERIFY_TOKEN` matches the value configured in Meta's
  app dashboard.
- **No live snapshot in the dashboard.** Ingestor frames flow at the rate
  configured per camera (default 5fps). If the camera is `OFFLINE` check the
  RTSP URL and `docker compose logs ov-ingestor`.

## Status

`v1`. See `build-spec.md` for the original specification and the
"Out of scope" section for what's deferred.
