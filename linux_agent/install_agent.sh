#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/lab-server-manager}"
AGENT_PORT="${AGENT_PORT:-18180}"
PROBE="$APP_DIR/dashboard_probe.sh"
AGENT="$APP_DIR/gpu_status_agent.py"
LOG="$APP_DIR/gpu_status_agent.log"

mkdir -p "$APP_DIR"
chmod +x "$PROBE"
pkill -f "python3 $AGENT" 2>/dev/null || true
nohup env DASHBOARD_PROBE="$PROBE" AGENT_PORT="$AGENT_PORT" python3 "$AGENT" > "$LOG" 2>&1 < /dev/null &
echo "agent started on 127.0.0.1:$AGENT_PORT, log: $LOG"
