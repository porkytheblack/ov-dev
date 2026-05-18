# ov-station

Background orchestration for Overwatch, built on [Station](https://station.dterminal.net).
Signal + broadcast runners persist into the same Postgres as the rest of the
stack via `station-adapter-postgres`.

## What it runs

| Job | Type | Trigger |
|---|---|---|
| `analyze-incident-clip` | broadcast | Redis `clips` stream (incident kind) |
| `daily-summary` | recurring signal | every 24h |
| `r2-sweep` | recurring signal | every 10m |

### Vision pipeline (`analyze-incident-clip`)

```
fetch-clip-context  → decide analyse vs skip (camera.vlm_enabled + Mimo configured)
  └─ upload-clip-to-r2   clip (+poster) MinIO → Cloudflare R2 (public URL)
       └─ analyze-clip    Mimo vision model resolves the summary
            ├─ write-summary   persist incident.summary + publish summary.ready
            └─ cleanup-r2      delete the transient R2 object
```

R2 is a *transient* store: a clip lives there only for its processing
window. `cleanup-r2` runs under the `continue` failure policy so the object
is removed even if the model call fails; `r2-sweep` is the crash safety net.

The vision model is Xiaomi MiMo via `@overwatch/ai` — set `MIMO_*` env vars.

### Daily summary

Compiles a 24h incident digest and pushes it to every enabled WhatsApp /
Telegram subscriber through the existing `bot_outbox` streams.

## Dashboard

```bash
pnpm --filter @overwatch/ov-station dashboard   # station-kit UI
```

Reads the same Postgres job store. Auth + port via `STATION_DASHBOARD_*`.

## Env

`DATABASE_URL`, `REDIS_URL`, `MIMO_*`, `R2_*`, `R2_TTL_MINUTES`,
`STATION_HEALTH_PORT`, `STATION_DASHBOARD_*`. See root `.env.example`.
