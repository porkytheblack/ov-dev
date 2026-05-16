/**
 * Codegen: emit Pydantic models from event Zod schemas.
 * Run via: pnpm codegen (or scripts/gen-schemas.sh).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "pygen", "events.py");

const PY = `# AUTO-GENERATED. Do not edit by hand. Source: packages/schemas/src/events.ts
from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class Bbox(BaseModel):
    x: float
    y: float
    w: float
    h: float


class Detection(BaseModel):
    cls: str = Field(..., alias="class")
    confidence: float
    bbox: Bbox
    track_id: Optional[str] = None

    class Config:
        populate_by_name = True


class FrameSampled(BaseModel):
    type: Literal["frame.sampled"] = "frame.sampled"
    camera_id: str
    ts: str
    frame_id: str
    storage_key: str
    width: Optional[int] = None
    height: Optional[int] = None


class FrameDetections(BaseModel):
    type: Literal["frame.detections"] = "frame.detections"
    camera_id: str
    ts: str
    frame_id: str
    detections: List[Detection]


class SegmentReady(BaseModel):
    type: Literal["segment.ready"] = "segment.ready"
    camera_id: str
    segment_id: str
    start_ts: str
    end_ts: str
    storage_key: str
    duration_ms: int
    size_bytes: int


class IncidentOpened(BaseModel):
    type: Literal["incident.opened"] = "incident.opened"
    incident_id: str
    camera_id: str
    roi_id: str
    classes: List[str]
    opened_at: str
    track_id: Optional[str] = None


class IncidentClosed(BaseModel):
    type: Literal["incident.closed"] = "incident.closed"
    incident_id: str
    closed_at: str
    duration_ms: int


class ClipReady(BaseModel):
    type: Literal["clip.ready"] = "clip.ready"
    clip_id: str
    incident_id: Optional[str] = None
    camera_id: str
    kind: Literal["incident", "regular"]
    storage_key: str
    poster_key: Optional[str] = None
    start_ts: str
    end_ts: str


class SummaryReady(BaseModel):
    type: Literal["summary.ready"] = "summary.ready"
    incident_id: str
    summary: str


class CameraStatusChanged(BaseModel):
    type: Literal["camera.status_changed"] = "camera.status_changed"
    camera_id: str
    status: Literal["connecting", "online", "offline"]
    ts: str


def frames_stream(camera_id: str) -> str:
    return f"frames.{camera_id}"


def detections_stream(camera_id: str) -> str:
    return f"detections.{camera_id}"


SEGMENTS_STREAM = "segments"
INCIDENTS_STREAM = "incidents"
CLIPS_STREAM = "clips"
SUMMARIES_STREAM = "summaries"
CAMERA_STATUS_STREAM = "camera_status"


def consumer_group(service: str) -> str:
    return f"cg.{service}"
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, PY, "utf8");
console.log(`Wrote ${OUT}`);
