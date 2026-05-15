"""Detector entrypoint: subscribes to `frames.*` for every enabled camera,
runs YOLO on each frame from MinIO, publishes `detections.{camera_id}` events
and persists each detection to the (partitioned) detections table.
"""

from __future__ import annotations

import asyncio
import contextlib
import io
import os
import uuid
from collections.abc import Iterable
from datetime import datetime, timezone

import cv2
import numpy as np
import psycopg
from fastapi import FastAPI
from overwatch_shared import (
    BUCKETS,
    consume_group,
    ensure_buckets,
    ensure_group,
    get_logger,
    make_minio,
    make_redis,
    publish_event,
)

from .model import detector_singleton

log = get_logger("ov-detector")

# Cap the per-camera detections stream. It is consumed live by the ov-api WS
# (bbox overlay) and by ov-incident-engine; both stay near the tail in normal
# operation. Unbounded, it grew to tens of thousands of entries and any
# consumer that briefly fell behind (e.g. after a restart) then replayed an
# enormous backlog of stale detections. The cap bounds memory and worst-case
# catch-up while staying far above incident-engine's working set.
DETECTIONS_STREAM_MAXLEN = int(os.environ.get("DETECTIONS_STREAM_MAXLEN", "3000"))

app = FastAPI(title="ov-detector")

_workers: dict[str, asyncio.Task] = {}
_stop_event = asyncio.Event()


def _db_url() -> str:
    return os.environ.get(
        "DATABASE_URL", "postgres://overwatch:overwatch@postgres:5432/overwatch"
    )


async def fetch_enabled_cameras() -> list[str]:
    async with await psycopg.AsyncConnection.connect(_db_url()) as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT id FROM cameras WHERE enabled = true")
            rows = await cur.fetchall()
            return [str(r[0]) for r in rows]


async def persist_detections(
    camera_id: str,
    ts: datetime,
    frame_id: str,
    detections: Iterable[dict],
) -> None:
    rows = []
    for d in detections:
        rows.append(
            (
                str(uuid.uuid4()),
                camera_id,
                ts,
                frame_id,
                d["class"],
                float(d["confidence"]),
                d["bbox"] if isinstance(d["bbox"], dict) else dict(d["bbox"]),
                d.get("track_id"),
            )
        )
    if not rows:
        return
    async with await psycopg.AsyncConnection.connect(_db_url()) as conn:
        async with conn.cursor() as cur:
            await cur.executemany(
                """
                INSERT INTO detections
                  (id, camera_id, ts, frame_id, class, confidence, bbox, track_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                [(r[0], r[1], r[2], r[3], r[4], r[5], psycopg.types.json.Json(r[6]), r[7]) for r in rows],
            )
        await conn.commit()


async def consume_camera(camera_id: str, redis, minio) -> None:
    stream = f"frames.{camera_id}"
    group = "cg.ov-detector"
    consumer = f"detector-{os.environ.get('HOSTNAME', 'local')}"
    await ensure_group(redis, stream, group)

    async def handle(event: dict, _msg_id: str) -> None:
        storage_key = event.get("storage_key")
        if not storage_key:
            return
        try:
            response = await asyncio.to_thread(
                minio.get_object, BUCKETS["frames"], storage_key
            )
            data = response.read()
            response.close()
            response.release_conn()
        except Exception as e:
            log.warning("frame fetch failed", storage_key=storage_key, error=str(e))
            return
        arr = np.frombuffer(data, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return
        try:
            detections = await asyncio.to_thread(detector_singleton.detect, img, camera_id)
        except Exception as e:
            log.warning("detect failed", camera_id=camera_id, error=str(e))
            detections = []
        ts = datetime.fromisoformat(event["ts"].replace("Z", "+00:00"))
        await publish_event(
            redis,
            f"detections.{camera_id}",
            {
                "type": "frame.detections",
                "camera_id": camera_id,
                "ts": ts.isoformat(),
                "frame_id": event["frame_id"],
                "detections": detections,
            },
            maxlen=DETECTIONS_STREAM_MAXLEN,
        )
        try:
            await persist_detections(camera_id, ts, event["frame_id"], detections)
        except Exception as e:
            log.warning("persist failed", camera_id=camera_id, error=str(e))
        # Clean up frame in MinIO (lifecycle policy is the backstop).
        with contextlib.suppress(Exception):
            await asyncio.to_thread(minio.remove_object, BUCKETS["frames"], storage_key)

    # count=1: pull a single frame per read so the detector always works on
    # the freshest surviving entry (the frames stream is hard-capped, so older
    # undelivered frames are trimmed and skipped). A larger batch would mark 16
    # frames "delivered" then chew them serially while CPU YOLO is slow — the
    # tail of each batch would be ~16 inferences stale, defeating the live
    # overlay. One-at-a-time keeps the bbox overlay close to real time.
    await consume_group(
        redis, stream, group, consumer, handle, count=1, stop_event=_stop_event
    )


async def reconcile_loop() -> None:
    redis = make_redis()
    minio = make_minio()
    with contextlib.suppress(Exception):
        ensure_buckets(minio)
    while not _stop_event.is_set():
        try:
            ids = set(await fetch_enabled_cameras())
            for cid in ids:
                if cid not in _workers:
                    _workers[cid] = asyncio.create_task(consume_camera(cid, redis, minio))
                    log.info("detector consumer started", camera_id=cid)
            for cid in list(_workers.keys()):
                if cid not in ids:
                    _workers[cid].cancel()
                    del _workers[cid]
        except Exception as e:
            log.error("reconcile failed", error=str(e))
        try:
            await asyncio.wait_for(_stop_event.wait(), timeout=30)
        except asyncio.TimeoutError:
            pass


@app.on_event("startup")
async def _startup() -> None:
    asyncio.create_task(reconcile_loop())


@app.on_event("shutdown")
async def _shutdown() -> None:
    _stop_event.set()
    for t in _workers.values():
        t.cancel()


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "service": "ov-detector", "cameras": list(_workers.keys())}


@app.get("/classes")
async def classes() -> dict:
    return {"classes": detector_singleton.class_names}
