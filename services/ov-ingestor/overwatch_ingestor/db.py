"""Direct psycopg async access. Single-table exception per build spec: the ingestor
writes the `segments` table directly so the segment-to-clip pipeline stays Python."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

import psycopg
from psycopg.rows import dict_row


def get_db_url() -> str:
    return os.environ.get(
        "DATABASE_URL",
        "postgres://overwatch:overwatch@postgres:5432/overwatch",
    )


async def fetch_cameras() -> list[dict]:
    async with await psycopg.AsyncConnection.connect(get_db_url(), row_factory=dict_row) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT id, name, rtsp_url, enabled, sample_fps, status "
                "FROM cameras WHERE enabled = true"
            )
            return await cur.fetchall()


async def upsert_camera_status(camera_id: str, status: str, last_frame_at: datetime | None = None) -> None:
    async with await psycopg.AsyncConnection.connect(get_db_url()) as conn:
        async with conn.cursor() as cur:
            if last_frame_at is not None:
                await cur.execute(
                    "UPDATE cameras SET status = %s, last_frame_at = %s, updated_at = now() "
                    "WHERE id = %s",
                    (status, last_frame_at, camera_id),
                )
            else:
                await cur.execute(
                    "UPDATE cameras SET status = %s, updated_at = now() WHERE id = %s",
                    (status, camera_id),
                )
        await conn.commit()


async def insert_segment(
    camera_id: str,
    start_ts: datetime,
    end_ts: datetime,
    storage_key: str,
    duration_ms: int,
    size_bytes: int,
    retention_days: int = 7,
) -> str:
    segment_id = str(uuid.uuid4())
    retention_until = end_ts + timedelta(days=retention_days)
    async with await psycopg.AsyncConnection.connect(get_db_url()) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO segments
                  (id, camera_id, start_ts, end_ts, storage_key, duration_ms, size_bytes, retention_until)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    segment_id,
                    camera_id,
                    start_ts,
                    end_ts,
                    storage_key,
                    duration_ms,
                    size_bytes,
                    retention_until,
                ),
            )
        await conn.commit()
    return segment_id


def now_utc() -> datetime:
    return datetime.now(timezone.utc)
