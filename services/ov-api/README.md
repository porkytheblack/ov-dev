# ov-api

Hono-powered HTTP + WebSocket API for the dashboard. Lucia-style session
cookies + bearer-token auth, Zod-validated routes, OpenAPI spec at
`/openapi.json`. Live event stream over `WS /events`.

Notable routes:
- `POST /api/auth/wizard` — first-boot operator creation (only succeeds when the users table is empty)
- `POST /api/auth/login` / `logout` / `me`
- `GET/POST /api/cameras` (and `/:id`, `/:id/test`, `/:id/snapshot`)
- `GET/POST /api/cameras/:id/rois`, `PATCH/DELETE /api/rois/:id`
- `GET /api/incidents`, `GET /api/incidents/:id`, `POST /api/incidents/:id/acknowledge`
- `GET /api/incidents/:id/playback` (public, signed-token)
- `GET /api/clips`, `GET /api/clips/:id/stream`, `GET /api/clips/by-key/...` (public)
- `GET/POST /api/subscribers`, `DELETE /api/subscribers/:id`
- `GET/PUT /api/bot-configs/:channel`
- `GET /api/system/status`
- `WS /events`
