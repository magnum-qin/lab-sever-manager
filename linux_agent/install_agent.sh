#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/lab-server-manager}"
AGENT_PORT="${AGENT_PORT:-18180}"
PROBE="$APP_DIR/dashboard_probe.sh"
AGENT="$APP_DIR/gpu-status-agent"
LOG="$APP_DIR/gpu_status_agent.log"

mkdir -p "$APP_DIR"
chmod +x "$PROBE"
chmod +x "$AGENT"
pkill -x gpu-status-agent 2>/dev/null || true
pkill -f "gpu_status_agent.py" 2>/dev/null || true
nohup env DASHBOARD_PROBE="$PROBE" AGENT_PORT="$AGENT_PORT" "$AGENT" > "$LOG" 2>&1 < /dev/null &
echo "go agent started on 127.0.0.1:$AGENT_PORT, log: $LOG"
