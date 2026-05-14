# ov-ingestor

Connects to each enabled camera's RTSP URL, writes 10-second `.ts` segments
to MinIO, samples frames at the configured fps, and emits `frame.sampled` +
`segment.ready` + `camera.status_changed` events on Redis Streams.
