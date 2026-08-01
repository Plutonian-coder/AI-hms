#!/usr/bin/env bash
# Redeploy the HMS backend on the EC2 instance.
# Run this from ~/AI-hms on the instance itself (via SSH), after the first-time
# setup in infra/ec2/SETUP.md has been done once.
set -euo pipefail

cd "$(dirname "$0")/../.."   # repo root

echo "==> Pulling latest code"
git pull

echo "==> Building image"
docker build -t hms-backend ./backend

echo "==> Replacing running container"
docker stop hms-backend 2>/dev/null || true
docker rm hms-backend 2>/dev/null || true

# Bound to localhost only — Nginx is the sole public entry point (80/443).
docker run -d \
    --name hms-backend \
    --restart unless-stopped \
    --env-file ./backend/.env \
    -e PORT=8000 \
    -p 127.0.0.1:8000:8000 \
    hms-backend

echo "==> Waiting for health check"
for i in $(seq 1 15); do
    if curl -sf http://127.0.0.1:8000/health > /dev/null; then
        echo "==> Healthy"
        exit 0
    fi
    sleep 2
done

echo "==> FAILED health check — check logs with: docker logs hms-backend"
exit 1
