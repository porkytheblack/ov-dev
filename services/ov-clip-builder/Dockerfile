FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY packages/shared-py /app/packages/shared-py
COPY services/ov-clip-builder /app/services/ov-clip-builder

RUN pip install --no-cache-dir /app/packages/shared-py \
    && pip install --no-cache-dir /app/services/ov-clip-builder

EXPOSE 8000
CMD ["uvicorn", "overwatch_clip_builder.main:app", "--host", "0.0.0.0", "--port", "8000"]
