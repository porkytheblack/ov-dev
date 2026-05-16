FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=600 \
    PIP_RETRIES=5

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY packages/shared-py /app/packages/shared-py
COPY services/ov-ingestor /app/services/ov-ingestor

RUN pip install --no-cache-dir /app/packages/shared-py \
    && pip install --no-cache-dir /app/services/ov-ingestor

EXPOSE 8000
CMD ["uvicorn", "overwatch_ingestor.main:app", "--host", "0.0.0.0", "--port", "8000"]
