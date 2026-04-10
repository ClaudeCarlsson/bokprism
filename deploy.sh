#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$HOME/bokprism/deploy.log"
LOCK_FILE="/tmp/bokprism-deploy.lock"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Log rotation: truncate if > 1MB
if [ -f "$LOG_FILE" ]; then
  LOG_SIZE=$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
  if [ "$LOG_SIZE" -gt 1048576 ]; then
    tail -n 500 "$LOG_FILE" > "$LOG_FILE.tmp"
    mv "$LOG_FILE.tmp" "$LOG_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Log rotated (was ${LOG_SIZE} bytes)" >> "$LOG_FILE"
  fi
fi

# Prevent overlapping runs
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  exit 0
fi

cd "$REPO_DIR"

# Fetch latest from origin
git fetch origin main 2>>"$LOG_FILE" || {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: git fetch failed" >> "$LOG_FILE"
  exit 1
}

LOCAL_HEAD=$(git rev-parse HEAD)
REMOTE_HEAD=$(git rev-parse origin/main)

# Nothing to do if already up to date
if [ "$LOCAL_HEAD" = "$REMOTE_HEAD" ]; then
  exit 0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Change detected: $LOCAL_HEAD -> $REMOTE_HEAD" >> "$LOG_FILE"

# Reset to remote (avoids merge conflicts on force-pushed branches)
git reset --hard origin/main >> "$LOG_FILE" 2>&1 || {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: git reset failed" >> "$LOG_FILE"
  exit 1
}

# Build and deploy
if cd "$REPO_DIR/infra" && docker compose up -d --build >> "$LOG_FILE" 2>&1; then
  SHORT_HASH=$(git -C "$REPO_DIR" rev-parse --short HEAD)
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deployed successfully: $SHORT_HASH" >> "$LOG_FILE"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: docker compose build failed" >> "$LOG_FILE"
fi
