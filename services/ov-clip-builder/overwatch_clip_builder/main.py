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
from psycopg_pool import AsyncConnectionPool
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
# Pre/post-roll around the incident window. MUST equal ov-api's
# `FOOTAGE_PRE_S` / `FOOTAGE_POST_S` (services/ov-api/src/routes/incidents.ts):
# the dashboard's /api/incidents/:id/markers route indexes timeline markers from
# `opened_at - FOOTAGE_PRE_S`, so any drift between the two pre-rolls shifts
# every marker by that many seconds relative to the actual frames. Keeping these
# in sync means the same clip works whether it was built here or by ov-api's
# ondemand fallback.
PADDING_BEFORE = int(os.environ.get("PADDING_SECONDS_BEFORE", "8"))
PADDING_AFTER = int(os.environ.get("PADDING_SECONDS_AFTER", "22"))


def _db_url() -> str:
    return os.environ.get(
        "DATABASE_URL", "postgres://overwatch:overwatch@postgres:5432/overwatch"
    )


# A single shared pool, lazily opened on first use. Bounded by DB_POOL_MAX to
# avoid the "too many clients already" exhaustion we saw when every query
# opened a fresh connection — that pattern made each retry storm consume
# postgres `max_connections` (default 100) across our other services too.
# A pool also amortises DNS lookups, so a transient "failed to resolve host
# 'postgres'" doesn't pierce through every call site individually.
_pool: AsyncConnectionPool | None = None
_pool_lock: asyncio.Lock | None = None
DB_POOL_MIN = int(os.environ.get("DB_POOL_MIN", "1"))
DB_POOL_MAX = int(os.environ.get("DB_POOL_MAX", "4"))


def _get_pool_lock() -> asyncio.Lock:
    global _pool_lock
    if _pool_lock is None:
        _pool_lock = asyncio.Lock()
    return _pool_lock


async def _get_pool() -> AsyncConnectionPool:
    global _pool
    if _pool is not None:
        return _pool
    async with _get_pool_lock():
        if _pool is None:
            pool = AsyncConnectionPool(
                conninfo=_db_url(),
                min_size=DB_POOL_MIN,
                max_size=DB_POOL_MAX,
                # `open=False` + explicit `open()` lets us catch the initial
                # connect error here (and retry it) instead of at first query.
                open=False,
                # Hand out connections only after a quick liveness check —
                # otherwise a stale connection survives a postgres restart
                # and the first user gets a confusing IO error.
                check=AsyncConnectionPool.check_connection,
                kwargs={"connect_timeout": 10},
                name="ov-clip-builder",
            )
            await pool.open(wait=False)
            _pool = pool
    return _pool


# Errors worth retrying: DNS resolve failures and connection refusals during
# brief network/postgres hiccups. psycopg surfaces these as OperationalError
# (with errno wrapped). We do NOT retry programming/data errors — those are
# bugs, not transient.
_RETRY_EXCEPTIONS = (
    psycopg.OperationalError,
    OSError,  # covers `gaierror` (DNS) too
)


async def _run_query(
    fn,
    *,
    attempts: int = 3,
    base_delay: float = 0.5,
):
    """Borrow a connection from the pool and run `fn(conn)`. Retries on
    transient connect failures (DNS, refused, EOF) with exponential backoff.

    `fn` is called with the connection; it owns its own cursor/commit. Calling
    code doesn't need to know about pooling or retries."""
    pool = await _get_pool()
    last_exc: Exception | None = None
    for attempt in range(attempts):
        try:
            async with pool.connection() as conn:
                return await fn(conn)
        except _RETRY_EXCEPTIONS as e:
            last_exc = e
            if attempt == attempts - 1:
                break
            delay = base_delay * (2**attempt)
            log.warning(
                "db op transient failure, retrying",
                attempt=attempt + 1,
                attempts=attempts,
                delay=delay,
                error=str(e),
            )
            await asyncio.sleep(delay)
    assert last_exc is not None
    raise last_exc


def _clip_key(camera_id: str, start_ts: datetime, kind: str) -> str:
    return f"clips/{kind}/{camera_id}/{start_ts.strftime('%Y/%m/%d')}/{uuid.uuid4()}.mp4"


def _poster_key(clip_key: str) -> str:
    return clip_key.replace(".mp4", ".jpg")


async def _fetch_segments(camera_id: str, start_ts: datetime, end_ts: datetime) -> list[dict]:
    async def go(conn: psycopg.AsyncConnection) -> list[dict]:
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
    return await _run_query(go)


async def _fetch_detections(camera_id: str, start_ts: datetime, end_ts: datetime) -> list[dict]:
    async def go(conn: psycopg.AsyncConnection) -> list[dict]:
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
    return await _run_query(go)


async def _register_clip(args: dict) -> None:
    retention_days = 90 if args["kind"] == "incident" else 3
    async def go(conn: psycopg.AsyncConnection) -> None:
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
    await _run_query(go)


def _concat_segments(local_paths: list[Path], out_path: Path) -> None:
    """Concat segments and transcode to H.264 so the result plays in every
    browser. Source segments are HEVC (Hikvision RTSP stream-copied by the
    ingestor); H.264 + yuv420p + faststart is universally decodable. Recipe
    mirrors ov-api's ondemand build so both pipelines produce identical output.
    Even-dimension scale guards libx264's 4:2:0 requirement (some cameras
    deliver odd heights)."""
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
        for p in local_paths:
            f.write(f"file '{p}'\n")
        list_file = f.name
    cmd = [
        "ffmpeg", "-y",
        "-loglevel", "error",
        "-f", "concat", "-safe", "0", "-i", list_file,
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-profile:v", "main",
        "-pix_fmt", "yuv420p",
        "-crf", "23",
        "-an",
        "-fflags", "+genpts",
        "-avoid_negative_ts", "make_zero",
        "-movflags", "+faststart",
        str(out_path),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    Path(list_file).unlink(missing_ok=True)


def _overlay_detections(in_path: Path, out_path: Path, detections: list[dict], video_start: datetime) -> None:
    """Open the muxed MP4 with OpenCV, paint bounding boxes per detection at its
    corresponding timestamp, write a new H.264 file. Slower than concat but only
    runs for incident clips.

    `video_start` MUST be the wall-clock time of the FIRST frame of `in_path`
    — i.e. the start_ts of the earliest concatenated segment — NOT the padded
    incident window start. The concat is untrimmed, so frame 0 is a segment
    boundary that can sit many seconds before window_start; indexing detections
    from anything but the true video start draws every box that many seconds
    off (boxes float over empty space).

    Encoding: OpenCV's mp4v fourcc writes MPEG-4 Part 2, which the dashboard's
    direct by-key playback can't decode (black box). Instead we pipe BGR frames
    into an ffmpeg child running libx264, producing the same H.264/yuv420p/
    +faststart container as _concat_segments."""
    if video_start.tzinfo is None:
        video_start = video_start.replace(tzinfo=timezone.utc)
    cap = cv2.VideoCapture(str(in_path))
    if not cap.isOpened():
        # Couldn't decode — fall back to the raw concat (already H.264).
        in_path.rename(out_path)
        return
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if w <= 0 or h <= 0:
        cap.release()
        in_path.rename(out_path)
        return
    # libx264/yuv420p needs even dimensions; the concat already forces this,
    # but be defensive — if width/height are odd we'd crash ffmpeg below.
    even_w = w - (w % 2)
    even_h = h - (h % 2)
    ffmpeg_proc = subprocess.Popen(
        [
            "ffmpeg", "-y",
            "-loglevel", "error",
            "-f", "rawvideo",
            "-pixel_format", "bgr24",
            "-video_size", f"{w}x{h}",
            "-framerate", f"{fps:.6f}",
            "-i", "-",
            *(["-vf", f"crop={even_w}:{even_h}:0:0"] if (even_w != w or even_h != h) else []),
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-profile:v", "main",
            "-pix_fmt", "yuv420p",
            "-crf", "23",
            "-an",
            "-movflags", "+faststart",
            str(out_path),
        ],
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    assert ffmpeg_proc.stdin is not None
    # Index detections by ms-from-window-start (100ms buckets).
    grouped: dict[int, list[dict]] = {}
    for d in detections:
        ts = d["ts"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts)
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        ms = int((ts - video_start).total_seconds() * 1000)
        if ms < 0:
            continue  # detection precedes the footage we have — can't place it
        grouped.setdefault(ms // 100, []).append(d)
    frame_idx = 0
    stderr_data = b""
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            ms = int(frame_idx * 1000.0 / fps)
            bucket = ms // 100
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
            try:
                ffmpeg_proc.stdin.write(frame.tobytes())
            except BrokenPipeError:
                # ffmpeg died — drain stderr below for the actual reason.
                break
            frame_idx += 1
    finally:
        cap.release()
        try:
            ffmpeg_proc.stdin.close()
        except Exception:
            pass
        try:
            stderr_data = ffmpeg_proc.stderr.read() if ffmpeg_proc.stderr else b""
        except Exception:
            stderr_data = b""
        rc = ffmpeg_proc.wait(timeout=60)
    if rc != 0 or not out_path.exists() or out_path.stat().st_size == 0:
        log.warning(
            "overlay ffmpeg encode failed",
            rc=rc,
            stderr=stderr_data.decode("utf-8", errors="ignore")[-400:],
        )
        # Surface failure so the caller's `except Exception` falls back to the
        # raw H.264 concat (which is universally playable already).
        raise RuntimeError(f"overlay ffmpeg exited {rc}")


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
        # Wall-clock of the FIRST frame of the concat == start_ts of the
        # earliest segment actually fetched (segs are start_ts-ordered and
        # appended in order). The overlay MUST be indexed from this, not the
        # padded incident window, or every box lands seconds off the object.
        video_start: datetime | None = None
        for s in segs:
            lp = work / Path(s["storage_key"]).name
            try:
                minio.fget_object(BUCKETS["segments"], s["storage_key"], str(lp))
                local_segs.append(lp)
                if video_start is None:
                    video_start = s["start_ts"]
            except Exception as e:
                log.warning("segment fetch failed", storage_key=s["storage_key"], error=str(e))
        if not local_segs:
            return
        if video_start is None:
            video_start = window_start
        concat_path = work / "concat.mp4"
        try:
            _concat_segments(local_segs, concat_path)
        except subprocess.CalledProcessError as e:
            log.error("concat failed", error=e.stderr.decode("utf-8", errors="ignore"))
            return
        overlay_path = work / "overlay.mp4"
        detections = await _fetch_detections(camera_id, window_start, window_end)
        try:
            _overlay_detections(concat_path, overlay_path, detections, video_start)
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
        async def lookup(conn: psycopg.AsyncConnection):
            async with conn.cursor() as cur:
                await cur.execute(
                    "SELECT camera_id, opened_at FROM incidents WHERE id = %s",
                    (iid,),
                )
                return await cur.fetchone()
        row = await _run_query(lookup)
        if not row:
            return
        pend = {"camera_id": str(row[0]), "opened_at": row[1]}
    try:
        await build_incident_clip(iid, pend["camera_id"], pend["opened_at"], closed_at, redis, minio)
    except Exception as e:
        log.error("build_incident_clip failed", error=str(e), incident_id=iid)


async def incident_loop() -> None:
    log.info("incident_loop: starting")
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
    log.info("regular_clip_loop: starting")
    """Every 5 minutes: scan detections in the prior 5 min, build short clips
    for each camera that had ≥1 class-of-interest detection. These are visible
    in the calendar but not notification-worthy."""
    redis = make_redis()
    minio = make_minio()
    while not _stop_event.is_set():
        try:
            now = datetime.now(timezone.utc)
            window_start = now - timedelta(minutes=5)
            async def list_cameras(conn: psycopg.AsyncConnection):
                async with conn.cursor() as cur:
                    await cur.execute(
                        """
                        SELECT DISTINCT camera_id FROM detections
                         WHERE ts BETWEEN %s AND %s
                        """,
                        (window_start, now),
                    )
                    return [str(r[0]) for r in await cur.fetchall()]
            cameras = await _run_query(list_cameras)
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


async def incident_backfill_loop() -> None:
    log.info("incident_backfill_loop: starting")
    """Periodic backfill: build clips for any incident with
    `clip_status='pending'` regardless of how it ended (closed, suppressed,
    or still open past a grace window).

    Why: the event-driven path only fires on `incident.closed`. The engine
    can auto-suppress an incident (linger threshold not met) and the API
    `/status` endpoint can suppress/close without publishing an event, so
    those incidents would never get a clip. The operator wants a clip for
    *every* opened incident — review value doesn't depend on whether the
    engine ultimately decided the detections were spammy. This loop closes
    that gap (and also survives missed/dropped Redis events).
    """
    redis = make_redis()
    minio = make_minio()
    with contextlib.suppress(Exception):
        ensure_buckets(minio)
    # Wait this long after `opened_at` before considering an open incident
    # ready to clip — gives the recording enough footage to be useful.
    min_age_s = int(os.environ.get("BACKFILL_MIN_AGE_SEC", "30"))
    # How often to scan. ~60s is enough — clip-builder doesn't need to be
    # millisecond-fresh, and the event path still catches the common case.
    interval_s = int(os.environ.get("BACKFILL_INTERVAL_SEC", "60"))
    # How far back to look. Older pending incidents are usually broken
    # (segments long gone) — surface as warnings but don't churn forever.
    lookback_h = int(os.environ.get("BACKFILL_LOOKBACK_HOURS", "24"))
    max_per_run = int(os.environ.get("BACKFILL_MAX_PER_RUN", "10"))

    async def fetch_pending(conn):
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT id::text, camera_id::text, status, opened_at, closed_at
                  FROM incidents
                 WHERE COALESCE(clip_status, 'pending') = 'pending'
                   AND opened_at > now() - (%s || ' hours')::interval
                   AND opened_at < now() - (%s || ' seconds')::interval
                 ORDER BY opened_at DESC
                 LIMIT %s
                """,
                (str(lookback_h), str(min_age_s), max_per_run),
            )
            rows = await cur.fetchall()
            return [
                {
                    "id": r[0],
                    "camera_id": r[1],
                    "status": r[2],
                    "opened_at": r[3],
                    "closed_at": r[4],
                }
                for r in rows
            ]

    while not _stop_event.is_set():
        try:
            pending = await _run_query(fetch_pending)
            for inc in pending:
                # Don't race with the event-driven path — if we have an
                # in-memory pending placeholder, that handler will build it.
                if inc["id"] in _pending_incidents:
                    continue
                # End of the build window: closed_at if we have it, else
                # bounded fall-back. An incident with no `closed_at` is
                # either (a) auto-suppressed by the engine (linger threshold
                # not met) or (b) still open. For (a) the suppression
                # happened seconds after opening — never want to capture an
                # hour of unrelated footage just because the row's never
                # been closed. For (b) we want a representative slice, not
                # the whole live tail. Cap to opened_at + max-window so the
                # resulting clip is something the vision provider can
                # actually process (OpenRouter timed out on a multi-hour
                # backfilled clip).
                # 25s + 8s pre + 22s post ≈ 55s of footage. At our cameras'
                # 1080p H.264 CRF 23 that's ~15–25MB, well under OpenRouter's
                # video upload ceiling. A previous 60s cap produced a 66MB
                # clip on East compound and Gemini timed out base64-decoding
                # it — adjusting smaller is the simplest robust fix.
                max_window_s = int(os.environ.get("BACKFILL_MAX_WINDOW_SEC", "25"))
                end_ts = inc["closed_at"] or min(
                    datetime.now(timezone.utc),
                    inc["opened_at"] + timedelta(seconds=max_window_s),
                )
                try:
                    await build_incident_clip(
                        inc["id"],
                        inc["camera_id"],
                        inc["opened_at"],
                        end_ts,
                        redis,
                        minio,
                    )
                except Exception as e:
                    log.error(
                        "backfill build failed",
                        error=str(e),
                        incident_id=inc["id"],
                        status=inc["status"],
                    )
                # build_incident_clip flips clip_status to 'ready' only on
                # success. If it's still 'pending' after we ran, the
                # underlying segments are gone (or some other unrecoverable
                # condition) — mark 'failed' so the backfill stops churning
                # on this row. The incident itself is preserved; just no
                # footage will materialise for it.
                async def mark_failed_if_pending(conn, iid=inc["id"]):
                    async with conn.cursor() as cur:
                        await cur.execute(
                            """
                            UPDATE incidents
                               SET clip_status = 'failed'
                             WHERE id = %s::uuid
                               AND COALESCE(clip_status, 'pending') = 'pending'
                            """,
                            (iid,),
                        )
                    await conn.commit()
                with contextlib.suppress(Exception):
                    await _run_query(mark_failed_if_pending)
        except Exception as e:
            log.error("incident_backfill_loop iteration failed", error=str(e))
        try:
            await asyncio.wait_for(_stop_event.wait(), timeout=interval_s)
        except asyncio.TimeoutError:
            pass


_background_tasks: set[asyncio.Task] = set()


def _on_task_done(task: asyncio.Task) -> None:
    _background_tasks.discard(task)
    if task.cancelled():
        log.warning("background task cancelled", name=task.get_name())
        return
    exc = task.exception()
    if exc is not None:
        log.error(
            "background task died",
            name=task.get_name(),
            error=f"{type(exc).__name__}: {exc}",
        )


def _spawn(coro, name: str | None = None) -> asyncio.Task:
    """Schedule a long-lived background coroutine and pin a strong reference.

    `asyncio.create_task` returns a Task that the event loop only WEAKLY
    references. If nothing in user code holds a strong ref, the task is
    eligible for GC the moment the scheduling function returns. We
    previously saw "Task was destroyed but it is pending!" warnings
    immediately after startup with the consumer task silently dying
    before processing a single event — same root cause. Storing the task
    in a module-level set keeps it alive for the lifetime of the process.

    The done callback also surfaces silent task deaths (uncaught
    exceptions / cancellations) into our structured log so a regression
    doesn't go unnoticed for hours."""
    t = asyncio.create_task(coro, name=name)
    _background_tasks.add(t)
    t.add_done_callback(_on_task_done)
    return t


@app.on_event("startup")
async def _startup() -> None:
    log.info("startup: opening pool")
    with contextlib.suppress(Exception):
        await _get_pool()
    log.info("startup: spawning background tasks")
    _spawn(incident_loop(), name="incident_loop")
    _spawn(regular_clip_loop(), name="regular_clip_loop")
    _spawn(incident_backfill_loop(), name="incident_backfill_loop")
    log.info("startup: complete", n_tasks=len(_background_tasks))


@app.on_event("shutdown")
async def _shutdown() -> None:
    _stop_event.set()
    global _pool
    if _pool is not None:
        with contextlib.suppress(Exception):
            await _pool.close()
        _pool = None


@app.get("/health")
async def health() -> dict:
    pool_info: dict[str, int | bool] = {"open": _pool is not None}
    if _pool is not None:
        with contextlib.suppress(Exception):
            st = _pool.get_stats()
            pool_info["pool_size"] = st.get("pool_size", 0)
            pool_info["requests_waiting"] = st.get("requests_waiting", 0)
    return {
        "ok": True,
        "service": "ov-clip-builder",
        "pending": len(_pending_incidents),
        "db": pool_info,
    }
