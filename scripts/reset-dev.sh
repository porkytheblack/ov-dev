#!/usr/bin/env bash
# Nuke local dev volumes and recreate. Stick on prod data and you will lose it.
set -euo pipefail
docker compose down --volumes --remove-orphans
docker compose up -d --build
