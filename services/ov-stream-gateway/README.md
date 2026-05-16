# ov-stream-gateway

Wraps `mediamtx` to relay each camera's RTSP feed to the browser via WebRTC
(preferred) or LL-HLS (fallback). The Node wrapper renders an `mediamtx.yml`
from the enabled cameras list, spawns mediamtx, and gates all stream
endpoints behind an Overwatch session by proxying to `ov-api`'s
`/api/auth/me`. Bounding boxes are NOT painted server-side — the dashboard
draws them on a `<canvas>` aligned to the video element.
