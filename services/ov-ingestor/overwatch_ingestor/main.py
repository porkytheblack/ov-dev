"""Entry point. Reconciles the live camera list every 60s; spawns/teardown workers
and restarts them when rtsp_url or sample_fps changes."""

from __future__ import annotations

import asyncio
import contextlib

from fastapi import FastAPI
from overwatch_shared import ensure_buckets, get_logger, make_minio, make_redis

from .camera_worker import CameraWorker
from .db import fetch_cameras

log = get_logger("ov-ingestor")
app = FastAPI(title="ov-ingestor")

_workers: dict[str, CameraWorker] = {}
_reconcile_task: asyncio.Task | None = None
_stop_event = asyncio.Event()


def _worker_outdated(worker: CameraWorker, row: dict) -> bool:
    """Detect changes that require a worker restart (URL, fps)."""
    cur_rtsp = str(worker.camera.get("rtsp_url"))
    cur_fps = int(worker.camera.get("sample_fps", 5) or 5)
    new_rtsp = str(row.get("rtsp_url"))
    new_fps = int(row.get("sample_fps", 5) or 5)
    return cur_rtsp != new_rtsp or cur_fps != new_fps


async def reconcile_loop() -> None:
    redis = make_redis()
    minio = make_minio()
    try:
        ensure_buckets(minio)
    except Exception as e:
        log.warning("ensure_buckets failed (will retry)", error=str(e))
    while not _stop_event.is_set():
        try:
            rows = await fetch_cameras()
            by_id = {str(r["id"]): r for r in rows}

            # Stop removed cameras.
            for cid in list(_workers.keys()):
                if cid not in by_id:
                    await _workers[cid].stop()
                    del _workers[cid]
                    log.info("stopped worker", camera_id=cid)

            # Start / restart cameras.
            for cid, row in by_id.items():
                existing = _workers.get(cid)
                if existing is None:
                    w = CameraWorker(row, redis, minio)
                    await w.start()
                    _workers[cid] = w
                    log.info("started worker", camera_id=cid, name=row.get("name"))
                elif _worker_outdated(existing, row):
                    log.info(
                        "restarting worker (config changed)",
                        camera_id=cid,
                        old_rtsp=existing.camera.get("rtsp_url"),
                        new_rtsp=row.get("rtsp_url"),
                        old_fps=existing.camera.get("sample_fps"),
                        new_fps=row.get("sample_fps"),
                    )
                    await existing.stop()
                    w = CameraWorker(row, redis, minio)
                    await w.start()
                    _workers[cid] = w
                else:
                    # Cheap fields (name) — just refresh the in-memory row so
                    # /health reflects the latest values.
                    existing.camera = row
        except Exception as e:
            log.error("reconcile failed", error=str(e))
        try:
            await asyncio.wait_for(_stop_event.wait(), timeout=15)
        except asyncio.TimeoutError:
            pass


@app.on_event("startup")
async def _on_startup() -> None:
    global _reconcile_task
    _reconcile_task = asyncio.create_task(reconcile_loop())


@app.on_event("shutdown")
async def _on_shutdown() -> None:
    _stop_event.set()
    for cid, w in list(_workers.items()):
        with contextlib.suppress(Exception):
            await w.stop()
    if _reconcile_task:
        with contextlib.suppress(Exception):
            await _reconcile_task


@app.get("/health")
async def health() -> dict:
    return {
        "ok": True,
        "service": "ov-ingestor",
        "cameras": {
            cid: {
                "running": True,
                "rtsp_url": w.camera.get("rtsp_url"),
                "sample_fps": w.camera.get("sample_fps"),
                "name": w.camera.get("name"),
            }
            for cid, w in _workers.items()
        },
    }
