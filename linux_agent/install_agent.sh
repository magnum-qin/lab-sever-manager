#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/lab-server-manager}"
AGENT_BIND="${AGENT_BIND:-0.0.0.0}"
AGENT_PORT="${AGENT_PORT:-18180}"
AGENT_TOKEN="${AGENT_TOKEN:-suzuki-lab}"
PROBE="$APP_DIR/dashboard_probe.sh"
AGENT="$APP_DIR/gpu-status-agent"
LOG="$APP_DIR/gpu_status_agent.log"

mkdir -p "$APP_DIR"
chmod +x "$PROBE"
chmod +x "$AGENT"
pids=$(pgrep -f "^$AGENT$" 2>/dev/null || true)
if [ -n "$pids" ]; then
  kill $pids 2>/dev/null || true
  sleep 1
fi
pkill -f "gpu_status_agent.py" 2>/dev/null || true
nohup env DASHBOARD_PROBE="$PROBE" AGENT_BIND="$AGENT_BIND" AGENT_PORT="$AGENT_PORT" AGENT_TOKEN="$AGENT_TOKEN" "$AGENT" > "$LOG" 2>&1 < /dev/null &
echo "go agent started on $AGENT_BIND:$AGENT_PORT, token enabled, log: $LOG"
