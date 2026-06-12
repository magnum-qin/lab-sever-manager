#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/lab-server-manager}"
AGENT_BIND="${AGENT_BIND:-0.0.0.0}"
AGENT_PORT="${AGENT_PORT:-18180}"
AGENT_TOKEN="${AGENT_TOKEN:-suzuki-lab}"
PROBE="$APP_DIR/dashboard_probe.sh"
AGENT="$APP_DIR/gpu-status-agent"
UPDATER="$APP_DIR/user_disk_cache_updater.sh"
LOG="$APP_DIR/gpu_status_agent.log"
UPDATER_LOG="$APP_DIR/user_disk_cache_updater.log"

mkdir -p "$APP_DIR"
chmod +x "$PROBE"
chmod +x "$AGENT"
chmod +x "$UPDATER"
pids=$(pgrep -f "^$AGENT$" 2>/dev/null || true)
if [ -n "$pids" ]; then
  kill $pids 2>/dev/null || true
  sleep 1
fi
updater_pids=$(pgrep -f "^bash $UPDATER$" 2>/dev/null || true)
if [ -n "$updater_pids" ]; then
  kill $updater_pids 2>/dev/null || true
  sleep 1
fi
pkill -u "$(id -un)" -f '^du -sm /home/' 2>/dev/null || true
pkill -f "gpu_status_agent.py" 2>/dev/null || true
nohup env DASHBOARD_PROBE="$PROBE" AGENT_BIND="$AGENT_BIND" AGENT_PORT="$AGENT_PORT" AGENT_TOKEN="$AGENT_TOKEN" "$AGENT" > "$LOG" 2>&1 < /dev/null &
nohup bash "$UPDATER" > "$UPDATER_LOG" 2>&1 < /dev/null &
echo "go agent started on $AGENT_BIND:$AGENT_PORT, token enabled, log: $LOG"
echo "user disk cache updater started, log: $UPDATER_LOG"
