"""MinIO client helper, with the same buckets the TS side knows about."""

from __future__ import annotations

import os

from minio import Minio


BUCKETS = {
    "segments": os.environ.get("MINIO_BUCKET_SEGMENTS", "overwatch-segments"),
    "frames": os.environ.get("MINIO_BUCKET_FRAMES", "overwatch-frames"),
    "clips": os.environ.get("MINIO_BUCKET_CLIPS", "overwatch-clips"),
}


def make_minio() -> Minio:
    endpoint = os.environ.get("MINIO_ENDPOINT", "minio:9000").replace("http://", "").replace("https://", "")
    use_ssl = os.environ.get("MINIO_USE_SSL", "false").lower() == "true"
    return Minio(
        endpoint,
        access_key=os.environ.get("MINIO_ACCESS_KEY", "overwatch"),
        secret_key=os.environ.get("MINIO_SECRET_KEY", "overwatch-secret"),
        secure=use_ssl,
    )


def ensure_buckets(client: Minio) -> None:
    for bucket in BUCKETS.values():
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)
