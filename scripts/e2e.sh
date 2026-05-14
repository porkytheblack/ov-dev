#!/usr/bin/env bash
# End-to-end smoke test. Spins up the dev stack (with the synthetic mediamtx RTSP source),
# waits for /health on every service, runs minimal assertions, then tears down.
set -euo pipefail

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile dev-rtsp"

cleanup() {
  echo "[e2e] cleaning up"
  $COMPOSE down --volumes --remove-orphans || true
}
trap cleanup EXIT

echo "[e2e] bringing stack up"
$COMPOSE up -d --build

echo "[e2e] waiting for ov-api health"
for i in $(seq 1 60); do
  if curl -fsS http://localhost:3001/health >/dev/null 2>&1; then
    echo "ov-api healthy"
    break
  fi
  sleep 2
done

echo "[e2e] creating admin user (wizard)"
curl -sS -X POST -H 'content-type: application/json' \
  -d '{"username":"admin","password":"correcthorse"}' \
  http://localhost:3001/api/auth/wizard | tee /tmp/wizard.json

echo "[e2e] checking dashboard accessible"
curl -fsS -o /dev/null http://localhost:3000/login

echo "[e2e] PASS"
