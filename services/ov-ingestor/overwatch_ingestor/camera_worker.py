"""One asyncio task per camera. ffmpeg subprocess writes 10s .ts segments;
an OpenCV frame loop samples frames at the configured fps. Both upload to MinIO.
"""

from __future__ import annotations

import asyncio
import io
import os
import shutil
import subprocess
import tempfile
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from overwatch_shared import (
    BUCKETS,
    get_logger,
    make_minio,
    make_redis,
    publish_event,
)

from .db import insert_segment, upsert_camera_status

SEGMENT_SECONDS = 10

# Hard cap on the per-camera `frames.<cid>` Redis stream. The detector drains
# this far slower than the ingestor fills it (CPU YOLO ≈ 1–2 fps total across
# all cameras) so a FIFO consumer group always trails by ~the buffer size.
# An uncapped stream → the detector falls hours behind and the live bbox
# overlay only ever shows stale/empty detections. Worst-case detector lag ≈
# MAXLEN / sample_fps seconds, so this is deliberately SMALL: at the default
# sample_fps that's a few seconds of lag. consume_group reads ">", so frames
# trimmed before delivery are simply skipped — exactly what a live overlay
# wants (process recent frames, drop the stale ones). Trade-off: detection
# is sampled, not exhaustive, while inference is the bottleneck — acceptable
# for the overlay; true frame-complete detection needs a GPU or fewer cameras.
# Tunable via env without a rebuild.
FRAMES_STREAM_MAXLEN = int(os.environ.get("FRAMES_STREAM_MAXLEN", "12"))

log = get_logger("ov-ingestor")


def _segment_key(camera_id: str, start_ts: datetime) -> str:
    return (
        f"segments/{camera_id}/"
        f"{start_ts.strftime('%Y/%m/%d/%H')}/"
        f"{int(start_ts.timestamp() * 1000)}.ts"
    )


def _frame_key(camera_id: str, frame_id: str) -> str:
    return f"frames/{camera_id}/{frame_id}.jpg"


async def _publish_status(redis, camera_id: str, status: str) -> None:
    await publish_event(
        redis,
        "camera_status",
        {
            "type": "camera.status_changed",
            "camera_id": camera_id,
            "status": status,
            "ts": datetime.now(timezone.utc).isoformat(),
        },
    )
    await upsert_camera_status(camera_id, status)


async def _segment_loop(camera_id: str, rtsp_url: str, redis, minio, stop_event: asyncio.Event) -> None:
    """Pipes ffmpeg's segmented output through a watcher that uploads new .ts files."""
    work_dir = Path(tempfile.mkdtemp(prefix=f"ov-seg-{camera_id}-"))
    pattern = str(work_dir / "seg-%05d.ts")
    cmd = [
        "ffmpeg",
        "-rtsp_transport", "tcp",
        "-i", rtsp_url,
        "-c", "copy",
        "-an",
        "-f", "segment",
        "-segment_time", str(SEGMENT_SECONDS),
        "-segment_format", "mpegts",
        "-reset_timestamps", "1",
        "-loglevel", "error",
        pattern,
    ]
    proc: subprocess.Popen | None = None
    try:
        while not stop_event.is_set():
            log.info("starting ffmpeg", camera_id=camera_id, rtsp_url=rtsp_url)
            try:
                proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            except FileNotFoundError:
                log.error("ffmpeg not on PATH; segment loop disabled")
                return
            seen: set[str] = set()
            start_marker = time.time()
            while proc.poll() is None and not stop_event.is_set():
                await asyncio.sleep(1.0)
                for f in sorted(work_dir.glob("seg-*.ts")):
                    if f.name in seen:
                        continue
                    # Wait until ffmpeg has moved on (file is closed) by checking the next one exists.
                    next_index = int(f.stem.split("-")[1]) + 1
                    if not (work_dir / f"seg-{next_index:05d}.ts").exists():
                        continue
                    seen.add(f.name)
                    try:
                        size = f.stat().st_size
                        start_ts = datetime.fromtimestamp(
                            start_marker + (next_index - 1) * SEGMENT_SECONDS,
                            tz=timezone.utc,
                        )
                        end_ts = datetime.fromtimestamp(
                            start_marker + next_index * SEGMENT_SECONDS,
                            tz=timezone.utc,
                        )
                        storage_key = _segment_key(camera_id, start_ts)
                        minio.fput_object(BUCKETS["segments"], storage_key, str(f))
                        segment_id = await insert_segment(
                            camera_id,
                            start_ts,
                            end_ts,
                            storage_key,
                            SEGMENT_SECONDS * 1000,
                            size,
                        )
                        await publish_event(
                            redis,
                            "segments",
                            {
                                "type": "segment.ready",
                                "camera_id": camera_id,
                                "segment_id": segment_id,
                                "start_ts": start_ts.isoformat(),
                                "end_ts": end_ts.isoformat(),
                                "storage_key": storage_key,
                                "duration_ms": SEGMENT_SECONDS * 1000,
                                "size_bytes": size,
                            },
                        )
                        f.unlink(missing_ok=True)
                    except Exception as e:
                        log.warning("segment upload failed", camera_id=camera_id, error=str(e))
            if proc and proc.poll() is not None:
                err = proc.stderr.read().decode("utf-8", errors="ignore") if proc.stderr else ""
                log.warning("ffmpeg exited", camera_id=camera_id, code=proc.returncode, stderr=err[-500:])
                await _publish_status(redis, camera_id, "offline")
            if stop_event.is_set():
                return
            await asyncio.sleep(5)
    finally:
        if proc and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
        shutil.rmtree(work_dir, ignore_errors=True)


async def _frame_loop(camera_id: str, rtsp_url: str, sample_fps: int, redis, minio, stop_event: asyncio.Event) -> None:
    """OpenCV captures frames at native rate; we throttle uploads to sample_fps."""
    interval = 1.0 / max(1, sample_fps)
    while not stop_event.is_set():
        cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
        if not cap.isOpened():
            log.warning("opencv cap closed", camera_id=camera_id)
            await _publish_status(redis, camera_id, "offline")
            await asyncio.sleep(5)
            continue
        await _publish_status(redis, camera_id, "online")
        last_sample = 0.0
        while not stop_event.is_set():
            ok, frame = cap.read()
            if not ok:
                log.warning("frame read failed; reconnecting", camera_id=camera_id)
                break
            now = time.time()
            if now - last_sample < interval:
                continue
            last_sample = now
            try:
                _, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
                data = buf.tobytes()
                frame_id = str(uuid.uuid4())
                storage_key = _frame_key(camera_id, frame_id)
                minio.put_object(
                    BUCKETS["frames"],
                    storage_key,
                    io.BytesIO(data),
                    length=len(data),
                    content_type="image/jpeg",
                )
                ts = datetime.now(timezone.utc)
                # Cap the frames stream. CPU YOLO drains it far slower than we
                # fill it; an uncapped stream means the detector processes
                # hours-old frames and the live overlay never reflects "now".
                # Bounding it makes the detector skip stale frames (consume_group
                # reads ">", trimmed entries are skipped) so it stays near-live.
                await publish_event(
                    redis,
                    f"frames.{camera_id}",
                    {
                        "type": "frame.sampled",
                        "camera_id": camera_id,
                        "ts": ts.isoformat(),
                        "frame_id": frame_id,
                        "storage_key": storage_key,
                        "width": int(frame.shape[1]),
                        "height": int(frame.shape[0]),
                    },
                    maxlen=FRAMES_STREAM_MAXLEN,
                    approximate=False,  # exact: a small cap must be enforced,
                    # not rounded up to a ~100-entry Redis macro node.
                )
                await upsert_camera_status(camera_id, "online", ts)
            except Exception as e:
                log.warning("frame publish failed", camera_id=camera_id, error=str(e))
        cap.release()
        await _publish_status(redis, camera_id, "offline")
        await asyncio.sleep(3)


class CameraWorker:
    """Owns one camera. Composes a segment loop + a frame loop."""

    def __init__(self, camera: dict, redis, minio) -> None:
        self.camera = camera
        self.redis = redis
        self.minio = minio
        self.stop_event = asyncio.Event()
        self.tasks: list[asyncio.Task] = []

    @property
    def camera_id(self) -> str:
        return str(self.camera["id"])

    async def start(self) -> None:
        rtsp = str(self.camera["rtsp_url"])
        sample_fps = int(self.camera.get("sample_fps", 5))
        await _publish_status(self.redis, self.camera_id, "connecting")
        self.tasks = [
            asyncio.create_task(_segment_loop(self.camera_id, rtsp, self.redis, self.minio, self.stop_event)),
            asyncio.create_task(_frame_loop(self.camera_id, rtsp, sample_fps, self.redis, self.minio, self.stop_event)),
        ]

    async def stop(self) -> None:
        self.stop_event.set()
        for t in self.tasks:
            try:
                await asyncio.wait_for(t, timeout=10)
            except asyncio.TimeoutError:
                t.cancel()
