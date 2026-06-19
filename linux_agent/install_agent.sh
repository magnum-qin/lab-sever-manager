#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/lab-server-manager}"
AGENT_BIND="${AGENT_BIND:-0.0.0.0}"
AGENT_PORT="${AGENT_PORT:-18180}"
AGENT_TOKEN="${AGENT_TOKEN:-}"
PROBE="$APP_DIR/dashboard_probe.sh"
AGENT="$APP_DIR/gpu-status-agent"
UPDATER="$APP_DIR/user_disk_cache_updater.sh"
LOG="$APP_DIR/gpu_status_agent.log"
UPDATER_LOG="$APP_DIR/user_disk_cache_updater.log"
ENV_FILE="$APP_DIR/gpu-status-agent.env"
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
AGENT_SERVICE="$SYSTEMD_USER_DIR/gpu-status-agent.service"
UPDATER_SERVICE="$SYSTEMD_USER_DIR/gpu-status-user-disk-cache.service"
CRON_MARKER="lab-server-manager agent autostart"

mkdir -p "$APP_DIR" "$SYSTEMD_USER_DIR"

if [ -n "${DOWNLOAD_URL:-}" ]; then
  echo "Downloading agent binaries and scripts from $DOWNLOAD_URL..."
  curl -sSL -f -o "$AGENT.tmp" "$DOWNLOAD_URL/gpu-status-agent"
  curl -sSL -f -o "$PROBE.tmp" "$DOWNLOAD_URL/dashboard_probe.sh"
  curl -sSL -f -o "$UPDATER.tmp" "$DOWNLOAD_URL/user_disk_cache_updater.sh"
  
  mv "$AGENT.tmp" "$AGENT"
  mv "$PROBE.tmp" "$PROBE"
  mv "$UPDATER.tmp" "$UPDATER"
  echo "Download complete."
fi

chmod +x "$PROBE" "$AGENT" "$UPDATER" "$0"

if [ -z "$AGENT_TOKEN" ] && [ -f "$ENV_FILE" ]; then
  AGENT_TOKEN="$(sed -n 's/^AGENT_TOKEN=//p' "$ENV_FILE" | tail -1)"
fi

umask 077
cat > "$ENV_FILE" <<EOF
DASHBOARD_PROBE=$PROBE
AGENT_BIND=$AGENT_BIND
AGENT_PORT=$AGENT_PORT
AGENT_TOKEN=$AGENT_TOKEN
EOF
chmod 600 "$ENV_FILE"
umask 022

cat > "$AGENT_SERVICE" <<EOF
[Unit]
Description=Lab GPU status agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=$ENV_FILE
ExecStart=$AGENT
Restart=always
RestartSec=5
WorkingDirectory=$APP_DIR
StandardOutput=append:$LOG
StandardError=append:$LOG

[Install]
WantedBy=default.target
EOF

cat > "$UPDATER_SERVICE" <<EOF
[Unit]
Description=Lab GPU status per-user disk cache updater
After=default.target

[Service]
Type=simple
ExecStart=/usr/bin/env bash $UPDATER
Restart=always
RestartSec=10
WorkingDirectory=$APP_DIR
StandardOutput=append:$UPDATER_LOG
StandardError=append:$UPDATER_LOG

[Install]
WantedBy=default.target
EOF

pkill -u "$(id -un)" -f '^du -sm /home/' 2>/dev/null || true
pkill -f "gpu_status_agent.py" 2>/dev/null || true
if command -v systemctl >/dev/null 2>&1; then
  systemctl --user stop gpu-status-agent.service gpu-status-user-disk-cache.service 2>/dev/null || true
fi
pids=$(pgrep -f "^$AGENT$" 2>/dev/null || true)
[ -n "$pids" ] && kill $pids 2>/dev/null || true
updater_pids=$(pgrep -f "^bash $UPDATER$" 2>/dev/null || true)
[ -n "$updater_pids" ] && kill $updater_pids 2>/dev/null || true
sleep 1

install_cron_fallback() {
  tmp="$(mktemp)"
  crontab -l 2>/dev/null | grep -v "$CRON_MARKER" > "$tmp" || true
  printf '@reboot APP_DIR=%q AGENT_BIND=%q AGENT_PORT=%q bash %q >> %q 2>&1 # %s\n' "$APP_DIR" "$AGENT_BIND" "$AGENT_PORT" "$APP_DIR/install_agent.sh" "$APP_DIR/agent_bootstrap.log" "$CRON_MARKER" >> "$tmp"
  crontab "$tmp" 2>/dev/null || true
  rm -f "$tmp"
}

install_cron_fallback

if command -v systemctl >/dev/null 2>&1; then
  systemctl --user daemon-reload 2>/dev/null || true
  if systemctl --user enable gpu-status-agent.service gpu-status-user-disk-cache.service >/dev/null 2>&1 && systemctl --user restart gpu-status-agent.service gpu-status-user-disk-cache.service >/dev/null 2>&1; then
    echo "systemd user services enabled and restarted"
  else
    pids=$(pgrep -f "^$AGENT$" 2>/dev/null || true)
    [ -n "$pids" ] && kill $pids 2>/dev/null || true
    updater_pids=$(pgrep -f "^bash $UPDATER$" 2>/dev/null || true)
    [ -n "$updater_pids" ] && kill $updater_pids 2>/dev/null || true
    nohup env DASHBOARD_PROBE="$PROBE" AGENT_BIND="$AGENT_BIND" AGENT_PORT="$AGENT_PORT" AGENT_TOKEN="$AGENT_TOKEN" "$AGENT" > "$LOG" 2>&1 < /dev/null &
    nohup bash "$UPDATER" > "$UPDATER_LOG" 2>&1 < /dev/null &
    echo "systemd user unavailable; started with nohup and installed @reboot crontab fallback"
  fi
else
  pids=$(pgrep -f "^$AGENT$" 2>/dev/null || true)
  [ -n "$pids" ] && kill $pids 2>/dev/null || true
  updater_pids=$(pgrep -f "^bash $UPDATER$" 2>/dev/null || true)
  [ -n "$updater_pids" ] && kill $updater_pids 2>/dev/null || true
  nohup env DASHBOARD_PROBE="$PROBE" AGENT_BIND="$AGENT_BIND" AGENT_PORT="$AGENT_PORT" AGENT_TOKEN="$AGENT_TOKEN" "$AGENT" > "$LOG" 2>&1 < /dev/null &
  nohup bash "$UPDATER" > "$UPDATER_LOG" 2>&1 < /dev/null &
  echo "systemd not found; started with nohup and installed @reboot crontab fallback"
fi

if command -v loginctl >/dev/null 2>&1; then
  loginctl enable-linger "$(id -un)" 2>/dev/null || true
fi

if [ -n "$AGENT_TOKEN" ]; then
  echo "go agent configured on $AGENT_BIND:$AGENT_PORT, token enabled, log: $LOG"
else
  echo "go agent configured on $AGENT_BIND:$AGENT_PORT, token disabled, log: $LOG"
fi
echo "user disk cache updater configured, log: $UPDATER_LOG"

