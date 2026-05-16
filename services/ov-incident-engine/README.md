# ov-incident-engine

Consumes `detections.{camera_id}` for every enabled camera, applies the ROI
matching state machine (centroid or IoU, detection windows, linger thresholds,
suppression on early-exit), persists incidents to Postgres, and emits
`incident.opened` / `incident.closed` on Redis.
