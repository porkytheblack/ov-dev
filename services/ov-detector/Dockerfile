FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY packages/shared-py /app/packages/shared-py
COPY services/ov-detector /app/services/ov-detector

RUN pip install --no-cache-dir /app/packages/shared-py \
    && pip install --no-cache-dir /app/services/ov-detector

# Model weights are mounted at /models via the docker-compose `models` volume.
# Ultralytics will auto-download to /models on first use if the path is writable.
RUN mkdir -p /models

EXPOSE 8000
CMD ["uvicorn", "overwatch_detector.main:app", "--host", "0.0.0.0", "--port", "8000"]
