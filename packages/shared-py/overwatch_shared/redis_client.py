"""Redis Streams helper compatible with the TS createGroupConsumer wire format."""

from __future__ import annotations

import asyncio
import json
import os
from collections.abc import Callable, Awaitable
from typing import Any

import redis.asyncio as aioredis


def make_redis() -> aioredis.Redis:
    url = os.environ.get("REDIS_URL", "redis://redis:6379")
    return aioredis.from_url(url, decode_responses=True)


def _encode(payload: dict[str, Any]) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in payload.items():
        out[k] = v if isinstance(v, str) else json.dumps(v, default=str, separators=(",", ":"))
    return out


def _decode(fields: dict[str, str]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, raw in fields.items():
        if raw and raw[0] in "{[":
            try:
                out[k] = json.loads(raw)
                continue
            except json.JSONDecodeError:
                pass
        if raw == "true":
            out[k] = True
        elif raw == "false":
            out[k] = False
        else:
            out[k] = raw
    return out


async def publish_event(
    redis: aioredis.Redis,
    stream: str,
    payload: dict[str, Any],
    *,
    maxlen: int | None = None,
    approximate: bool = True,
) -> str:
    # `frames.<cid>` is the one unbounded firehose: the ingestor samples frames
    # far faster than CPU YOLO can drain them, so with no cap the detector
    # consumer group falls hours behind and the live bbox overlay only ever
    # shows stale (usually empty) detections. `consume_group` reads ">", so
    # MAXLEN-trimmed entries are simply skipped — bounding the stream bounds
    # the worst-case detector lag and keeps the overlay near-live. Other
    # streams (detections/incidents/status) stay uncapped (maxlen=None).
    if maxlen is not None:
        msg_id = await redis.xadd(
            stream, _encode(payload), maxlen=maxlen, approximate=approximate
        )
    else:
        msg_id = await redis.xadd(stream, _encode(payload))
    return msg_id


async def ensure_group(redis: aioredis.Redis, stream: str, group: str) -> None:
    try:
        await redis.xgroup_create(stream, group, id="$", mkstream=True)
    except aioredis.ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise


async def consume_group(
    redis: aioredis.Redis,
    stream: str,
    group: str,
    consumer: str,
    handler: Callable[[dict[str, Any], str], Awaitable[None]],
    *,
    block_ms: int = 5000,
    count: int = 16,
    stop_event: asyncio.Event | None = None,
) -> None:
    await ensure_group(redis, stream, group)
    while stop_event is None or not stop_event.is_set():
        try:
            res = await redis.xreadgroup(
                groupname=group,
                consumername=consumer,
                streams={stream: ">"},
                count=count,
                block=block_ms,
            )
        except Exception:
            await asyncio.sleep(1)
            continue
        if not res:
            continue
        for _, messages in res:
            for msg_id, fields in messages:
                try:
                    event = _decode(fields)
                    await handler(event, msg_id)
                except Exception:
                    pass
                finally:
                    await redis.xack(stream, group, msg_id)
