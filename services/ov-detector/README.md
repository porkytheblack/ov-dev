# ov-detector

Subscribes to `frames.{camera_id}` for every enabled camera, fetches each
sampled frame from MinIO, runs YOLO11L + BoT-SORT, emits
`frame.detections` events and persists rows into the partitioned
`detections` table.
