#!/usr/bin/env bash
set -euo pipefail

COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "dev")
BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "Building with GIT_COMMIT=${COMMIT_HASH} BUILD_TIME=${BUILD_TIME}" >&2

# Build API with version metadata
WEB_PORT=8001 docker compose build --build-arg GIT_COMMIT="${COMMIT_HASH}" --build-arg BUILD_TIME="${BUILD_TIME}" api
# Build web (no need for build args currently)
WEB_PORT=8001 docker compose build web

# Bring up (api first for dependency ordering)
WEB_PORT=8001 docker compose up -d --no-deps api
WEB_PORT=8001 docker compose up -d web

echo "Deployed containers:" >&2
docker compose ps
