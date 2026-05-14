"""Consume clip.ready (incident kind only), sample frames, ask the configured
local VLM (LM Studio-compatible OpenAI API) for a 1-2 sentence summary, write
back to incidents.summary, publish summary.ready."""

from __future__ import annotations

import asyncio
import base64
import contextlib
import io
import json
import os
import tempfile
from datetime import datetime
from pathlib import Path

import cv2
import httpx
import psycopg
from fastapi import FastAPI
from overwatch_shared import (
    BUCKETS,
    consume_group,
    get_logger,
    make_minio,
    make_redis,
    publish_event,
)

log = get_logger("ov-vlm")
app = FastAPI(title="ov-vlm")
_stop_event = asyncio.Event()


def _db_url() -> str:
    return os.environ.get(
        "DATABASE_URL", "postgres://overwatch:overwatch@postgres:5432/overwatch"
    )


async def _get_incident_context(incident_id: str) -> dict | None:
    async with await psycopg.AsyncConnection.connect(_db_url()) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT i.id, i.camera_id, i.classes, i.opened_at, i.closed_at,
                       c.vlm_enabled, c.frame_context
                  FROM incidents i
                  JOIN cameras c ON c.id = i.camera_id
                 WHERE i.id = %s
                """,
                (incident_id,),
            )
            row = await cur.fetchone()
            if not row:
                return None
            (iid, camera_id, classes, opened_at, closed_at, vlm_enabled, frame_context) = row
            if not vlm_enabled:
                return None
            duration = 0.0
            if closed_at and opened_at:
                duration = (closed_at - opened_at).total_seconds()
            return {
                "incident_id": str(iid),
                "camera_id": str(camera_id),
                "classes": classes or [],
                "duration_seconds": duration,
                "frame_context": frame_context or {},
            }


async def _mark_pending(incident_id: str) -> None:
    async with await psycopg.AsyncConnection.connect(_db_url()) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "UPDATE incidents SET summary_status = 'pending' WHERE id = %s",
                (incident_id,),
            )
        await conn.commit()


async def _save_summary(incident_id: str, summary: str, status: str = "ready") -> None:
    async with await psycopg.AsyncConnection.connect(_db_url()) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "UPDATE incidents SET summary = %s, summary_status = %s WHERE id = %s",
                (summary, status, incident_id),
            )
        await conn.commit()


def _sample_frames(clip_local_path: Path, n: int) -> list[bytes]:
    cap = cv2.VideoCapture(str(clip_local_path))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    out: list[bytes] = []
    if total <= 0:
        return out
    indices = [max(0, int((i + 1) * total / (n + 1))) for i in range(n)]
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, frame = cap.read()
        if not ok:
            continue
        _, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
        out.append(buf.tobytes())
    cap.release()
    return out


async def _call_vlm(prompt: str, image_bytes_list: list[bytes]) -> str:
    endpoint = os.environ.get("VLM_ENDPOINT", "http://lmstudio:1234/v1")
    model = os.environ.get("VLM_MODEL", "gemma3-it-vision")
    content: list[dict] = [{"type": "text", "text": prompt}]
    for b in image_bytes_list:
        b64 = base64.b64encode(b).decode("ascii")
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
            }
        )
    body = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "max_tokens": 160,
        "temperature": 0.2,
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(f"{endpoint.rstrip('/')}/chat/completions", json=body)
        r.raise_for_status()
        data = r.json()
        return data["choices"][0]["message"]["content"].strip()


def _build_prompt(ctx: dict) -> str:
    description = ctx.get("frame_context", {}).get("description", "")
    classes = ", ".join(ctx.get("classes", []))
    return (
        "You are summarizing a security incident clip. "
        f"Context about this camera's scene: {description or 'unknown scene'}. "
        f"Detected classes: {classes}. "
        f"Incident duration: {ctx.get('duration_seconds', 0):.0f}s.\n\n"
        "Describe what is happening in 1-2 sentences. Be specific and factual. "
        "Do not speculate."
    )


async def handle_clip_ready(event: dict, _msg_id: str) -> None:
    if event.get("type") != "clip.ready" or event.get("kind") != "incident":
        return
    iid = event.get("incident_id")
    if not iid:
        return
    ctx = await _get_incident_context(iid)
    if ctx is None:
        return
    await _mark_pending(iid)
    work = Path(tempfile.mkdtemp(prefix=f"ov-vlm-{iid}-"))
    minio = make_minio()
    try:
        local = work / "clip.mp4"
        minio.fget_object(BUCKETS["clips"], event["storage_key"], str(local))
        frames = _sample_frames(local, int(os.environ.get("SAMPLE_FRAMES_PER_CLIP", "8")))
        if not frames:
            await _save_summary(iid, "", status="failed")
            return
        prompt = _build_prompt(ctx)
        try:
            summary = await _call_vlm(prompt, frames)
        except Exception as e:
            log.warning("VLM call failed", error=str(e), incident_id=iid)
            await _save_summary(iid, "", status="failed")
            return
        await _save_summary(iid, summary, status="ready")
        await publish_event(
            make_redis(),
            "summaries",
            {"type": "summary.ready", "incident_id": iid, "summary": summary},
        )
        log.info("summary ready", incident_id=iid)
    finally:
        import shutil
        shutil.rmtree(work, ignore_errors=True)


async def main_loop() -> None:
    redis = make_redis()
    await consume_group(
        redis,
        "clips",
        "cg.ov-vlm",
        f"vlm-{os.environ.get('HOSTNAME', 'local')}",
        handle_clip_ready,
        stop_event=_stop_event,
    )


@app.on_event("startup")
async def _startup() -> None:
    asyncio.create_task(main_loop())


@app.on_event("shutdown")
async def _shutdown() -> None:
    _stop_event.set()


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "service": "ov-vlm"}
