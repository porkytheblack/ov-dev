"""Entry point. Reconciles the live camera list every 60s; spawns/teardown workers."""

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
            ids = {str(r["id"]) for r in rows}
            # Stop removed cameras.
            for cid in list(_workers.keys()):
                if cid not in ids:
                    await _workers[cid].stop()
                    del _workers[cid]
                    log.info("stopped worker", camera_id=cid)
            # Start new cameras.
            for row in rows:
                cid = str(row["id"])
                if cid not in _workers:
                    w = CameraWorker(row, redis, minio)
                    await w.start()
                    _workers[cid] = w
                    log.info("started worker", camera_id=cid, name=row.get("name"))
        except Exception as e:
            log.error("reconcile failed", error=str(e))
        try:
            await asyncio.wait_for(_stop_event.wait(), timeout=60)
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
        "cameras": {cid: {"running": True} for cid in _workers},
    }
