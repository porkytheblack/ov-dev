# ov-clip-builder

Consumes `incident.opened` + `incident.closed`, fetches overlapping raw
segments from MinIO, composites bounding boxes onto frames, uploads an
overlay MP4 + poster, and registers the clip. Also runs a 5-minute cron
that builds "regular" detection clips so the calendar view is browsable.
