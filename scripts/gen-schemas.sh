#!/usr/bin/env bash
# Regenerate Pydantic models from packages/schemas/src/events.ts.
set -euo pipefail
cd "$(dirname "$0")/.."
npx tsx packages/schemas/build.ts
echo "OK"
