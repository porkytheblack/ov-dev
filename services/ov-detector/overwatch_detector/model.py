"""YOLO11L wrapper. The model + tracker are loaded once at module import.

The detector falls back to a NO-OP class list when ultralytics is not installable
in the build environment — keeps `GET /classes` and `/health` working even before
weights are present, so the rest of the stack can be exercised without a GPU.
"""

from __future__ import annotations

import os
import threading
from typing import Any

import numpy as np

# COCO classes (80) — the YOLO11 default head. Hard-coded so `/classes` works
# even when weights haven't been downloaded yet.
COCO_CLASSES = [
    "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck",
    "boat", "traffic light", "fire hydrant", "stop sign", "parking meter", "bench",
    "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra",
    "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
    "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove",
    "skateboard", "surfboard", "tennis racket", "bottle", "wine glass", "cup",
    "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
    "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch",
    "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
    "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
    "refrigerator", "book", "clock", "vase", "scissors", "teddy bear",
    "hair drier", "toothbrush",
]


class Detector:
    def __init__(self) -> None:
        self.model: Any = None
        self.tracker_cfg = os.environ.get("TRACKER_CONFIG", "botsort.yaml")
        self.device = os.environ.get("DEVICE", "cpu")
        # Default to the nano model: on CPU, YOLO11L manages ~1 detection per
        # ~12s per camera with several cameras — far too sparse to ever catch
        # a person who's only in frame for a few seconds, so the live overlay
        # looks empty. yolo11n is ~10x faster and still detects people well.
        # Override MODEL_PATH (e.g. /models/yolo11l.pt) on a GPU box.
        self.model_path = os.environ.get("MODEL_PATH", "/models/yolo11n.pt")
        self.conf_threshold = float(os.environ.get("CONFIDENCE_THRESHOLD", "0.35"))
        self.iou_threshold = float(os.environ.get("IOU_THRESHOLD", "0.45"))
        # Smaller inference size = faster CPU inference. 480 keeps people
        # detectable while roughly halving compute vs the 640 default.
        self.imgsz = int(os.environ.get("IMGSZ", "480"))
        self._lock = threading.Lock()
        self._load_attempted = False
        self._load_error: str | None = None

    def _try_load(self) -> None:
        if self._load_attempted:
            return
        self._load_attempted = True
        try:
            from ultralytics import YOLO  # type: ignore
            self.model = YOLO(self.model_path)
        except Exception as e:
            self._load_error = str(e)
            self.model = None

    @property
    def class_names(self) -> list[str]:
        self._try_load()
        if self.model is not None:
            try:
                names = self.model.names
                if isinstance(names, dict):
                    return [names[i] for i in sorted(names.keys())]
                return list(names)
            except Exception:
                pass
        return COCO_CLASSES

    def detect(self, image: np.ndarray, camera_id: str) -> list[dict]:
        """Returns a list of dicts: { class, confidence, bbox{x,y,w,h}, track_id? }.
        bbox is normalized 0..1 by the original image dims.
        """
        self._try_load()
        if self.model is None:
            return []
        h, w = image.shape[:2]
        with self._lock:
            results = self.model.track(
                image,
                persist=True,
                tracker=self.tracker_cfg,
                conf=self.conf_threshold,
                iou=self.iou_threshold,
                imgsz=self.imgsz,
                device=self.device,
                verbose=False,
            )
        out: list[dict] = []
        if not results:
            return out
        r = results[0]
        if r.boxes is None:
            return out
        boxes = r.boxes
        xyxy = boxes.xyxy.cpu().numpy() if hasattr(boxes.xyxy, "cpu") else np.asarray(boxes.xyxy)
        confs = boxes.conf.cpu().numpy() if hasattr(boxes.conf, "cpu") else np.asarray(boxes.conf)
        cls = boxes.cls.cpu().numpy() if hasattr(boxes.cls, "cpu") else np.asarray(boxes.cls)
        ids = None
        if getattr(boxes, "id", None) is not None:
            ids = boxes.id.cpu().numpy() if hasattr(boxes.id, "cpu") else np.asarray(boxes.id)
        names = r.names if hasattr(r, "names") else self.class_names
        for i in range(len(xyxy)):
            x1, y1, x2, y2 = xyxy[i]
            class_name = names[int(cls[i])] if int(cls[i]) < len(names) else str(int(cls[i]))
            d = {
                "class": class_name,
                "confidence": float(confs[i]),
                "bbox": {
                    "x": float(x1 / w),
                    "y": float(y1 / h),
                    "w": float((x2 - x1) / w),
                    "h": float((y2 - y1) / h),
                },
            }
            if ids is not None:
                d["track_id"] = f"{camera_id}:{int(ids[i])}"
            out.append(d)
        return out


detector_singleton = Detector()
