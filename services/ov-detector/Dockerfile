FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=600 \
    PIP_RETRIES=5

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pre-install CPU-only torch from PyTorch's CPU index so ultralytics
# doesn't drag in 2GB+ of CUDA wheels transitively. Override the index
# at build time with --build-arg TORCH_INDEX=... for a GPU build.
ARG TORCH_INDEX=https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir --index-url ${TORCH_INDEX} \
      torch torchvision

COPY packages/shared-py /app/packages/shared-py
COPY services/ov-detector /app/services/ov-detector

RUN pip install --no-cache-dir /app/packages/shared-py \
    && pip install --no-cache-dir /app/services/ov-detector

# Model weights live at /models. Ultralytics auto-downloads on first use
# when the path is writable; mounted via the `models` named volume.
RUN mkdir -p /models

EXPOSE 8000
CMD ["uvicorn", "overwatch_detector.main:app", "--host", "0.0.0.0", "--port", "8000"]
