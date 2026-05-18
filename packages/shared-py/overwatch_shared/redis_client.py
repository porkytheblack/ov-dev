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

    async def _process(messages: Any) -> None:
        for msg_id, fields in messages:
            try:
                event = _decode(fields)
                await handler(event, msg_id)
            except Exception:
                pass
            finally:
                await redis.xack(stream, group, msg_id)

    # Reclaim messages orphaned by a consumer that died/restarted so events
    # are never silently dropped. Must NEVER block the main read: throttled
    # and hard-timeboxed (a hung xautoclaim during a reconnect would
    # otherwise freeze the consumer — observed killing clip/alert delivery).
    reclaim_idle_ms = 30_000
    reclaim_every_s = 30.0
    reclaim_budget_s = 4.0
    last_reclaim = 0.0

    async def _reclaim_stale() -> None:
        cursor = "0-0"
        for _ in range(5):
            out = await redis.xautoclaim(
                stream, group, consumer, reclaim_idle_ms, start_id=cursor, count=count
            )
            # Redis >=7 returns (cursor, claimed, deleted); 6.2 returns (cursor, claimed)
            cursor = out[0]
            claimed = out[1] if len(out) > 1 else []
            if claimed:
                await _process(claimed)
            if not cursor or cursor in ("0-0", b"0-0"):
                break

    async def _try_reclaim() -> None:
        nonlocal last_reclaim
        now = asyncio.get_event_loop().time()
        if now - last_reclaim < reclaim_every_s:
            return
        last_reclaim = now
        try:
            await asyncio.wait_for(_reclaim_stale(), timeout=reclaim_budget_s)
        except Exception:
            pass  # timeout / unsupported / transient — keep consuming

    while stop_event is None or not stop_event.is_set():
        try:
            await _try_reclaim()
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
            await _process(messages)
