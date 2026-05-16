"""Builds overlay clips for incidents and regular detection clips.

On incident.opened → reserve a window and prepare a placeholder.
On incident.closed → finalize the window, fetch overlapping segments,
concat with ffmpeg, overlay detections, upload MP4 + poster, register clip.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import os
import subprocess
import tempfile
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import cv2
import numpy as np
import psycopg
from fastapi import FastAPI
from overwatch_shared import (
    BUCKETS,
    consume_group,
    ensure_buckets,
    get_logger,
    make_minio,
    make_redis,
    publish_event,
)

log = get_logger("ov-clip-builder")
app = FastAPI(title="ov-clip-builder")

_stop_event = asyncio.Event()
_pending_incidents: dict[str, dict] = {}
PADDING_BEFORE = int(os.environ.get("PADDING_SECONDS_BEFORE", "5"))
PADDING_AFTER = int(os.environ.get("PADDING_SECONDS_AFTER", "10"))


def _db_url() -> str:
    return os.environ.get(
        "DATABASE_URL", "postgres://overwatch:overwatch@postgres:5432/overwatch"
    )


def _clip_key(camera_id: str, start_ts: datetime, kind: str) -> str:
    return f"clips/{kind}/{camera_id}/{start_ts.strftime('%Y/%m/%d')}/{uuid.uuid4()}.mp4"


def _poster_key(clip_key: str) -> str:
    return clip_key.replace(".mp4", ".jpg")


async def _fetch_segments(camera_id: str, start_ts: datetime, end_ts: datetime) -> list[dict]:
    async with await psycopg.AsyncConnection.connect(_db_url()) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT id, start_ts, end_ts, storage_key
                  FROM segments
                 WHERE camera_id = %s
                   AND end_ts >= %s
                   AND start_ts <= %s
                 ORDER BY start_ts
                """,
                (camera_id, start_ts, end_ts),
            )
            rows = await cur.fetchall()
            return [
                {"id": r[0], "start_ts": r[1], "end_ts": r[2], "storage_key": r[3]}
                for r in rows
            ]


async def _fetch_detections(camera_id: str, start_ts: datetime, end_ts: datetime) -> list[dict]:
    async with await psycopg.AsyncConnection.connect(_db_url()) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT ts, class, confidence, bbox, track_id
                  FROM detections
                 WHERE camera_id = %s AND ts BETWEEN %s AND %s
                 ORDER BY ts
                """,
                (camera_id, start_ts, end_ts),
            )
            rows = await cur.fetchall()
            return [
                {"ts": r[0], "class": r[1], "confidence": r[2], "bbox": r[3], "track_id": r[4]}
                for r in rows
            ]


async def _register_clip(args: dict) -> None:
    retention_days = 90 if args["kind"] == "incident" else 3
    async with await psycopg.AsyncConnection.connect(_db_url()) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO clips
                  (id, camera_id, kind, incident_id, start_ts, end_ts, storage_key, poster_key, retention_until)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    args["clip_id"],
                    args["camera_id"],
                    args["kind"],
                    args.get("incident_id"),
                    args["start_ts"],
                    args["end_ts"],
                    args["storage_key"],
                    args.get("poster_key"),
                    args["end_ts"] + timedelta(days=retention_days),
                ),
            )
            if args.get("incident_id"):
                await cur.execute(
                    "UPDATE incidents SET clip_status = 'ready', clip_url = %s WHERE id = %s",
                    (f"s3://{BUCKETS['clips']}/{args['storage_key']}", args["incident_id"]),
                )
        await conn.commit()


def _concat_segments(local_paths: list[Path], out_path: Path) -> None:
    """ffmpeg concat without re-encoding for speed."""
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
        for p in local_paths:
            f.write(f"file '{p}'\n")
        list_file = f.name
    cmd = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0", "-i", list_file,
        "-c", "copy", "-movflags", "+faststart",
        str(out_path),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    Path(list_file).unlink(missing_ok=True)


def _overlay_detections(in_path: Path, out_path: Path, detections: list[dict], window_start: datetime) -> None:
    """Open the muxed MP4 with OpenCV, paint bounding boxes per detection at its
    corresponding timestamp, write a new H.264 file. Slower than concat but only
    runs for incident clips."""
    cap = cv2.VideoCapture(str(in_path))
    if not cap.isOpened():
        # Couldn't decode — fall back to the raw concat.
        in_path.rename(out_path)
        return
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(out_path), fourcc, fps, (w, h))
    # Index detections by ms-from-window-start.
    indexed: list[tuple[int, list[dict]]] = []
    grouped: dict[int, list[dict]] = {}
    for d in detections:
        ts = d["ts"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts)
        ms = int((ts - window_start).total_seconds() * 1000)
        grouped.setdefault(ms // 100, []).append(d)
    for k in sorted(grouped.keys()):
        indexed.append((k, grouped[k]))
    frame_idx = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            ms = int(frame_idx * 1000.0 / fps)
            bucket = ms // 100
            # Find the closest detection bucket within ±200ms.
            for delta in (0, -1, 1, -2, 2):
                cand = grouped.get(bucket + delta)
                if cand:
                    for d in cand:
                        bbox = d["bbox"] if isinstance(d["bbox"], dict) else json.loads(d["bbox"])
                        x1 = int(bbox["x"] * w); y1 = int(bbox["y"] * h)
                        x2 = int((bbox["x"] + bbox["w"]) * w); y2 = int((bbox["y"] + bbox["h"]) * h)
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0xA8, 0xF5), 2)
                        label = f"{d['class']} {d['confidence']:.2f}"
                        cv2.rectangle(frame, (x1, y1 - 18), (x1 + 7 * len(label), y1), (0, 0xA8, 0xF5), -1)
                        cv2.putText(frame, label, (x1 + 2, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1)
                    break
            writer.write(frame)
            frame_idx += 1
    finally:
        cap.release()
        writer.release()


def _extract_poster(clip_path: Path, poster_path: Path) -> None:
    cap = cv2.VideoCapture(str(clip_path))
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 1)
    cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, n // 2))
    ok, frame = cap.read()
    cap.release()
    if ok and frame is not None:
        cv2.imwrite(str(poster_path), frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])


async def build_incident_clip(incident_id: str, camera_id: str, start_ts: datetime, end_ts: datetime, redis, minio) -> None:
    window_start = start_ts - timedelta(seconds=PADDING_BEFORE)
    window_end = end_ts + timedelta(seconds=PADDING_AFTER)
    segs = await _fetch_segments(camera_id, window_start, window_end)
    if not segs:
        log.warning("no segments for incident", incident_id=incident_id)
        return
    work = Path(tempfile.mkdtemp(prefix=f"ov-clip-{incident_id}-"))
    try:
        local_segs: list[Path] = []
        for s in segs:
            lp = work / Path(s["storage_key"]).name
            try:
                minio.fget_object(BUCKETS["segments"], s["storage_key"], str(lp))
                local_segs.append(lp)
            except Exception as e:
                log.warning("segment fetch failed", storage_key=s["storage_key"], error=str(e))
        if not local_segs:
            return
        concat_path = work / "concat.mp4"
        try:
            _concat_segments(local_segs, concat_path)
        except subprocess.CalledProcessError as e:
            log.error("concat failed", error=e.stderr.decode("utf-8", errors="ignore"))
            return
        overlay_path = work / "overlay.mp4"
        detections = await _fetch_detections(camera_id, window_start, window_end)
        try:
            _overlay_detections(concat_path, overlay_path, detections, window_start)
        except Exception as e:
            log.warning("overlay failed, using raw", error=str(e))
            overlay_path = concat_path
        poster_path = work / "poster.jpg"
        with contextlib.suppress(Exception):
            _extract_poster(overlay_path, poster_path)
        clip_id = str(uuid.uuid4())
        storage_key = _clip_key(camera_id, window_start, "incident")
        minio.fput_object(BUCKETS["clips"], storage_key, str(overlay_path), content_type="video/mp4")
        poster_key = None
        if poster_path.exists():
            poster_key = _poster_key(storage_key)
            minio.fput_object(BUCKETS["clips"], poster_key, str(poster_path), content_type="image/jpeg")
        await _register_clip(
            {
                "clip_id": clip_id,
                "camera_id": camera_id,
                "kind": "incident",
                "incident_id": incident_id,
                "start_ts": window_start,
                "end_ts": window_end,
                "storage_key": storage_key,
                "poster_key": poster_key,
            }
        )
        await publish_event(
            redis,
            "clips",
            {
                "type": "clip.ready",
                "clip_id": clip_id,
                "incident_id": incident_id,
                "camera_id": camera_id,
                "kind": "incident",
                "storage_key": storage_key,
                "poster_key": poster_key or "",
                "start_ts": window_start.isoformat(),
                "end_ts": window_end.isoformat(),
            },
        )
        log.info("incident clip ready", clip_id=clip_id, incident_id=incident_id)
    finally:
        import shutil
        shutil.rmtree(work, ignore_errors=True)


async def on_incident_opened(event: dict, _msg_id: str) -> None:
    if event.get("type") != "incident.opened":
        return
    iid = event["incident_id"]
    _pending_incidents[iid] = {
        "camera_id": event["camera_id"],
        "opened_at": datetime.fromisoformat(event["opened_at"].replace("Z", "+00:00")),
    }


async def on_incident_closed(event: dict, _msg_id: str, redis, minio) -> None:
    if event.get("type") != "incident.closed":
        return
    iid = event["incident_id"]
    pend = _pending_incidents.pop(iid, None)
    closed_at = datetime.fromisoformat(event["closed_at"].replace("Z", "+00:00"))
    if pend is None:
        async with await psycopg.AsyncConnection.connect(_db_url()) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "SELECT camera_id, opened_at FROM incidents WHERE id = %s",
                    (iid,),
                )
                row = await cur.fetchone()
                if not row:
                    return
                pend = {"camera_id": str(row[0]), "opened_at": row[1]}
    try:
        await build_incident_clip(iid, pend["camera_id"], pend["opened_at"], closed_at, redis, minio)
    except Exception as e:
        log.error("build_incident_clip failed", error=str(e), incident_id=iid)


async def incident_loop() -> None:
    redis = make_redis()
    minio = make_minio()
    with contextlib.suppress(Exception):
        ensure_buckets(minio)
    async def handler(event: dict, msg_id: str) -> None:
        if event.get("type") == "incident.opened":
            await on_incident_opened(event, msg_id)
        elif event.get("type") == "incident.closed":
            await on_incident_closed(event, msg_id, redis, minio)
    await consume_group(
        redis,
        "incidents",
        "cg.ov-clip-builder",
        f"clip-builder-{os.environ.get('HOSTNAME', 'local')}",
        handler,
        stop_event=_stop_event,
    )


async def regular_clip_loop() -> None:
    """Every 5 minutes: scan detections in the prior 5 min, build short clips
    for each camera that had ≥1 class-of-interest detection. These are visible
    in the calendar but not notification-worthy."""
    redis = make_redis()
    minio = make_minio()
    while not _stop_event.is_set():
        try:
            now = datetime.now(timezone.utc)
            window_start = now - timedelta(minutes=5)
            async with await psycopg.AsyncConnection.connect(_db_url()) as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        """
                        SELECT DISTINCT camera_id FROM detections
                         WHERE ts BETWEEN %s AND %s
                        """,
                        (window_start, now),
                    )
                    cameras = [str(r[0]) for r in await cur.fetchall()]
            for camera_id in cameras:
                try:
                    segs = await _fetch_segments(camera_id, window_start, now)
                    if not segs:
                        continue
                    work = Path(tempfile.mkdtemp(prefix=f"ov-regular-{camera_id}-"))
                    locals_ = []
                    for s in segs[:6]:  # cap
                        lp = work / Path(s["storage_key"]).name
                        try:
                            minio.fget_object(BUCKETS["segments"], s["storage_key"], str(lp))
                            locals_.append(lp)
                        except Exception:
                            pass
                    if not locals_:
                        continue
                    out_path = work / "clip.mp4"
                    try:
                        _concat_segments(locals_, out_path)
                    except subprocess.CalledProcessError:
                        continue
                    clip_id = str(uuid.uuid4())
                    storage_key = _clip_key(camera_id, window_start, "regular")
                    minio.fput_object(BUCKETS["clips"], storage_key, str(out_path), content_type="video/mp4")
                    poster = work / "poster.jpg"
                    with contextlib.suppress(Exception):
                        _extract_poster(out_path, poster)
                    poster_key = None
                    if poster.exists():
                        poster_key = _poster_key(storage_key)
                        minio.fput_object(BUCKETS["clips"], poster_key, str(poster), content_type="image/jpeg")
                    await _register_clip(
                        {
                            "clip_id": clip_id,
                            "camera_id": camera_id,
                            "kind": "regular",
                            "start_ts": window_start,
                            "end_ts": now,
                            "storage_key": storage_key,
                            "poster_key": poster_key,
                        }
                    )
                    await publish_event(
                        redis,
                        "clips",
                        {
                            "type": "clip.ready",
                            "clip_id": clip_id,
                            "camera_id": camera_id,
                            "kind": "regular",
                            "storage_key": storage_key,
                            "poster_key": poster_key or "",
                            "start_ts": window_start.isoformat(),
                            "end_ts": now.isoformat(),
                        },
                    )
                    import shutil
                    shutil.rmtree(work, ignore_errors=True)
                except Exception as e:
                    log.warning("regular clip failed", camera_id=camera_id, error=str(e))
        except Exception as e:
            log.error("regular_clip_loop iteration failed", error=str(e))
        try:
            await asyncio.wait_for(_stop_event.wait(), timeout=300)
        except asyncio.TimeoutError:
            pass


@app.on_event("startup")
async def _startup() -> None:
    asyncio.create_task(incident_loop())
    asyncio.create_task(regular_clip_loop())


@app.on_event("shutdown")
async def _shutdown() -> None:
    _stop_event.set()


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "service": "ov-clip-builder", "pending": len(_pending_incidents)}
